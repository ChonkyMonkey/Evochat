import UsageService, { CostGuardResult } from '../UsageService';

// Mock Redis client
const mockRedis = {
  zadd: jest.fn(),
  zremrangebyscore: jest.fn(),
  zcard: jest.fn(),
  incrby: jest.fn(),
  incrbyfloat: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  expireat: jest.fn(),
};

// Mock getMultiplier function
jest.mock('../../../models/tx', () => ({
  getMultiplier: jest.fn().mockReturnValue(0.001), // $0.001 per 1M tokens
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('UsageService - Cost Guard', () => {
  let usageService: UsageService;

  beforeEach(() => {
    jest.clearAllMocks();
    usageService = new UsageService(mockRedis as any);
    
    // Mock successful exchange rate response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rates: { EUR: 0.92 } }),
    });
  });

  describe('trackTokenCost', () => {
    it('should calculate and track token costs correctly', async () => {
      mockRedis.incrbyfloat.mockResolvedValue(0.00184); // 2000 tokens * 0.001/1M * 0.92

      const result = await usageService.trackTokenCost('user123', 'gpt-4', 1000, 1000);

      expect(result).toBe(0.00184);
      expect(mockRedis.incrbyfloat).toHaveBeenCalledWith(
        expect.stringContaining('cogs:user123:'),
        0.00184
      );
    });

    it('should handle zero tokens gracefully', async () => {
      const result = await usageService.trackTokenCost('user123', 'gpt-4', 0, 0);
      expect(result).toBe(0);
      expect(mockRedis.incrbyfloat).not.toHaveBeenCalled();
    });
  });

  describe('checkCostGuard', () => {
    it('should allow usage when below 90% of budget', async () => {
      mockRedis.get.mockResolvedValue('9.0'); // €9 spent
      const monthlyBudgetEUR = 10; // €10 budget

      const result: CostGuardResult = await usageService.checkCostGuard('user123', monthlyBudgetEUR);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('ok');
      expect(result.percentageUsed).toBe(90);
    });

    it('should warn when between 90% and 110% of budget', async () => {
      mockRedis.get.mockResolvedValue('9.5'); // €9.5 spent
      const monthlyBudgetEUR = 10; // €10 budget

      const result: CostGuardResult = await usageService.checkCostGuard('user123', monthlyBudgetEUR);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('cost_guard_warning');
      expect(result.percentageUsed).toBe(95);
      expect(result.message).toContain('Warning: You\'ve used 95.0%');
    });

    it('should block when above 110% of budget', async () => {
      mockRedis.get.mockResolvedValue('11.5'); // €11.5 spent
      const monthlyBudgetEUR = 10; // €10 budget

      const result: CostGuardResult = await usageService.checkCostGuard('user123', monthlyBudgetEUR);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('cost_guard_blocked');
      expect(result.percentageUsed).toBe(115);
      expect(result.message).toContain('Monthly budget exceeded by 110%');
    });

    it('should handle zero budget gracefully', async () => {
      mockRedis.get.mockResolvedValue('5.0'); // €5 spent
      const monthlyBudgetEUR = 0; // €0 budget

      const result: CostGuardResult = await usageService.checkCostGuard('user123', monthlyBudgetEUR);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('ok');
      expect(result.percentageUsed).toBe(0);
    });
  });


  describe('calculateTokenCostUSD', () => {
    it('should calculate token cost correctly', () => {
      const cost = usageService['calculateTokenCostUSD']('gpt-4', 'prompt', 1000);
      
      // 1000 tokens * ($0.001 / 1,000,000) = $0.000001
      expect(cost).toBe(0.000001);
    });

    it('should return 0 for zero tokens', () => {
      const cost = usageService['calculateTokenCostUSD']('gpt-4', 'prompt', 0);
      expect(cost).toBe(0);
    });
  });
});