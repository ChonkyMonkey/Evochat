// CurrencyService for handling USD to EUR exchange rate conversions
// with Frankfurter API integration, caching, and fallback mechanisms

import logger from '../../../utils/logger';

// Extended RedisLike interface with del method
export interface RedisLike {
  zadd(key: string, score: number, member: string): Promise<number>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
  zcard(key: string): Promise<number>;
  incrby(key: string, by: number): Promise<number>;
  incrbyfloat?(key: string, by: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  expireat(key: string, when: number): Promise<number>;
  del(key: string): Promise<number>;
}

export interface CurrencyServiceOptions {
  namespace?: string;      // optional sub-namespace: defaults to 'currency'
  nowMs?: () => number;    // test hook; default Date.now
  cacheTtl?: number;       // cache TTL in seconds, defaults to 8 hours
}

export default class CurrencyService {
  private redis: RedisLike;
  private ns: string;
  private nowMs: () => number;
  private cacheTtl: number;

  constructor(redis: RedisLike, opts: CurrencyServiceOptions = {}) {
    this.redis = redis;
    this.ns = (opts.namespace ?? 'currency').replace(/:$/, '');
    this.nowMs = opts.nowMs ?? (() => Date.now());
    this.cacheTtl = opts.cacheTtl ?? 28800; // 8 hours
  }

  /** Get current USD to EUR exchange rate using Frankfurter API with Redis caching */
  async getUSDToEURRate(): Promise<number> {
    const cacheKey = `${this.ns}:exchange_rate:usd_eur`;
    const failureKey = `${this.ns}:exchange_rate_failure`;
    
    try {
      // Check Redis cache first
      const cachedRate = await this.redis.get(cacheKey);
      if (cachedRate) {
        const rate = parseFloat(cachedRate);
        if (rate > 0) {
          logger.debug('[CurrencyService] Using cached exchange rate:', rate);
          return rate;
        }
      }

      // Check if we recently had a failure and should use historical data
      const lastFailure = await this.redis.get(failureKey);
      if (lastFailure) {
        const failureTime = parseInt(lastFailure, 10);
        const timeSinceFailure = this.nowMs() - failureTime;
        
        // If failure was less than 1 hour ago, try historical data
        if (timeSinceFailure < 3600000) {
          const historicalRate = await this.tryHistoricalDataFallback();
          if (historicalRate) {
            return historicalRate;
          }
        } else {
          // Clear old failure record
          await this.redis.del(failureKey);
        }
      }
      
      // Fetch from Frankfurter API using node-fetch with AbortController for timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR', {
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        const rate = data?.rates?.EUR;
        
        if (typeof rate === 'number' && rate > 0) {
          // Cache the rate in Redis using EXPIRE for TTL
          await this.redis.set(cacheKey, rate.toString());
          await this.redis.expire(cacheKey, this.cacheTtl);
          logger.debug('[CurrencyService] Fetched and cached exchange rate:', rate);
          return rate;
        }
      }
      
      logger.warn('[CurrencyService] Invalid exchange rate from Frankfurter, trying Exchangerate-API fallback');
      
      // Try fallback to Exchangerate-API if Frankfurter fails
      try {
        const erController = new AbortController();
        const erTimeout = setTimeout(() => erController.abort(), 3000);
        
        const erResponse = await fetch(`https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`, {
          signal: erController.signal
        });
        
        clearTimeout(erTimeout);
        
        if (erResponse.ok) {
          const erData = await erResponse.json();
          const erRate = erData?.conversion_rates?.EUR;
          
          if (erRate && typeof erRate === 'number' && erRate > 0) {
            await this.redis.set(cacheKey, erRate.toString());
            await this.redis.expire(cacheKey, this.cacheTtl);
            return erRate;
          }
        }
      } catch (erError) {
        logger.error('[CurrencyService] Exchangerate-API fallback also failed:', erError);
      }
      
      // Record failure timestamp and try historical data
      await this.redis.set(failureKey, this.nowMs().toString());
      await this.redis.expire(failureKey, 3600); // Keep failure record for 1 hour
      
      const historicalRate = await this.tryHistoricalDataFallback();
      if (historicalRate) {
        return historicalRate;
      }
      
      logger.warn('[CurrencyService] All exchange rate sources failed, using historical average 0.92');
      return 0.92;
      
    } catch (error) {
      logger.error('[CurrencyService] Error in exchange rate fetching:', error);
      
      // Try historical data as last resort
      const historicalRate = await this.tryHistoricalDataFallback();
      if (historicalRate) {
        return historicalRate;
      }
      
      return 0.92; // Final fallback to historical average
    }
  }

  /** Try to get historical exchange rate data from Frankfurter */
  private async tryHistoricalDataFallback(): Promise<number | null> {
    try {
      // Get yesterday's date for historical data
      const yesterday = new Date(this.nowMs() - 86400000); // 24 hours ago
      const dateStr = yesterday.toISOString().split('T')[0];

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`https://api.frankfurter.dev/v1/${dateStr}?base=USD&symbols=EUR`, {
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        const rate = data?.rates?.EUR;
        
        if (typeof rate === 'number' && rate > 0) {
          logger.debug('[CurrencyService] Using historical exchange rate from:', dateStr, rate);
          return rate;
        }
      }
    } catch (error) {
      logger.error('[CurrencyService] Historical data fallback failed:', error);
    }
    
    return null;
  }
}