import React from 'react';
import { useLocalize } from '~/hooks';
import { AlertTriangle, TrendingUp, X } from 'lucide-react';
import { Button } from '~/components/ui';
import { cn } from '~/utils';

interface UsageWarningProps {
  usagePercentage: number;
  currentUsage: number;
  limit: number;
  onClose?: () => void;
  onUpgrade?: () => void;
}

const UsageWarning: React.FC<UsageWarningProps> = ({
  usagePercentage,
  currentUsage,
  limit,
  onClose,
  onUpgrade,
}) => {
  const localize = useLocalize();

  // Only show warnings at specified thresholds: 25%, 50%, 75%, and 100%
  const shouldShow = usagePercentage >= 25;
  const isAtLimit = usagePercentage >= 100;

  if (!shouldShow) {
    return null;
  }

  const getWarningLevel = () => {
    if (usagePercentage >= 100) return 'critical';
    if (usagePercentage >= 75) return 'high';
    if (usagePercentage >= 50) return 'medium';
    return 'low';
  };

  const warningLevel = getWarningLevel();

  const getWarningStyles = () => {
    switch (warningLevel) {
      case 'critical':
        return {
          container: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
          text: 'text-red-900 dark:text-red-100',
          subtext: 'text-red-700 dark:text-red-300',
          icon: 'text-red-600 dark:text-red-400',
        };
      case 'high':
        return {
          container: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
          text: 'text-orange-900 dark:text-orange-100',
          subtext: 'text-orange-700 dark:text-orange-300',
          icon: 'text-orange-600 dark:text-orange-400',
        };
      case 'medium':
        return {
          container: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-900 dark:text-yellow-100',
          subtext: 'text-yellow-700 dark:text-yellow-300',
          icon: 'text-yellow-600 dark:text-yellow-400',
        };
      default:
        return {
          container: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
          text: 'text-blue-900 dark:text-blue-100',
          subtext: 'text-blue-700 dark:text-blue-300',
          icon: 'text-blue-600 dark:text-blue-400',
        };
    }
  };

  const styles = getWarningStyles();

  const getTitle = () => {
    if (isAtLimit) return localize('com_usage_warning_title_100');
    if (usagePercentage >= 75) return localize('com_usage_warning_title_75');
    if (usagePercentage >= 50) return localize('com_usage_warning_title_50');
    return localize('com_usage_warning_title_25');
  };

  const getMessage = () => {
    if (isAtLimit) {
      return localize('com_usage_warning_message_100', { limit: limit.toLocaleString() });
    }
    if (usagePercentage >= 75) {
      return localize('com_usage_warning_message_75', {
        percentage: usagePercentage.toFixed(0),
        current: currentUsage.toLocaleString(),
        limit: limit.toLocaleString()
      });
    }
    if (usagePercentage >= 50) {
      return localize('com_usage_warning_message_50', {
        current: currentUsage.toLocaleString(),
        limit: limit.toLocaleString()
      });
    }
    return localize('com_usage_warning_message_25', {
      percentage: usagePercentage.toFixed(0),
      current: currentUsage.toLocaleString(),
      limit: limit.toLocaleString()
    });
  };

  return (
    <div className={cn('rounded-lg border p-4 mb-4', styles.container)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn('h-5 w-5 flex-shrink-0 mt-0.5', styles.icon)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className={cn('font-medium', styles.text)}>
              {getTitle()}
            </h4>
            {onClose && (
              <button
                onClick={onClose}
                className={cn('hover:opacity-70', styles.text)}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className={cn('text-sm mt-1', styles.subtext)}>
            {getMessage()}
          </p>
          
          {/* Usage bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className={styles.subtext}>Current Usage</span>
              <span className={styles.subtext}>{usagePercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  warningLevel === 'critical' ? 'bg-red-500' :
                  warningLevel === 'high' ? 'bg-orange-500' :
                  warningLevel === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                )}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Only show upgrade prompt when at 100% usage */}
          {isAtLimit && onUpgrade && (
            <div className="mt-4 flex gap-2">
              <Button
                onClick={onUpgrade}
                variant="default"
                size="sm"
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                {localize('com_usage_warning_upgrade_plan')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsageWarning;