const { logger } = require('@librechat/data-schemas');

/**
 * Billing configuration service that handles the toggle between token-based and subscription-based billing
 */
class BillingConfig {
  constructor() {
    this.billingMode = process.env.BILLING_MODE || 'token';
    this.isSubscriptionMode = this.billingMode === 'subscription';
    this.isTokenMode = this.billingMode === 'token';
    
    // Notification thresholds for subscription mode
    this.notificationThresholds = [
      parseInt(process.env.USAGE_NOTIFICATION_THRESHOLD_1) || 25,
      parseInt(process.env.USAGE_NOTIFICATION_THRESHOLD_2) || 50,
      parseInt(process.env.USAGE_NOTIFICATION_THRESHOLD_3) || 75,
      parseInt(process.env.USAGE_NOTIFICATION_THRESHOLD_4) || 100,
    ];
    
    logger.info(`[BillingConfig] Initialized with billing mode: ${this.billingMode}`);
  }

  /**
   * Gets the current billing mode
   * @returns {string} 'token' or 'subscription'
   */
  getBillingMode() {
    return this.billingMode;
  }

  /**
   * Checks if subscription billing is enabled
   * @returns {boolean}
   */
  isSubscriptionEnabled() {
    return this.isSubscriptionMode;
  }

  /**
   * Checks if token billing is enabled
   * @returns {boolean}
   */
  isTokenEnabled() {
    return this.isTokenMode;
  }

  /**
   * Gets notification thresholds for subscription mode
   * @returns {number[]} Array of threshold percentages
   */
  getNotificationThresholds() {
    return this.notificationThresholds;
  }

  /**
   * Validates the billing configuration
   * @returns {Object} Validation result
   */
  validateConfiguration() {
    const issues = [];
    
    if (!['token', 'subscription'].includes(this.billingMode)) {
      issues.push(`Invalid BILLING_MODE: ${this.billingMode}. Must be 'token' or 'subscription'`);
    }
    
    if (this.isSubscriptionMode) {
      // Check Paddle configuration when in subscription mode
      if (!process.env.PADDLE_API_KEY) {
        issues.push('PADDLE_API_KEY is required when BILLING_MODE=subscription');
      }
      if (!process.env.PADDLE_WEBHOOK_SECRET) {
        issues.push('PADDLE_WEBHOOK_SECRET is required when BILLING_MODE=subscription');
      }
      if (!process.env.PADDLE_VENDOR_ID) {
        issues.push('PADDLE_VENDOR_ID is required when BILLING_MODE=subscription');
      }
    }
    
    // Validate notification thresholds
    for (let i = 0; i < this.notificationThresholds.length; i++) {
      const threshold = this.notificationThresholds[i];
      if (isNaN(threshold) || threshold < 0 || threshold > 100) {
        issues.push(`Invalid notification threshold ${i + 1}: ${threshold}. Must be between 0 and 100.`);
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      mode: this.billingMode,
    };
  }

  /**
   * Gets the configuration summary for logging/debugging
   * @returns {Object} Configuration summary
   */
  getConfigurationSummary() {
    return {
      billingMode: this.billingMode,
      isSubscriptionMode: this.isSubscriptionMode,
      isTokenMode: this.isTokenMode,
      notificationThresholds: this.notificationThresholds,
      paddleConfigured: !!(process.env.PADDLE_API_KEY && process.env.PADDLE_WEBHOOK_SECRET),
      environment: process.env.PADDLE_ENVIRONMENT || 'not_set',
    };
  }

  /**
   * Determines which billing system should handle a request
   * @param {Object} user - User object
   * @returns {Promise<Object>} Billing handler info
   */
  async getBillingHandler(user) {
    if (this.isTokenMode) {
      return {
        type: 'token',
        handler: 'balance',
        requiresSubscription: false,
        usesCredits: true,
      };
    }
    
    if (this.isSubscriptionMode) {
      // Check if user has active subscription
      const { getUserSubscription } = require('~/models/Subscription');
      const subscription = await getUserSubscription(user.id);
      
      return {
        type: 'subscription',
        handler: 'subscription',
        requiresSubscription: true,
        hasActiveSubscription: !!subscription,
        subscription,
        usesCredits: false,
      };
    }
    
    throw new Error(`Unknown billing mode: ${this.billingMode}`);
  }

  /**
   * Checks if a user can access a service based on billing mode
   * @param {Object} user - User object
   * @param {string} modelName - Model name (optional)
   * @returns {Promise<Object>} Access check result
   */
  async checkAccess(user, modelName = null) {
    const billingHandler = await this.getBillingHandler(user);
    
    if (this.isTokenMode) {
      // In token mode, access depends on balance
      const { getBalanceConfig } = require('~/server/services/Config');
      const balanceConfig = await getBalanceConfig();
      
      if (!balanceConfig?.enabled) {
        return { allowed: true, reason: 'Balance checking disabled' };
      }
      
      // Check user balance
      const { Balance } = require('~/db/models');
      const balance = await Balance.findOne({ user: user.id }).lean();
      const credits = balance?.tokenCredits || 0;
      
      return {
        allowed: credits > 0,
        reason: credits > 0 ? 'Sufficient credits' : 'Insufficient credits',
        credits,
        billingType: 'token',
      };
    }
    
    if (this.isSubscriptionMode) {
      if (!billingHandler.hasActiveSubscription) {
        return {
          allowed: false,
          reason: 'No active subscription',
          billingType: 'subscription',
          requiresSubscription: true,
        };
      }
      
      const subscription = billingHandler.subscription;
      
      // Check if subscription is still valid
      const now = new Date();
      if (now > subscription.currentPeriodEnd) {
        return {
          allowed: false,
          reason: 'Subscription expired',
          billingType: 'subscription',
          expiredAt: subscription.currentPeriodEnd,
        };
      }
      
      // Check model access if specified
      if (modelName && subscription.planId) {
        const { isModelAllowedForPlan } = require('~/models/Plan');
        const isModelAllowed = isModelAllowedForPlan(subscription.planId, modelName);
        
        if (!isModelAllowed) {
          return {
            allowed: false,
            reason: `Model ${modelName} not allowed in current plan`,
            billingType: 'subscription',
            planName: subscription.planId.name,
          };
        }
      }
      
      // Check monthly quota (if plan has limits)
      if (subscription.planId.tokenQuotaMonthly > 0) {
        const { getMonthlyUsage } = require('~/models/UsageRecord');
        const now = new Date();
        const usage = await getMonthlyUsage(user.id, now.getFullYear(), now.getMonth() + 1);
        
        if (usage.totalTokensUsed >= subscription.planId.tokenQuotaMonthly) {
          return {
            allowed: false,
            reason: 'Monthly quota exceeded',
            billingType: 'subscription',
            usage: usage.totalTokensUsed,
            quota: subscription.planId.tokenQuotaMonthly,
          };
        }
      }
      
      return {
        allowed: true,
        reason: 'Active subscription with quota available',
        billingType: 'subscription',
        subscription,
      };
    }
    
    return { allowed: false, reason: 'Unknown billing configuration' };
  }
}

// Create singleton instance
let billingConfig = null;

function getBillingConfig() {
  if (!billingConfig) {
    billingConfig = new BillingConfig();
  }
  return billingConfig;
}

module.exports = {
  BillingConfig,
  getBillingConfig,
};