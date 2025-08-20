import express from 'express';

const router = express.Router();

router.get('/config', async (req, res) => {
  res.json({
    environment: process.env.PADDLE_ENVIRONMENT || 'sandbox',
    clientToken: process.env.PADDLE_CLIENT_TOKEN || '',
    priceId: process.env.PADDLE_TEST_PRICE_ID || '',
  });
});

export default router;