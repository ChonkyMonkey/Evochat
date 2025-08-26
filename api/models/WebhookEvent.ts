import { Schema, model, models, Document, Model } from 'mongoose';

export interface IWebhookEvent extends Document {
  provider: string;
  eventId: string;
  type: string;
  occurredAt: Date;
  payload: Record<string, any>;
  status: 'pending' | 'processed' | 'failed' | 'ignored';
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    provider: { type: String, required: true, default: 'paddle', trim: true },
    eventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, trim: true },
    occurredAt: { type: Date, required: true },
    payload: { type: Object as any, required: true },
    status: {
      type: String,
      default: 'pending',
      enum: ['pending', 'processed', 'failed', 'ignored'],
    },
    createdAt: { type: Date, default: Date.now, immutable: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'webhook_events', minimize: false }
);

WebhookEventSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const WebhookEvent: Model<IWebhookEvent> =
  models.WebhookEvent || model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);

export default WebhookEvent;
