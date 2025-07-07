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
  const token = localStorage.getItem('token');
  
  // Debug authentication
  console.log('[SubscriptionAPI] Getting current subscription:', {
    hasToken: !!token,
    tokenPrefix: token?.substring(0, 20) + '...',
  });

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const response = await fetch('/api/subscription/current', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    console.error('[SubscriptionAPI] Request failed:', {
      status: response.status,
      statusText: response.statusText,
      hasToken: !!token,
    });
    
    if (response.status === 401) {
      console.error('[SubscriptionAPI] Authentication failed - check JWT token');
    }
    
    if (response.status === 404) {
      return null; // No subscription found
    }
    throw new Error(`Failed to get subscription: ${response.statusText}`);
  }

  const data = await response.json();
  return data.success ? data.subscription : null;
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

  const data = await response.json();
  return data.success ? data.plans : [];
};

export const getSubscriptionStatus = async (): Promise<SubscriptionStatus | null> => {
  const token = localStorage.getItem('token');
  
  console.log('[SubscriptionAPI] Getting subscription status:', {
    hasToken: !!token,
  });
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const response = await fetch('/api/subscription/current', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    console.error('[SubscriptionAPI] Status request failed:', {
      status: response.status,
      statusText: response.statusText,
      hasToken: !!token,
    });
    
    if (response.status === 401) {
      console.error('[SubscriptionAPI] Authentication failed for status check');
    }
    
    if (response.status === 404) {
      return null; // No subscription found
    }
    throw new Error(`Failed to get subscription status: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success) {
    return null;
  }

  // Convert backend response to SubscriptionStatus format
  return {
    isActive: data.isActive,
    isExpired: data.isExpired,
    remainingDays: data.remainingDays,
    plan: data.plan,
    currentUsage: {
      tokensUsed: data.usage?.tokens || 0,
      requestCount: data.usage?.requests || 0,
      percentage: 0, // Calculate if needed
    },
  };
};

export const getUsageData = async (period?: 'current' | 'last_month'): Promise<UsageSummary> => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const response = await fetch('/api/subscription/current', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to get usage data: ${response.statusText}`);
  }

  const data = await response.json();
  return data.success && data.usage ? {
    totalTokensUsed: data.usage.tokens || 0,
    totalRequests: data.usage.requests || 0,
    modelBreakdown: [],
    dailyAverage: 0,
    weeklyTrend: [],
  } : {
    totalTokensUsed: 0,
    totalRequests: 0,
    modelBreakdown: [],
    dailyAverage: 0,
    weeklyTrend: [],
  };
};

export const createCheckoutSession = async (planId: string): Promise<SubscriptionCheckoutData> => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const response = await fetch('/api/subscription/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify({ planId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create checkout session: ${response.statusText}`);
  }

  const data = await response.json();
  return data.success ? data : data;
};

export const cancelSubscription = async (immediately: boolean): Promise<{ success: boolean; message: string }> => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const response = await fetch('/api/subscription/cancel', {
    method: 'POST',
    headers,
    body: JSON.stringify({ immediately }),
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel subscription: ${response.statusText}`);
  }

  return response.json();
};

export const updateSubscription = async (
  planId: string
): Promise<ISubscription> => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const response = await fetch('/api/subscription/update', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ planId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update subscription: ${response.statusText}`);
  }

  return response.json();
};

export const resumeSubscription = async (): Promise<ISubscription> => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const response = await fetch('/api/subscription/resume', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Failed to resume subscription: ${response.statusText}`);
  }

  return response.json();
};

// Get customer portal URL for billing management
export const getCustomerPortalUrl = async (): Promise<{ portalUrl: string }> => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const response = await fetch('/api/subscription/portal', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to get customer portal: ${response.statusText}`);
  }

  const data = await response.json();
  return data.success ? { portalUrl: data.portalUrl } : data;
};