// Step 4: Redis counters for rolling windows, weekly/monthly caps, monthly COGS.
// Uses your existing ioredis client via a minimal RedisLike interface.
// All time math is UTC. ISO week (Mon..Sun). Keys are *not* globally prefixed
// because your ioredis client already applies keyPrefix from env.

import { randomUUID } from 'crypto';

export type ModelTier =
  | 'economy'
  | 'standard'
  | 'premium'
  | 'flagship'
  | 'economy_mini'
  | 'standard_mini'
  | 'premium_mini';

// Minimal surface compatible with ioredis
export interface RedisLike {
  zadd(key: string, score: number, member: string): Promise<number>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
  zcard(key: string): Promise<number>;
  incrby(key: string, by: number): Promise<number>;
  incrbyfloat?(key: string, by: number): Promise<number>;
  get(key: string): Promise<string | null>;
  ttl(key: string): Promise<number>;
  expireat(key: string, when: number): Promise<number>;
}

export interface UsageServiceOptions {
  namespace?: string;      // optional sub-namespace: defaults to 'usage'
  nowMs?: () => number;    // test hook; default Date.now
}

export default class UsageService {
  private redis: RedisLike;
  private ns: string;
  private nowMs: () => number;

  constructor(redis: RedisLike, opts: UsageServiceOptions = {}) {
    this.redis = redis;
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
