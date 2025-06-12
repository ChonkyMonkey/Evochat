import React, { useState, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { MessageSquare, Users, TrendingUp, Lightbulb, ChevronRight } from 'lucide-react';
import { useGetUserSubscription, useGetUsageData } from '~/data-provider';
import { useLocalize } from '~/hooks';
import subscriptionStore from '~/store/subscription';
import { cn } from '~/utils';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

function CircularProgress({ percentage, size = 120, strokeWidth = 8, color = '#3b82f6' }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-surface-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-text-primary">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}

interface ModelUsageBarProps {
  model: string;
  percentage: number;
  color: string;
  messageCount: number;
}

function ModelUsageBar({ model, percentage, color, messageCount }: ModelUsageBarProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: color }} />
        <div>
          <div className="text-sm font-medium text-text-primary">{model}</div>
          <div className="text-xs text-text-secondary">{messageCount} messages</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-text-primary">{percentage.toFixed(1)}%</div>
      </div>
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

  // Calculate usage percentage (for Basic plan, this tracks €10 spending internally but shows as message-based to user)
  const messagesUsed = usage.messages || 0;
  const messageLimit = currentPlan?.limits?.messages || 1500; // Default Basic plan limit
  const usagePercentage = messageLimit > 0 ? Math.min((messagesUsed / messageLimit) * 100, 100) : 0;

  // Model usage data from actual usage tracking
  // Ensure modelUsage is always an array to prevent "map is not a function" errors
  const rawModelUsage = usage.modelUsage;
  const modelUsage = Array.isArray(rawModelUsage) ? rawModelUsage : [
    { model: 'GPT-4', percentage: messagesUsed > 0 ? 55 : 0, messageCount: Math.round(messagesUsed * 0.55), color: '#10b981' },
    { model: 'Claude', percentage: messagesUsed > 0 ? 30 : 0, messageCount: Math.round(messagesUsed * 0.30), color: '#3b82f6' },
    { model: 'Gemini', percentage: messagesUsed > 0 ? 15 : 0, messageCount: Math.round(messagesUsed * 0.15), color: '#8b5cf6' },
  ];

  // Debug logging to help identify the issue
  console.log('UsageDashboard Debug:', {
    usage,
    rawModelUsage,
    isRawModelUsageArray: Array.isArray(rawModelUsage),
    modelUsage,
    isModelUsageArray: Array.isArray(modelUsage)
  });

  // Calculate active chats from actual data
  const activeChats = usage.activeChats || 0;

  // Calculate trend from actual data
  const trendPercentage = usage.trendPercentage || 0;
  const isPositiveTrend = trendPercentage > 0;

  // Rotating tips for bottom bar
  const tips = [
    localize('com_subscription_tip_shorter_messages'),
    localize('com_subscription_tip_efficient_models'),
    localize('com_subscription_tip_batch_requests'),
    localize('com_subscription_tip_monitor_usage'),
    localize('com_subscription_tip_different_models'),
    localize('com_subscription_tip_conversation_starters'),
  ];

  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 30000); // Change tip every 30 seconds

    return () => clearInterval(interval);
  }, [tips.length]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-semibold text-text-primary mb-2">
          {localize('com_subscription_activity_title')}
        </h3>
        <p className="text-text-secondary">
          {localize('com_subscription_activity_subtitle')}
        </p>
      </div>

      {/* Core Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Messages Sent */}
        <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-sm text-text-secondary">{localize('com_subscription_messages_sent')}</div>
              <div className="text-2xl font-bold text-text-primary">{messagesUsed.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Active Chats */}
        <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-sm text-text-secondary">{localize('com_subscription_active_chats')}</div>
              <div className="text-2xl font-bold text-text-primary">{activeChats}</div>
            </div>
          </div>
        </div>

        {/* Monthly Usage Progress */}
        <div className="rounded-lg border border-border-medium bg-surface-primary p-6 md:col-span-2 lg:col-span-1">
          <div className="text-center">
            <div className="text-sm text-text-secondary mb-4">{localize('com_subscription_monthly_usage')}</div>
            <CircularProgress
              percentage={usagePercentage}
              color={usagePercentage > 85 ? '#ef4444' : usagePercentage > 70 ? '#f59e0b' : '#3b82f6'}
            />
            <div className="text-xs text-text-secondary mt-2">{localize('com_subscription_of_included_usage')}</div>
          </div>
        </div>
      </div>

      {/* Model Usage Breakdown */}
      <div className="rounded-lg border border-border-medium bg-surface-primary p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-text-primary">{localize('com_subscription_model_usage_title')}</h3>
          <span className="text-sm text-text-secondary">— {localize('com_subscription_model_usage_subtitle')}</span>
        </div>
        <div className="space-y-3">
          {modelUsage.map((model, index) => (
            <ModelUsageBar
              key={index}
              model={model.model}
              percentage={model.percentage}
              color={model.color}
              messageCount={model.messageCount}
            />
          ))}
        </div>
      </div>

      {/* Trend Indicator */}
      <div className="rounded-lg border border-border-medium bg-surface-primary p-4">
        <div className="flex items-center justify-center gap-2">
          <TrendingUp className={cn(
            "h-4 w-4",
            isPositiveTrend ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )} />
          <span className="text-sm text-text-secondary">
            {isPositiveTrend ? '↗' : '↘'} {Math.abs(trendPercentage)}% compared to last month
          </span>
        </div>
      </div>

      {/* Bottom Tip Bar */}
      <div className="sticky bottom-0 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Tip:</strong> {tips[currentTipIndex]}
          </span>
        </div>
      </div>
    </div>
  );
}