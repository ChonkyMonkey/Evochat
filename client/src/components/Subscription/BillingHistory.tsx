import React from 'react';
import { useLocalize } from '~/hooks';
import { useGetUserSubscription } from '~/data-provider';
import { Button } from '~/components/ui';

const BillingHistory: React.FC = () => {
  const localize = useLocalize();
  const { data: subscription, isLoading } = useGetUserSubscription();

  const handleOpenCustomerPortal = async () => {
    if (!subscription?.id) {
      return;
    }

    try {
      // Call backend API to get customer portal URL
      const response = await fetch('/api/subscription/portal', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get customer portal URL');
      }

      const data = await response.json();
      
      if (data.portalUrl) {
        // Open Paddle customer portal in new tab
        window.open(data.portalUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to open customer portal:', error);
      alert('Failed to open customer portal. Please contact support.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            {localize('com_billing_history')}
          </h3>
          <div className="text-center py-8">
            <p className="text-text-secondary mb-4">
              {localize('com_billing_no_subscription')}
            </p>
            <p className="text-sm text-text-secondary">
              {localize('com_billing_no_subscription_help')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-primary">
            {localize('com_billing_history')}
          </h3>
          <Button
            onClick={handleOpenCustomerPortal}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {localize('com_billing_view_invoices')}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-text-secondary">
            {localize('com_billing_managed_by_paddle')}
          </div>
          
          {/* Current subscription info */}
          <div className="rounded-lg bg-surface-secondary p-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-text-primary">
                  {subscription.plan?.name || localize('com_billing_current_plan')}
                </h4>
                <p className="text-sm text-text-secondary mt-1">
                  {subscription.status === 'active'
                    ? localize('com_billing_active_subscription')
                    : localize('com_billing_status', { status: subscription.status })
                  }
                </p>
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-text-secondary mt-1">
                    {localize('com_billing_next_billing', {
                      date: new Date(subscription.currentPeriodEnd).toLocaleDateString()
                    })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-medium text-text-primary">
                  ${subscription.plan?.price || 0}/{subscription.plan?.interval || 'month'}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center py-4">
            <p className="text-sm text-text-secondary mb-3">
              {localize('com_billing_full_history_available')}
            </p>
            <Button
              onClick={handleOpenCustomerPortal}
              className="border border-border-medium bg-surface-secondary hover:bg-surface-tertiary text-text-primary"
            >
              {localize('com_billing_open_customer_portal')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingHistory;