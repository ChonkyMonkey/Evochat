import React, { useState, useEffect } from 'react';

function PaddleCheckoutButton() {
  const [priceId, setPriceId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paddleInitialized, setPaddleInitialized] = useState(false);

  useEffect(() => {
    // Initialize Paddle.js
    if (window.Paddle) {
      window.Paddle.Initialize({
        environment: 'sandbox', // Use 'sandbox' for testing
        pw: 'test', // Required for sandbox environment
      });
      setPaddleInitialized(true);
    } else {
      console.warn('Paddle.js not loaded. Make sure the script is included in index.html');
      setError('Paddle.js not loaded.');
      return;
    }

    // Fetch price ID from backend
    const fetchPriceId = async () => {
      try {
        const response = await fetch('/api/paddle/checkout-data');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch price ID');
        }
        const data = await response.json();
        setPriceId(data.priceId);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (paddleInitialized) {
      fetchPriceId();
    }

    // Set up Paddle event listeners
    const handleCheckoutLoaded = (event) => {
      console.log('Paddle checkout loaded:', event);
    };

    const handleCheckoutCustomerCreated = (event) => {
      console.log('Paddle checkout customer created:', event);
    };

    const handleCheckoutSuccess = (event) => {
      console.log('Paddle checkout success:', event);
      // You would typically verify this on your backend
      alert('Checkout successful! Check console for details.');
    };

    const handleCheckoutClose = () => {
      console.log('Paddle checkout closed.');
    };

    window.Paddle.Status.on('checkout.loaded', handleCheckoutLoaded);
    window.Paddle.Status.on('checkout.customer.created', handleCheckoutCustomerCreated);
    window.Paddle.Status.on('checkout.completed', handleCheckoutSuccess);
    window.Paddle.Status.on('checkout.closed', handleCheckoutClose);

    // Clean up event listeners on component unmount
    return () => {
      if (window.Paddle) {
        window.Paddle.Status.off('checkout.loaded', handleCheckoutLoaded);
        window.Paddle.Status.off('checkout.customer.created', handleCheckoutCustomerCreated);
        window.Paddle.Status.off('checkout.completed', handleCheckoutSuccess);
        window.Paddle.Status.off('checkout.closed', handleCheckoutClose);
      }
    };
  }, [paddleInitialized]);

  const handleOpenCheckout = () => {
    if (window.Paddle && priceId) {
      window.Paddle.Checkout.open({
        items: [{ priceId: priceId, quantity: 1 }],
      });
    } else {
      console.warn('Paddle.js not ready or priceId not available.');
      setError('Paddle.js not ready or price ID missing.');
    }
  };

  if (isLoading) {
    return <div style={{ padding: '20px', margin: '20px' }}>Loading Paddle checkout data...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', margin: '20px', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px' }}>
      <h2>Buy with Paddle</h2>
      <p>Product Price ID: <strong>{priceId || 'N/A'}</strong></p>
      <button onClick={handleOpenCheckout} disabled={!priceId} style={{ padding: '10px 15px', cursor: 'pointer' }}>
        Open Paddle Checkout
      </button>
      {!priceId && <p style={{ color: 'orange' }}>Waiting for price ID from backend...</p>}
      <p style={{ fontSize: '0.8em', color: '#666', marginTop: '10px' }}>
        Check your browser's console for Paddle event logs.
      </p>
    </div>
  );
}

export default PaddleCheckoutButton;