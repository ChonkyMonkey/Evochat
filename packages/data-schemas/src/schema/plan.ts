import mongoose, { Schema, Document, Types } from 'mongoose';

// @ts-ignore
export interface IPlan extends Document {
  name: string;
  paddleProductId: string;
  paddlePriceId: string;
  price: number; // in cents
  currency: string;
  interval: 'month' | 'year';
  tokenQuotaMonthly: number; // in cents worth of tokens, -1 for unlimited
  allowedModels: string[];
  features: string[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const planSchema: Schema<IPlan> = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    paddleProductId: {
      type: String,
      required: true,
      unique: true,
    },
    paddlePriceId: {
      type: String,
      required: true,
      unique: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'EUR',
      uppercase: true,
    },
    interval: {
      type: String,
      enum: ['month', 'year'],
      default: 'month',
    },
    tokenQuotaMonthly: {
      type: Number,
      required: true,
      min: -1, // Allow -1 for unlimited
    },
    allowedModels: {
      type: [String],
      default: [],
    },
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Validation middleware
planSchema.pre('save', function (next: any) {
  // Validate price is positive
  if ((this as any).price <= 0) {
    return next(new Error('Plan price must be greater than 0'));
  }
  
  // Validate token quota is -1 (unlimited) or positive
  if ((this as any).tokenQuotaMonthly < -1 || (this as any).tokenQuotaMonthly === 0) {
    return next(new Error('Token quota must be -1 (unlimited) or greater than 0'));
  }
  
  next();
});

// Instance methods
planSchema.methods.getDisplayPrice = function () {
  return (this as any).price / 100; // Convert cents to currency units
};

planSchema.methods.getPriceFormatted = function () {
  const price = (this as any).price / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: (this as any).currency,
  }).format(price);
};

planSchema.methods.getTokenQuotaFormatted = function () {
  if ((this as any).tokenQuotaMonthly === -1) {
    return 'Unlimited';
  }
  const quota = (this as any).tokenQuotaMonthly / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: (this as any).currency,
  }).format(quota);
};

// Static methods
planSchema.statics.getActivePlans = function () {
  return this.find({ isActive: true }).sort({ price: 1 });
};

planSchema.statics.getPlanByName = function (name: string) {
  return this.findOne({ name, isActive: true });
};

export default planSchema;