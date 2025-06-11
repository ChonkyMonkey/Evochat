const { logger } = require('@librechat/data-schemas');
const { Subscription, Plan, UsageRecord } = require('~/db/models');

/**
 * Creates a new subscription for a user
 * @param {Object} subscriptionData - Subscription data from Paddle webhook
 * @param {string} subscriptionData.userId - The user ID
 * @param {string} subscriptionData.paddleSubscriptionId - Paddle subscription ID
 * @param {string} subscriptionData.planId - Plan ID
 * @param {string} subscriptionData.status - Subscription status
 * @param {Date} subscriptionData.currentPeriodStart - Period start date
 * @param {Date} subscriptionData.currentPeriodEnd - Period end date
 * @returns {Promise<Object>} The created subscription
 */
async function createSubscription(subscriptionData) {
  try {
    const subscription = new Subscription(subscriptionData);
    await subscription.save();
    
    logger.info(`[Subscription] Created subscription ${subscription._id} for user ${subscriptionData.userId}`);
    return subscription;
  } catch (error) {
    logger.error('[Subscription] Error creating subscription:', error);
    throw error;
  }
}

/**
 * Gets the active subscription for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object|null>} The active subscription or null
 */
async function getUserSubscription(userId) {
  try {
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['active', 'past_due'] },
    })
      .populate('planId')
      .lean();

    if (!subscription) {
      return null;
    }

    // Check if subscription is still valid
    const now = new Date();
    if (now > subscription.currentPeriodEnd && subscription.status !== 'past_due') {
      // Mark as expired
      await Subscription.findByIdAndUpdate(subscription._id, {
        status: 'canceled',
      });
      return null;
    }

    return subscription;
  } catch (error) {
    logger.error('[Subscription] Error getting user subscription:', error);
    throw error;
  }
}

/**
 * Updates a subscription based on Paddle webhook data
 * @param {string} paddleSubscriptionId - Paddle subscription ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object|null>} The updated subscription
 */
async function updateSubscription(paddleSubscriptionId, updateData) {
  try {
    const subscription = await Subscription.findOneAndUpdate(
      { paddleSubscriptionId },
      { $set: updateData },
      { new: true }
    ).populate('planId');

    if (!subscription) {
      logger.warn(`[Subscription] Subscription not found for Paddle ID: ${paddleSubscriptionId}`);
      return null;
    }

    logger.info(`[Subscription] Updated subscription ${subscription._id}`);
    return subscription;
  } catch (error) {
    logger.error('[Subscription] Error updating subscription:', error);
    throw error;
  }
}

/**
 * Cancels a subscription
 * @param {string} userId - The user ID
 * @param {boolean} atPeriodEnd - Whether to cancel at period end
 * @returns {Promise<Object|null>} The updated subscription
 */
async function cancelSubscription(userId, atPeriodEnd = true) {
  try {
    const updateData = atPeriodEnd
      ? { cancelAtPeriodEnd: true }
      : { status: 'canceled', cancelAtPeriodEnd: true };

    const subscription = await Subscription.findOneAndUpdate(
      { userId, status: { $in: ['active', 'past_due'] } },
      { $set: updateData },
      { new: true }
    ).populate('planId');

    if (!subscription) {
      logger.warn(`[Subscription] No active subscription found for user: ${userId}`);
      return null;
    }

    logger.info(`[Subscription] Canceled subscription ${subscription._id} for user ${userId}`);
    return subscription;
  } catch (error) {
    logger.error('[Subscription] Error canceling subscription:', error);
    throw error;
  }
}

/**
 * Gets subscription status with usage information
 * @param {string} userId - The user ID
 * @returns {Promise<Object|null>} Subscription status with usage data
 */
async function getSubscriptionStatus(userId) {
  try {
    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      return null;
    }

    // Get current month usage
    const now = new Date();
    const monthlyUsage = await UsageRecord.getMonthlyUsage(
      userId,
      now.getFullYear(),
      now.getMonth() + 1
    );

    // Calculate usage percentage
    const plan = subscription.planId;
    const usagePercentage = plan.tokenQuotaMonthly > 0
      ? Math.min((monthlyUsage.totalTokensUsed / plan.tokenQuotaMonthly) * 100, 100)
      : 0;

    // Get remaining days
    const remainingDays = Math.max(
      0,
      Math.ceil((subscription.currentPeriodEnd - now) / (1000 * 60 * 60 * 24))
    );

    return {
      subscription,
      plan,
      usage: {
        tokensUsed: monthlyUsage.totalTokensUsed,
        requestCount: monthlyUsage.totalRequests,
        percentage: usagePercentage,
        quota: plan.tokenQuotaMonthly,
      },
      isActive: subscription.status === 'active' && now < subscription.currentPeriodEnd,
      isExpired: now > subscription.currentPeriodEnd,
      remainingDays,
    };
  } catch (error) {
    logger.error('[Subscription] Error getting subscription status:', error);
    throw error;
  }
}

/**
 * Checks if user has access to a specific model
 * @param {string} userId - The user ID
 * @param {string} modelName - The model name to check
 * @returns {Promise<boolean>} Whether user has access to the model
 */
async function hasModelAccess(userId, modelName) {
  try {
    const subscription = await getUserSubscription(userId);
    
    if (!subscription || !subscription.planId) {
      return false; // No subscription = no premium model access
    }

    const plan = subscription.planId;
    
    // Check if model is in allowed models list
    return plan.allowedModels.includes(modelName) || 
           plan.allowedModels.includes('*'); // '*' means all models
  } catch (error) {
    logger.error('[Subscription] Error checking model access:', error);
    return false;
  }
}

/**
 * Gets all subscriptions (for admin purposes)
 * @param {Object} filter - MongoDB filter object
 * @param {Object} options - Query options (limit, skip, sort)
 * @returns {Promise<Array>} Array of subscriptions
 */
async function getSubscriptions(filter = {}, options = {}) {
  try {
    const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
    
    return await Subscription.find(filter)
      .populate('userId', 'username email')
      .populate('planId')
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();
  } catch (error) {
    logger.error('[Subscription] Error getting subscriptions:', error);
    throw error;
  }
}

/**
 * Resets monthly quota for active subscriptions (called on billing cycle)
 * @param {string} paddleSubscriptionId - Paddle subscription ID
 * @returns {Promise<void>}
 */
async function resetMonthlyQuota(paddleSubscriptionId) {
  try {
    const subscription = await Subscription.findOne({ paddleSubscriptionId });
    if (!subscription) {
      return;
    }

    // Update subscription period dates
    const now = new Date();
    await Subscription.findByIdAndUpdate(subscription._id, {
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
    });

    logger.info(`[Subscription] Reset quota for subscription ${subscription._id}`);
  } catch (error) {
    logger.error('[Subscription] Error resetting monthly quota:', error);
    throw error;
  }
}

module.exports = {
  createSubscription,
  getUserSubscription,
  updateSubscription,
  cancelSubscription,
  getSubscriptionStatus,
  hasModelAccess,
  getSubscriptions,
  resetMonthlyQuota,
};