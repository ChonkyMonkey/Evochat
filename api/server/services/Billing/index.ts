// api/server/services/Billing/index.ts

import PaddleService from '../Paddle/PaddleService';
import { CreateCustomerRequestBody, Customer } from '@paddle/paddle-node-sdk';
import { ModelTier, PlanBase } from '../../../../packages/data-schemas/billing';
export type Plan = PlanBase & { priceId: string };

function optionalEnv(name: string): string {
  const v = process.env[name] || '';
  if (!v) console.warn(`[billing] ${name} not set — plan will be excluded from PRICE_TO_PLAN`);
  return v;
}



/**
 * Per-exchange cost model (USD/EUR assumed ≈ 1 for planning).
 * 1 "exchange" ≈ 2k input + 1k output tokens.
 *
 * Keep this in one place so enforcement & analytics can reference it.
 */
export const COST_PER_EXCHANGE_USD: Record<
  Exclude<ModelTier, 'economy_mini' | 'standard_mini' | 'premium_mini'>,
  number
> = {
  economy: 0.001,
  standard: 0.0025,
  premium: 0.021,
  flagship: 0.105,
};


/**
 * =========================
 * Plan Catalog (Final Spec)
 * =========================
 * Matches the finalized English version with rolling windows,
 * soft caps, and auto-fallback chains.
 */

const FIVE_HOURS = 5 * 60 * 60; // 18,000
const THREE_HOURS = 3 * 60 * 60; // 10,800

export const PLANS: Readonly<Record<Plan['id'], Readonly<Plan>>> = Object.freeze({  free: {
    id: 'free',
    priceId: optionalEnv('PADDLE_FREE_PLAN_PRICE_ID'),
    priceEUR: 0,
    windowLimits: [
      { tier: 'economy', limit: 10, windowSeconds: FIVE_HOURS }, // 10 / 5h
    ],
    monthlySoftCaps: [{ tier: 'economy', cap: 300 }],
    fallbackChain: ['economy_mini'],
    monthlyCogsBudgetEUR: 0,
  },

  basic: {
    id: 'basic',
    priceId: optionalEnv('PADDLE_BASIC_PLAN_PRICE_ID'),
    priceEUR: 12,
    windowLimits: [
      { tier: 'premium', limit: 15, windowSeconds: THREE_HOURS }, // 15 / 3h
      { tier: 'standard', limit: 60, windowSeconds: THREE_HOURS }, // 60 / 3h
    ],
    weeklyLimits: [{ tier: 'premium', limit: 300 }], // ~50% cost share bias
    monthlySoftCaps: [{ tier: 'economy', cap: 2000 }],
    fallbackChain: ['standard', 'standard_mini'],
    monthlyCogsBudgetEUR: 12 * 0.6, // 60% COGS guard
  },

  pro: {
    id: 'pro',
    priceId: optionalEnv('PADDLE_PRO_PLAN_PRICE_ID'),
    priceEUR: 22,
    windowLimits: [
      { tier: 'premium', limit: 160, windowSeconds: THREE_HOURS }, // 160 / 3h
      { tier: 'standard', limit: 120, windowSeconds: THREE_HOURS }, // 120 / 3h
    ],
    weeklyLimits: [{ tier: 'premium', limit: 1000 }],
    monthlySoftCaps: [{ tier: 'economy', cap: 2000 }],
    fallbackChain: ['standard', 'standard_mini'],
    monthlyCogsBudgetEUR: 22 * 0.6,
  },

  pro_plus: {
    id: 'pro_plus',
    priceId: optionalEnv('PADDLE_PRO_PLUS_PLAN_PRICE_ID'),
    priceEUR: 48,
    windowLimits: [
      { tier: 'flagship', limit: 60, windowSeconds: THREE_HOURS }, // 60 / 3h
      { tier: 'premium', limit: 300, windowSeconds: THREE_HOURS }, // 300 / 3h
      { tier: 'standard', limit: 120, windowSeconds: THREE_HOURS }, // 120 / 3h
    ],
    weeklyLimits: [
      { tier: 'flagship', limit: 300 },
      { tier: 'premium', limit: 2000 },
    ],
    monthlySoftCaps: [
      { tier: 'economy', cap: 2000 },
      { tier: 'flagship', cap: 80 }, // hard-ish soft cap for SOTA costs
    ],
    fallbackChain: ['premium', 'standard', 'standard_mini'],
    monthlyCogsBudgetEUR: 48 * 0.6,
  },
});

/**
 * Maps Paddle price IDs to internal plan IDs.
 * Generated from the PLANS object.
 */
export const PRICE_TO_PLAN: Record<string, Plan['id']> =
  Object.values(PLANS).reduce<Record<string, Plan['id']>>((acc, plan) => {
    if (plan.priceId) acc[plan.priceId] = plan.id;
    return acc;
  }, {});

/**
 * =========================
 * Billing Service
 * =========================
 * - Exposes plan catalog
 * - Provisions Paddle customers (server-side)
 */
class BillingService {
  private plans: Readonly<typeof PLANS>;

  constructor() {
    this.plans = PLANS;
  }

  /** Returns the full plan catalog keyed by id */
  getPlans(): Readonly<typeof PLANS> {
    return this.plans;
  }

  /** Helper to fetch a single plan (throws if missing) */
  getPlanById(id: Plan['id']): Readonly<Plan> {
    const plan = this.plans[id];
    if (!plan) {
      throw new Error(`Plan not found: ${id}`);
    }
    return plan;
  }

  /**
   * Server-side creation of a Paddle Customer.
   * Keep this minimal; subscription lifecycle is handled via webhooks.
   */
  async createCustomer(
    customerData: CreateCustomerRequestBody,
  ): Promise<Customer> {
    try {
      const customer = await PaddleService.createPaddleCustomer(customerData);
      if (!customer) {
        throw new Error('Failed to create customer: PaddleService returned undefined.');
      }
      return customer;
    } catch (error) {
      console.error('Error in BillingService creating customer:', error);
      throw new Error('Failed to create customer via Billing Service.');
    }
  }
}

export default new BillingService();
