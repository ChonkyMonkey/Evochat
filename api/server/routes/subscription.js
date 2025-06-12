const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const { getPaddleService } = require('~/services/paddle');
const {
  getSubscriptionStatus,
  cancelSubscription,
  getUserSubscription,
} = require('~/models/Subscription');
const {
  getActivePlans,
  getPlansForComparison,
} = require('~/models/Plan');

const router = express.Router();

/**
 * GET /api/subscription/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    logger.debug('[SubscriptionRoutes] Getting available plans');
    
    const plans = await getPlansForComparison();
    
    res.json({
      success: true,
      plans,
    });
    
  } catch (error) {
    logger.error('[SubscriptionRoutes] Error getting plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription plans',
    });
  }
});

/**
 * GET /api/subscription/current
 * Get current user's subscription status
 */
router.get('/current', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    logger.debug(`[SubscriptionRoutes] Getting subscription status for user ${userId}`);
    
    const subscriptionStatus = await getSubscriptionStatus(userId);
    
    if (!subscriptionStatus) {
      return res.json({
        success: true,
        subscription: null,
        hasActiveSubscription: false,
      });
    }
    
    res.json({
      success: true,
      subscription: subscriptionStatus.subscription,
      plan: subscriptionStatus.plan,
      usage: subscriptionStatus.usage,
      isActive: subscriptionStatus.isActive,
      isExpired: subscriptionStatus.isExpired,
      remainingDays: subscriptionStatus.remainingDays,
      hasActiveSubscription: subscriptionStatus.isActive,
    });
    
  } catch (error) {
    logger.error('[SubscriptionRoutes] Error getting current subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription status',
    });
  }
});

/**
 * POST /api/subscription/checkout
 * Create a checkout session for a subscription plan
 */
router.post('/checkout', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.body;
    
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: 'Plan ID is required',
      });
    }
    
    logger.info(`[SubscriptionRoutes] Creating checkout session for user ${userId}, plan ${planId}`);
    
    // Check if user already has an active subscription
    const existingSubscription = await getUserSubscription(userId);
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: 'User already has an active subscription',
      });
    }
    
    const paddleService = getPaddleService();
    
    // Validate Paddle configuration
    const configValidation = paddleService.validateConfiguration();
    if (!configValidation.isValid) {
      logger.error('[SubscriptionRoutes] Paddle not configured:', configValidation.issues);
      return res.status(500).json({
        success: false,
        error: 'Subscription service not available',
      });
    }
    
    // Create checkout session
    const checkoutSession = await paddleService.createCheckoutSession({
      planId,
      userId,
      customData: {
        customerEmail: req.user.email,
        customerName: req.user.name || req.user.username,
      },
    });
    
    res.json({
      success: true,
      checkoutUrl: checkoutSession.checkoutUrl,
      sessionId: checkoutSession.sessionId,
    });
    
  } catch (error) {
    logger.error('[SubscriptionRoutes] Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
    });
  }
});

/**
 * POST /api/subscription/cancel
 * Cancel user's subscription
 */
router.post('/cancel', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { immediately = false } = req.body;
    
    logger.info(`[SubscriptionRoutes] Canceling subscription for user ${userId}, immediately: ${immediately}`);
    
    const canceledSubscription = await cancelSubscription(userId, !immediately);
    
    if (!canceledSubscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found',
      });
    }
    
    // Also cancel with Paddle
    try {
      const paddleService = getPaddleService();
      await paddleService.cancelSubscription(
        canceledSubscription.paddleSubscriptionId,
        immediately
      );
    } catch (paddleError) {
      logger.error('[SubscriptionRoutes] Error canceling with Paddle:', paddleError);
      // Continue even if Paddle cancellation fails - our database is updated
    }
    
    res.json({
      success: true,
      subscription: canceledSubscription,
      message: immediately 
        ? 'Subscription canceled immediately' 
        : 'Subscription will be canceled at the end of the current billing period',
    });
    
  } catch (error) {
    logger.error('[SubscriptionRoutes] Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
    });
  }
});

/**
 * PUT /api/subscription/update
 * Update user's subscription (plan changes)
 */
router.put('/update', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.body;
    
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: 'Plan ID is required',
      });
    }
    
    logger.info(`[SubscriptionRoutes] Updating subscription for user ${userId} to plan ${planId}`);
    
    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found',
      });
    }
    
    const paddleService = getPaddleService();
    
    // Validate Paddle configuration
    const configValidation = paddleService.validateConfiguration();
    if (!configValidation.isValid) {
      logger.error('[SubscriptionRoutes] Paddle not configured:', configValidation.issues);
      return res.status(500).json({
        success: false,
        error: 'Subscription service not available',
      });
    }
    
    // Get the new plan details
    const { getPlanById } = require('~/models/Plan');
    const newPlan = await getPlanById(planId);
    
    if (!newPlan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }
    
    if (!newPlan.paddlePriceId) {
      return res.status(400).json({
        success: false,
        error: 'Plan is not configured with Paddle pricing',
      });
    }
    
    try {
      // Update subscription with Paddle
      const updatedSubscription = await paddleService.updateSubscription(
        subscription.paddleSubscriptionId,
        {
          priceId: newPlan.paddlePriceId,
          prorationBehavior: 'create_prorations',
        }
      );
      
      // Update our local subscription record
      const { updateSubscription } = require('~/models/Subscription');
      await updateSubscription(subscription.paddleSubscriptionId, {
        planId: newPlan._id,
        updatedAt: new Date(),
      });
      
      res.json({
        success: true,
        subscription: updatedSubscription,
        newPlan,
        message: 'Subscription plan updated successfully',
      });
      
    } catch (paddleError) {
      logger.error('[SubscriptionRoutes] Error updating subscription with Paddle:', paddleError);
      res.status(500).json({
        success: false,
        error: 'Failed to update subscription plan',
      });
    }
    
  } catch (error) {
    logger.error('[SubscriptionRoutes] Error updating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update subscription',
    });
  }
});

/**
 * GET /api/subscription/portal
 * Get Paddle customer portal URL
 */
router.get('/portal', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    logger.debug(`[SubscriptionRoutes] Getting customer portal URL for user ${userId}`);
    
    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found',
      });
    }
    
    const paddleService = getPaddleService();
    
    // Validate Paddle configuration
    const configValidation = paddleService.validateConfiguration();
    if (!configValidation.isValid) {
      logger.error('[SubscriptionRoutes] Paddle not configured:', configValidation.issues);
      return res.status(500).json({
        success: false,
        error: 'Subscription service not available',
      });
    }
    
    try {
      // Get customer ID from subscription data
      const paddleSubscription = await paddleService.getSubscription(subscription.paddleSubscriptionId);
      
      if (!paddleSubscription.customer?.id) {
        return res.status(500).json({
          success: false,
          error: 'Customer information not found in subscription',
        });
      }

      // Create customer portal session using SDK
      const returnUrl = `${process.env.DOMAIN_CLIENT}/subscription`;
      const portalUrl = await paddleService.createCustomerPortalSession(
        paddleSubscription.customer.id,
        returnUrl
      );
      
      res.json({
        success: true,
        portalUrl,
        message: 'Redirecting to Paddle customer portal',
        subscriptionId: subscription.paddleSubscriptionId,
      });
      
    } catch (portalError) {
      logger.error('[SubscriptionRoutes] Error creating customer portal session:', portalError);
      
      // Fallback to direct portal links if SDK method fails
      const portalUrl = paddleService.environment === 'production'
        ? 'https://myaccount.paddle.com'
        : 'https://sandbox-myaccount.paddle.com';
      
      res.json({
        success: true,
        portalUrl,
        message: 'Redirecting to Paddle customer portal (fallback)',
        subscriptionId: subscription.paddleSubscriptionId,
      });
    }
    
  } catch (error) {
    logger.error('[SubscriptionRoutes] Error getting customer portal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customer portal',
    });
  }
});

/**
 * GET /api/subscription/usage
 * Get usage data for the current user's subscription
 */
router.get('/usage', requireJwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'current' } = req.query;
    
    logger.debug(`[SubscriptionRoutes] Getting usage data for user ${userId}, period: ${period}`);
    
    // Get subscription status first to ensure user has a subscription
    const subscriptionStatus = await getSubscriptionStatus(userId);
    
    if (!subscriptionStatus) {
      return res.json({
        success: true,
        usage: {
          messages: 0,
          activeChats: 0,
          modelUsage: [],
          trendPercentage: 0,
          usagePercentage: 0,
          hasActiveSubscription: false,
        },
      });
    }
    
    // Get detailed usage data from the existing usage tracking system
    const { getMonthlyUsage, getTopModelsByUsage } = require('~/models/UsageRecord');
    const now = new Date();
    
    let usageData;
    if (period === 'current') {
      usageData = await getMonthlyUsage(userId, now.getFullYear(), now.getMonth() + 1);
    } else {
      // Handle other periods if needed (weekly, daily, etc.)
      usageData = await getMonthlyUsage(userId, now.getFullYear(), now.getMonth() + 1);
    }
    
    // Get top models by usage (increased limit to handle many models)
    const modelUsageData = await getTopModelsByUsage(userId, 30, 20);
    
    // Calculate usage percentage based on subscription limits
    let usagePercentage = 0;
    if (subscriptionStatus.plan && subscriptionStatus.plan.tokenQuotaMonthly > 0) {
      usagePercentage = Math.min((usageData.totalTokensUsed / subscriptionStatus.plan.tokenQuotaMonthly) * 100, 100);
    }
    
    // Generate a diverse color palette for many models
    const generateColors = (count) => {
      const colors = [];
      // Base color palette
      const baseColors = [
        '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
        '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
        '#14b8a6', '#eab308', '#dc2626', '#7c3aed', '#059669',
        '#0ea5e9', '#65a30d', '#ea580c', '#db2777', '#4f46e5'
      ];
      
      // If we need more colors than base palette, generate them
      for (let i = 0; i < count; i++) {
        if (i < baseColors.length) {
          colors.push(baseColors[i]);
        } else {
          // Generate additional colors using HSL
          const hue = (i * 137.508) % 360; // Use golden angle for good distribution
          const saturation = 65 + (i % 3) * 10; // Vary saturation
          const lightness = 45 + (i % 4) * 5; // Vary lightness
          colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        }
      }
      return colors;
    };
    
    // Transform model usage data for frontend with diverse colors
    const colors = generateColors(modelUsageData.length);
    const totalRequests = usageData.totalRequests || 1; // Avoid division by zero
    
    const modelUsage = modelUsageData.map((model, index) => ({
      model: model.model || `Model ${index + 1}`,
      percentage: totalRequests > 0 ? (model.requestCount / totalRequests) * 100 : 0,
      messageCount: model.requestCount || 0,
      tokenUsage: model.usage || 0,
      color: colors[index],
    }));
    
    // Calculate trend using historical data (comparing to previous month)
    let trendPercentage = 0;
    try {
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevMonthUsage = await getMonthlyUsage(userId, prevYear, prevMonth);
      
      if (prevMonthUsage.totalRequests > 0) {
        trendPercentage = ((usageData.totalRequests - prevMonthUsage.totalRequests) / prevMonthUsage.totalRequests) * 100;
        trendPercentage = Math.round(trendPercentage * 10) / 10; // Round to 1 decimal
      }
    } catch (error) {
      logger.debug('[SubscriptionRoutes] Could not calculate trend:', error.message);
      trendPercentage = 0;
    }
    
    res.json({
      success: true,
      usage: {
        messages: usageData.totalRequests || 0,
        activeChats: usageData.daysWithUsage || 0, // Using active days as proxy for active chats
        modelUsage,
        trendPercentage,
        usagePercentage,
        hasActiveSubscription: true,
        period: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
        quota: subscriptionStatus.plan?.tokenQuotaMonthly || 0,
        tokensUsed: usageData.totalTokensUsed || 0,
      },
    });
    
  } catch (error) {
    logger.error('[SubscriptionRoutes] Error getting usage data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage data',
    });
  }
});

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  logger.error('[SubscriptionRoutes] Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

module.exports = router;