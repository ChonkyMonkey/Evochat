import React, { useEffect, useRef, useState } from 'react';

function PaddleCheckoutButton({ prefillEmail, successUrl, customData }) {
  const [priceId, setPriceId] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const inited = useRef(false);

  // wait until Paddle script is ready
  const waitForPaddle = () =>
    new Promise((resolve, reject) => {
      let tries = 0;
      const tick = () => {
        if (window.Paddle) return resolve(window.Paddle);
        if (++tries > 100) return reject(new Error('Paddle.js not loaded'));
        setTimeout(tick, 60);
      };
      tick();
    });

  useEffect(() => {
    (async () => {
      try {
        const Paddle = await waitForPaddle();

        // backend exposes public client config
        const r = await fetch('/api/paddle/config');
        if (!r.ok) throw new Error('Failed to fetch Paddle config');
        const { environment, clientToken, priceId: pid } = await r.json();

        if (!clientToken) throw new Error('Missing PADDLE_CLIENT_TOKEN on backend');
        if (!pid) throw new Error('Missing PADDLE_TEST_PRICE_ID on backend');

        // v2: set env then initialize
        if (Paddle.Environment?.set) {
          Paddle.Environment.set(environment || 'sandbox');
        }
        if (!inited.current) {
          Paddle.Initialize({ token: clientToken });
          inited.current = true;
        }

        setPriceId(pid);
        setReady(true);
      } catch (e) {
        console.error(e);
        setError(e.message || String(e));
      }
    })();
  }, []);

  const openCheckout = () => {
    try {
      if (!window.Paddle) throw new Error('Paddle not ready');
      if (!priceId) throw new Error('No priceId');

      // Build params from docs: settings + items + (optional) customer/customData
      const params = {
        // --- settings ---
        displayMode: 'overlay',                 // or 'inline' if you wire a frameTarget via Initialize()
        locale: undefined,                      // let Paddle use browser locale
        theme: undefined,                       // 'light' | 'dark' | undefined
        successUrl: successUrl || undefined,    // optional redirect after completion

        // --- items OR transactionId ---
        items: [{ priceId, quantity: 1 }],

        // --- optional prefill ---
        customer: prefillEmail ? { email: prefillEmail } : undefined,

        // --- optional custom data (stored on transaction/subscription) ---
        customData: customData && Object.keys(customData).length ? customData : undefined,

        // You can also pass: customerAuthToken, address, business, discountCode/discountId, savedPaymentMethodId, etc.
        // See Paddle docs for the full surface.
        
        // --- per-checkout callbacks (more reliable than global Events/Status) ---
        loadCallback: (evt) => console.log('[Paddle] checkout.loaded', evt),
        successCallback: (evt) => {
          console.log('[Paddle] checkout.completed', evt);
          if (!successUrl) alert('Checkout completed (see console for payload).');
        },
        closeCallback: () => console.log('[Paddle] checkout.closed'),
      };

      window.Paddle.Checkout.open(params);
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
        Using per‑checkout callbacks; no global event listeners required.
      </p>
    </div>
  );
}

export default PaddleCheckoutButton;
