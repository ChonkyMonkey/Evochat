#!/usr/bin/env node

const { connectDb } = require('~/db/connect');
const { seedDefaultPlans } = require('~/models/Plan');
const { logger } = require('@librechat/data-schemas');

/**
 * Sets up subscription-related database collections and seeds default data
 */
async function setupSubscriptionDatabase() {
  try {
    logger.info('[SubscriptionSetup] Starting subscription database setup...');
    
    // Connect to database
    await connectDb();
    logger.info('[SubscriptionSetup] Connected to database');

    // Import models to ensure they are registered
    const { Subscription, Plan, UsageRecord } = require('~/db/models');
    
    // Create indexes manually if needed (mongoose usually handles this)
    logger.info('[SubscriptionSetup] Ensuring database indexes...');
    
    // Subscription indexes
    await Subscription.collection.createIndex({ userId: 1 });
    await Subscription.collection.createIndex({ paddleSubscriptionId: 1 }, { unique: true });
    await Subscription.collection.createIndex({ status: 1 });
    await Subscription.collection.createIndex({ currentPeriodEnd: 1 });
    
    // Plan indexes
    await Plan.collection.createIndex({ name: 1 });
    await Plan.collection.createIndex({ paddleProductId: 1 }, { unique: true });
    await Plan.collection.createIndex({ paddlePriceId: 1 }, { unique: true });
    await Plan.collection.createIndex({ isActive: 1 });
    
    // UsageRecord indexes
    await UsageRecord.collection.createIndex({ userId: 1, date: 1 }, { unique: true });
    await UsageRecord.collection.createIndex({ subscriptionId: 1, date: 1 });
    await UsageRecord.collection.createIndex({ date: 1 });
    
    logger.info('[SubscriptionSetup] Database indexes created successfully');

    // Seed default plans
    await seedDefaultPlans();
    logger.info('[SubscriptionSetup] Default plans seeded successfully');

    logger.info('[SubscriptionSetup] Subscription database setup completed successfully!');
    
    // Display setup summary
    const planCount = await Plan.countDocuments({ isActive: true });
    logger.info(`[SubscriptionSetup] Summary: ${planCount} active plans available`);
    
    const plans = await Plan.find({ isActive: true }).select('name price currency').lean();
    plans.forEach(plan => {
      const formattedPrice = new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: plan.currency,
      }).format(plan.price / 100);
      logger.info(`[SubscriptionSetup] - ${plan.name}: ${formattedPrice}/month`);
    });

  } catch (error) {
    logger.error('[SubscriptionSetup] Error during subscription setup:', error);
    throw error;
  }
}

/**
 * Validates that all subscription models are working correctly
 */
async function validateSubscriptionSetup() {
  try {
    logger.info('[SubscriptionSetup] Validating subscription setup...');
    
    await connectDb();
    const { Subscription, Plan, UsageRecord } = require('~/db/models');
    
    // Test Plan model
    const planCount = await Plan.countDocuments({});
    logger.info(`[SubscriptionSetup] Found ${planCount} plans in database`);
    
    if (planCount === 0) {
      throw new Error('No plans found in database. Run setup first.');
    }
    
    // Test basic model operations
    const testPlan = await Plan.findOne({ isActive: true });
    if (!testPlan) {
      throw new Error('No active plans found');
    }
    
    logger.info(`[SubscriptionSetup] Test plan found: ${testPlan.name}`);
    
    // Validate required Paddle configuration
    const missingPaddleConfig = [];
    if (!process.env.PADDLE_API_KEY) missingPaddleConfig.push('PADDLE_API_KEY');
    if (!process.env.PADDLE_WEBHOOK_SECRET) missingPaddleConfig.push('PADDLE_WEBHOOK_SECRET');
    if (!process.env.PADDLE_VENDOR_ID) missingPaddleConfig.push('PADDLE_VENDOR_ID');
    if (!process.env.PADDLE_ENVIRONMENT) missingPaddleConfig.push('PADDLE_ENVIRONMENT');
    
    if (missingPaddleConfig.length > 0) {
      logger.warn(`[SubscriptionSetup] Missing Paddle environment variables: ${missingPaddleConfig.join(', ')}`);
      logger.warn('[SubscriptionSetup] Subscription features will not work without proper Paddle configuration');
    } else {
      logger.info('[SubscriptionSetup] Paddle environment variables configured');
    }
    
    logger.info('[SubscriptionSetup] Validation completed successfully!');
    return true;
    
  } catch (error) {
    logger.error('[SubscriptionSetup] Validation failed:', error);
    throw error;
  }
}

/**
 * Cleans up subscription data (useful for development/testing)
 */
async function cleanupSubscriptionData() {
  try {
    logger.info('[SubscriptionSetup] Cleaning up subscription data...');
    
    await connectDb();
    const { Subscription, Plan, UsageRecord } = require('~/db/models');
    
    // Remove all subscription data (be careful in production!)
    const deletedUsageRecords = await UsageRecord.deleteMany({});
    const deletedSubscriptions = await Subscription.deleteMany({});
    const deletedPlans = await Plan.deleteMany({});
    
    logger.info(`[SubscriptionSetup] Cleanup completed:`);
    logger.info(`[SubscriptionSetup] - Deleted ${deletedUsageRecords.deletedCount} usage records`);
    logger.info(`[SubscriptionSetup] - Deleted ${deletedSubscriptions.deletedCount} subscriptions`);
    logger.info(`[SubscriptionSetup] - Deleted ${deletedPlans.deletedCount} plans`);
    
  } catch (error) {
    logger.error('[SubscriptionSetup] Error during cleanup:', error);
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  const runCommand = async () => {
    try {
      switch (command) {
        case 'setup':
          await setupSubscriptionDatabase();
          break;
        case 'validate':
          await validateSubscriptionSetup();
          break;
        case 'cleanup':
          await cleanupSubscriptionData();
          break;
        case 'reset':
          await cleanupSubscriptionData();
          await setupSubscriptionDatabase();
          break;
        default:
          console.log('LibreChat Subscription Setup Tool');
          console.log('');
          console.log('Usage: node subscription-setup.js <command>');
          console.log('');
          console.log('Commands:');
          console.log('  setup     - Set up subscription database and seed default plans');
          console.log('  validate  - Validate subscription setup and configuration');
          console.log('  cleanup   - Remove all subscription data (BE CAREFUL!)');
          console.log('  reset     - Cleanup and setup fresh subscription data');
          console.log('');
          process.exit(1);
      }
      
      process.exit(0);
    } catch (error) {
      logger.error('Command failed:', error);
      process.exit(1);
    }
  };
  
  runCommand();
}

module.exports = {
  setupSubscriptionDatabase,
  validateSubscriptionSetup,
  cleanupSubscriptionData,
};