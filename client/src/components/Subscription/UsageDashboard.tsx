import React from 'react';
import { BarChart3, TrendingUp, Clock, Zap } from 'lucide-react';
import { useGetUsageData, useGetUserSubscription } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export default function UsageDashboard() {
  const localize = useLocalize();
  const { data: subscription, isLoading: subscriptionLoading } = useGetUserSubscription();
  const { data: usageData, isLoading: usageLoading } = useGetUsageData('current');

  const isLoading = subscriptionLoading || usageLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-text-secondary">{localize('com_ui_loading')}</span>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="text-center p-8">
        <BarChart3 className="h-16 w-16 mx-auto text-text-secondary mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {localize('com_subscription_no_subscription')}
        </h3>
        <p className="text-text-secondary">
          {localize('com_subscription_subscribe_to_view_usage')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {localize('com_subscription_usage_overview')}
        </h3>
        <p className="text-text-secondary">
          {localize('com_subscription_current_period_usage')}
        </p>
      </div>

      {/* Usage Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
              <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-medium text-text-primary">
              {localize('com_subscription_tokens_used')}
            </h4>
          </div>
          <div className="text-2xl font-bold text-text-primary mb-1">
            {usageData?.totalTokensUsed ? Math.round(usageData.totalTokensUsed / 1000) + 'K' : '0'}
          </div>
          <div className="text-sm text-text-secondary">
            {localize('com_subscription_this_period')}
          </div>
        </div>

        <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="font-medium text-text-primary">
              {localize('com_subscription_requests_made')}
            </h4>
          </div>
          <div className="text-2xl font-bold text-text-primary mb-1">
            {usageData?.totalRequests || 0}
          </div>
          <div className="text-sm text-text-secondary">
            {localize('com_subscription_this_period')}
          </div>
        </div>

        <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-2">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h4 className="font-medium text-text-primary">
              {localize('com_subscription_daily_average')}
            </h4>
          </div>
          <div className="text-2xl font-bold text-text-primary mb-1">
            {usageData?.dailyAverage ? Math.round(usageData.dailyAverage) : 0}
          </div>
          <div className="text-sm text-text-secondary">
            {localize('com_subscription_tokens_per_day')}
          </div>
        </div>
      </div>

      {/* Model Breakdown */}
      {usageData?.modelBreakdown && usageData.modelBreakdown.length > 0 && (
        <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
          <h4 className="text-lg font-semibold text-text-primary mb-4">
            {localize('com_subscription_usage_by_model')}
          </h4>
          <div className="space-y-3">
            {usageData.modelBreakdown.map((model, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-text-primary">
                    {model.model}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-text-secondary">
                    {Math.round(model.tokensUsed / 1000)}K tokens
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    {model.percentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Trend */}
      {usageData?.weeklyTrend && usageData.weeklyTrend.length > 0 && (
        <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
          <h4 className="text-lg font-semibold text-text-primary mb-4">
            {localize('com_subscription_weekly_trend')}
          </h4>
          <div className="space-y-2">
            {usageData.weeklyTrend.map((day, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="text-sm text-text-secondary">
                  {new Date(day.date).toLocaleDateString()}
                </div>
                <div className="text-sm font-medium text-text-primary">
                  {Math.round(day.tokensUsed / 1000)}K tokens
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan Limits */}
      <div className="rounded-lg border border-border-medium bg-surface-secondary p-6">
        <h4 className="text-lg font-semibold text-text-primary mb-4">
          {localize('com_subscription_plan_limits')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-between">
            <span className="text-text-secondary">{localize('com_subscription_current_plan')}</span>
            <span className="font-medium text-text-primary">
              {subscription.plan?.name || localize('com_subscription_free_plan')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">{localize('com_subscription_billing_cycle')}</span>
            <span className="font-medium text-text-primary">
              {subscription.plan?.interval || localize('com_subscription_not_applicable')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}