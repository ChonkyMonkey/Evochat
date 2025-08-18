import express from 'express';

const router = express.Router();

router.get('/checkout-data', async (req, res) => {
  try {
    const priceId = process.env.PADDLE_TEST_PRICE_ID;

    if (!priceId) {
      console.error('PADDLE_TEST_PRICE_ID environment variable is not set.');
      return res.status(500).json({ message: 'Paddle test price ID is not configured.' });
    }

    res.json({ priceId });
  } catch (error: any) {
    console.error('Error in /api/paddle/checkout-data:', error);
    res.status(500).json({ message: 'Failed to retrieve checkout data', error: error.message });
  }
});

export default router;