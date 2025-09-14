import express from 'express';
import BillingService from '../services/Paddle/BillingService';
import { CreateCustomerRequestBody } from '@paddle/paddle-node-sdk';
import { ModelTier } from '@librechat/data-schemas/billing';
import { IUser } from '@librechat/data-schemas';
import { requireJwtAuth } from '../middleware';

const router = express.Router();

router.post('/customer', async (req, res) => {
  try {
    const { email, name, customData, locale } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required to create a customer.' });
    }

    const customerData: CreateCustomerRequestBody = { email };
    if (name) customerData.name = name;
    if (customData) customerData.customData = customData;
    if (locale) customerData.locale = locale;

    const customer = await BillingService.createCustomer(customerData);

    if (customer) {
      res.status(201).json({ customerId: customer.id, message: 'Customer created successfully.' });
    } else {
      res.status(500).json({ message: 'Failed to create customer: No customer data returned.' });
    }
    
  } catch (error: any) {
    console.error('Error in /api/billing/customer:', error);
    res.status(500).json({ message: 'Failed to create customer', error: error.message });
  }
});

router.post('/usage/choose-tier', requireJwtAuth, async (req, res) => {
  try {
    const user = req.user as IUser;
    const {
      requestedTier,
      prompt,
      conversationContext,
      mode = 'standard'
    } = req.body;

    // Validate requestedTier is provided
    if (!requestedTier) {
      return res.status(400).json({ message: 'requestedTier is required' });
    }

    // Validate requestedTier is a valid ModelTier
    const validTiers: ModelTier[] = [
      'economy', 'standard', 'premium', 'flagship',
      'economy_mini', 'standard_mini', 'premium_mini'
    ];
    
    if (!validTiers.includes(requestedTier as ModelTier)) {
      return res.status(400).json({
        message: 'Invalid requestedTier',
        validTiers
      });
    }

    // Validate mode is valid
    const validModes = ['auto', 'standard', 'premium'];
    if (mode && !validModes.includes(mode)) {
      return res.status(400).json({
        message: 'Invalid mode',
        validModes
      });
    }

    // Validate conversationContext structure if provided
    if (conversationContext && !Array.isArray(conversationContext)) {
      return res.status(400).json({
        message: 'conversationContext must be an array'
      });
    }

    if (conversationContext) {
      for (const message of conversationContext) {
        if (!message.role || !message.content || typeof message.role !== 'string' || typeof message.content !== 'string') {
          return res.status(400).json({
            message: 'Each message in conversationContext must have role and content as strings'
          });
        }
      }
    }

    const userId = user._id?.toString() || user.id;
    const result = await BillingService.chooseTier(
      userId,
      requestedTier as ModelTier,
      {
        mode,
        prompt,
        conversationContext
      },
      req
    );

    res.status(200).json(result);
    
  } catch (error: any) {
    console.error('Error in /api/billing/usage/choose-tier:', error);
    res.status(500).json({
      message: 'Failed to choose tier',
      error: error.message
    });
  }
});

export default router;