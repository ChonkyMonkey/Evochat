import React, { useState } from 'react';

function CustomerCreator() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCustomerId(null);

    try {
      const response = await fetch('/api/billing/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create customer');
      }

      const data = await response.json();
      setCustomerId(data.customerId);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px' }}>
      <h2>Create Paddle Customer</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div style={{ marginTop: '10px' }}>
          <label htmlFor="name">Name (Optional):</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button type="submit" style={{ marginTop: '15px', padding: '10px 15px', cursor: 'pointer' }}>
          Create Customer
        </button>
      </form>

      {customerId && (
        <p style={{ marginTop: '15px', color: 'green' }}>
          Customer created with ID: <strong>{customerId}</strong>
        </p>
      )}
      {error && (
        <p style={{ marginTop: '15px', color: 'red' }}>
          Error: {error}
        </p>
      )}
    </div>
  );
}

export default CustomerCreator;