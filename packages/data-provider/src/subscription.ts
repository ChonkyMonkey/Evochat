import * as endpoints from './api-endpoints';
import type {
  ISubscription,
  IPlan,
  SubscriptionStatus,
  UsageSummary,
  SubscriptionCheckoutData
} from '../../../packages/data-schemas/src/types/subscription';

// Subscription API functions
export const getCurrentSubscription = async (): Promise<ISubscription | null> => {
  const response = await fetch('/api/subscription', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null; // No subscription found
    }
    throw new Error(`Failed to get subscription: ${response.statusText}`);
  }

  return response.json();
};

export const getAvailablePlans = async (): Promise<IPlan[]> => {
  const response = await fetch('/api/subscription/plans', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get plans: ${response.statusText}`);
  }

  return response.json();
};

export const getSubscriptionStatus = async (): Promise<SubscriptionStatus | null> => {
  const response = await fetch('/api/subscription/status', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null; // No subscription found
    }
    throw new Error(`Failed to get subscription status: ${response.statusText}`);
  }

  return response.json();
};

export const getUsageData = async (period?: 'current' | 'last_month'): Promise<UsageSummary> => {
  const periodParam = period ? `?period=${period}` : '';
  const response = await fetch(`/api/subscription/usage${periodParam}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get usage data: ${response.statusText}`);
  }

  return response.json();
};

export const createCheckoutSession = async (planId: string): Promise<SubscriptionCheckoutData> => {
  const response = await fetch('/api/subscription/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ planId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create checkout session: ${response.statusText}`);
  }

  return response.json();
};

export const cancelSubscription = async (subscriptionId: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch('/api/subscription/cancel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscriptionId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel subscription: ${response.statusText}`);
  }

  return response.json();
};

export const updateSubscription = async (
  subscriptionId: string, 
  planId: string
): Promise<ISubscription> => {
  const response = await fetch('/api/subscription/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscriptionId, planId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update subscription: ${response.statusText}`);
  }

  return response.json();
};

export const resumeSubscription = async (subscriptionId: string): Promise<ISubscription> => {
  const response = await fetch('/api/subscription/resume', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscriptionId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to resume subscription: ${response.statusText}`);
  }

  return response.json();
};

export const getSubscriptionHistory = async (): Promise<ISubscription[]> => {
  const response = await fetch('/api/subscription/history', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get subscription history: ${response.statusText}`);
  }

  return response.json();
};