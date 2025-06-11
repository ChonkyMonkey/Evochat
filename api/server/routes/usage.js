const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const {
  getMonthlyUsage,
  getWeeklyUsage,
  getUserUsageHistory,
  getDailyUsage,
  checkWeeklyWarning,
  getTopModelsByUsage,
} = require('~/models/UsageRecord');
const { getSubscriptionStatus } = require('~/models/Subscription');

const router = express.Router();

/**
 * GET /api/usage/current
 * Get current month usage for authenticated user
 */
router.get('/current', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    
    logger.debug(`[UsageRoutes] Getting current usage for user ${userId}`);
    
    const monthlyUsage = await getMonthlyUsage(
      userId,
      now.getFullYear(),
      now.getMonth() + 1
    );
    
    // Get subscription info for quota calculation
    const subscriptionStatus = await getSubscriptionStatus(userId);
    
    let usagePercentage = 0;
    let quota = 0;
    let remainingQuota = 0;
    
    if (subscriptionStatus && subscriptionStatus.plan) {
      quota = subscriptionStatus.plan.tokenQuotaMonthly;
      if (quota > 0) {
        usagePercentage = Math.min((monthlyUsage.totalTokensUsed / quota) * 100, 100);
        remainingQuota = Math.max(0, quota - monthlyUsage.totalTokensUsed);
      } else if (quota === -1) {
        // Unlimited plan
        usagePercentage = 0;
        remainingQuota = -1; // Unlimited
      }
    }
    
    res.json({
      success: true,
      usage: {
        ...monthlyUsage,
        usagePercentage,
        quota,
        remainingQuota,
        period: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
      },
    });
    
  } catch (error) {
    logger.error('[UsageRoutes] Error getting current usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage data',
    });
  }
});

/**
 * GET /api/usage/history
 * Get usage history for authenticated user
 */
router.get('/history', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { months = 6 } = req.query;
    
    logger.debug(`[UsageRoutes] Getting usage history for user ${userId}, months: ${months}`);
    
    const history = await getUserUsageHistory(userId, parseInt(months));
    
    res.json({
      success: true,
      history,
      months: parseInt(months),
    });
    
  } catch (error) {
    logger.error('[UsageRoutes] Error getting usage history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage history',
    });
  }
});

/**
 * GET /api/usage/weekly
 * Get current week usage breakdown
 */
router.get('/weekly', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    
    // Calculate start and end of current week (Monday to Sunday)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + mondayOffset);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    logger.debug(`[UsageRoutes] Getting weekly usage for user ${userId}`);
    
    const weeklyUsage = await getWeeklyUsage(userId, startOfWeek, endOfWeek);
    
    // Get subscription status for usage context
    const subscriptionStatus = await getSubscriptionStatus(userId);
    
    res.json({
      success: true,
      usage: {
        ...weeklyUsage,
        startOfWeek,
        endOfWeek,
      },
      subscription: subscriptionStatus,
    });
    
  } catch (error) {
    logger.error('[UsageRoutes] Error getting weekly usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get weekly usage',
    });
  }
});

/**
 * GET /api/usage/daily
 * Get daily usage for a specific date range
 */
router.get('/daily', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, days = 30 } = req.query;
    
    let start, end;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Default to last N days
      end = new Date();
      start = new Date();
      start.setDate(start.getDate() - parseInt(days));
    }
    
    logger.debug(`[UsageRoutes] Getting daily usage for user ${userId}, range: ${start} to ${end}`);
    
    const dailyUsage = await getDailyUsage(userId, start, end);
    
    res.json({
      success: true,
      usage: dailyUsage,
      range: {
        startDate: start,
        endDate: end,
      },
    });
    
  } catch (error) {
    logger.error('[UsageRoutes] Error getting daily usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get daily usage',
    });
  }
});

/**
 * GET /api/usage/models
 * Get top models by usage
 */
router.get('/models', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30, limit = 10 } = req.query;
    
    logger.debug(`[UsageRoutes] Getting top models for user ${userId}`);
    
    const topModels = await getTopModelsByUsage(
      userId,
      parseInt(days),
      parseInt(limit)
    );
    
    res.json({
      success: true,
      models: topModels,
      period: {
        days: parseInt(days),
      },
    });
    
  } catch (error) {
    logger.error('[UsageRoutes] Error getting model usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get model usage data',
    });
  }
});

/**
 * GET /api/usage/export
 * Export usage data in CSV format
 */
router.get('/export', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { format = 'csv', months = 6 } = req.query;
    
    logger.debug(`[UsageRoutes] Exporting usage data for user ${userId}`);
    
    if (format !== 'csv') {
      return res.status(400).json({
        success: false,
        error: 'Only CSV format is currently supported',
      });
    }
    
    // Get usage history
    const history = await getUserUsageHistory(userId, parseInt(months));
    
    // Convert to CSV
    const csvHeader = 'Year,Month,Total Tokens Used,Total Requests,Days Active\n';
    const csvRows = history.map(record => {
      return `${record._id.year},${record._id.month},${record.totalTokensUsed},${record.totalRequests},${record.days}`;
    }).join('\n');
    
    const csvContent = csvHeader + csvRows;
    
    // Set response headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="usage-export-${userId}-${Date.now()}.csv"`);
    
    res.send(csvContent);
    
  } catch (error) {
    logger.error('[UsageRoutes] Error exporting usage data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export usage data',
    });
  }
});

/**
 * GET /api/usage/warnings
 * Check for usage notifications based on monthly thresholds
 */
router.get('/warnings', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    logger.debug(`[UsageRoutes] Checking usage notifications for user ${userId}`);
    
    const subscriptionStatus = await getSubscriptionStatus(userId);
    
    if (!subscriptionStatus || !subscriptionStatus.plan) {
      return res.json({
        success: true,
        notifications: [],
        hasActiveSubscription: false,
      });
    }
    
    const notifications = [];
    
    // Check monthly usage notifications
    if (subscriptionStatus.plan.tokenQuotaMonthly > 0) {
      const { getBillingConfig } = require('~/services/billingConfig');
      const billingConfig = getBillingConfig();
      const thresholds = billingConfig.getNotificationThresholds();
      
      const usagePercentage = subscriptionStatus.usage.percentage;
      
      // Find the highest threshold that has been exceeded
      let triggeredThreshold = null;
      for (const threshold of thresholds.sort((a, b) => b - a)) {
        if (usagePercentage >= threshold) {
          triggeredThreshold = threshold;
          break;
        }
      }
      
      if (triggeredThreshold) {
        const isQuotaExceeded = triggeredThreshold >= 100;
        notifications.push({
          type: 'monthly_usage',
          severity: isQuotaExceeded ? 'critical' : usagePercentage >= 75 ? 'high' : 'medium',
          threshold: triggeredThreshold,
          actualPercentage: usagePercentage,
          message: isQuotaExceeded
            ? 'Monthly quota exceeded - service temporarily limited'
            : `You've used ${usagePercentage.toFixed(1)}% of your monthly quota`,
          isBlocking: isQuotaExceeded,
          data: {
            usage: subscriptionStatus.usage.tokensUsed,
            quota: subscriptionStatus.usage.quota,
            percentage: usagePercentage,
          },
        });
      }
    }
    
    // Check if subscription is expiring soon
    if (subscriptionStatus.remainingDays <= 7) {
      notifications.push({
        type: 'subscription_expiring',
        severity: subscriptionStatus.remainingDays <= 3 ? 'high' : 'medium',
        message: `Your subscription expires in ${subscriptionStatus.remainingDays} days`,
        isBlocking: false,
        data: {
          remainingDays: subscriptionStatus.remainingDays,
          expiresAt: subscriptionStatus.subscription.currentPeriodEnd,
        },
      });
    }
    
    res.json({
      success: true,
      notifications,
      hasActiveSubscription: true,
    });
    
  } catch (error) {
    logger.error('[UsageRoutes] Error checking usage notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check usage notifications',
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  logger.error('[UsageRoutes] Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

module.exports = router;