import mongoose, { Schema, Document, Types } from 'mongoose';

// @ts-ignore
export interface ISubscription extends Document {
  userId: Types.ObjectId;
  paddleSubscriptionId: string;
  planId: Types.ObjectId;
  status: 'active' | 'canceled' | 'past_due' | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const subscriptionSchema: Schema<ISubscription> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    paddleSubscriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'paused'],
      required: true,
      index: true,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save middleware to validate dates
subscriptionSchema.pre('save', function (next: any) {
  if ((this as any).currentPeriodStart >= (this as any).currentPeriodEnd) {
    return next(new Error('Current period start must be before current period end'));
  }
  next();
});

// Instance methods
subscriptionSchema.methods.isActive = function () {
  return (this as any).status === 'active' && new Date() < (this as any).currentPeriodEnd;
};

subscriptionSchema.methods.isExpired = function () {
  return new Date() > (this as any).currentPeriodEnd;
};

subscriptionSchema.methods.getRemainingDays = function () {
  const now = new Date();
  const end = new Date((this as any).currentPeriodEnd);
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default subscriptionSchema;