import React, { useEffect, useRef, useState } from 'react';

function PaddleCheckoutButton() {
  const [priceId, setPriceId] = useState(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const initializedRef = useRef(false);

  // wait until the CDN script has created window.Paddle
  const waitForPaddle = () =>
    new Promise((resolve, reject) => {
      let tries = 0;
      const poll = () => {
        if (window.Paddle) return resolve(window.Paddle);
        if (++tries > 100) return reject(new Error('Paddle.js not loaded'));
        setTimeout(poll, 60);
      };
      poll();
    });

  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      try {
        const Paddle = await waitForPaddle();

        // fetch public client-side config (env + client token + price)
        const res = await fetch('/api/paddle/config');
        if (!res.ok) throw new Error('Failed to fetch Paddle config');
        const { environment, clientToken, priceId: pid } = await res.json();

        if (!clientToken) throw new Error('Missing PADDLE_CLIENT_TOKEN on backend');
        if (!pid) throw new Error('Missing PADDLE_TEST_PRICE_ID on backend');

        // correct v2 calls: set environment then Initialize with client token
        if (Paddle.Environment?.set) {
          Paddle.Environment.set(environment || 'sandbox');
        }

        if (!initializedRef.current) {
          Paddle.Initialize({ token: clientToken });
          initializedRef.current = true;
        }

        // event listeners (optional but handy during PoC)
        const onLoaded = (evt) => console.log('[Paddle] checkout.loaded', evt);
        const onCreated = (evt) => console.log('[Paddle] checkout.customer.created', evt);
        const onCompleted = (evt) => {
          console.log('[Paddle] checkout.completed', evt);
          alert('Checkout completed (see console for event payload).');
        };
        const onClosed = () => console.log('[Paddle] checkout.closed');

        Paddle.Status.on('checkout.loaded', onLoaded);
        Paddle.Status.on('checkout.customer.created', onCreated);
        Paddle.Status.on('checkout.completed', onCompleted);
        Paddle.Status.on('checkout.closed', onClosed);

        cleanup = () => {
          try {
            Paddle.Status.off('checkout.loaded', onLoaded);
            Paddle.Status.off('checkout.customer.created', onCreated);
            Paddle.Status.off('checkout.completed', onCompleted);
            Paddle.Status.off('checkout.closed', onClosed);
          } catch {}
        };

        setPriceId(pid);
        setReady(true);
      } catch (e) {
        console.error(e);
        setError(e.message || String(e));
      }
    })();

    return () => cleanup();
  }, []);

  const openCheckout = () => {
    try {
      if (!window.Paddle) throw new Error('Paddle not ready');
      if (!priceId) throw new Error('No priceId');
      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
      });
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) return <div style={{ color: 'red', padding: 12 }}>Error: {error}</div>;
  if (!ready) return <div style={{ padding: 12 }}>Loading Paddle…</div>;

  return (
    <div style={{ padding: 20, border: '1px solid #ccc', borderRadius: 8, margin: 20 }}>
      <h2>Buy with Paddle</h2>
      <p>Price ID: <strong>{priceId}</strong></p>
      <button onClick={openCheckout} style={{ padding: '10px 15px', cursor: 'pointer' }}>
        Open Paddle Checkout
      </button>
      <p style={{ fontSize: 12, color: '#666', marginTop: 10 }}>
        Watch the console for Paddle events.
      </p>
    </div>
  );
}

export default PaddleCheckoutButton;
