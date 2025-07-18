const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { getPaddleService } = require('~/services/paddle');
const {
  createSubscription,
  updateSubscription,
  resetMonthlyQuota,
} = require('~/models/Subscription');
const { getPlanByPaddleId } = require('~/models/Plan');

const router = express.Router();

/**
 * Paddle webhook endpoint for handling subscription events
 * This endpoint receives webhook notifications from Paddle
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.get('Paddle-Signature');
    const rawBody = req.body;
    
    logger.info('[PaddleWebhook] Received webhook event');
    
    // Verify webhook signature
    const paddleService = getPaddleService();
    const isValidSignature = await paddleService.verifyWebhookSignature(rawBody, signature);
    
    if (!isValidSignature) {
      logger.warn('[PaddleWebhook] Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Parse the webhook payload using Paddle SDK
    let eventData;
    try {
      eventData = await paddleService.unmarshalWebhook(rawBody.toString(), signature);
    } catch (error) {
      logger.error('[PaddleWebhook] Failed to unmarshal webhook payload:', error);
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }
    
    const { eventType, data } = eventData;
    
    logger.info(`[PaddleWebhook] Processing event: ${eventType}`);
    
    // Handle different webhook events (modern Paddle API)
    switch (eventType) {
      case 'subscription.activated':
      case 'subscription.created':
        await handleSubscriptionCreated(data);
        break;
        
      case 'subscription.updated':
        await handleSubscriptionUpdated(data);
        break;
        
      case 'subscription.canceled':
      case 'subscription.cancelled':
        await handleSubscriptionCanceled(data);
        break;
        
      case 'subscription.paused':
        await handleSubscriptionPaused(data);
        break;
        
      case 'subscription.resumed':
        await handleSubscriptionResumed(data);
        break;
        
      case 'transaction.completed':
        await handleTransactionCompleted(data);
        break;
        
      case 'transaction.payment_failed':
        await handlePaymentFailed(data);
        break;
        
      case 'price.updated':
        await handlePriceUpdated(data);
        break;
        
      case 'product.updated':
        await handleProductUpdated(data);
        break;
        
      default:
        logger.info(`[PaddleWebhook] Unhandled event type: ${eventType}`);
    }
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ received: true });
    
  } catch (error) {
    logger.error('[PaddleWebhook] Error processing webhook:', error);
    
    // Return 500 to signal Paddle to retry
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handles subscription created events
 */
async function handleSubscriptionCreated(data) {
  try {
    logger.info(`[PaddleWebhook] Handling subscription created: ${data.id}`);
    
    const {
      id: paddleSubscriptionId,
      customer_id: paddleCustomerId,
      items,
      custom_data,
      current_billing_period,
      status,
    } = data;
    
    // Extract user ID from custom data
    const userId = custom_data?.userId;
    if (!userId) {
      throw new Error('No userId found in subscription custom data');
    }
    
    // Get plan from Paddle price ID
    const priceId = items?.[0]?.price?.id;
    if (!priceId) {
      throw new Error('No price ID found in subscription items');
    }
    
    const plan = await getPlanByPaddleId(priceId);
    if (!plan) {
      throw new Error(`No plan found for Paddle price ID: ${priceId}`);
    }
    
    // Create subscription record
    await createSubscription({
      userId,
      paddleSubscriptionId,
      planId: plan._id,
      status: mapPaddleStatus(status),
      currentPeriodStart: new Date(current_billing_period?.starts_at),
      currentPeriodEnd: new Date(current_billing_period?.ends_at),
    });
    
    logger.info(`[PaddleWebhook] Created subscription for user ${userId}`);
    
    // TODO: Send welcome email
    
  } catch (error) {
    logger.error('[PaddleWebhook] Error handling subscription created:', error);
    throw error;
  }
}

/**
 * Handles subscription updated events
 */
async function handleSubscriptionUpdated(data) {
  try {
    logger.info(`[PaddleWebhook] Handling subscription updated: ${data.id}`);
    
    const {
      id: paddleSubscriptionId,
      status,
      current_billing_period,
      items,
      canceled_at,
    } = data;
    
    const updateData = {
      status: mapPaddleStatus(status),
    };
    
    if (current_billing_period) {
      updateData.currentPeriodStart = new Date(current_billing_period.starts_at);
      updateData.currentPeriodEnd = new Date(current_billing_period.ends_at);
    }
    
    if (canceled_at) {
      updateData.cancelAtPeriodEnd = true;
    }
    
    // Handle plan changes
    if (items && items.length > 0) {
      const newPriceId = items[0].price?.id;
      if (newPriceId) {
        const newPlan = await getPlanByPaddleId(newPriceId);
        if (newPlan) {
          updateData.planId = newPlan._id;
        }
      }
    }
    
    await updateSubscription(paddleSubscriptionId, updateData);
    
    logger.info(`[PaddleWebhook] Updated subscription ${paddleSubscriptionId}`);
    
  } catch (error) {
    logger.error('[PaddleWebhook] Error handling subscription updated:', error);
    throw error;
  }
}

/**
 * Handles subscription canceled events
 */
async function handleSubscriptionCanceled(data) {
  try {
    logger.info(`[PaddleWebhook] Handling subscription canceled: ${data.id}`);
    
    const { id: paddleSubscriptionId, canceled_at } = data;
    
    await updateSubscription(paddleSubscriptionId, {
      status: 'canceled',
      cancelAtPeriodEnd: true,
    });
    
    logger.info(`[PaddleWebhook] Canceled subscription ${paddleSubscriptionId}`);
    
    // TODO: Send cancellation email
    
  } catch (error) {
    logger.error('[PaddleWebhook] Error handling subscription canceled:', error);
    throw error;
  }
}

/**
 * Handles subscription paused events
 */
async function handleSubscriptionPaused(data) {
  try {
    logger.info(`[PaddleWebhook] Handling subscription paused: ${data.id}`);
    
    const { id: paddleSubscriptionId } = data;
    
    await updateSubscription(paddleSubscriptionId, {
      status: 'paused',
    });
    
    logger.info(`[PaddleWebhook] Paused subscription ${paddleSubscriptionId}`);
    
  } catch (error) {
    logger.error('[PaddleWebhook] Error handling subscription paused:', error);
    throw error;
  }
}

/**
 * Handles subscription resumed events
 */
async function handleSubscriptionResumed(data) {
  try {
    logger.info(`[PaddleWebhook] Handling subscription resumed: ${data.id}`);
    
    const { id: paddleSubscriptionId } = data;
    
    await updateSubscription(paddleSubscriptionId, {
      status: 'active',
    });
    
    logger.info(`[PaddleWebhook] Resumed subscription ${paddleSubscriptionId}`);
    
  } catch (error) {
    logger.error('[PaddleWebhook] Error handling subscription resumed:', error);
    throw error;
  }
}

/**
 * Handles successful payment transactions
 */
async function handleTransactionCompleted(data) {
  try {
    logger.info(`[PaddleWebhook] Handling transaction completed: ${data.id}`);
    
    const { subscription_id: paddleSubscriptionId } = data;
    
    if (paddleSubscriptionId) {
      // Reset monthly quota for successful payment
      await resetMonthlyQuota(paddleSubscriptionId);
      
      // Update subscription status to active
      await updateSubscription(paddleSubscriptionId, {
        status: 'active',
      });
      
      logger.info(`[PaddleWebhook] Reset quota for subscription ${paddleSubscriptionId}`);
    }
    
    // TODO: Send payment success email
    
  } catch (error) {
    logger.error('[PaddleWebhook] Error handling transaction completed:', error);
    throw error;
  }
}

/**
 * Handles failed payment events
 */
async function handlePaymentFailed(data) {
  try {
    logger.info(`[PaddleWebhook] Handling payment failed: ${data.id}`);
    
    const { subscription_id: paddleSubscriptionId } = data;
    
    if (paddleSubscriptionId) {
      // Mark subscription as past due
      await updateSubscription(paddleSubscriptionId, {
        status: 'past_due',
      });
      
      logger.info(`[PaddleWebhook] Marked subscription ${paddleSubscriptionId} as past due`);
    }
    
    // TODO: Send payment failure notification
    
  } catch (error) {
    logger.error('[PaddleWebhook] Error handling payment failed:', error);
    throw error;
  }
}

/**
 * Handles price updated events from Paddle
 */
async function handlePriceUpdated(data) {
  try {
    logger.info(`[PaddleWebhook] Handling price updated: ${data.id}`);
    
    const { id: priceId, product_id: productId, unit_amount } = data;
    
    // Find and update the local plan
    const { getPlanByPaddleId, updatePlan } = require('~/models/Plan');
    const plan = await getPlanByPaddleId(productId);
    
    if (plan) {
      await updatePlan(plan._id, {
        price: unit_amount,
        paddlePriceId: priceId,
      });
      
      logger.info(`[PaddleWebhook] Updated plan pricing: ${plan.name} -> €${(unit_amount / 100).toFixed(2)}`);
    } else {
      logger.warn(`[PaddleWebhook] No local plan found for product: ${productId}`);
    }
    
  } catch (error) {
    logger.error('[PaddleWebhook] Error handling price updated:', error);
    throw error;
  }
}

/**
 * Handles product updated events from Paddle
 */
async function handleProductUpdated(data) {
  try {
    logger.info(`[PaddleWebhook] Handling product updated: ${data.id}`);
    
    const { id: productId, name, description } = data;
    
    // Find and update the local plan
    const { getPlanByPaddleId, updatePlan } = require('~/models/Plan');
    const plan = await getPlanByPaddleId(productId);
    
    if (plan) {
      await updatePlan(plan._id, {
        name: name || plan.name,
        description: description || plan.description,
      });
      
      logger.info(`[PaddleWebhook] Updated plan details: ${plan.name}`);
    } else {
      // Product might be new - trigger a sync
      logger.info(`[PaddleWebhook] New product detected, triggering sync: ${productId}`);
      const { getPaddleService } = require('~/services/paddle');
      const paddleService = getPaddleService();
      await paddleService.syncPlansFromPaddle();
    }
    
  } catch (error) {
    logger.error('[PaddleWebhook] Error handling product updated:', error);
    throw error;
  }
}

/**
 * Maps Paddle subscription status to our internal status
 */
function mapPaddleStatus(paddleStatus) {
  const statusMap = {
    'active': 'active',
    'canceled': 'canceled',
    'past_due': 'past_due',
    'paused': 'paused',
    'trialing': 'active', // Treat trial as active
  };
  
  return statusMap[paddleStatus] || 'canceled';
}

/**
 * Middleware to handle webhook errors and ensure idempotency
 */
router.use((error, req, res, next) => {
  logger.error('[PaddleWebhook] Unhandled error in webhook route:', error);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;