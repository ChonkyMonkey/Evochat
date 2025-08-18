import PaddleService from '../Paddle/PaddleService';
import { CreateCustomerRequestBody, Customer } from '@paddle/paddle-node-sdk';

class BillingService {
  async createCustomer(customerData: CreateCustomerRequestBody): Promise<Customer | undefined> {
    try {
      const customer = await PaddleService.createPaddleCustomer(customerData);
      return customer;
    } catch (error) {
      console.error('Error in BillingService creating customer:', error);
      throw new Error('Failed to create customer via Billing Service.');
    }
  }

  // NOTE: The 'createCheckoutLink' method is being removed as per the revised POC
  // If a checkout link is needed in the future, this method would need to be re-evaluated
  // based on Paddle's current API for generating such links.
}

export default new BillingService();