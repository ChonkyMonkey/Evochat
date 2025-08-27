import { Schema, model, models, Document, Model } from 'mongoose';

export enum SubscriptionPlan { FREE='free', BASIC='basic', PRO='pro', PRO_PLUS='pro_plus' }
export enum SubscriptionStatus { TRIALING='trialing', ACTIVE='active', PAUSED='paused', PAST_DUE='past_due', CANCELED='canceled' }

export interface ISubscription extends Document {
  userId: Schema.Types.ObjectId;
  paddleCustomerId?: string | null;
  paddleSubscriptionId: string;
  planId: SubscriptionPlan;
  priceId: string;
  status: SubscriptionStatus;
  gracePeriodUntil: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  lastEventAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: 'User', index: true },
    paddleCustomerId: { type: String, default: null, index: true },
    paddleSubscriptionId: { type: String, required: true, unique: true, index: true },
    planId: { type: String, required: true, enum: Object.values(SubscriptionPlan), index: true },
    priceId: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(SubscriptionStatus), index: true },
    gracePeriodUntil: { type: Date, default: null },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    lastEventAt: { type: Date, required: true, index: true },
    createdAt: { type: Date, default: Date.now, immutable: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'subscriptions', minimize: false }
);

SubscriptionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const Subscription: Model<ISubscription> =
  models.Subscription || model<ISubscription>('Subscription', SubscriptionSchema);

export default Subscription;