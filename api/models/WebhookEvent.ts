import { Schema, model, models, Document, Model, Types } from 'mongoose';

export interface IWebhookEvent extends Document {
  provider: string;                 // e.g. 'paddle'
  eventId: string;                  // unique, idempotency key
  type: string;                     // e.g. 'subscription.created'
  occurredAt: Date;                 // timestamp from Paddle
  payload: Record<string, any>;     // full unmarshaled event payload

  status: 'pending' | 'processing' | 'processed' | 'failed' | 'ignored';
  processedAt?: Date | null;        // when handling finished (success/fail/ignore)
  failReason?: string | null;       // reason on failed/ignored

  // Optional, helps debugging concurrency (who claimed it)
  claimedAt?: Date | null;
  claimedBy?: string | null;

  // Denormalized fields for quicker lookups
  paddleCustomerId?: string | null;
  paddleSubscriptionId?: string | null;
  userId?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    provider: { type: String, required: true, default: 'paddle', index: true, trim: true },
    eventId:   { type: String, required: true, unique: true, index: true },
    type:      { type: String, required: true, index: true, trim: true },
    occurredAt:{ type: Date,   required: true, index: true },

    payload:   { type: Schema.Types.Mixed, required: true },

    status: {
      type: String,
      default: 'pending',
      enum: ['pending', 'processing', 'processed', 'failed', 'ignored'],
      index: true,
    },
    processedAt: { type: Date, default: null },
    failReason:  { type: String, default: null },

    claimedAt:   { type: Date, default: null },
    claimedBy:   { type: String, default: null },

    paddleCustomerId:     { type: String, default: null, index: true },
    paddleSubscriptionId: { type: String, default: null, index: true },
    userId:               { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    createdAt: { type: Date, default: Date.now, immutable: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'webhook_events', minimize: false }
);

// Fast queue scans
WebhookEventSchema.index({ status: 1, occurredAt: 1 });

// Optional TTL to purge old processed events (enable only when confident):
// WebhookEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

WebhookEventSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const WebhookEvent: Model<IWebhookEvent> =
  models.WebhookEvent || model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);

export default WebhookEvent;
