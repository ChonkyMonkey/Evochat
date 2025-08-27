import { Paddle, CreateCustomerRequestBody, Customer, Environment } from '@paddle/paddle-node-sdk';
import WebhookEvent, { IWebhookEvent } from '../../../models/WebhookEvent';
import Subscription, { ISubscription, SubscriptionPlan, SubscriptionStatus } from '../../../models/Subscription';
import logger from '../../../utils/logger';
import { Types } from 'mongoose';
import { toObjectId } from '../../../utils/objectId';
import CustomerLink from '../../../models/CustomerLink';
import { PRICE_TO_PLAN, type Plan } from '../Billing';

const PLAN_ID_TO_ENUM: Record<Plan['id'], SubscriptionPlan> = {
  free:     SubscriptionPlan.FREE,
  basic:    SubscriptionPlan.BASIC,
  pro:      SubscriptionPlan.PRO,
  pro_plus: SubscriptionPlan.PRO_PLUS,
};




const get = (obj: any, path: string, def?: any) =>
  path.split('.').reduce((o, k) => (o && k in o ? o[k] : undefined), obj) ?? def;



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
    this.environment = process.env.PADDLE_ENVIRONMENT === 'production' ? Environment.production : Environment.sandbox;
    this.paddle = new Paddle(process.env.PADDLE_API_KEY, { environment: this.environment as Environment });
  }

  async createPaddleCustomer(customerData: CreateCustomerRequestBody): Promise<Customer | undefined> {
    try {
      const customer: Customer = await this.paddle.customers.create(customerData);
      return customer;
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error('Error creating Paddle customer:', error.message);
      } else {
        logger.error('An unknown error occurred while creating Paddle customer:', error);
      }
      throw new Error('Failed to create Paddle customer.');
    }
  }

  /**
   * Persist a Paddle webhook event in MongoDB (idempotent).
   */
  async persistWebhookEvent(event: any): Promise<void> {
    // Normalize names to Paddle v2 style where possible
    const type = event?.event_type || event?.eventType || 'unknown';
    const occurredAtStr = event?.occurred_at || event?.issuedAt || event?.created_at;
    const occurredAt = occurredAtStr ? new Date(occurredAtStr) : new Date();

    const eventId =
      event?.event_id ||
      event?.eventId ||
      event?.id ||
      event?.notificationId ||
      `${type}:${occurredAt.getTime()}:${get(event, 'data.id', 'no-data-id')}`;

    // Extract quick-look fields for faster processing
    const paddleCustomerId = get(event, 'data.customer_id') || get(event, 'data.customerId') || null;
    const paddleSubscriptionId = get(event, 'data.id') || get(event, 'data.subscription_id') || null;
    const rawUserId = get(event, 'data.custom_data.user_id') || null;
    const userId = toObjectId(rawUserId);

    try {
      await WebhookEvent.create({
        provider: 'paddle',
        eventId,
        type,
        occurredAt,
        payload: event,
        status: 'pending',
        paddleCustomerId,
        paddleSubscriptionId,
        userId,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        logger.info(`[PaddleService] Duplicate webhook (eventId=${eventId}) — ignored.`);
        return;
      }
      logger.error('[PaddleService] Failed to persist webhook event:', err);
      throw err;
    }
  }

  /**
   * Applies subscription state transitions based on Paddle webhook events.
   * Ensures idempotency and correct ordering by 'occurredAt'.
   */
private async claimNextEvent() {
  return WebhookEvent.findOneAndUpdate(
    { status: 'pending' },
    { $set: { status: 'processing', claimedAt: new Date(), claimedBy: 'local-dev', failReason: null } },
    { sort: { occurredAt: 1 }, new: true }
  );
}

private getPlanFromItems(payload: any): { priceId?: string; plan?: SubscriptionPlan } {
  const items: any[] = (payload?.data?.items ?? []) as any[];
  for (const it of items) {
    const pid = it?.price?.id as string | undefined;
    if (!pid) continue;
    const planId = PRICE_TO_PLAN[pid]; // 'free'|'basic'|'pro'|'pro_plus'|undefined
    if (planId) return { priceId: pid, plan: PLAN_ID_TO_ENUM[planId] };
  }
  return {};
}

private async processOne(evt: IWebhookEvent) {
  const payload = evt.payload;
  const occurredAt: Date = evt.occurredAt;

  // Resolve user
  let userId = (evt.userId ?? null) as Types.ObjectId | null;
  if (!userId) {
    const resolved = await this.resolveUserIdFromEvent(payload);
    userId = toObjectId(resolved);
    // persist for future retries/analytics
    evt.userId = userId;
  }
  if (!userId) {
    evt.status = 'ignored';
    evt.failReason = 'user_not_found';
    return;
  }

  const paddleSubscriptionId = get(payload, 'data.id');
  if (!paddleSubscriptionId) {
    evt.status = 'ignored';
    evt.failReason = 'no_subscription_id';
    return;
  }

  const paddleCustomerId = get(payload, 'data.customer_id') || get(payload, 'data.customerId');
  const statusRaw = get(payload, 'data.status') || '';
  const status = this.mapPaddleStatusToSubscriptionStatus(statusRaw);

  const periodStart = get(payload, 'data.current_period.starts_at') || get(payload, 'data.currentPeriod.startsAt');
  const periodEnd   = get(payload, 'data.current_period.ends_at')   || get(payload, 'data.currentPeriod.endsAt');
  const graceAt     = get(payload, 'data.grace_period.effective_at') || get(payload, 'data.gracePeriod.effectiveAt');
  const cancelAt    = get(payload, 'data.cancellation.effective_at') || get(payload, 'data.cancelled_at');
  const { priceId: matchedPriceId, plan: mappedPlan } = this.getPlanFromItems(payload);


  // Grace logic (clear on recovery)
  let gracePeriodUntil: Date | null = null;
  if (status === SubscriptionStatus.PAST_DUE) {
    gracePeriodUntil = graceAt ? new Date(graceAt) : new Date(occurredAt.getTime() + 7 * 24 * 3600 * 1000);
  }

  const update: Partial<ISubscription> = {
    paddleSubscriptionId,
    paddleCustomerId,
    status,
    lastEventAt: occurredAt,
    gracePeriodUntil: status === SubscriptionStatus.PAST_DUE ? gracePeriodUntil : null,
  };
  if (periodStart) update.currentPeriodStart = new Date(periodStart);
  if (periodEnd || cancelAt) update.currentPeriodEnd = new Date(cancelAt ?? periodEnd);
  if (mappedPlan) update.planId = mappedPlan;
  if (matchedPriceId) update.priceId = matchedPriceId;


  const existingSub = await Subscription.findOne({ userId }).select('_id').lean();
  if (!existingSub && !mappedPlan) {
    evt.status = 'ignored';
    evt.failReason = 'price_not_mapped';
    return;
  }

  const res = await Subscription.findOneAndUpdate(
    {
      userId,
      $or: [
        { lastEventAt: { $lt: occurredAt } },
        { lastEventAt: { $exists: false } },
      ],
    },
    { $setOnInsert: { userId }, $set: update },
    { upsert: true, new: true }
  );

  if (!res) {
    evt.status = 'ignored';
    evt.failReason = 'stale_event';
  } else {
    evt.status = 'processed';
    evt.failReason = null;
  }
}


async applySubscriptionState(maxBatches = 500): Promise<void> {
  for (let i = 0; i < maxBatches; i++) {
    const evt = await this.claimNextEvent();
    if (!evt) break;

    try {
      await this.processOne(evt); // this sets evt.status to processed/ignored/failed as needed
    } catch (error: any) {
      logger.error(`[PaddleService] Failed event ${evt.eventId}`, error);
      evt.status = 'failed';
      evt.failReason = (error?.message || 'unknown').slice(0, 500);
    }

    evt.processedAt = new Date();
    await evt.save();
  }
}

  private async resolveUserIdFromEvent(payload: any): Promise<string | Types.ObjectId | null> {
    // 1) Prefer custom_data.user_id (later step in checkout overlay)
    const uid = get(payload, 'data.custom_data.user_id');
    if (uid) return uid;

    // 2) Fallback via Paddle customer_id -> our mapping
    const paddleCustomerId = get(payload, 'data.customer_id') || get(payload, 'data.customerId');
    if (!paddleCustomerId) return null;

    const link = await CustomerLink.findOne({ paddleCustomerId }).select('userId').lean();
    return link?.userId ?? null;
  }


  private mapPaddleStatusToSubscriptionStatus(paddleStatus: string): SubscriptionStatus {
    switch ((paddleStatus || '').toLowerCase()) {
      case 'active': return SubscriptionStatus.ACTIVE;
      case 'trialing': return SubscriptionStatus.TRIALING;
      case 'paused': return SubscriptionStatus.PAUSED;
      case 'past_due': return SubscriptionStatus.PAST_DUE;
      case 'canceled': return SubscriptionStatus.CANCELED;
      default:
        logger.warn(`[PaddleService] Unknown Paddle status "${paddleStatus}", defaulting to ACTIVE`);
        return SubscriptionStatus.ACTIVE;
    }
  }
}
export default new PaddleService();