const { logger } = require('@librechat/data-schemas');

/**
 * Paddle API client for handling subscription billing
 * This is a placeholder implementation - needs to be replaced with actual Paddle SDK
 */
class PaddleService {
  constructor() {
    this.apiKey = process.env.PADDLE_API_KEY;
    this.environment = process.env.PADDLE_ENVIRONMENT || 'sandbox';
    this.webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
    
    if (!this.apiKey) {
      logger.warn('[PaddleService] PADDLE_API_KEY not configured - subscription features will not work');
    }
    
    // Modern Paddle Billing API base URL
    this.baseUrl = this.environment === 'production'
      ? 'https://api.paddle.com'
      : 'https://sandbox-api.paddle.com';
      
    // Default headers for Paddle API requests
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
      
    logger.info(`[PaddleService] Initialized in ${this.environment} mode`);
  }

  /**
   * Makes HTTP request to Paddle API
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async makeRequest(endpoint, options = {}) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Paddle API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`[PaddleService] API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Creates a checkout session for a subscription
   * @param {Object} params - Checkout parameters
   * @param {string} params.planId - Internal plan ID
   * @param {string} params.userId - User ID
   * @param {Object} params.customData - Additional data to pass to Paddle
   * @returns {Promise<Object>} Checkout session data
   */
  async createCheckoutSession({ planId, userId, customData = {} }) {
    try {
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

      // TODO: Replace with actual Paddle SDK implementation
      // This is a placeholder implementation
      const checkoutData = {
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
        returnUrl: `${process.env.DOMAIN_CLIENT}/subscription/success`,
        discountUrl: `${process.env.DOMAIN_CLIENT}/subscription/cancel`,
      };

      // Placeholder response - replace with actual Paddle API call
      const mockResponse = {
        checkoutUrl: `${this.baseUrl}/checkout?session_id=mock_session_${Date.now()}`,
        sessionId: `session_${Date.now()}`,
        customData: checkoutData.customData,
      };
      
      logger.info(`[PaddleService] Checkout session created: ${mockResponse.sessionId}`);
      return mockResponse;
      
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
      
      // TODO: Replace with actual Paddle API call
      // const response = await paddle.subscriptions.get(subscriptionId);
      
      // Placeholder implementation
      const mockSubscription = {
        id: subscriptionId,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        customData: {},
      };
      
      return mockSubscription;
      
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
      
      // TODO: Replace with actual Paddle API call
      // const response = await paddle.subscriptions.update(subscriptionId, updates);
      
      // Placeholder implementation
      const updatedSubscription = {
        id: subscriptionId,
        ...updates,
        updatedAt: new Date(),
      };
      
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
      
      // TODO: Replace with actual Paddle API call
      const cancelData = {
        subscriptionId,
        cancelAtPeriodEnd: !immediately,
      };
      
      // Placeholder implementation
      const result = {
        success: true,
        subscriptionId,
        canceledAt: new Date(),
        cancelAtPeriodEnd: !immediately,
      };
      
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
      
      // TODO: Replace with actual Paddle API call
      // const response = await paddle.customers.get(customerId);
      
      // Placeholder implementation
      const mockCustomer = {
        id: customerId,
        email: 'user@example.com',
        name: 'Test User',
        createdAt: new Date(),
      };
      
      return mockCustomer;
      
    } catch (error) {
      logger.error('[PaddleService] Error getting customer:', error);
      throw error;
    }
  }

  /**
   * Creates a customer in Paddle
   * @param {Object} userData - User data
   * @param {string} userData.email - Customer email
   * @param {string} userData.name - Customer name
   * @returns {Promise<Object>} Created customer
   */
  async createCustomer(userData) {
    try {
      logger.info(`[PaddleService] Creating customer for ${userData.email}`);
      
      // TODO: Replace with actual Paddle API call
      // const response = await paddle.customers.create(userData);
      
      // Placeholder implementation
      const mockCustomer = {
        id: `cust_${Date.now()}`,
        email: userData.email,
        name: userData.name,
        createdAt: new Date(),
      };
      
      return mockCustomer;
      
    } catch (error) {
      logger.error('[PaddleService] Error creating customer:', error);
      throw error;
    }
  }

  /**
   * Syncs plans from Paddle to local database
   * @returns {Promise<Array>} Synced plans
   */
  async syncPlansFromPaddle() {
    try {
      logger.info('[PaddleService] Syncing plans from Paddle API...');
      
      if (!this.apiKey) {
        throw new Error('Paddle API key not configured');
      }
      
      // Fetch products and prices from modern Paddle API
      const productsResponse = await this.makeRequest('/products?status=active');
      const pricesResponse = await this.makeRequest('/prices?status=active');
      
      const products = productsResponse.data || [];
      const prices = pricesResponse.data || [];
      
      logger.debug(`[PaddleService] Fetched ${products.length} products and ${prices.length} prices from Paddle`);
      
      const { createPlan, getPlanByPaddleId } = require('~/models/Plan');
      const syncedPlans = [];
      
      // Match products with their prices
      for (const product of products) {
        // Find prices for this product
        const productPrices = prices.filter(price => price.product_id === product.id);
        
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
            price: parseInt(price.unit_amount),
            currency: price.currency_code,
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
   * Verifies a webhook signature
   * @param {string} rawBody - Raw webhook body
   * @param {string} signature - Webhook signature
   * @returns {boolean} Whether signature is valid
   */
  verifyWebhookSignature(rawBody, signature) {
    try {
      if (!this.webhookSecret) {
        logger.warn('[PaddleService] No webhook secret configured - cannot verify signature');
        return false;
      }
      
      // TODO: Implement actual Paddle webhook signature verification
      // This is typically done with HMAC-SHA256
      
      // Placeholder implementation - always return true for development
      logger.debug('[PaddleService] Webhook signature verification (placeholder)');
      return true;
      
    } catch (error) {
      logger.error('[PaddleService] Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Validates configuration
   * @returns {Object} Configuration status
   */
  validateConfiguration() {
    const issues = [];
    
    if (!this.apiKey) issues.push('Missing PADDLE_API_KEY');
    if (!this.webhookSecret) issues.push('Missing PADDLE_WEBHOOK_SECRET');
    
    return {
      isValid: issues.length === 0,
      issues,
      environment: this.environment,
    };
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