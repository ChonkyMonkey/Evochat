import React from 'react';
import { Check, Star, Zap, Loader } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { Button } from '~/components/ui';
import { usePaddleCheckout } from '~/contexts/PaddleProvider';
import { useGetAvailablePlans, useGetUserSubscription } from '~/data-provider';
import { cn } from '~/utils';

export default function PlanSelection() {
  const localize = useLocalize();
  const { openCheckout, isLoaded } = usePaddleCheckout();
  const { data: plans, isLoading: plansLoading } = useGetAvailablePlans();
  const { data: currentSubscription } = useGetUserSubscription();

  const handleSelectPlan = async (plan: any) => {
    if (!isLoaded) {
      console.error('Paddle is not loaded yet');
      return;
    }

    if (!plan.paddlePriceId) {
      console.error('Plan does not have a Paddle price ID');
      return;
    }

    try {
      // Use Paddle's overlay checkout
      await openCheckout({
        items: [
          {
            priceId: plan.paddlePriceId,
            quantity: 1,
          },
        ],
        successUrl: window.location.origin + '/subscription/success',
        onSuccess: (data) => {
          console.log('Subscription successful:', data);
          // Optionally refresh subscription data
          window.location.reload();
        },
        onError: (error) => {
          console.error('Subscription failed:', error);
        },
      });
    } catch (error) {
      console.error('Failed to open checkout:', error);
    }
  };

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-text-secondary">{localize('com_ui_loading')}</span>
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-text-secondary">{localize('com_ui_no_data')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-text-primary">
          {localize('com_subscription_choose_plan')}
        </h3>
        <p className="mt-2 text-text-secondary">
          {localize('com_subscription_plan_description')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-10">
        {plans.map((plan) => {
          const isCurrentPlan = currentSubscription?.planId === plan.id;
          
          return (
            <div
              key={plan.id}
              className={cn(
                'relative rounded-lg border p-6 transition-all duration-200',
                plan.isPopular
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : 'border-border-medium bg-surface-primary hover:border-border-heavy',
                isCurrentPlan && 'ring-2 ring-green-500'
              )}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white">
                    <Star className="h-3 w-3" />
                    {localize('com_subscription_most_popular')}
                  </div>
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <div className="rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
                    {localize('com_subscription_current_plan')}
                  </div>
                </div>
              )}

              <div className="text-center">
                <h4 className="text-lg font-semibold text-text-primary">{plan.name}</h4>
                <p className="mt-1 text-sm text-text-secondary">{plan.description}</p>
                
                <div className="mt-4">
                  <div className="flex items-baseline justify-center">
                    <span className="text-3xl font-bold text-text-primary">
                      ${plan.price}
                    </span>
                    {plan.price > 0 && (
                      <span className="ml-1 text-text-secondary">
                        /{plan.interval}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {plan.features?.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-text-primary">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Button
                  variant={plan.isPopular ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => handleSelectPlan(plan)}
                  disabled={!isLoaded || isCurrentPlan}
                >
                  {isCurrentPlan ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      {localize('com_subscription_current_plan')}
                    </>
                  ) : (
                    <>
                      {plan.isPopular && <Zap className="mr-2 h-4 w-4" />}
                      {localize('com_subscription_select_plan')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-lg border border-border-medium bg-surface-secondary p-6">
        <h4 className="text-lg font-semibold text-text-primary mb-4">
          {localize('com_subscription_faq_title')}
        </h4>
        <div className="space-y-4 text-sm">
          <div>
            <div className="font-medium text-text-primary">
              {localize('com_subscription_faq_cancel')}
            </div>
            <div className="text-text-secondary">
              {localize('com_subscription_faq_cancel_answer')}
            </div>
          </div>
          <div>
            <div className="font-medium text-text-primary">
              {localize('com_subscription_faq_upgrade')}
            </div>
            <div className="text-text-secondary">
              {localize('com_subscription_faq_upgrade_answer')}
            </div>
          </div>
          <div>
            <div className="font-medium text-text-primary">
              {localize('com_subscription_faq_support')}
            </div>
            <div className="text-text-secondary">
              {localize('com_subscription_faq_support_answer')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}