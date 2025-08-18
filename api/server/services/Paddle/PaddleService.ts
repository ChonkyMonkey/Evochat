import { Paddle, CreateCustomerRequestBody, Customer } from '@paddle/paddle-node-sdk';

class PaddleService {
  private paddle: Paddle;

  constructor() {
    if (!process.env.PADDLE_API_KEY) {
      throw new Error('PADDLE_API_KEY environment variable is not set.');
    }
    this.paddle = new Paddle(process.env.PADDLE_API_KEY);
  }

  async createPaddleCustomer(customerData: CreateCustomerRequestBody): Promise<Customer | undefined> {
    try {
      const customer: Customer = await this.paddle.customers.create(customerData);
      return customer;
    } catch (error) {
      console.error('Error creating Paddle customer:', error.message);
      throw new Error('Failed to create Paddle customer.');
    }
  }
}

export default new PaddleService();