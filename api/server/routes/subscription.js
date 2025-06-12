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
    
    // TODO: Implement plan change with Paddle
    // This would involve calling Paddle's subscription update API
    
    res.status(501).json({
      success: false,
      error: 'Plan updates not yet implemented',
    });
    
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
    
    // TODO: Implement Paddle customer portal URL generation
    // This would involve calling Paddle's customer portal API
    
    res.status(501).json({
      success: false,
      error: 'Customer portal not yet implemented',
    });
    
  } catch (error) {
    logger.error('[SubscriptionRoutes] Error getting customer portal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customer portal',
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