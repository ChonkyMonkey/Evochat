import React from 'react';
import { Check, Star, Zap } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { Button } from '~/components/ui';
import { usePaddleCheckout } from '~/contexts/PaddleProvider';
import { cn } from '~/utils';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  popular?: boolean;
  features: PlanFeature[];
  paddleProductId?: string;
}

const plans: Plan[] = [
  {
    id: 'basic',
    name: 'com_subscription_plan_basic',
    description: 'com_subscription_plan_basic_description',
    price: 14.99,
    billingCycle: 'monthly',
    popular: true,
    features: [
      { text: 'com_subscription_feature_messages_limit', included: true },
      { text: 'com_subscription_feature_advanced_models', included: true },
      { text: 'com_subscription_feature_file_uploads', included: true },
      { text: 'com_subscription_feature_image_generation', included: true },
      { text: 'com_subscription_feature_ai_search', included: true },
      { text: 'com_subscription_feature_agent_builder', included: true },
      { text: 'com_subscription_feature_rag_capabilities', included: true },
      { text: 'com_subscription_feature_prompt_templates', included: true },
      { text: 'com_subscription_feature_basic_support', included: true },
      { text: 'com_subscription_feature_and_more', included: true },
    ],
    paddleProductId: 'pro_monthly',
  },
  {
    id: 'pro',
    name: 'com_subscription_plan_pro',
    description: 'com_subscription_plan_pro_description',
    price: 49.99,
    billingCycle: 'monthly',
    features: [
      { text: 'com_subscription_feature_unlimited_messages', included: true },
      { text: 'com_subscription_feature_all_models', included: true },
      { text: 'com_subscription_feature_file_uploads', included: true },
      { text: 'com_subscription_feature_image_generation', included: true },
      { text: 'com_subscription_feature_ai_search', included: true },
      { text: 'com_subscription_feature_agent_builder', included: true },
      { text: 'com_subscription_feature_rag_capabilities', included: true },
      { text: 'com_subscription_feature_prompt_templates', included: true },
      { text: 'com_subscription_feature_premium_support', included: true },
      { text: 'com_subscription_feature_and_more', included: true },
    ],
    paddleProductId: 'team_monthly',
  },
];

export default function PlanSelection() {
  const localize = useLocalize();
  const { openCheckout } = usePaddleCheckout();

  const handleSelectPlan = async (plan: Plan) => {

    if (plan.paddleProductId) {
      try {
        await openCheckout({
          items: [{ priceId: plan.paddleProductId, quantity: 1 }],
          onSuccess: (data) => {
            console.log('Subscription successful:', data);
            // Handle successful subscription
          },
          onError: (error) => {
            console.error('Subscription failed:', error);
            // Handle subscription error
          },
        });
      } catch (error) {
        console.error('Failed to open checkout:', error);
      }
    }
  };

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
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              'relative rounded-lg border p-6 transition-all duration-200',
              plan.popular
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                : 'border-border-medium bg-surface-primary hover:border-border-heavy'
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-1 rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white">
                  <Star className="h-3 w-3" />
                  {localize('com_subscription_most_popular')}
                </div>
              </div>
            )}

            <div className="text-center">
              <h4 className="text-lg font-semibold text-text-primary">{localize(plan.name)}</h4>
              <p className="mt-1 text-sm text-text-secondary">{localize(plan.description)}</p>
              
              <div className="mt-4">
                <div className="flex items-baseline justify-center">
                  <span className="text-3xl font-bold text-text-primary">
                    ${plan.price}
                  </span>
                  {plan.price > 0 && (
                    <span className="ml-1 text-text-secondary">
                      /{localize(`com_subscription_${plan.billingCycle}`)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {plan.features.map((feature, index) => {
                const isHighlighted = feature.text.includes('Unlimitted messages') ||
                                    feature.text.includes('Premium support') ||
                                    feature.text.includes('Advanced AI models');
                
                return (
                  <div key={index} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <div className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    )}
                    <span
                      className={cn(
                        'text-sm',
                        feature.included
                          ? 'text-text-primary'
                          : 'text-text-secondary line-through',
                        isHighlighted && feature.included && 'font-bold'
                      )}
                    >
                      {localize(feature.text)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Message count disclaimer for plans with message limits */}
            {plan.features.some(f => localize(f.text).includes('*')) && (
              <div className="mt-4 text-xs text-text-secondary bg-surface-secondary rounded p-2">
                {localize('com_subscription_message_count_disclaimer')}
              </div>
            )}

            <div className="mt-8">
              <Button
                variant={plan.popular ? 'default' : 'outline'}
                className="w-full"
                onClick={() => handleSelectPlan(plan)}
                disabled={false}
              >
                {(
                  <>
                    {plan.popular && <Zap className="mr-2 h-4 w-4" />}
                    {localize('com_subscription_select_plan')}
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
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