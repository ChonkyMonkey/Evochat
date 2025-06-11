import React, { useState } from 'react';
import { useLocalize } from '~/hooks';
import { usePaddle } from '~/contexts/PaddleProvider';
import { useGetSubscriptionQuery } from 'librechat-data-provider/react-query';
import { Button } from '~/components/ui';
import { AlertTriangle, X } from 'lucide-react';

interface CancelSubscriptionProps {
  onClose?: () => void;
}

const CancelSubscription: React.FC<CancelSubscriptionProps> = ({ onClose }) => {
  const localize = useLocalize();
  const { paddle } = usePaddle();
  const { data: subscription } = useGetSubscriptionQuery();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCancelClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirmCancel = async () => {
    if (!paddle || !subscription?.paddleSubscriptionId) {
      return;
    }

    setIsProcessing(true);
    try {
      // Use Paddle's customer portal for cancellation
      paddle.CustomerPortal.open({
        customerId: subscription.paddleCustomerId,
        subscriptionId: subscription.paddleSubscriptionId,
        initialView: 'cancel_subscription',
      });
      
      // Close the dialog after opening the portal
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to open cancellation portal:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!subscription || subscription.status !== 'active') {
    return (
      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {localize('com_subscription_cancel_title')}
        </h3>
        <p className="text-text-secondary">
          {localize('com_subscription_cancel_no_active')}
        </p>
      </div>
    );
  }

  if (showConfirmation) {
    return (
      <div className="rounded-lg border p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
              {localize('com_subscription_cancel_confirm')}
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {localize('com_subscription_cancel_warning')}
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="text-sm text-red-700 dark:text-red-300">
            <strong>{localize('com_subscription_cancel_what_happens')}</strong>
          </div>
          <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 ml-4">
            <li>• {localize('com_subscription_cancel_access_until', {
              date: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'the end of your billing period'
            })}</li>
            <li>• {localize('com_subscription_cancel_lose_access')}</li>
            <li>• {localize('com_subscription_cancel_history_preserved')}</li>
            <li>• {localize('com_subscription_cancel_can_resubscribe')}</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleConfirmCancel}
            variant="destructive"
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing ? localize('com_subscription_cancel_processing') : localize('com_subscription_cancel_confirm_button')}
          </Button>
          <Button
            onClick={() => setShowConfirmation(false)}
            variant="outline"
            className="flex-1"
          >
            {localize('com_subscription_cancel_keep_button')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">
          {localize('com_subscription_cancel_title')}
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-4">
          <h4 className="font-medium text-text-primary mb-2">
            {localize('com_billing_current_plan')}: {subscription.plan?.name}
          </h4>
          <p className="text-sm text-text-secondary">
            Active until: {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'Unknown'}
          </p>
          <p className="text-sm text-text-secondary">
            Monthly cost: ${subscription.plan?.price || 0}
          </p>
        </div>

        <div className="text-sm text-text-secondary">
          <p className="mb-2">
            <strong>{localize('com_subscription_cancel_before_consider')}</strong>
          </p>
          <ul className="space-y-1 ml-4">
            <li>• {localize('com_subscription_cancel_lose_models')}</li>
            <li>• {localize('com_subscription_cancel_limited_uploads')}</li>
            <li>• {localize('com_subscription_cancel_no_advanced')}</li>
            <li>• {localize('com_subscription_cancel_can_resubscribe_later')}</li>
          </ul>
        </div>

        <div className="pt-4">
          <Button
            onClick={handleCancelClick}
            variant="destructive"
            className="w-full"
          >
            {localize('com_subscription_cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CancelSubscription;