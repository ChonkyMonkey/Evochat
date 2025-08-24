import { Paddle, CreateCustomerRequestBody, Customer, Environment } from '@paddle/paddle-node-sdk';
import { env } from 'process';

class PaddleService {
  private paddle: Paddle;
  private environment: Environment;



  constructor() {
    if (!process.env.PADDLE_API_KEY) {
      throw new Error('PADDLE_API_KEY environment variable is not set.');
    }
    if (!process.env.PADDLE_ENVIRONMENT) {
      throw new Error('PADDLE_ENVIRONMENT environment variable is not set.');
    }
    this.environment = process.env.PADDLE_ENVIRONMENT as Environment;
    this.paddle = new Paddle(process.env.PADDLE_API_KEY, { environment: this.environment});
  }

  async createPaddleCustomer(customerData: CreateCustomerRequestBody): Promise<Customer | undefined> {
    try {
      const customer: Customer = await this.paddle.customers.create(customerData);
      return customer;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error creating Paddle customer:', error.message);
      } else {
        console.error('An unknown error occurred while creating Paddle customer:', error);
      }
      throw new Error('Failed to create Paddle customer.');
    }
  }
}

export default new PaddleService();