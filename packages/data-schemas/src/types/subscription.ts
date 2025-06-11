import type { ISubscription } from '~/schema/subscription';
import type { IPlan } from '~/schema/plan';
import type { IUsageRecord } from '~/schema/usageRecord';

// Export interfaces
export type { ISubscription, IPlan, IUsageRecord };

// Additional subscription-related types
export interface SubscriptionStatus {
  isActive: boolean;
  isExpired: boolean;
  remainingDays: number;
  currentUsage: {
    tokensUsed: number;
    requestCount: number;
    percentage: number;
  };
  plan: IPlan;
}

export interface UsageSummary {
  totalTokensUsed: number;
  totalRequests: number;
  modelBreakdown: Array<{
    model: string;
    tokensUsed: number;
    percentage: number;
  }>;
  dailyAverage: number;
  weeklyTrend: Array<{
    date: string;
    tokensUsed: number;
  }>;
}

export interface SubscriptionCheckoutData {
  planId: string;
  userId: string;
  checkoutUrl: string;
  sessionId: string;
}

export interface PaddleWebhookEvent {
  eventType: string;
  data: {
    subscriptionId: string;
    customerId: string;
    status: string;
    planId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    [key: string]: any;
  };
}