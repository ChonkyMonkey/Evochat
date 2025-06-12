import React from 'react';
import { useLocalize } from '~/hooks';
import { useGetUserSubscription } from 'librechat-data-provider/react-query';
import { usePaddle } from '~/contexts/PaddleProvider';
import { Button } from '~/components/ui';

const BillingHistory: React.FC = () => {
  const localize = useLocalize();
  const { paddle, isLoaded } = usePaddle();
  const { data: subscription, isLoading } = useGetUserSubscription();

  const handleOpenCustomerPortal = () => {
    if (!paddle || !subscription?.paddleCustomerId) {
      return;
    }

    // Use Paddle's customer portal for billing history and invoice management
    paddle.CustomerPortal.open({
      customerId: subscription.paddleCustomerId,
      subscriptionId: subscription.paddleSubscriptionId,
    });
  };

  if (isLoading || !isLoaded) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {localize('com_billing_history')}
        </h3>
        <p className="text-text-secondary">
          {localize('com_billing_no_subscription')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-text-primary">
          {localize('com_billing_history')}
        </h3>
        <Button
          onClick={handleOpenCustomerPortal}
          variant="default"
          size="sm"
        >
          {localize('com_billing_view_invoices')}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="text-sm text-text-secondary">
          {localize('com_billing_managed_by_paddle')}
        </div>
        
        {/* Current subscription info */}
        <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-4">
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
            variant="outline"
            size="sm"
          >
            {localize('com_billing_open_customer_portal')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BillingHistory;