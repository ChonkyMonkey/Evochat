/* eslint-disable @typescript-eslint/no-var-requires */
import UsageService from "./UsageService";

// Your redisClients.js is CommonJS
const { ioredisClient } = require('../../../cache/redisClients');

if (!ioredisClient) {
  throw new Error('[UsageService] ioredisClient is not initialized. Ensure USE_REDIS=true and REDIS_URI set.');
}

// ioredis already applies the global keyPrefix from env.
// We pass the client methods directly to match the RedisLike surface.
const redisAdapter = {
  zadd: (key: string, score: number, member: string) => ioredisClient.zadd(key, score, member),
  zremrangebyscore: (key: string, min: number | string, max: number | string) =>
    ioredisClient.zremrangebyscore(key, min, max),
  zcard: (key: string) => ioredisClient.zcard(key),
  incrby: (key: string, by: number) => ioredisClient.incrby(key, by),
  incrbyfloat: (key: string, by: number) => ioredisClient.incrbyfloat(key, by),
  get: (key: string) => ioredisClient.get(key),
  ttl: (key: string) => ioredisClient.ttl(key),
  expireat: (key: string, when: number) => ioredisClient.expireat(key, when),
};

export const usageService = new UsageService(redisAdapter, {
  namespace: 'usage', // final keys look like: <globalPrefix>::usage:<userId>:<tier>:...
});

export default usageService;
