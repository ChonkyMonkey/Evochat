const { logger } = require('@librechat/data-schemas');

/**
 * Paddle API client using the official Paddle Node.js SDK
 * Uses the latest @paddle/paddle-node-sdk for modern API integration
 */
class PaddleService {
  constructor() {
    this.apiKey = process.env.PADDLE_API_KEY;
    this.environment = process.env.PADDLE_ENVIRONMENT || 'sandbox';
    this.webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    
    if (!this.apiKey) {
      logger.warn('[PaddleService] PADDLE_API_KEY not configured - subscription features will not work');
      this.paddle = null;
      return;
    }
    
    try {
      // Initialize official Paddle SDK
      const { Paddle, Environment, LogLevel } = require('@paddle/paddle-node-sdk');
      
      this.paddle = new Paddle(this.apiKey, {
        environment: this.environment === 'production' ? Environment.production : Environment.sandbox,
        logLevel: LogLevel.error, // Less verbose logging for production
      });
      
      logger.info(`[PaddleService] Initialized with official Paddle SDK in ${this.environment} mode`);
    } catch (error) {
      logger.error('[PaddleService] Failed to initialize Paddle SDK:', error);
      logger.warn('[PaddleService] Make sure to install: npm install @paddle/paddle-node-sdk');
      this.paddle = null;
    }
  }

  /**
   * Checks if Paddle SDK is available
   * @returns {boolean} Whether SDK is properly initialized
   */
  isAvailable() {
    return this.paddle !== null;
  }

  /**
   * Creates a checkout session for a subscription using modern Paddle SDK
   * @param {Object} params - Checkout parameters
   * @param {string} params.planId - Internal plan ID
   * @param {string} params.userId - User ID
   * @param {Object} params.customData - Additional data to pass to Paddle
   * @returns {Promise<Object>} Checkout session data
   */
  async createCheckoutSession({ planId, userId, customData = {} }) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Paddle SDK not available');
      }

      logger.info(`[PaddleService] Creating checkout session for user ${userId}, plan ${planId}`);
      
      // Get plan details to get Paddle price ID
      const { getPlanById } = require('~/models/Plan');
      const plan = await getPlanById(planId);
      
      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }
      
      if (!plan.paddlePriceId) {
        throw new Error(`Plan ${plan.name} missing Paddle price ID`);
      }

      // Use official Paddle SDK to create transaction
      const transactionRequest = {
        items: [
          {
            priceId: plan.paddlePriceId,
            quantity: 1,
          },
        ],
        customData: {
          userId,
          planId,
          ...customData,
        },
        returnUrl: `${process.env.DOMAIN_CLIENT}/subscription/success`,
        discountUrl: `${process.env.DOMAIN_CLIENT}/subscription/cancel`,
      };

      if (customData.customerEmail) {
        transactionRequest.customerEmail = customData.customerEmail;
      }

      const transaction = await this.paddle.transactions.create(transactionRequest);
      
      logger.info(`[PaddleService] Checkout session created: ${transaction.id}`);
      
      return {
        checkoutUrl: transaction.checkoutUrl,
        sessionId: transaction.id,
        customData: transactionRequest.customData,
      };
      
    } catch (error) {
      logger.error('[PaddleService] Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Gets subscription details from Paddle using modern SDK
   * @param {string} subscriptionId - Paddle subscription ID
   * @returns {Promise<Object>} Subscription details
   */
  async getSubscription(subscriptionId) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Paddle SDK not available');
      }

      logger.debug(`[PaddleService] Getting subscription ${subscriptionId}`);
      
      const subscription = await this.paddle.subscriptions.get(subscriptionId);
      
      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.currentBillingPeriod?.startsAt),
        currentPeriodEnd: new Date(subscription.currentBillingPeriod?.endsAt),
        customData: subscription.customData || {},
        items: subscription.items,
        customer: subscription.customer,
      };
      
    } catch (error) {
      logger.error('[PaddleService] Error getting subscription:', error);
      throw error;
    }
  }

  /**
   * Updates a subscription using modern SDK
   * @param {string} subscriptionId - Paddle subscription ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated subscription
   */
  async updateSubscription(subscriptionId, updates) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Paddle SDK not available');
      }

      logger.info(`[PaddleService] Updating subscription ${subscriptionId}`);
      
      const updatedSubscription = await this.paddle.subscriptions.update(subscriptionId, updates);
      
      return {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        currentPeriodStart: new Date(updatedSubscription.currentBillingPeriod?.startsAt),
        currentPeriodEnd: new Date(updatedSubscription.currentBillingPeriod?.endsAt),
        customData: updatedSubscription.customData || {},
        items: updatedSubscription.items,
        updatedAt: new Date(),
      };
      
    } catch (error) {
      logger.error('[PaddleService] Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancels a subscription using modern SDK
   * @param {string} subscriptionId - Paddle subscription ID
   * @param {boolean} immediately - Whether to cancel immediately or at period end
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelSubscription(subscriptionId, immediately = false) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Paddle SDK not available');
      }

      logger.info(`[PaddleService] Canceling subscription ${subscriptionId}, immediately: ${immediately}`);
      
      const cancelRequest = {
        effectiveFrom: immediately ? 'immediately' : 'next_billing_period',
      };
      
      const canceledSubscription = await this.paddle.subscriptions.cancel(subscriptionId, cancelRequest);
      
      return {
        success: true,
        subscriptionId: canceledSubscription.id,
        status: canceledSubscription.status,
        canceledAt: new Date(),
        cancelAtPeriodEnd: !immediately,
        scheduledChange: canceledSubscription.scheduledChange,
      };
      
    } catch (error) {
      logger.error('[PaddleService] Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Gets customer details from Paddle using modern SDK
   * @param {string} customerId - Paddle customer ID
   * @returns {Promise<Object>} Customer details
   */
  async getCustomer(customerId) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Paddle SDK not available');
      }

      logger.debug(`[PaddleService] Getting customer ${customerId}`);
      
      const customer = await this.paddle.customers.get(customerId);
      
      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        createdAt: new Date(customer.createdAt),
        updatedAt: new Date(customer.updatedAt),
        customData: customer.customData || {},
      };
      
    } catch (error) {
      logger.error('[PaddleService] Error getting customer:', error);
      throw error;
    }
  }

  /**
   * Creates a customer in Paddle using modern SDK
   * @param {Object} userData - User data
   * @param {string} userData.email - Customer email
   * @param {string} userData.name - Customer name
   * @returns {Promise<Object>} Created customer
   */
  async createCustomer(userData) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Paddle SDK not available');
      }

      logger.info(`[PaddleService] Creating customer for ${userData.email}`);
      
      const customerRequest = {
        email: userData.email,
        name: userData.name,
      };

      const customer = await this.paddle.customers.create(customerRequest);
      
      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        createdAt: new Date(customer.createdAt),
        updatedAt: new Date(customer.updatedAt),
        customData: customer.customData || {},
      };
      
    } catch (error) {
      logger.error('[PaddleService] Error creating customer:', error);
      throw error;
    }
  }

  /**
   * Syncs plans from Paddle to local database using modern SDK
   * @returns {Promise<Array>} Synced plans
   */
  async syncPlansFromPaddle() {
    try {
      logger.info('[PaddleService] Syncing plans from Paddle API...');
      
      if (!this.isAvailable()) {
        throw new Error('Paddle SDK not available');
      }
      
      // Fetch products and prices using modern SDK
      const productCollection = this.paddle.products.list({ status: ['active'] });
      const priceCollection = this.paddle.prices.list({ status: ['active'] });
      
      const productsPage = await productCollection.next();
      const pricesPage = await priceCollection.next();
      
      const products = productsPage || [];
      const prices = pricesPage || [];
      
      logger.debug(`[PaddleService] Fetched ${products.length} products and ${prices.length} prices from Paddle`);
      
      const { createPlan, getPlanByPaddleId } = require('~/models/Plan');
      const syncedPlans = [];
      
      // Match products with their prices
      for (const product of products) {
        // Find prices for this product
        const productPrices = prices.filter(price => price.productId === product.id);
        
        if (productPrices.length === 0) {
          logger.warn(`[PaddleService] No prices found for product: ${product.name}`);
          continue;
        }
        
        // Use the first active price (assuming one price per product for simplicity)
        const price = productPrices[0];
        
        // Check if plan already exists
        const existingPlan = await getPlanByPaddleId(product.id);
        
        if (!existingPlan) {
          // Map LibreChat features to Paddle products
          const planData = this.mapPaddleProductToPlan(product, price);
          const newPlan = await createPlan(planData);
          syncedPlans.push(newPlan);
          logger.info(`[PaddleService] Created plan: ${newPlan.name}`);
        } else {
          // Update existing plan with latest pricing
          const { updatePlan } = require('~/models/Plan');
          await updatePlan(existingPlan._id, {
            price: parseInt(price.unitPrice.amount),
            currency: price.unitPrice.currencyCode,
            paddlePriceId: price.id,
          });
          syncedPlans.push(existingPlan);
          logger.debug(`[PaddleService] Updated existing plan: ${product.name}`);
        }
      }
      
      logger.info(`[PaddleService] Synced ${syncedPlans.length} plans from Paddle`);
      return syncedPlans;
      
    } catch (error) {
      logger.error('[PaddleService] Error syncing plans from Paddle:', error);
      
      // Fallback to mock data for development
      logger.info('[PaddleService] Using mock data for development');
      return await this.createMockPlansForDevelopment();
    }
  }

  /**
   * Creates mock plans for development when Paddle API is not available
   * @returns {Promise<Array>} Mock plans
   */
  async createMockPlansForDevelopment() {
    const mockPaddleData = [
      {
        product: {
          id: 'prod_basic_librechat_dev',
          name: 'LibreChat Basic',
          description: 'Basic plan with €10 monthly token allowance',
          status: 'active',
        },
        price: {
          id: 'pri_basic_monthly_dev',
          product_id: 'prod_basic_librechat_dev',
          unit_amount: '1500', // €15.00 in cents
          currency_code: 'EUR',
          billing_cycle: {
            interval: 'month',
            frequency: 1,
          },
        },
      },
      {
        product: {
          id: 'prod_pro_librechat_dev',
          name: 'LibreChat Pro',
          description: 'Pro plan with unlimited usage',
          status: 'active',
        },
        price: {
          id: 'pri_pro_monthly_dev',
          product_id: 'prod_pro_librechat_dev',
          unit_amount: '5000', // €50.00 in cents
          currency_code: 'EUR',
          billing_cycle: {
            interval: 'month',
            frequency: 1,
          },
        },
      },
    ];
    
    const { createPlan, getPlanByPaddleId } = require('~/models/Plan');
    const syncedPlans = [];
    
    for (const item of mockPaddleData) {
      const { product, price } = item;
      
      // Check if plan already exists
      const existingPlan = await getPlanByPaddleId(product.id);
      
      if (!existingPlan) {
        // Map LibreChat features to Paddle products
        const planData = this.mapPaddleProductToPlan(product, price);
        const newPlan = await createPlan(planData);
        syncedPlans.push(newPlan);
        logger.info(`[PaddleService] Created mock plan: ${newPlan.name}`);
      } else {
        syncedPlans.push(existingPlan);
      }
    }
    
    return syncedPlans;
  }

  /**
   * Maps Paddle product data to LibreChat plan format
   * @param {Object} product - Paddle product (modern API format)
   * @param {Object} price - Paddle price (modern API format)
   * @returns {Object} Plan data for LibreChat
   */
  mapPaddleProductToPlan(product, price) {
    // Determine LibreChat-specific features based on product
    let tokenQuotaMonthly;
    let allowedModels;
    let features;
    
    if (product.name.toLowerCase().includes('basic')) {
      tokenQuotaMonthly = parseInt(process.env.BASIC_PLAN_QUOTA) || 1000;
      allowedModels = [
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        'claude-instant-1',
        'claude-instant-1.2',
      ];
      features = [
        'Standard models access',
        `€${(tokenQuotaMonthly / 100).toFixed(2)} monthly token quota`,
        'Email support',
        'Usage analytics',
      ];
    } else if (product.name.toLowerCase().includes('pro')) {
      tokenQuotaMonthly = parseInt(process.env.PRO_PLAN_QUOTA) || -1;
      allowedModels = ['*']; // All models
      features = [
        'All models access',
        'Unlimited usage',
        'Priority support',
        'Advanced analytics',
        'API access',
        'Custom integrations',
      ];
    } else {
      // Default configuration
      tokenQuotaMonthly = 500;
      allowedModels = ['gpt-3.5-turbo'];
      features = ['Basic access'];
    }
    
    return {
      name: product.name,
      paddleProductId: product.id,
      paddlePriceId: price.id,
      price: parseInt(price.unit_amount), // Modern API returns string
      currency: price.currency_code.toUpperCase(), // Modern API uses currency_code
      interval: price.billing_cycle?.interval || 'month',
      tokenQuotaMonthly,
      allowedModels,
      features,
      description: product.description || `${product.name} subscription plan`,
      isActive: product.status === 'active',
    };
  }

  /**
   * Verifies and unmarshals a webhook using modern SDK
   * @param {string} rawBody - Raw webhook body
   * @param {string} signature - Webhook signature
   * @returns {Promise<Object|null>} Webhook event data or null if invalid
   */
  async verifyAndUnmarshalWebhook(rawBody, signature) {
    try {
      if (!this.isAvailable()) {
        logger.warn('[PaddleService] Paddle SDK not available - cannot verify webhook');
        return null;
      }

      if (!this.webhookSecret) {
        logger.warn('[PaddleService] No webhook secret configured - cannot verify signature');
        return null;
      }
      
      // Use official Paddle SDK for webhook verification and unmarshaling
      const eventData = await this.paddle.webhooks.unmarshal(rawBody, this.webhookSecret, signature);
      
      logger.debug('[PaddleService] Webhook signature verified successfully');
      return eventData;
      
    } catch (error) {
      logger.error('[PaddleService] Error verifying webhook signature:', error);
      return null;
    }
  }

  /**
   * Creates a customer portal session URL using modern SDK
   * @param {string} customerId - Paddle customer ID
   * @param {string} returnUrl - URL to redirect after portal session
   * @returns {Promise<string>} Customer portal URL
   */
  async createCustomerPortalSession(customerId, returnUrl = null) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Paddle SDK not available');
      }

      logger.debug(`[PaddleService] Creating customer portal session for ${customerId}`);
      
      const portalRequest = {
        customerId,
      };

      if (returnUrl) {
        portalRequest.returnUrl = returnUrl;
      }

      const portalSession = await this.paddle.customerPortal.create(portalRequest);
      
      logger.info(`[PaddleService] Customer portal session created for ${customerId}`);
      
      return portalSession.url;
      
    } catch (error) {
      logger.error('[PaddleService] Error creating customer portal session:', error);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @param {string} rawBody - Raw webhook body
   * @param {string} signature - Webhook signature
   * @returns {boolean} Whether signature is valid
   */
  verifyWebhookSignature(rawBody, signature) {
    // For backward compatibility, return true if verification succeeds
    return this.verifyAndUnmarshalWebhook(rawBody, signature)
      .then(eventData => eventData !== null)
      .catch(() => false);
  }

  /**
   * Validates configuration and SDK availability
   * @returns {Object} Configuration status
   */
  validateConfiguration() {
    const issues = [];
    
    if (!this.apiKey) issues.push('Missing PADDLE_API_KEY');
    if (!this.webhookSecret) issues.push('Missing PADDLE_WEBHOOK_SECRET');
    if (!this.isAvailable()) issues.push('Paddle SDK not properly initialized');
    
    const config = {
      isValid: issues.length === 0,
      issues,
      environment: this.environment,
      sdkVersion: '@paddle/paddle-node-sdk v1.0.0',
      capabilities: {
        transactions: this.isAvailable(),
        subscriptions: this.isAvailable(),
        customers: this.isAvailable(),
        webhooks: this.isAvailable() && !!this.webhookSecret,
        customerPortal: this.isAvailable(),
      }
    };
    
    logger.debug('[PaddleService] Configuration validation:', config);
    return config;
  }
}

// Create singleton instance
let paddleService = null;

function getPaddleService() {
  if (!paddleService) {
    paddleService = new PaddleService();
  }
  return paddleService;
}

module.exports = {
  PaddleService,
  getPaddleService,
};