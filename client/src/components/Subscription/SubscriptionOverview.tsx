import React from 'react';
import { useRecoilValue } from 'recoil';
import { CheckCircle, AlertTriangle, Calendar, CreditCard } from 'lucide-react';
import { useGetUserSubscription } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { Button } from '~/components/ui';
import subscriptionStore from '~/store/subscription';
import { cn } from '~/utils';

export default function SubscriptionOverview() {
  const localize = useLocalize();
  const subscription = useRecoilValue(subscriptionStore.subscription);
  const { data: subscriptionData, isLoading } = useGetUserSubscription();

  const currentPlan = subscriptionData || subscription;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'text-green-600 dark:text-green-400';
      case 'trialing':
        return 'text-blue-600 dark:text-blue-400';
      case 'past_due':
      case 'unpaid':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'canceled':
      case 'incomplete':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-text-secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'trialing':
        return <CheckCircle className="h-5 w-5" />;
      case 'past_due':
      case 'unpaid':
      case 'canceled':
      case 'incomplete':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return localize('com_subscription_not_available');
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-text-secondary">{localize('com_ui_loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">
            {localize('com_subscription_current_plan')}
          </h3>
          <div className={cn('flex items-center gap-2', getStatusColor(currentPlan?.status || ''))}>
            {getStatusIcon(currentPlan?.status || '')}
            <span className="text-sm font-medium">
              {currentPlan?.status ? localize(`com_subscription_status_${currentPlan.status}`) : localize('com_subscription_no_subscription')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm text-text-secondary">{localize('com_subscription_plan_name')}</div>
            <div className="text-base font-medium text-text-primary">
              {currentPlan?.planName || localize('com_subscription_free_plan')}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-text-secondary">{localize('com_subscription_billing_cycle')}</div>
            <div className="text-base text-text-primary">
              {currentPlan?.billingCycle ? localize(`com_subscription_cycle_${currentPlan.billingCycle}`) : localize('com_subscription_not_applicable')}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-text-secondary">{localize('com_subscription_price')}</div>
            <div className="text-base font-semibold text-text-primary">
              {currentPlan?.price ? `$${currentPlan.price}` : localize('com_subscription_free')}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-text-secondary">{localize('com_subscription_next_billing')}</div>
            <div className="flex items-center gap-2 text-base text-text-primary">
              <Calendar className="h-4 w-4" />
              {formatDate(currentPlan?.nextBillingDate || '')}
            </div>
          </div>
        </div>
      </div>

      {/* Plan Features */}
      {currentPlan?.features && (
        <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">
            {localize('com_subscription_plan_features')}
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {currentPlan.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-text-primary">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Summary */}
      <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
        <h3 className="mb-4 text-lg font-semibold text-text-primary">
          {localize('com_subscription_usage_summary')}
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-text-primary">
              {currentPlan?.usage?.messages || 0}
            </div>
            <div className="text-sm text-text-secondary">{localize('com_subscription_messages_used')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-text-primary">
              {currentPlan?.usage?.tokens ? Math.round(currentPlan.usage.tokens / 1000) + 'K' : '0'}
            </div>
            <div className="text-sm text-text-secondary">{localize('com_subscription_tokens_used')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-text-primary">
              {currentPlan?.usage?.requests || 0}
            </div>
            <div className="text-sm text-text-secondary">{localize('com_subscription_requests_used')}</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <div className="flex gap-3">
          <Button
            variant="default"
            className="flex items-center gap-2"
            onClick={() => {
              // Handle upgrade/downgrade
            }}
          >
            <CreditCard className="h-4 w-4" />
            {currentPlan?.planName ? localize('com_subscription_change_plan') : localize('com_subscription_upgrade')}
          </Button>
          
          {currentPlan?.status === 'active' && (
            <Button
              variant="outline"
              onClick={() => {
                // Handle manage subscription
              }}
            >
              {localize('com_subscription_manage')}
            </Button>
          )}
        </div>

        {currentPlan?.status === 'active' && (
          <Button
            variant="destructive"
            onClick={() => {
              // Handle cancel subscription
            }}
          >
            {localize('com_subscription_cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}