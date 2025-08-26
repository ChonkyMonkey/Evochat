import express, { Request, Response } from 'express';
import BillingService from '../services/Billing';
import { Paddle, Environment, EventName } from '@paddle/paddle-node-sdk';
import PaddleService from '../services/Paddle/PaddleService';

const router = express.Router();

const paddle = new Paddle(process.env.PADDLE_API_KEY ?? '', {
  environment:
    process.env.PADDLE_ENVIRONMENT === 'production'
      ? Environment.production
      : Environment.sandbox,
});

router.get('/config', (req: Request, res: Response) => {
  const environment =
    process.env.PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const clientToken = process.env.PADDLE_CLIENT_TOKEN || '';
  if (!clientToken) {
    return res.status(500).json({ error: 'PADDLE_CLIENT_TOKEN not set' });
  }
  return res.json({ environment, clientToken, plans: BillingService.getPlans() });
});

router.post('/webhooks', async (req: Request, res: Response) => {
  // Raw body must be available (set by app-level express.raw for /api/paddle/webhooks)
  if (!Buffer.isBuffer(req.body)) {
    return res.status(500).send('Server misconfigured: raw body not available');
  }

  const signature = String(req.headers['paddle-signature'] || '');
  const secret = process.env.PADDLE_WEBHOOK_SECRET || '';
  if (!secret) return res.status(500).send('PADDLE_WEBHOOK_SECRET not set');

  const rawBody = (req.body as Buffer).toString('utf8');

  try {
    // Verify and parse
    const event = await paddle.webhooks.unmarshal(rawBody, secret, signature);

      // Persist the event for idempotent processing
    try {
      await PaddleService.persistWebhookEvent(event);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[webhooks] Event persisted:', {
          eventType: event.eventType,
        });
      }
    } catch (persistErr) {
     // We still ACK Paddle with 200 OK to avoid retries storms from transient DB issues
      console.error('[webhooks] Failed to persist event (acknowledging anyway):', persistErr);
    }

    // Example routing
    switch (event.eventType) {
      case EventName.SubscriptionUpdated:
        // TODO: handle subscription updates (e.g., sync user entitlements)
        break;
      // Add other cases you subscribe to:
      // case EventName.TransactionCompleted:
      // case EventName.SubscriptionCreated:
      default:
        break;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('Received Paddle webhook OK:', event.eventType);
      console.log('Raw Body:', rawBody);
    }

    return res.status(200).send('OK');
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Webhook verification failed:', e);
      console.error('Signature:', signature);
      console.error('Raw Body:', rawBody);
    }
    return res.status(401).send('Invalid signature');
  }
});

export default router;