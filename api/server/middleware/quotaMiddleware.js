const { logger } = require('@librechat/data-schemas');
const { getBillingConfig } = require('~/services/billingConfig');
const { recordUsage } = require('~/models/UsageRecord');
const { getMultiplier } = require('~/models/tx');

/**
 * Middleware to enforce quota limits based on billing mode
 * Works with both token-based and subscription-based billing
 */
async function quotaMiddleware(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const billingConfig = getBillingConfig();
    const modelName = req.body?.model || req.query?.model;
    
    logger.debug(`[QuotaMiddleware] Checking access for user ${user.id}, model: ${modelName}, billing mode: ${billingConfig.getBillingMode()}`);

    // Check access based on current billing mode
    const accessCheck = await billingConfig.checkAccess(user, modelName);
    
    if (!accessCheck.allowed) {
      logger.warn(`[QuotaMiddleware] Access denied for user ${user.id}: ${accessCheck.reason}`);
      
      return res.status(403).json({
        error: accessCheck.reason,
        code: getErrorCode(accessCheck),
        billingType: accessCheck.billingType,
        details: getErrorDetails(accessCheck),
      });
    }

    // Store billing info in request for later use
    req.billingInfo = {
      mode: billingConfig.getBillingMode(),
      accessCheck,
      user,
      modelName,
    };

    logger.debug(`[QuotaMiddleware] Access granted for user ${user.id}`);
    next();

  } catch (error) {
    logger.error('[QuotaMiddleware] Error checking quota:', error);
    res.status(500).json({
      error: 'Internal server error while checking access',
      code: 'QUOTA_CHECK_ERROR',
    });
  }
}

/**
 * Middleware to record usage after request completion
 * Must be called after the main request handler
 */
async function recordUsageMiddleware(req, res, next) {
  try {
    const billingInfo = req.billingInfo;
    
    if (!billingInfo) {
      logger.warn('[RecordUsageMiddleware] No billing info found in request');
      return next();
    }

    const billingConfig = getBillingConfig();
    
    // Only record usage for subscription mode
    if (!billingConfig.isSubscriptionEnabled()) {
      return next();
    }

    // Get usage data from request/response
    const usageData = extractUsageData(req, res);
    
    if (usageData && usageData.tokenCost > 0) {
      const subscription = billingInfo.accessCheck.subscription;
      
      await recordUsage({
        userId: billingInfo.user.id,
        subscriptionId: subscription._id,
        model: billingInfo.modelName,
        tokenCost: usageData.tokenCost,
        requestCount: 1,
      });
      
      logger.debug(`[RecordUsageMiddleware] Recorded usage for user ${billingInfo.user.id}: ${usageData.tokenCost} tokens`);
      
      // Check for notifications after recording usage
      await checkUsageNotifications(billingInfo.user.id, subscription);
    }

    next();

  } catch (error) {
    logger.error('[RecordUsageMiddleware] Error recording usage:', error);
    // Don't fail the request if usage recording fails
    next();
  }
}

/**
 * Extracts usage data from request/response
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {Object|null} Usage data
 */
function extractUsageData(req, res) {
  try {
    // Try to get usage from various places in the request/response
    const usage = req.usage || res.locals?.usage || req.body?.usage;
    
    if (usage && (usage.promptTokens || usage.completionTokens)) {
      // Calculate token cost using existing multiplier system
      const model = req.billingInfo?.modelName;
      const endpointTokenConfig = req.body?.endpointTokenConfig;
      
      const promptCost = usage.promptTokens ? 
        usage.promptTokens * Math.abs(getMultiplier({ 
          tokenType: 'prompt', 
          model, 
          endpointTokenConfig 
        })) : 0;
        
      const completionCost = usage.completionTokens ? 
        usage.completionTokens * Math.abs(getMultiplier({ 
          tokenType: 'completion', 
          model, 
          endpointTokenConfig 
        })) : 0;
      
      return {
        tokenCost: promptCost + completionCost,
        promptTokens: usage.promptTokens || 0,
        completionTokens: usage.completionTokens || 0,
      };
    }
    
    // Fallback: try to extract from response headers or body
    if (res.locals?.tokenCost) {
      return {
        tokenCost: res.locals.tokenCost,
        promptTokens: res.locals.promptTokens || 0,
        completionTokens: res.locals.completionTokens || 0,
      };
    }
    
    return null;
    
  } catch (error) {
    logger.error('[extractUsageData] Error extracting usage data:', error);
    return null;
  }
}

/**
 * Checks if user should receive usage notifications
 * @param {string} userId - User ID
 * @param {Object} subscription - User subscription
 */
async function checkUsageNotifications(userId, subscription) {
  try {
    if (subscription.planId.tokenQuotaMonthly <= 0) {
      // Unlimited plan, no notifications needed
      return;
    }

    const { getMonthlyUsage } = require('~/models/UsageRecord');
    const now = new Date();
    const usage = await getMonthlyUsage(userId, now.getFullYear(), now.getMonth() + 1);
    
    const usagePercentage = (usage.totalTokensUsed / subscription.planId.tokenQuotaMonthly) * 100;
    
    const billingConfig = getBillingConfig();
    const thresholds = billingConfig.getNotificationThresholds();
    
    // Check which threshold was just crossed
    for (const threshold of thresholds) {
      if (usagePercentage >= threshold && !hasNotificationBeenSent(userId, threshold)) {
        await sendUsageNotification(userId, threshold, usagePercentage, usage, subscription);
        await markNotificationSent(userId, threshold);
      }
    }
    
  } catch (error) {
    logger.error('[checkUsageNotifications] Error checking notifications:', error);
  }
}

/**
 * Sends usage notification to user
 * @param {string} userId - User ID
 * @param {number} threshold - Threshold percentage
 * @param {number} actualPercentage - Actual usage percentage
 * @param {Object} usage - Usage data
 * @param {Object} subscription - Subscription data
 */
async function sendUsageNotification(userId, threshold, actualPercentage, usage, subscription) {
  try {
    logger.info(`[UsageNotification] Sending ${threshold}% notification to user ${userId}`);
    
    const notificationData = {
      userId,
      type: 'usage_notification',
      threshold,
      actualPercentage: Math.round(actualPercentage * 100) / 100,
      usage: usage.totalTokensUsed,
      quota: subscription.planId.tokenQuotaMonthly,
      planName: subscription.planId.name,
      isQuotaExceeded: threshold >= 100,
    };
    
    // TODO: Integrate with actual notification system
    // For now, just log the notification
    logger.warn(`[UsageNotification] User ${userId} has used ${actualPercentage.toFixed(1)}% of monthly quota`);
    
    // Store notification in database for frontend to display
    // This could be integrated with existing notification system
    
  } catch (error) {
    logger.error('[sendUsageNotification] Error sending notification:', error);
  }
}

/**
 * Checks if notification has already been sent for this threshold
 * @param {string} userId - User ID
 * @param {number} threshold - Threshold percentage
 * @returns {boolean} Whether notification was already sent
 */
function hasNotificationBeenSent(userId, threshold) {
  // TODO: Implement proper notification tracking
  // For now, return false to allow notifications
  return false;
}

/**
 * Marks notification as sent for this threshold
 * @param {string} userId - User ID
 * @param {number} threshold - Threshold percentage
 */
async function markNotificationSent(userId, threshold) {
  try {
    // TODO: Implement proper notification tracking
    // Could store in Redis, database, or memory cache
    logger.debug(`[markNotificationSent] Marked notification sent for user ${userId}, threshold ${threshold}%`);
  } catch (error) {
    logger.error('[markNotificationSent] Error marking notification:', error);
  }
}

/**
 * Gets error code based on access check result
 * @param {Object} accessCheck - Access check result
 * @returns {string} Error code
 */
function getErrorCode(accessCheck) {
  if (accessCheck.billingType === 'token') {
    return 'INSUFFICIENT_CREDITS';
  }
  
  if (accessCheck.billingType === 'subscription') {
    if (accessCheck.requiresSubscription) {
      return 'NO_SUBSCRIPTION';
    }
    if (accessCheck.expiredAt) {
      return 'SUBSCRIPTION_EXPIRED';
    }
    if (accessCheck.reason.includes('quota')) {
      return 'QUOTA_EXCEEDED';
    }
    if (accessCheck.reason.includes('Model')) {
      return 'MODEL_NOT_ALLOWED';
    }
  }
  
  return 'ACCESS_DENIED';
}

/**
 * Gets detailed error information for client
 * @param {Object} accessCheck - Access check result
 * @returns {Object} Error details
 */
function getErrorDetails(accessCheck) {
  const details = {
    billingType: accessCheck.billingType,
  };
  
  if (accessCheck.billingType === 'token') {
    details.credits = accessCheck.credits || 0;
  }
  
  if (accessCheck.billingType === 'subscription') {
    if (accessCheck.expiredAt) {
      details.expiredAt = accessCheck.expiredAt;
    }
    if (accessCheck.usage !== undefined && accessCheck.quota !== undefined) {
      details.usage = accessCheck.usage;
      details.quota = accessCheck.quota;
      details.usagePercentage = Math.round((accessCheck.usage / accessCheck.quota) * 100);
    }
    if (accessCheck.planName) {
      details.planName = accessCheck.planName;
    }
  }
  
  return details;
}

module.exports = {
  quotaMiddleware,
  recordUsageMiddleware,
  extractUsageData,
  checkUsageNotifications,
};