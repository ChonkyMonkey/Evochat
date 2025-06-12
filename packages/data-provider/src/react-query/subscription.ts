import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  UseQueryOptions,
  UseMutationResult,
  QueryObserverResult,
} from '@tanstack/react-query';
import * as subscriptionService from '../subscription';
import { QueryKeys } from '../keys';
import type { 
  ISubscription, 
  IPlan, 
  SubscriptionStatus, 
  UsageSummary,
  SubscriptionCheckoutData 
} from '../../../../packages/data-schemas/src/types/subscription';

// Query: Get current user subscription
export const useGetUserSubscription = (
  config?: UseQueryOptions<ISubscription | null>,
): QueryObserverResult<ISubscription | null> => {
  return useQuery<ISubscription | null>(
    [QueryKeys.subscription],
    () => subscriptionService.getCurrentSubscription(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
      ...config,
    },
  );
};

// Query: Get available subscription plans
export const useGetAvailablePlans = (
  config?: UseQueryOptions<IPlan[]>,
): QueryObserverResult<IPlan[]> => {
  return useQuery<IPlan[]>(
    [QueryKeys.subscriptionPlans],
    () => subscriptionService.getAvailablePlans(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      ...config,
    },
  );
};

// Query: Get subscription status
export const useGetSubscriptionStatus = (
  config?: UseQueryOptions<SubscriptionStatus | null>,
): QueryObserverResult<SubscriptionStatus | null> => {
  return useQuery<SubscriptionStatus | null>(
    [QueryKeys.subscriptionStatus],
    () => subscriptionService.getSubscriptionStatus(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

// Query: Get usage data
export const useGetUsageData = (
  period?: 'current' | 'last_month',
  config?: UseQueryOptions<UsageSummary>,
): QueryObserverResult<UsageSummary> => {
  return useQuery<UsageSummary>(
    [QueryKeys.subscriptionUsage, period],
    () => subscriptionService.getUsageData(period),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

// Query: Get subscription history
export const useGetSubscriptionHistory = (
  config?: UseQueryOptions<ISubscription[]>,
): QueryObserverResult<ISubscription[]> => {
  return useQuery<ISubscription[]>(
    [QueryKeys.subscriptionHistory],
    () => subscriptionService.getSubscriptionHistory(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

// Mutation: Create checkout session
export const useCreateCheckout = (): UseMutationResult<
  SubscriptionCheckoutData,
  Error,
  string,
  unknown
> => {
  const queryClient = useQueryClient();
  return useMutation(
    (planId: string) => subscriptionService.createCheckoutSession(planId),
    {
      onSuccess: () => {
        // Invalidate subscription queries when checkout is successful
        queryClient.invalidateQueries([QueryKeys.subscription]);
        queryClient.invalidateQueries([QueryKeys.subscriptionStatus]);
      },
    },
  );
};

// Mutation: Cancel subscription
export const useCancelSubscription = (): UseMutationResult<
  { success: boolean; message: string },
  Error,
  string,
  unknown
> => {
  const queryClient = useQueryClient();
  return useMutation(
    (subscriptionId: string) => subscriptionService.cancelSubscription(subscriptionId),
    {
      onSuccess: () => {
        // Invalidate subscription queries when cancellation is successful
        queryClient.invalidateQueries([QueryKeys.subscription]);
        queryClient.invalidateQueries([QueryKeys.subscriptionStatus]);
        queryClient.invalidateQueries([QueryKeys.subscriptionHistory]);
      },
    },
  );
};

// Mutation: Update subscription (change plan)
export const useUpdateSubscription = (): UseMutationResult<
  ISubscription,
  Error,
  { subscriptionId: string; planId: string },
  unknown
> => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ subscriptionId, planId }: { subscriptionId: string; planId: string }) =>
      subscriptionService.updateSubscription(subscriptionId, planId),
    {
      onSuccess: () => {
        // Invalidate subscription queries when update is successful
        queryClient.invalidateQueries([QueryKeys.subscription]);
        queryClient.invalidateQueries([QueryKeys.subscriptionStatus]);
        queryClient.invalidateQueries([QueryKeys.subscriptionHistory]);
      },
    },
  );
};

// Mutation: Resume subscription
export const useResumeSubscription = (): UseMutationResult<
  ISubscription,
  Error,
  string,
  unknown
> => {
  const queryClient = useQueryClient();
  return useMutation(
    (subscriptionId: string) => subscriptionService.resumeSubscription(subscriptionId),
    {
      onSuccess: () => {
        // Invalidate subscription queries when resume is successful
        queryClient.invalidateQueries([QueryKeys.subscription]);
        queryClient.invalidateQueries([QueryKeys.subscriptionStatus]);
        queryClient.invalidateQueries([QueryKeys.subscriptionHistory]);
      },
    },
  );
};