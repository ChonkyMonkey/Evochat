export type ModelTier =
  | 'economy' | 'standard' | 'premium' | 'flagship'
  | 'economy_mini' | 'standard_mini' | 'premium_mini';

export interface WindowLimit { tier: ModelTier; limit: number; windowSeconds: number; }
export interface WeeklyLimit { tier: ModelTier; limit: number; }
export interface MonthlySoftCap { tier: ModelTier; cap: number; }

export interface PlanBase {
  id: 'free' | 'basic' | 'pro' | 'pro_plus';
  priceEUR: number;
  windowLimits: WindowLimit[];
  weeklyLimits?: WeeklyLimit[];
  monthlySoftCaps?: MonthlySoftCap[];
  fallbackChain: ModelTier[];
  monthlyCogsBudgetEUR: number;
}