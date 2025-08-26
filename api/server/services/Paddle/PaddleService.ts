import { Paddle, CreateCustomerRequestBody, Customer, Environment } from '@paddle/paddle-node-sdk';
import WebhookEvent from '../../../models/WebhookEvent';
class PaddleService {
  private paddle: Paddle;
  private environment: Environment;



  constructor() {
    if (!process.env.PADDLE_API_KEY) {
      throw new Error('PADDLE_API_KEY environment variable is not set.');
    }
    if (!process.env.PADDLE_ENVIRONMENT) {
      throw new Error('PADDLE_ENVIRONMENT environment variable is not set.');
    }
    this.environment = process.env.PADDLE_ENVIRONMENT as Environment;
    this.paddle = new Paddle(process.env.PADDLE_API_KEY, { environment: this.environment});
  }

  async createPaddleCustomer(customerData: CreateCustomerRequestBody): Promise<Customer | undefined> {
    try {
      const customer: Customer = await this.paddle.customers.create(customerData);
      return customer;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error creating Paddle customer:', error.message);
      } else {
        console.error('An unknown error occurred while creating Paddle customer:', error);
      }
      throw new Error('Failed to create Paddle customer.');
    }
  }

    /**
   * Persist a Paddle webhook event in MongoDB (idempotent).
   */
  async persistWebhookEvent(event: any): Promise<void> {
    const provider = 'paddle';
    const type = event?.eventType ?? 'unknown';

    const occurredAt = event?.issuedAt
      ? new Date(event.issuedAt)
      : new Date();

    const eventId =
      event?.eventId ||
      event?.id ||
      event?.notificationId ||
      `${type}:${occurredAt.getTime()}:${event?.data?.id ?? 'no-data-id'}`;

    try {
      await WebhookEvent.create({
        provider,
        eventId,
        type,
        occurredAt,
        payload: event,
        status: 'pending',
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        // duplicate key error (already persisted)
        console.info(`[PaddleService] Duplicate webhook (eventId=${eventId}) — ignored.`);
        return;
      }
      console.error('[PaddleService] Failed to persist webhook event:', err);
      throw err;
    }
  }

}

export default new PaddleService();