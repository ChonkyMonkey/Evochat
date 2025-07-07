const { logger } = require('@librechat/data-schemas');
const { createUser, updateUser } = require('~/models');
const { getPaddleService } = require('~/services/paddle');
const { getBillingConfig } = require('~/services/billingConfig');

/**
 * Enhanced user service that integrates with Paddle for subscription management
 */
class UserService {
  constructor() {
    this.paddleService = getPaddleService();
  }

  /**
   * Creates a user with Paddle customer integration
   * @param {Object} userData - User data
   * @param {Object} balanceConfig - Balance configuration
   * @param {boolean} disableTTL - Whether to disable TTL
   * @param {boolean} returnUser - Whether to return user object
   * @returns {Promise<Object>} Created user
   */
  async createUserWithPaddle(userData, balanceConfig, disableTTL = true, returnUser = false) {
    let newUser = null;
    let paddleCustomer = null;

    try {
      // First create the user in our database
      newUser = await createUser(userData, balanceConfig, disableTTL, true);
      logger.info(`[UserService] Created user: ${newUser._id} (${userData.email})`);

      // Check if subscription mode is enabled
      const billingConfig = getBillingConfig();
      if (billingConfig.isSubscriptionEnabled()) {
        try {
          // Create customer in Paddle
          paddleCustomer = await this.paddleService.createCustomer({
            email: userData.email,
            name: userData.name || userData.username || userData.email,
          });

          // Update user with Paddle customer ID
          const updatedUser = await updateUser(newUser._id, {
            paddleCustomerId: paddleCustomer.id,
          });

          logger.info(`[UserService] Created Paddle customer ${paddleCustomer.id} for user ${newUser._id}`);

          // Optionally create a free tier subscription
          await this.createFreeTierSubscription(updatedUser, paddleCustomer);

          return returnUser ? updatedUser : newUser._id;
        } catch (paddleError) {
          logger.error('[UserService] Failed to create Paddle customer:', paddleError);
          logger.warn(`[UserService] User ${newUser._id} created without Paddle integration`);
          
          // Continue without Paddle integration - user can still use the app
          return returnUser ? newUser : newUser._id;
        }
      } else {
        logger.debug('[UserService] Subscription mode not enabled, skipping Paddle customer creation');
        return returnUser ? newUser : newUser._id;
      }
    } catch (error) {
      logger.error('[UserService] Error creating user with Paddle integration:', error);

      // If user creation failed and we created a Paddle customer, we should clean up
      // For now, we'll log it - in production, consider cleanup mechanisms
      if (paddleCustomer) {
        logger.warn(`[UserService] Paddle customer ${paddleCustomer.id} may need cleanup`);
      }

      throw error;
    }
  }

  /**
   * Creates a free tier subscription for new users
   * @param {Object} user - User object
   * @param {Object} paddleCustomer - Paddle customer object
   */
  async createFreeTierSubscription(user, paddleCustomer) {
    try {
      // This would implement free tier logic
      // For now, we'll just log that the user is ready for subscription setup
      logger.info(`[UserService] User ${user._id} with Paddle customer ${paddleCustomer.id} ready for subscription`);

      // In a real implementation, you might:
      // 1. Check if there's a free tier plan
      // 2. Create a subscription with $0 pricing
      // 3. Set up the user with free tier limits
      
    } catch (error) {
      logger.error('[UserService] Error creating free tier subscription:', error);
      // Don't throw - this is optional functionality
    }
  }

  /**
   * Updates user with Paddle customer ID if missing
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @param {string} name - User name
   * @returns {Promise<string|null>} Paddle customer ID
   */
  async ensurePaddleCustomer(userId, email, name) {
    try {
      const { getUserById } = require('~/models');
      const user = await getUserById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // If user already has a Paddle customer ID, return it
      if (user.paddleCustomerId) {
        logger.debug(`[UserService] User ${userId} already has Paddle customer: ${user.paddleCustomerId}`);
        return user.paddleCustomerId;
      }

      // Check if subscription mode is enabled
      const billingConfig = getBillingConfig();
      if (!billingConfig.isSubscriptionEnabled()) {
        logger.debug('[UserService] Subscription mode not enabled, skipping Paddle customer creation');
        return null;
      }

      // Create Paddle customer
      const paddleCustomer = await this.paddleService.createCustomer({
        email: email || user.email,
        name: name || user.name || user.username || user.email,
      });

      // Update user with Paddle customer ID
      await updateUser(userId, {
        paddleCustomerId: paddleCustomer.id,
      });

      logger.info(`[UserService] Created Paddle customer ${paddleCustomer.id} for existing user ${userId}`);
      return paddleCustomer.id;
    } catch (error) {
      logger.error('[UserService] Error ensuring Paddle customer:', error);
      return null;
    }
  }

  /**
   * Gets or creates a Paddle customer for a user
   * @param {Object} user - User object
   * @returns {Promise<Object|null>} Paddle customer object
   */
  async getOrCreatePaddleCustomer(user) {
    try {
      // If user has a Paddle customer ID, try to fetch it
      if (user.paddleCustomerId) {
        try {
          const customer = await this.paddleService.getCustomer(user.paddleCustomerId);
          return customer;
        } catch (error) {
          logger.warn(`[UserService] Paddle customer ${user.paddleCustomerId} not found, creating new one`);
          // Continue to create a new customer
        }
      }

      // Create new Paddle customer
      const paddleCustomer = await this.paddleService.createCustomer({
        email: user.email,
        name: user.name || user.username || user.email,
      });

      // Update user with new Paddle customer ID
      await updateUser(user._id, {
        paddleCustomerId: paddleCustomer.id,
      });

      logger.info(`[UserService] Created new Paddle customer ${paddleCustomer.id} for user ${user._id}`);
      return paddleCustomer;
    } catch (error) {
      logger.error('[UserService] Error getting or creating Paddle customer:', error);
      return null;
    }
  }
}

// Create singleton instance
let userService = null;

function getUserService() {
  if (!userService) {
    userService = new UserService();
  }
  return userService;
}

module.exports = {
  UserService,
  getUserService,
};