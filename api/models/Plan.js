const { logger } = require('@librechat/data-schemas');
const { Plan } = require('~/db/models');

/**
 * Creates a new subscription plan
 * @param {Object} planData - Plan data
 * @returns {Promise<Object>} The created plan
 */
async function createPlan(planData) {
  try {
    const plan = new Plan(planData);
    await plan.save();
    
    logger.info(`[Plan] Created plan ${plan.name} with ID ${plan._id}`);
    return plan;
  } catch (error) {
    logger.error('[Plan] Error creating plan:', error);
    throw error;
  }
}

/**
 * Gets all active plans
 * @returns {Promise<Array>} Array of active plans
 */
async function getActivePlans() {
  try {
    return await Plan.find({ isActive: true })
      .sort({ price: 1 })
      .lean();
  } catch (error) {
    logger.error('[Plan] Error getting active plans:', error);
    throw error;
  }
}

/**
 * Gets a plan by ID
 * @param {string} planId - The plan ID
 * @returns {Promise<Object|null>} The plan or null
 */
async function getPlanById(planId) {
  try {
    return await Plan.findById(planId).lean();
  } catch (error) {
    logger.error('[Plan] Error getting plan by ID:', error);
    throw error;
  }
}

/**
 * Gets a plan by name
 * @param {string} name - The plan name
 * @returns {Promise<Object|null>} The plan or null
 */
async function getPlanByName(name) {
  try {
    return await Plan.findOne({ name, isActive: true }).lean();
  } catch (error) {
    logger.error('[Plan] Error getting plan by name:', error);
    throw error;
  }
}

/**
 * Gets a plan by Paddle product ID
 * @param {string} paddleProductId - The Paddle product ID
 * @returns {Promise<Object|null>} The plan or null
 */
async function getPlanByPaddleId(paddleProductId) {
  try {
    return await Plan.findOne({ paddleProductId, isActive: true }).lean();
  } catch (error) {
    logger.error('[Plan] Error getting plan by Paddle ID:', error);
    throw error;
  }
}

/**
 * Updates a plan
 * @param {string} planId - The plan ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object|null>} The updated plan
 */
async function updatePlan(planId, updateData) {
  try {
    const plan = await Plan.findByIdAndUpdate(
      planId,
      { $set: updateData },
      { new: true }
    );

    if (!plan) {
      logger.warn(`[Plan] Plan not found: ${planId}`);
      return null;
    }

    logger.info(`[Plan] Updated plan ${plan.name}`);
    return plan;
  } catch (error) {
    logger.error('[Plan] Error updating plan:', error);
    throw error;
  }
}

/**
 * Deactivates a plan (soft delete)
 * @param {string} planId - The plan ID
 * @returns {Promise<Object|null>} The deactivated plan
 */
async function deactivatePlan(planId) {
  try {
    const plan = await Plan.findByIdAndUpdate(
      planId,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!plan) {
      logger.warn(`[Plan] Plan not found: ${planId}`);
      return null;
    }

    logger.info(`[Plan] Deactivated plan ${plan.name}`);
    return plan;
  } catch (error) {
    logger.error('[Plan] Error deactivating plan:', error);
    throw error;
  }
}

/**
 * Seeds default plans if they don't exist
 * @returns {Promise<void>}
 */
async function seedDefaultPlans() {
  try {
    const existingPlans = await Plan.countDocuments({});
    
    if (existingPlans > 0) {
      logger.debug('[Plan] Plans already exist, skipping seed');
      return;
    }

    const defaultPlans = [
      {
        name: 'Basic',
        paddleProductId: 'prod_basic_placeholder', // To be replaced with actual Paddle IDs
        paddlePriceId: 'price_basic_placeholder',
        price: 1500, // €15.00 in cents
        currency: 'EUR',
        interval: 'month',
        tokenQuotaMonthly: 1000, // €10.00 worth of tokens in cents
        allowedModels: [
          'gpt-3.5-turbo',
          'gpt-3.5-turbo-16k',
          'claude-instant-1',
          'claude-instant-1.2',
        ],
        features: [
          'Standard models access',
          '€10 monthly token quota',
          'Email support',
          'Usage analytics',
        ],
        isActive: true,
      },
      {
        name: 'Pro',
        paddleProductId: 'prod_pro_placeholder', // To be replaced with actual Paddle IDs
        paddlePriceId: 'price_pro_placeholder',
        price: 5000, // €50.00 in cents
        currency: 'EUR',
        interval: 'month',
        tokenQuotaMonthly: -1, // Unlimited (represented as -1)
        allowedModels: ['*'], // All models
        features: [
          'All models access',
          'Unlimited usage',
          'Priority support',
          'Advanced analytics',
          'API access',
          'Custom integrations',
        ],
        isActive: true,
      },
    ];

    for (const planData of defaultPlans) {
      await createPlan(planData);
    }

    logger.info('[Plan] Default plans seeded successfully');
  } catch (error) {
    logger.error('[Plan] Error seeding default plans:', error);
    throw error;
  }
}

/**
 * Gets plan comparison data for frontend display
 * @returns {Promise<Array>} Array of plans with formatted data
 */
async function getPlansForComparison() {
  try {
    const plans = await getActivePlans();
    
    return plans.map(plan => ({
      ...plan,
      displayPrice: plan.price / 100, // Convert cents to currency
      formattedPrice: new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: plan.currency,
      }).format(plan.price / 100),
      isUnlimited: plan.tokenQuotaMonthly === -1,
      formattedQuota: plan.tokenQuotaMonthly === -1 
        ? 'Unlimited' 
        : new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: plan.currency,
          }).format(plan.tokenQuotaMonthly / 100),
    }));
  } catch (error) {
    logger.error('[Plan] Error getting plans for comparison:', error);
    throw error;
  }
}

/**
 * Validates if a model is allowed for a plan
 * @param {Object} plan - The plan object
 * @param {string} modelName - The model name to check
 * @returns {boolean} Whether the model is allowed
 */
function isModelAllowedForPlan(plan, modelName) {
  if (!plan || !plan.allowedModels) {
    return false;
  }
  
  return plan.allowedModels.includes('*') || plan.allowedModels.includes(modelName);
}

/**
 * Gets models available for a specific plan
 * @param {string} planId - The plan ID
 * @returns {Promise<Array>} Array of allowed model names
 */
async function getModelsForPlan(planId) {
  try {
    const plan = await getPlanById(planId);
    
    if (!plan) {
      return [];
    }
    
    return plan.allowedModels;
  } catch (error) {
    logger.error('[Plan] Error getting models for plan:', error);
    throw error;
  }
}

module.exports = {
  createPlan,
  getActivePlans,
  getPlanById,
  getPlanByName,
  getPlanByPaddleId,
  updatePlan,
  deactivatePlan,
  seedDefaultPlans,
  getPlansForComparison,
  isModelAllowedForPlan,
  getModelsForPlan,
};