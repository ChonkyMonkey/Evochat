import express from 'express';
import BillingService from '../services/Paddle/BillingService';
import { CreateCustomerRequestBody } from '@paddle/paddle-node-sdk';

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

export default router;