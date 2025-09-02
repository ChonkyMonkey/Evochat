
import PaddleService from './PaddleService';
import { CreateCustomerRequestBody, Customer } from '@paddle/paddle-node-sdk';
import { ModelTier, PlanBase } from '@librechat/data-schemas/billing';
import Subscription, { SubscriptionPlan, SubscriptionStatus } from '../../../models/Subscription';
import { usageService } from './usageInitializer';
import { CostGuardResult } from './UsageService';
export type Plan = PlanBase & { priceId: string };

export interface AllowanceResult {
  allowed: boolean;
  reason: string;
  resetETA?: string;
}

export interface TierSelectionResult {
  effectiveTier: ModelTier;
  reason: string;
  resetETA?: string;
}

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

  /**
   * Check if a user is allowed to use a specific model tier
   * @param userId User ID to check
   * @param tier Model tier to check
   * @returns Allowance result with reason and optional reset time
   */
  async isAllowed(userId: string, tier: ModelTier): Promise<AllowanceResult> {
    try {
      // Get user's subscription or fall back to free plan
      const subscription = await Subscription.findOne({ userId }).lean();
      const planId = subscription?.planId || 'free';
      const plan = this.getPlanById(planId);

      // Check rolling window limits
      for (const windowLimit of plan.windowLimits || []) {
        if (windowLimit.tier === tier) {
          const currentUsage = await usageService.getRollingWindowUsage(
            userId,
            tier,
            windowLimit.windowSeconds
          );
          
          if (currentUsage >= windowLimit.limit) {
            // Calculate reset time (current time + remaining window seconds)
            const now = Date.now();
            const resetTime = new Date(now + windowLimit.windowSeconds * 1000).toISOString();
            return {
              allowed: false,
              reason: 'window_cap',
              resetETA: resetTime
            };
          }
        }
      }

      // Check weekly limits
      for (const weeklyLimit of plan.weeklyLimits || []) {
        if (weeklyLimit.tier === tier) {
          const currentUsage = await usageService.getWeeklyUsage(userId, tier);
          
          if (currentUsage >= weeklyLimit.limit) {
            // Weekly limits reset at end of current week
            const now = Date.now();
            const { weekEndTs } = this.getWeekEndInfo(now);
            return {
              allowed: false,
              reason: 'weekly_cap',
              resetETA: new Date(weekEndTs).toISOString()
            };
          }
        }
      }

      // Check monthly soft caps
      for (const softCap of plan.monthlySoftCaps || []) {
        if (softCap.tier === tier) {
          const currentUsage = await usageService.getMonthlySoftCap(userId, tier);
          
          if (currentUsage >= softCap.cap) {
            // Monthly soft caps reset at end of current month
            const now = Date.now();
            const monthEnd = this.getMonthEnd(now);
            return {
              allowed: false,
              reason: 'soft_cap',
              resetETA: monthEnd.toISOString()
            };
          }
        }
      }

      // Check cost guard
      const costGuardResult = await usageService.checkCostGuard(userId, plan.monthlyCogsBudgetEUR, tier);
      if (!costGuardResult.allowed) {
        return {
          allowed: false,
          reason: 'cost_guard',
          resetETA: this.getMonthEnd(Date.now()).toISOString()
        };
      }

      // All checks passed
      return {
        allowed: true,
        reason: 'ok'
      };

    } catch (error) {
      console.error('Error in BillingService.isAllowed:', error);
      // On error, default to not allowed with unknown reason
      return {
        allowed: false,
        reason: 'error'
      };
    }
  }

  /**
   * Choose the best available tier for a user based on their plan and usage
   * @param userId User ID
   * @param requestedTier The tier the user requested
   * @returns The effective tier to use with reason and optional reset time
   */
  async chooseTier(userId: string, requestedTier: ModelTier): Promise<TierSelectionResult> {
    try {
      // Get user's subscription or fall back to free plan
      const subscription = await Subscription.findOne({ userId }).lean();
      const planId = subscription?.planId || 'free';
      const plan = this.getPlanById(planId);

      // Start with requested tier and walk through fallback chain
      const tiersToTry = [requestedTier, ...plan.fallbackChain];

      for (const tier of tiersToTry) {
        const allowance = await this.isAllowed(userId, tier);
        
        if (allowance.allowed) {
          return {
            effectiveTier: tier,
            reason: 'ok',
            resetETA: allowance.resetETA
          };
        }

        // If this tier is not allowed but it's the last one in the chain (mini tier),
        // return it anyway as the final fallback
        if (tier === tiersToTry[tiersToTry.length - 1]) {
          return {
            effectiveTier: tier,
            reason: allowance.reason,
            resetETA: allowance.resetETA
          };
        }
      }

      // Should never reach here, but return the last tier as fallback
      const lastTier = tiersToTry[tiersToTry.length - 1];
      return {
        effectiveTier: lastTier,
        reason: 'fallback',
        resetETA: undefined
      };

    } catch (error) {
      console.error('Error in BillingService.chooseTier:', error);
      // On error, fall back to economy_mini
      return {
        effectiveTier: 'economy_mini',
        reason: 'error',
        resetETA: undefined
      };
    }
  }

  // Helper methods for time calculations
  private getWeekEndInfo(nowMs: number): { weekEndTs: number } {
    const d = new Date(nowMs);
    const dow = d.getUTCDay() || 7; // Mon=1..Sun=7
    const thurs = new Date(d);
    thurs.setUTCDate(d.getUTCDate() + (4 - dow));
    const isoYear = thurs.getUTCFullYear();

    const jan1 = new Date(Date.UTC(isoYear, 0, 1));
    const jan1Dow = jan1.getUTCDay() || 7;
    const week1Mon = new Date(jan1);
    week1Mon.setUTCDate(jan1.getUTCDate() + (1 - jan1Dow));

    const diffMs = d.getTime() - week1Mon.getTime();
    const isoWeek = Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1;

    const weekEndMonAfter = new Date(week1Mon);
    weekEndMonAfter.setUTCDate(week1Mon.getUTCDate() + isoWeek * 7);
    const weekEndTs = weekEndMonAfter.getTime() - 1;
    return { weekEndTs };
  }

  private getMonthEnd(nowMs: number): Date {
    const d = new Date(nowMs);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const next = new Date(Date.UTC(y, m + 1, 1));
    return new Date(next.getTime() - 1);
  }
}

export default new BillingService();
