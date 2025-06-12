const { logger } = require('@librechat/data-schemas');
const { UsageRecord } = require('~/db/models');

/**
 * Records token usage for a user
 * @param {Object} usageData - Usage data
 * @param {string} usageData.userId - The user ID
 * @param {string} usageData.subscriptionId - The subscription ID
 * @param {string} usageData.model - The model used
 * @param {number} usageData.tokenCost - Token cost in cents
 * @param {number} usageData.requestCount - Number of requests (default: 1)
 * @returns {Promise<Object>} The updated usage record
 */
async function recordUsage(usageData) {
  try {
    const { userId, subscriptionId, model, tokenCost, requestCount = 1 } = usageData;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    // Find or create today's usage record
    let usageRecord = await UsageRecord.findOne({
      userId,
      date: today,
    });

    if (!usageRecord) {
      // Create new record for today
      usageRecord = new UsageRecord({
        userId,
        subscriptionId,
        date: today,
        tokensUsed: tokenCost,
        requestCount,
        modelUsage: new Map([[model, tokenCost]]),
      });
    } else {
      // Update existing record
      usageRecord.tokensUsed += tokenCost;
      usageRecord.requestCount += requestCount;
      
      // Update model usage
      const currentModelUsage = usageRecord.modelUsage.get(model) || 0;
      usageRecord.modelUsage.set(model, currentModelUsage + tokenCost);
    }

    await usageRecord.save();
    
    logger.debug(`[UsageRecord] Recorded usage for user ${userId}: ${tokenCost} tokens for ${model}`);
    return usageRecord;
  } catch (error) {
    logger.error('[UsageRecord] Error recording usage:', error);
    throw error;
  }
}

/**
 * Gets current month usage for a user
 * @param {string} userId - The user ID
 * @param {number} year - Year (optional, defaults to current year)
 * @param {number} month - Month (optional, defaults to current month)
 * @returns {Promise<Object>} Monthly usage statistics
 */
async function getMonthlyUsage(userId, year, month) {
  try {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || (now.getMonth() + 1);
    
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const result = await UsageRecord.aggregate([
      {
        $match: {
          userId: userId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalTokensUsed: { $sum: '$tokensUsed' },
          totalRequests: { $sum: '$requestCount' },
          modelUsage: { $push: '$modelUsage' },
          daysWithUsage: { $sum: 1 },
        },
      },
    ]);

    if (result.length === 0) {
      return {
        totalTokensUsed: 0,
        totalRequests: 0,
        modelUsage: [],
        daysWithUsage: 0,
      };
    }

    // Aggregate model usage from all days
    const aggregatedModelUsage = new Map();
    result[0].modelUsage.forEach(dailyModelUsage => {
      if (dailyModelUsage && typeof dailyModelUsage === 'object') {
        Object.entries(dailyModelUsage).forEach(([model, usage]) => {
          const currentUsage = aggregatedModelUsage.get(model) || 0;
          aggregatedModelUsage.set(model, currentUsage + usage);
        });
      }
    });

    return {
      ...result[0],
      modelUsage: Array.from(aggregatedModelUsage.entries()).map(([model, usage]) => ({
        model,
        usage,
      })),
    };
  } catch (error) {
    logger.error('[UsageRecord] Error getting monthly usage:', error);
    throw error;
  }
}

/**
 * Gets weekly usage for a user
 * @param {string} userId - The user ID
 * @param {Date} startDate - Start date of the week
 * @param {Date} endDate - End date of the week
 * @returns {Promise<Object>} Weekly usage statistics
 */
async function getWeeklyUsage(userId, startDate, endDate) {
  try {
    const result = await UsageRecord.aggregate([
      {
        $match: {
          userId: userId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalTokensUsed: { $sum: '$tokensUsed' },
          totalRequests: { $sum: '$requestCount' },
          dailyUsage: {
            $push: {
              date: '$date',
              tokensUsed: '$tokensUsed',
              requestCount: '$requestCount',
            },
          },
        },
      },
    ]);

    return result.length > 0 ? result[0] : {
      totalTokensUsed: 0,
      totalRequests: 0,
      dailyUsage: [],
    };
  } catch (error) {
    logger.error('[UsageRecord] Error getting weekly usage:', error);
    throw error;
  }
}

/**
 * Gets usage history for a user
 * @param {string} userId - The user ID
 * @param {number} months - Number of months to look back (default: 6)
 * @returns {Promise<Array>} Monthly usage history
 */
async function getUserUsageHistory(userId, months = 6) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return await UsageRecord.aggregate([
      {
        $match: {
          userId: userId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          totalTokensUsed: { $sum: '$tokensUsed' },
          totalRequests: { $sum: '$requestCount' },
          days: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
    ]);
  } catch (error) {
    logger.error('[UsageRecord] Error getting usage history:', error);
    throw error;
  }
}

/**
 * Gets daily usage for a specific date range
 * @param {string} userId - The user ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Daily usage records
 */
async function getDailyUsage(userId, startDate, endDate) {
  try {
    return await UsageRecord.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
    })
      .sort({ date: 1 })
      .lean();
  } catch (error) {
    logger.error('[UsageRecord] Error getting daily usage:', error);
    throw error;
  }
}

/**
 * Checks if user has exceeded weekly warning threshold
 * @param {string} userId - The user ID
 * @param {number} monthlyQuota - Monthly quota in cents
 * @param {number} warningThreshold - Warning threshold percentage (default: 50)
 * @returns {Promise<Object>} Warning status and usage data
 */
async function checkWeeklyWarning(userId, monthlyQuota, warningThreshold = 50) {
  try {
    // Get current week usage (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Handle Sunday as day 0
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + mondayOffset);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weeklyUsage = await getWeeklyUsage(userId, startOfWeek, endOfWeek);
    
    // Calculate weekly threshold (monthly quota / 4 weeks * warning percentage)
    const weeklyQuota = monthlyQuota / 4;
    const weeklyThreshold = (weeklyQuota * warningThreshold) / 100;
    
    const shouldWarn = weeklyUsage.totalTokensUsed >= weeklyThreshold;
    const usagePercentage = monthlyQuota > 0 ? (weeklyUsage.totalTokensUsed / weeklyQuota) * 100 : 0;

    return {
      shouldWarn,
      weeklyUsage: weeklyUsage.totalTokensUsed,
      weeklyQuota,
      usagePercentage: Math.min(usagePercentage, 100),
      threshold: warningThreshold,
      startOfWeek,
      endOfWeek,
    };
  } catch (error) {
    logger.error('[UsageRecord] Error checking weekly warning:', error);
    throw error;
  }
}

/**
 * Gets top models by usage for a user
 * @param {string} userId - The user ID
 * @param {number} days - Number of days to look back (default: 30)
 * @param {number} limit - Number of top models to return (default: 5)
 * @returns {Promise<Array>} Top models with usage data
 */
async function getTopModelsByUsage(userId, days = 30, limit = 5) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await UsageRecord.aggregate([
      {
        $match: {
          userId: userId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $unwind: {
          path: '$modelUsage',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: '$modelUsage.k',
          totalUsage: { $sum: '$modelUsage.v' },
          requestCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalUsage: -1 },
      },
      {
        $limit: limit,
      },
    ]);

    return result.map(item => ({
      model: item._id,
      usage: item.totalUsage,
      requestCount: item.requestCount,
    }));
  } catch (error) {
    logger.error('[UsageRecord] Error getting top models:', error);
    throw error;
  }
}

/**
 * Cleanup old usage records (for data retention)
 * @param {number} retentionDays - Number of days to retain (default: 365)
 * @returns {Promise<number>} Number of deleted records
 */
async function cleanupOldRecords(retentionDays = 365) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await UsageRecord.deleteMany({
      date: { $lt: cutoffDate },
    });

    logger.info(`[UsageRecord] Cleaned up ${result.deletedCount} old usage records`);
    return result.deletedCount;
  } catch (error) {
    logger.error('[UsageRecord] Error cleaning up old records:', error);
    throw error;
  }
}

module.exports = {
  recordUsage,
  getMonthlyUsage,
  getWeeklyUsage,
  getUserUsageHistory,
  getDailyUsage,
  checkWeeklyWarning,
  getTopModelsByUsage,
  cleanupOldRecords,
};