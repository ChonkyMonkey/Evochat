import React from 'react';
import { useRecoilValue } from 'recoil';
import { BarChart3, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { useGetUserSubscription, useGetUsageData } from '~/data-provider';
import { useLocalize } from '~/hooks';
import subscriptionStore from '~/store/subscription';
import { cn } from '~/utils';

interface UsageProgressBarProps {
  label: string;
  current: number;
  limit: number;
  unit?: string;
  colorClass?: string;
}

function UsageProgressBar({ label, current, limit, unit = '', colorClass = 'bg-blue-500' }: UsageProgressBarProps) {
  const localize = useLocalize();
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isAt25Percent = percentage >= 25;
  const isAt50Percent = percentage >= 50;
  const isAt75Percent = percentage >= 75;
  const isOverLimit = percentage >= 100;
  
  // Only show warnings at specific thresholds, not upgrade prompts until 100%
  const showWarning = isAt25Percent && !isOverLimit;
  const warningLevel = percentage >= 75 ? 'high' : percentage >= 50 ? 'medium' : 'low';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className={cn(
          'text-sm',
          isOverLimit ? 'text-red-600 dark:text-red-400' :
          isAt75Percent ? 'text-orange-600 dark:text-orange-400' :
          isAt50Percent ? 'text-yellow-600 dark:text-yellow-400' :
          isAt25Percent ? 'text-blue-600 dark:text-blue-400' :
          'text-text-secondary'
        )}>
          {current.toLocaleString()}{unit} / {limit > 0 ? limit.toLocaleString() + unit : 'Unlimited'}
        </span>
      </div>
      <div className="w-full bg-surface-secondary rounded-full h-2">
        <div
          className={cn(
            'h-2 rounded-full transition-all duration-300',
            isOverLimit ? 'bg-red-500' :
            isAt75Percent ? 'bg-orange-500' :
            isAt50Percent ? 'bg-yellow-500' :
            isAt25Percent ? 'bg-blue-400' :
            colorClass
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {showWarning && (
        <div className={cn(
          'flex items-center gap-1 text-xs',
          warningLevel === 'high' ? 'text-orange-600 dark:text-orange-400' :
          warningLevel === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
          'text-blue-600 dark:text-blue-400'
        )}>
          <AlertTriangle className="h-3 w-3" />
          {warningLevel === 'high' ? localize('com_subscription_usage_warning_75') :
           warningLevel === 'medium' ? localize('com_subscription_usage_warning_50') :
           localize('com_subscription_usage_warning_25')}
        </div>
      )}
      {isOverLimit && (
        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" />
          {localize('com_subscription_usage_limit_exceeded')}
        </div>
      )}
    </div>
  );
}

export default function UsageDashboard() {
  const localize = useLocalize();
  const subscription = useRecoilValue(subscriptionStore.subscription);
  const usageData = useRecoilValue(subscriptionStore.usageData);
  const { data: subscriptionData, isLoading: subscriptionLoading } = useGetUserSubscription();
  const { data: usageDataFromQuery, isLoading: usageLoading } = useGetUsageData('current');
  
  const isLoading = subscriptionLoading || usageLoading;

  const currentPlan = subscriptionData || subscription;
  const usage = usageDataFromQuery || usageData || currentPlan?.usage || {};

  const currentPeriodStart = new Date();
  currentPeriodStart.setDate(1); // First day of current month
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1, 0); // Last day of current month

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-text-secondary">{localize('com_ui_loading')}</div>
      </div>
    );
  }

  const usageStats = [
    {
      label: localize('com_subscription_messages_used'),
      current: usage.messages || 0,
      limit: currentPlan?.limits?.messages || 0,
      icon: <BarChart3 className="h-5 w-5" />,
      colorClass: 'bg-blue-500',
    },
    {
      label: localize('com_subscription_tokens_used'),
      current: usage.tokens || 0,
      limit: currentPlan?.limits?.tokens || 0,
      unit: 'K',
      icon: <TrendingUp className="h-5 w-5" />,
      colorClass: 'bg-green-500',
      displayCurrent: Math.round((usage.tokens || 0) / 1000),
      displayLimit: Math.round((currentPlan?.limits?.tokens || 0) / 1000),
    },
    {
      label: localize('com_subscription_requests_used'),
      current: usage.requests || 0,
      limit: currentPlan?.limits?.requests || 0,
      icon: <Calendar className="h-5 w-5" />,
      colorClass: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Current Billing Period */}
      <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">
            {localize('com_subscription_current_period')}
          </h3>
          <div className="text-sm text-text-secondary">
            {currentPeriodStart.toLocaleDateString()} - {currentPeriodEnd.toLocaleDateString()}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {usageStats.map((stat, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn('p-2 rounded-lg bg-opacity-10', stat.colorClass.replace('bg-', 'bg-opacity-10 text-'))}>
                  {stat.icon}
                </div>
                <div>
                  <div className="text-sm font-medium text-text-primary">{stat.label}</div>
                  <div className="text-xs text-text-secondary">
                    {stat.limit > 0 ? `${stat.displayCurrent || stat.current}${stat.unit || ''} ${localize('com_ui_used')}` : localize('com_subscription_not_applicable')}
                  </div>
                </div>
              </div>
              
              <UsageProgressBar
                label=""
                current={stat.displayCurrent || stat.current}
                limit={stat.displayLimit || stat.limit}
                unit={stat.unit}
                colorClass={stat.colorClass}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Usage Breakdown */}
      <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
        <h3 className="mb-4 text-lg font-semibold text-text-primary">
          {localize('com_subscription_usage_breakdown')}
        </h3>
        
        <div className="space-y-4">
          <UsageProgressBar
            label={localize('com_subscription_messages_used')}
            current={usage.messages || 0}
            limit={currentPlan?.limits?.messages || 0}
            colorClass="bg-blue-500"
          />
          
          <UsageProgressBar
            label={localize('com_subscription_tokens_used')}
            current={Math.round((usage.tokens || 0) / 1000)}
            limit={Math.round((currentPlan?.limits?.tokens || 0) / 1000)}
            unit="K"
            colorClass="bg-green-500"
          />
          
          <UsageProgressBar
            label={localize('com_subscription_requests_used')}
            current={usage.requests || 0}
            limit={currentPlan?.limits?.requests || 0}
            colorClass="bg-purple-500"
          />

          {usage.imageGenerations !== undefined && (
            <UsageProgressBar
              label={localize('com_subscription_image_generations')}
              current={usage.imageGenerations || 0}
              limit={currentPlan?.limits?.imageGenerations || 0}
              colorClass="bg-pink-500"
            />
          )}

          {usage.fileUploads !== undefined && (
            <UsageProgressBar
              label={localize('com_subscription_file_uploads')}
              current={usage.fileUploads || 0}
              limit={currentPlan?.limits?.fileUploads || 0}
              colorClass="bg-orange-500"
            />
          )}
        </div>
      </div>

      {/* Usage History */}
      <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
        <h3 className="mb-4 text-lg font-semibold text-text-primary">
          {localize('com_subscription_usage_history')}
        </h3>
        
        {usage.history && usage.history.length > 0 ? (
          <div className="space-y-3">
            {usage.history.slice(0, 5).map((entry, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary">
                <div>
                  <div className="text-sm font-medium text-text-primary">
                    {new Date(entry.date).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {entry.messages} messages, {Math.round(entry.tokens / 1000)}K tokens
                  </div>
                </div>
                <div className="text-sm text-text-secondary">
                  {entry.requests} requests
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-text-secondary py-8">
            {localize('com_subscription_no_usage_history')}
          </div>
        )}
      </div>

      {/* Usage Tips */}
      <div className="rounded-lg border border-border-medium bg-surface-secondary p-6">
        <h3 className="mb-4 text-lg font-semibold text-text-primary">
          {localize('com_subscription_usage_tips')}
        </h3>
        <div className="space-y-2 text-sm text-text-secondary">
          <div>• {localize('com_subscription_tip_shorter_messages')}</div>
          <div>• {localize('com_subscription_tip_efficient_models')}</div>
          <div>• {localize('com_subscription_tip_batch_requests')}</div>
          <div>• {localize('com_subscription_tip_monitor_usage')}</div>
        </div>
      </div>
    </div>
  );
}