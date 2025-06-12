import mongoose, { Schema, Document, Types } from 'mongoose';

// @ts-ignore
export interface IUsageRecord extends Document {
  userId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  date: Date; // Daily aggregation
  tokensUsed: number; // in cents worth
  requestCount: number;
  modelUsage: Map<string, number>; // model -> token cost
  createdAt?: Date;
  updatedAt?: Date;
}

const usageRecordSchema: Schema<IUsageRecord> = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    tokensUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    requestCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    modelUsage: {
      type: Map,
      of: Number,
      default: new Map(),
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for performance
usageRecordSchema.index({ userId: 1, date: 1 }, { unique: true });
usageRecordSchema.index({ subscriptionId: 1, date: 1 });
usageRecordSchema.index({ date: 1 }); // For cleanup queries

// Instance methods
usageRecordSchema.methods.addUsage = function (model: string, tokenCost: number, requestCount = 1) {
  const record = this as any;
  record.tokensUsed += tokenCost;
  record.requestCount += requestCount;
  
  // Update model usage
  const currentModelUsage = record.modelUsage.get(model) || 0;
  record.modelUsage.set(model, currentModelUsage + tokenCost);
  
  return record.save();
};

usageRecordSchema.methods.getTopModels = function (limit = 5) {
  const record = this as any;
  const modelUsageArray = Array.from(record.modelUsage.entries()) as [string, number][];
  return modelUsageArray
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, limit)
    .map(([model, usage]: [string, number]) => ({ model, usage }));
};

// Static methods for aggregation
usageRecordSchema.statics.getMonthlyUsage = async function (userId: Types.ObjectId, year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const result = await this.aggregate([
    {
      $match: {
        userId,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalTokensUsed: { $sum: '$tokensUsed' },
        totalRequests: { $sum: '$requestCount' },
        modelUsage: {
          $push: '$modelUsage',
        },
      },
    },
  ]);
  
  return result.length > 0 ? result[0] : { totalTokensUsed: 0, totalRequests: 0, modelUsage: [] };
};

usageRecordSchema.statics.getWeeklyUsage = async function (userId: Types.ObjectId, startDate: Date, endDate: Date) {
  const result = await this.aggregate([
    {
      $match: {
        userId,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalTokensUsed: { $sum: '$tokensUsed' },
        totalRequests: { $sum: '$requestCount' },
        dailyUsage: {
          $push: {
            date: '$date',
            tokensUsed: '$tokensUsed',
            requestCount: '$requestCount',
          },
        },
      },
    },
  ]);
  
  return result.length > 0 ? result[0] : { totalTokensUsed: 0, totalRequests: 0, dailyUsage: [] };
};

usageRecordSchema.statics.getUserUsageHistory = async function (userId: Types.ObjectId, months = 6) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  return this.aggregate([
    {
      $match: {
        userId,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
        totalTokensUsed: { $sum: '$tokensUsed' },
        totalRequests: { $sum: '$requestCount' },
        days: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
  ]);
};

// Pre-save middleware
usageRecordSchema.pre('save', function (next: any) {
  const record = this as any;
  
  // Ensure date is start of day
  if (record.date) {
    record.date.setHours(0, 0, 0, 0);
  }
  
  next();
});

export default usageRecordSchema;