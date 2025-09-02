// Step 4: Redis counters for rolling windows, weekly/monthly caps, monthly COGS.
// Uses your existing ioredis client via a minimal RedisLike interface.
// All time math is UTC. ISO week (Mon..Sun). Keys are *not* globally prefixed
// because your ioredis client already applies keyPrefix from env.

import { randomUUID } from 'crypto';
import logger from '../../../utils/logger';
import CurrencyService, { RedisLike } from './CurrencyService';

import { getMultiplier } from '../../../models/tx';

export type ModelTier =
  | 'economy'
  | 'standard'
  | 'premium'
  | 'flagship'
  | 'economy_mini'
  | 'standard_mini'
  | 'premium_mini';


export interface UsageServiceOptions {
  namespace?: string;      // optional sub-namespace: defaults to 'usage'
  nowMs?: () => number;    // test hook; default Date.now
  exchangeRateApiUrl?: string; // exchange rate API URL; defaults to ECB
}

export interface CostGuardResult {
  allowed: boolean;
  reason?: 'ok' | 'cost_guard_warning' | 'cost_guard_blocked';
  message?: string;
  currentCogsEUR: number;
  budgetEUR: number;
  percentageUsed: number;
}

export default class UsageService {
  private redis: RedisLike;
  private currencyService: CurrencyService;
  private ns: string;
  private nowMs: () => number;

  constructor(redis: RedisLike, opts: UsageServiceOptions = {}) {
    this.redis = redis;
    this.currencyService = new CurrencyService(redis, {
      namespace: opts.namespace ? `${opts.namespace}:currency` : 'currency',
      nowMs: opts.nowMs,
    });
    this.ns = (opts.namespace ?? 'usage').replace(/:$/,'');
    this.nowMs = opts.nowMs ?? (() => Date.now());
  }

  // ---------- Public API ----------

  /** Adds a timestamped event to rolling ZSET (score = epoch ms). */
  async trackUsage(userId: string, tier: ModelTier, timestamp?: number): Promise<void> {
    const ts = (timestamp ?? this.nowMs()) | 0;
    const member = `${ts}:${randomUUID()}`;
    await this.redis.zadd(this.kRolling(userId, tier), ts, member);
  }

  /** Trims old items and returns current count in the rolling window. */
  async getRollingWindowUsage(userId: string, tier: ModelTier, windowSeconds: number, now?: number): Promise<number> {
    const nowMs = now ?? this.nowMs();
    const windowStart = nowMs - windowSeconds * 1000;
    const key = this.kRolling(userId, tier);
    await this.redis.zremrangebyscore(key, 0, windowStart);
    return this.redis.zcard(key);
  }

  /** Weekly caps: increments counter and ensures TTL set to week end. */
  async incrementWeeklyUsage(userId: string, tier: ModelTier, incrementBy: number = 1, now?: number): Promise<number> {
    const { weekKey, expireAtSec } = this.weekKey(now ?? this.nowMs(), userId, tier);
    const val = await this.redis.incrby(weekKey, incrementBy);
    await this.ensureExpireAt(weekKey, expireAtSec);
    return val;
  }

  /** Weekly caps: get current count. */
  async getWeeklyUsage(userId: string, tier: ModelTier, now?: number): Promise<number> {
    const { weekKey } = this.weekKey(now ?? this.nowMs(), userId, tier);
    const v = await this.redis.get(weekKey);
    return v ? parseInt(v, 10) || 0 : 0;
  }

  /** Monthly soft caps: increments counter and ensures TTL set to month end. */
  async incrementMonthlySoftCap(userId: string, tier: ModelTier, incrementBy: number = 1, now?: number): Promise<number> {
    const { monthKey, expireAtSec } = this.monthKey(now ?? this.nowMs(), userId, tier);
    const val = await this.redis.incrby(monthKey, incrementBy);
    await this.ensureExpireAt(monthKey, expireAtSec);
    return val;
  }

  /** Monthly soft caps: get current count. */
  async getMonthlySoftCap(userId: string, tier: ModelTier, now?: number): Promise<number> {
    const { monthKey } = this.monthKey(now ?? this.nowMs(), userId, tier);
    const v = await this.redis.get(monthKey);
    return v ? parseInt(v, 10) || 0 : 0;
  }

  /** Monthly COGS: increments float (or cents fallback) with TTL to month end. */
  async incrementMonthlyCogs(userId: string, cost: number, now?: number): Promise<number> {
    const { cogsKey, centsKey, expireAtSec } = this.cogsKey(now ?? this.nowMs(), userId);
    let newVal: number;

    if (typeof this.redis.incrbyfloat === 'function') {
      newVal = (await this.redis.incrbyfloat!(cogsKey, cost)) as unknown as number;
      await this.ensureExpireAt(cogsKey, expireAtSec);
    } else {
      const cents = Math.round(cost * 100);
      const centsVal = await this.redis.incrby(centsKey, cents);
      await this.ensureExpireAt(centsKey, expireAtSec);
      newVal = centsVal / 100;
    }
    return newVal;
  }

  /** Track token usage cost and add to monthly COGS in EUR */
  async trackTokenCost(userId: string, model: string, promptTokens: number, completionTokens: number, endpoint?: string): Promise<number> {
    // Calculate USD cost using existing pricing system
    const promptCostUSD = this.calculateTokenCostUSD(model, 'prompt', promptTokens, endpoint);
    const completionCostUSD = this.calculateTokenCostUSD(model, 'completion', completionTokens, endpoint);
    const totalCostUSD = promptCostUSD + completionCostUSD;

    // Convert USD to EUR using current exchange rate
    const exchangeRate = await this.currencyService.getUSDToEURRate();
    const totalCostEUR = totalCostUSD * exchangeRate;

    // Add to monthly COGS tracking
    return this.incrementMonthlyCogs(userId, totalCostEUR);
  }

  /** Calculate token cost in USD using existing pricing system */
  private calculateTokenCostUSD(model: string, tokenType: 'prompt' | 'completion', tokenCount: number, endpoint?: string): number {
    if (tokenCount <= 0) return 0;

    const multiplier = getMultiplier({ model, tokenType, endpoint });
    // Multiplier is USD per 1M tokens, so calculate cost for actual token count
    const costPerToken = multiplier / 1000000;
    return tokenCount * costPerToken;
  }


  /** Check cost guard thresholds and return decision */
  async checkCostGuard(userId: string, monthlyBudgetEUR: number, requestedTier?: ModelTier): Promise<CostGuardResult> {
    const currentCogsEUR = await this.getMonthlyCogs(userId);
    const percentageUsed = monthlyBudgetEUR > 0 ? (currentCogsEUR / monthlyBudgetEUR) * 100 : 0;

    if (percentageUsed >= 110) {
      return {
        allowed: false,
        reason: 'cost_guard_blocked',
        message: 'Monthly budget exceeded by 110%. Please upgrade your plan to continue using premium models.',
        currentCogsEUR,
        budgetEUR: monthlyBudgetEUR,
        percentageUsed
      };
    }

    if (percentageUsed >= 90) {
      return {
        allowed: true,
        reason: 'cost_guard_warning',
        message: `Warning: You've used ${percentageUsed.toFixed(1)}% of your monthly budget. Consider upgrading to avoid service interruptions.`,
        currentCogsEUR,
        budgetEUR: monthlyBudgetEUR,
        percentageUsed
      };
    }

    return {
      allowed: true,
      reason: 'ok',
      currentCogsEUR,
      budgetEUR: monthlyBudgetEUR,
      percentageUsed
    };
  }

  /** Monthly COGS: get current value. */
  async getMonthlyCogs(userId: string, now?: number): Promise<number> {
    const { cogsKey, centsKey } = this.cogsKey(now ?? this.nowMs(), userId);
    const v = await this.redis.get(cogsKey);
    if (v != null) {
      const f = parseFloat(v);
      return Number.isFinite(f) ? f : 0;
    }
    const cents = await this.redis.get(centsKey);
    return cents ? (parseInt(cents, 10) || 0) / 100 : 0;
  }

  // ---------- Internals ----------

  private kRolling(userId: string, tier: string) {
    return `${this.ns}:${userId}:${tier}:z`;
  }

  private weekKey(nowMs: number, userId: string, tier: string) {
    const { isoYear, isoWeek, weekEndTs } = isoWeekInfo(new Date(nowMs));
    const weekKey = `${this.ns}:${userId}:${tier}:week:${isoYear}-${pad2(isoWeek)}`;
    return { weekKey, expireAtSec: Math.floor(weekEndTs / 1000) };
  }

  private monthKey(nowMs: number, userId: string, tier: string) {
    const d = new Date(nowMs);
    const yyyy = d.getUTCFullYear();
    const mm = pad2(d.getUTCMonth() + 1);
    const monthKey = `${this.ns}:${userId}:${tier}:month:${yyyy}-${mm}`;
    const monthEnd = endOfMonthUtc(d).getTime();
    return { monthKey, expireAtSec: Math.floor(monthEnd / 1000) };
  }

  private cogsKey(nowMs: number, userId: string) {
    const d = new Date(nowMs);
    const yyyy = d.getUTCFullYear();
    const mm = pad2(d.getUTCMonth() + 1);
    const base = `cogs:${userId}:${yyyy}-${mm}`;
    return { cogsKey: base, centsKey: `${base}:cents`, expireAtSec: Math.floor(endOfMonthUtc(d).getTime() / 1000) };
  }

  private get options(): UsageServiceOptions {
    return this as any;
  }

  private async ensureExpireAt(key: string, expireAtSec: number) {
    const ttl = await this.redis.ttl(key);
    if (ttl === -1) {
      await this.redis.expireat(key, expireAtSec);
    }
  }
}

// ---- time utils (UTC / ISO week) ----

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function endOfMonthUtc(d: Date) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const next = new Date(Date.UTC(y, m + 1, 1));
  return new Date(next.getTime() - 1);
}

/** ISO week: Monday start; returns week end Sunday 23:59:59.999 UTC */
function isoWeekInfo(d: Date) {
  const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = base.getUTCDay() || 7; // Mon=1..Sun=7
  const thurs = new Date(base);
  thurs.setUTCDate(base.getUTCDate() + (4 - dow));
  const isoYear = thurs.getUTCFullYear();

  const jan1 = new Date(Date.UTC(isoYear, 0, 1));
  const jan1Dow = jan1.getUTCDay() || 7;
  const week1Mon = new Date(jan1);
  week1Mon.setUTCDate(jan1.getUTCDate() + (1 - jan1Dow));

  const diffMs = base.getTime() - week1Mon.getTime();
  const isoWeek = Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1;

  const weekEndMonAfter = new Date(week1Mon);
  weekEndMonAfter.setUTCDate(week1Mon.getUTCDate() + isoWeek * 7); // Monday after this week
  const weekEndTs = weekEndMonAfter.getTime() - 1; // Sunday 23:59:59.999
  return { isoYear, isoWeek, weekEndTs };
}
