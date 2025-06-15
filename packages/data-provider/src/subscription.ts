import * as endpoints from './api-endpoints';
import request from './request';
import type {
  ISubscription,
  IPlan,
  SubscriptionStatus,
  UsageSummary,
  SubscriptionCheckoutData
} from '../../../packages/data-schemas/src/types/subscription';

// Subscription API functions using authenticated request helper
export const getCurrentSubscription = async (): Promise<ISubscription | null> => {
  try {
    const data = await request.get<any>('/api/subscription/current');
    return data.subscription || null;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // No subscription found
    }
    throw new Error(`Failed to get subscription: ${error.message}`);
  }
};

export const getAvailablePlans = async (): Promise<IPlan[]> => {
  try {
    const data = await request.get<any>('/api/subscription/plans');
    // Backend returns {success: true, plans: [...]} but we need just the plans array
    return data.plans || data;
  } catch (error: any) {
    throw new Error(`Failed to get plans: ${error.message}`);
  }
};

export const getSubscriptionStatus = async (): Promise<SubscriptionStatus | null> => {
  try {
    const data = await request.get<any>('/api/subscription/current');
    if (!data || !data.hasActiveSubscription) {
      return null;
    }
    return {
      isActive: data.isActive,
      isExpired: data.isExpired,
      remainingDays: data.remainingDays,
      currentUsage: data.usage || { tokensUsed: 0, requestCount: 0, percentage: 0 },
      plan: data.plan
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // No subscription found
    }
    throw new Error(`Failed to get subscription status: ${error.message}`);
  }
};

export const getUsageData = async (period?: 'current' | 'last_month'): Promise<UsageSummary> => {
  try {
    const endpoint = period ? `/api/subscription/usage?period=${period}` : '/api/subscription/usage';
    const data = await request.get<any>(endpoint);
    
    // Transform backend response to match frontend interface
    return {
      totalTokensUsed: data.usage?.tokensUsed || 0,
      totalRequests: data.usage?.messages || 0,
      modelBreakdown: data.usage?.modelUsage?.map((model: any) => ({
        model: model.model,
        tokensUsed: model.tokenUsage || 0,
        percentage: model.percentage || 0,
      })) || [],
      dailyAverage: Math.round((data.usage?.messages || 0) / 30),
      weeklyTrend: [], // Backend doesn't provide this yet
    };
  } catch (error: any) {
    throw new Error(`Failed to get usage data: ${error.message}`);
  }
};

export const createCheckoutSession = async (planId: string): Promise<SubscriptionCheckoutData> => {
  try {
    const data = await request.post('/api/subscription/checkout', { planId });
    return {
      planId,
      userId: '', // Backend doesn't return this
      checkoutUrl: data.checkoutUrl,
      sessionId: data.sessionId,
    };
  } catch (error: any) {
    throw new Error(`Failed to create checkout session: ${error.message}`);
  }
};

export const cancelSubscription = async (subscriptionId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const data = await request.post('/api/subscription/cancel', { subscriptionId });
    return {
      success: data.success,
      message: data.message,
    };
  } catch (error: any) {
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
};

export const updateSubscription = async (
  subscriptionId: string,
  planId: string
): Promise<ISubscription> => {
  try {
    return await request.put('/api/subscription/update', { subscriptionId, planId });
  } catch (error: any) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }
};

export const resumeSubscription = async (subscriptionId: string): Promise<ISubscription> => {
  try {
    return await request.post('/api/subscription/resume', { subscriptionId });
  } catch (error: any) {
    throw new Error(`Failed to resume subscription: ${error.message}`);
  }
};

export const getSubscriptionHistory = async (): Promise<ISubscription[]> => {
  try {
    return await request.get<ISubscription[]>('/api/subscription/history');
  } catch (error: any) {
    throw new Error(`Failed to get subscription history: ${error.message}`);
  }
};