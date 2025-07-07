const { Paddle, Environment, LogLevel } = require('@paddle/paddle-node-sdk');
const { logger } = require('@librechat/data-schemas');
const { createPlan, getPlanByPaddleId, updatePlan } = require('~/models');

/**
 * Real Paddle API client for handling subscription billing
 * Uses the official Paddle Node SDK v3.0.0
 */
class PaddleService {
  constructor() {
    this.apiKey = process.env.PADDLE_API_KEY;
    this.webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    this.environment = process.env.PADDLE_ENVIRONMENT || 'sandbox';

    if (!this.apiKey) {
      logger.warn('[PaddleService] PADDLE_API_KEY not configured - subscription features will not work');
    }

    if (!this.webhookSecret) {
      logger.warn('[PaddleService] PADDLE_WEBHOOK_SECRET not configured - webhook verification will fail');
    }

    // Initialize Paddle SDK
    this.paddle = new Paddle(this.apiKey, {
      environment: this.environment === 'production' ? Environment.production : Environment.sandbox,
      logLevel: LogLevel.verbose,
    });

    logger.info(`[PaddleService] Initialized with Paddle Node SDK in ${this.environment} mode`);
  }

  /**
   * Validates Paddle configuration
   * @returns {Object} Validation result
   */
  validateConfiguration() {
    const issues = [];

    if (!this.apiKey) {
      issues.push('PADDLE_API_KEY is required');
    }

    if (!this.webhookSecret) {
      issues.push('PADDLE_WEBHOOK_SECRET is required');
    }

    if (!['sandbox', 'production'].includes(this.environment)) {
      issues.push(`Invalid PADDLE_ENVIRONMENT: ${this.environment}. Must be 'sandbox' or 'production'`);
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Creates a checkout session for a subscription
   * @param {Object} params - Checkout parameters
   * @param {string} params.planId - Plan ID from our database
   * @param {string} params.userId - User ID
   * @param {Object} params.customData - Additional data to pass
   * @returns {Promise<Object>} Checkout session details
   */
  async createCheckoutSession({ planId, userId, customData }) {
    try {
      logger.info(`[PaddleService] Creating checkout session for user ${userId}, plan ${planId}`);

      const { getPlanById } = require('~/models');
      const plan = await getPlanById(planId);

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      if (!plan.paddlePriceId) {
        throw new Error(`Plan ${plan.name} missing Paddle price ID`);
      }

      // Create transaction using Paddle SDK
      const transactionData = {
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
        customerEmail: customData.customerEmail,
        successUrl: `${process.env.DOMAIN_CLIENT}/subscription/success?session_id={checkout.id}`,
        cancelUrl: `${process.env.DOMAIN_CLIENT}/subscription/cancel`,
      };

      // Create transaction for checkout using Paddle SDK
      const transaction = await this.paddle.transactions.create(transactionData);
      
      const response = {
        sessionId: transaction.id,
        checkoutUrl: transaction.checkoutUrl || `https://checkout.paddle.com/checkout?checkout_id=${transaction.id}`,
        status: transaction.status,
        transactionId: transaction.id,
      };

      logger.info(`[PaddleService] Checkout session created: ${response.sessionId}`);
      return response;
    } catch (error) {
      logger.error('[PaddleService] Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Gets subscription details from Paddle
   * @param {string} subscriptionId - Paddle subscription ID
   * @returns {Promise<Object>} Subscription details
   */
  async getSubscription(subscriptionId) {
    try {
      logger.debug(`[PaddleService] Getting subscription ${subscriptionId}`);

      const subscription = await this.paddle.subscriptions.get(subscriptionId);
      logger.debug(`[PaddleService] Retrieved subscription:`, subscription);
      return subscription;
    } catch (error) {
      logger.error('[PaddleService] Error getting subscription:', error);
      throw error;
    }
  }

  /**
   * Updates a subscription
   * @param {string} subscriptionId - Paddle subscription ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated subscription
   */
  async updateSubscription(subscriptionId, updates) {
    try {
      logger.info(`[PaddleService] Updating subscription ${subscriptionId}`);

      const updatedSubscription = await this.paddle.subscriptions.update(subscriptionId, updates);
      logger.info(`[PaddleService] Updated subscription:`, updatedSubscription);
      return updatedSubscription;
    } catch (error) {
      logger.error('[PaddleService] Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancels a subscription
   * @param {string} subscriptionId - Paddle subscription ID
   * @param {boolean} immediately - Whether to cancel immediately or at period end
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelSubscription(subscriptionId, immediately = false) {
    try {
      logger.info(`[PaddleService] Canceling subscription ${subscriptionId}, immediately: ${immediately}`);

      const cancelData = immediately ? { effectiveFrom: 'immediately' } : {};
      const result = await this.paddle.subscriptions.cancel(subscriptionId, cancelData);

      logger.info(`[PaddleService] Canceled subscription:`, result);
      return result;
    } catch (error) {
      logger.error('[PaddleService] Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Gets customer details from Paddle
   * @param {string} customerId - Paddle customer ID
   * @returns {Promise<Object>} Customer details
   */
  async getCustomer(customerId) {
    try {
      logger.debug(`[PaddleService] Getting customer ${customerId}`);

      const customer = await this.paddle.customers.get(customerId);
      logger.debug(`[PaddleService] Retrieved customer:`, customer);
      return customer;
    } catch (error) {
      logger.error('[PaddleService] Error getting customer:', error);
      throw error;
    }
  }

  /**
   * Creates a new customer in Paddle
   * @param {Object} userData - Customer data
   * @param {string} userData.email - Customer email
   * @param {string} userData.name - Customer name
   * @returns {Promise<Object>} Created customer
   */
  async createCustomer(userData) {
    try {
      logger.info(`[PaddleService] Creating customer for ${userData.email}`);

      const customerData = {
        email: userData.email,
        name: userData.name,
      };

      const customer = await this.paddle.customers.create(customerData);
      logger.info(`[PaddleService] Created customer: ${customer.id}`);
      return customer;
    } catch (error) {
      logger.error('[PaddleService] Error creating customer:', error);
      
      // Enhanced error logging for Paddle API permission debugging
      if (error.status === 403 || error.response?.status === 403) {
        logger.error('[PaddleService] 403 Forbidden - Check API key permissions in Paddle Dashboard:');
        logger.error('🔧 REQUIRED permissions for customer creation:');
        logger.error('   ✅ Read and write customers');
        logger.error('   ✅ Read products and prices (if needed)');
        logger.error('');
        logger.error('❌ NOT REQUIRED for backend customer operations:');
        logger.error('   ❌ Read and write client-side tokens (this is ONLY for frontend Paddle.js operations)');
        logger.error('');
        logger.error('📍 Steps to fix:');
        logger.error('   1. Go to Paddle Dashboard → Developer tools → Authentication');
        logger.error('   2. Edit your API key permissions');
        logger.error('   3. Ensure "Read and write customers" is enabled');
        logger.error('   4. Save the permissions');
        logger.error('');
        logger.error('🔑 API Key validation:');
        logger.error(`   Format: ${this.apiKey ? 'API key is set' : 'API key is missing!'}`);
        logger.error(`   Starts with pdl_: ${this.apiKey?.startsWith('pdl_') ? 'Yes (new format)' : 'No (legacy format or invalid)'}`);
        logger.error(`   Environment: ${this.environment}`);
      }
      
      throw error;
    }
  }

  /**
   * Syncs plans from Paddle API to local database
   * @returns {Promise<Array>} Array of synced plans
   */
  async syncPlansFromPaddle() {
    try {
      logger.info('[PaddleService] Syncing plans from Paddle API...');

      // Get all products and prices from Paddle
      const products = [];
      const prices = [];

      // Fetch products
      const productCollection = this.paddle.products.list();
      for await (const product of productCollection) {
        products.push(product);
      }

      // Fetch prices
      const priceCollection = this.paddle.prices.list();
      for await (const price of priceCollection) {
        prices.push(price);
      }

      logger.debug(`[PaddleService] Fetched ${products.length} products and ${prices.length} prices from Paddle`);

      const syncedPlans = [];

      // Process each product and create/update plans
      for (const product of products) {
        if (product.status !== 'active') {
          continue;
        }

        // Find prices for this product
        const productPrices = prices.filter(price => price.productId === product.id && price.status === 'active');

        if (productPrices.length === 0) {
          logger.warn(`[PaddleService] No prices found for product: ${product.name}`);
          continue;
        }

        // Use the first price for the plan (assuming one price per product for simplicity)
        const price = productPrices[0];

        // Check if plan already exists
        const existingPlan = await getPlanByPaddleId(product.id);

        if (!existingPlan) {
          // Create new plan
          const planData = this.mapPaddleProductToPlan(product, price);
          const newPlan = await createPlan(planData);
          syncedPlans.push(newPlan);
          logger.info(`[PaddleService] Created plan: ${newPlan.name}`);
        } else {
          // Update existing plan
          const updateData = {
            name: product.name,
            price: parseInt(price.unitPrice.amount),
            currency: price.unitPrice.currencyCode,
            paddlePriceId: price.id,
          };
          const updatedPlan = await updatePlan(existingPlan._id, updateData);
          syncedPlans.push(updatedPlan);
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
   * Creates mock plans for development purposes
   * @returns {Promise<Array>} Array of created mock plans
   */
  async createMockPlansForDevelopment() {
    const mockPlans = [
      {
        name: 'Basic',
        paddleProductId: 'pro_mock_basic',
        paddlePriceId: 'pri_mock_basic',
        price: 1500, // €15.00 in cents
        currency: 'EUR',
        billingInterval: 'month',
        features: [
          'Access to GPT-3.5-turbo',
          '1,000 messages per month',
          'Standard support',
        ],
        description: 'Perfect for individuals getting started',
        tokenQuotaMonthly: 100000,
        allowedModels: ['gpt-3.5-turbo'],
        isActive: true,
      },
      {
        name: 'Pro',
        paddleProductId: 'pro_mock_pro',
        paddlePriceId: 'pri_mock_pro',
        price: 5000, // €50.00 in cents
        currency: 'EUR',
        billingInterval: 'month',
        features: [
          'Access to GPT-4 and GPT-3.5-turbo',
          '10,000 messages per month',
          'Priority support',
          'Advanced features',
        ],
        description: 'For professionals and power users',
        tokenQuotaMonthly: 1000000,
        allowedModels: ['gpt-4', 'gpt-3.5-turbo'],
        isActive: true,
      },
    ];

    const syncedPlans = [];

    for (const planData of mockPlans) {
      const existingPlan = await getPlanByPaddleId(planData.paddleProductId);
      if (!existingPlan) {
        const newPlan = await createPlan(planData);
        syncedPlans.push(newPlan);
        logger.info(`[PaddleService] Created mock plan: ${newPlan.name}`);
      } else {
        syncedPlans.push(existingPlan);
        logger.debug(`[PaddleService] Mock plan already exists: ${planData.name}`);
      }
    }

    return syncedPlans;
  }

  /**
   * Maps a Paddle product and price to our plan structure
   * @param {Object} product - Paddle product
   * @param {Object} price - Paddle price
   * @returns {Object} Plan data
   */
  mapPaddleProductToPlan(product, price) {
    // Extract features from product description or use defaults
    const features = product.description ? [product.description] : ['Basic features'];

    return {
      name: product.name,
      paddleProductId: product.id,
      paddlePriceId: price.id,
      price: parseInt(price.unitPrice.amount), // Paddle returns string, convert to cents
      currency: price.unitPrice.currencyCode,
      billingInterval: price.billingCycle?.interval === 'month' ? 'month' : 'year',
      features,
      description: product.description || `${product.name} subscription plan`,
      isActive: product.status === 'active',
      // Default values - these should be configured per plan
      tokenQuotaMonthly: 100000,
      allowedModels: ['gpt-3.5-turbo'],
    };
  }

  /**
   * Verifies webhook signature from Paddle
   * @param {string} rawBody - Raw request body
   * @param {string} signature - Paddle signature header
   * @returns {Promise<boolean>} Whether signature is valid
   */
  async verifyWebhookSignature(rawBody, signature) {
    try {
      if (!this.webhookSecret) {
        logger.warn('[PaddleService] No webhook secret configured - cannot verify signature');
        return false;
      }

      if (!signature || !rawBody) {
        logger.warn('[PaddleService] Missing signature or body for webhook verification');
        return false;
      }

      // Use Paddle SDK webhook verification
      const isValid = await this.paddle.webhooks.isSignatureValid(rawBody, this.webhookSecret, signature);
      logger.debug(`[PaddleService] Webhook signature verification result: ${isValid}`);
      return isValid;
    } catch (error) {
      logger.error('[PaddleService] Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Unmarshal webhook event data
   * @param {string} rawBody - Raw request body
   * @param {string} signature - Paddle signature header
   * @returns {Promise<Object>} Parsed webhook event
   */
  async unmarshalWebhook(rawBody, signature) {
    try {
      if (!this.webhookSecret) {
        throw new Error('No webhook secret configured');
      }

      const eventData = await this.paddle.webhooks.unmarshal(rawBody, this.webhookSecret, signature);
      logger.debug(`[PaddleService] Unmarshaled webhook event: ${eventData.eventType}`);
      return eventData;
    } catch (error) {
      logger.error('[PaddleService] Error unmarshaling webhook:', error);
      throw error;
    }
  }

  /**
   * Creates a customer portal session
   * @param {string} customerId - Paddle customer ID
   * @param {Array} subscriptionIds - Array of subscription IDs
   * @returns {Promise<Object>} Customer portal session
   */
  async createCustomerPortalSession(customerId, subscriptionIds = []) {
    try {
      logger.info(`[PaddleService] Creating customer portal session for customer ${customerId}`);

      const session = await this.paddle.customerPortalSessions.create(customerId, subscriptionIds);
      logger.info(`[PaddleService] Created customer portal session: ${session.id}`);
      return session;
    } catch (error) {
      logger.error('[PaddleService] Error creating customer portal session:', error);
      throw error;
    }
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