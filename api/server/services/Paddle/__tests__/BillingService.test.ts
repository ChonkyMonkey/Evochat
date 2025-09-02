import { AllowanceResult, TierSelectionResult } from '../BillingService';
import billingServiceInstance from '../BillingService';
import { usageService } from '../usageInitializer';
import Subscription, { SubscriptionPlan, SubscriptionStatus } from '../../../../models/Subscription';
import { CostGuardResult } from '../UsageService';

// Mock the Subscription model
jest.mock('../../../../models/Subscription', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
  SubscriptionPlan: {
    FREE: 'free',
    BASIC: 'basic', 
    PRO: 'pro',
    PRO_PLUS: 'pro_plus',
  },
  SubscriptionStatus: {
    ACTIVE: 'active',
  },
}));

// Mock the usageService
jest.mock('../usageInitializer', () => ({
  usageService: {
    getRollingWindowUsage: jest.fn(),
    getWeeklyUsage: jest.fn(),
    getMonthlySoftCap: jest.fn(),
    getMonthlyCogs: jest.fn(),
    checkCostGuard: jest.fn(),
  },
}));

describe('BillingService', () => {
  const mockSubscriptionFindOne = Subscription.findOne as jest.Mock;
  const mockGetRollingWindowUsage = usageService.getRollingWindowUsage as jest.Mock;
  const mockGetWeeklyUsage = usageService.getWeeklyUsage as jest.Mock;
  const mockGetMonthlySoftCap = usageService.getMonthlySoftCap as jest.Mock;
  const mockCheckCostGuard = usageService.checkCostGuard as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks - all usage checks pass by default
    mockGetRollingWindowUsage.mockResolvedValue(0);
    mockGetWeeklyUsage.mockResolvedValue(0);
    mockGetMonthlySoftCap.mockResolvedValue(0);
    mockCheckCostGuard.mockResolvedValue({
      allowed: true,
      reason: 'ok',
      currentCogsEUR: 0,
      budgetEUR: 0,
      percentageUsed: 0,
    } as CostGuardResult);
  });

  describe('isAllowed()', () => {
    describe('Rolling Window Limits', () => {
      it('should allow when below rolling window limit', async () => {
        // Mock basic plan subscription
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        // Mock rolling window usage below limit (5/15 for premium tier)
        mockGetRollingWindowUsage.mockResolvedValue(5);

        const result = await billingServiceInstance.isAllowed('user123', 'premium');

        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('ok');
        expect(mockGetRollingWindowUsage).toHaveBeenCalledWith('user123', 'premium', 10800);
      });

      it('should block when at rolling window limit', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        // Mock rolling window usage at limit (15/15 for premium tier)
        mockGetRollingWindowUsage.mockResolvedValue(15);

        const result = await billingServiceInstance.isAllowed('user123', 'premium');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('window_cap');
        expect(result.resetETA).toBeDefined();
        expect(result.resetETA).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('should block when above rolling window limit', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        // Mock rolling window usage above limit (16/15 for premium tier)
        mockGetRollingWindowUsage.mockResolvedValue(16);

        const result = await billingServiceInstance.isAllowed('user123', 'premium');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('window_cap');
        expect(result.resetETA).toBeDefined();
      });
    });

    describe('Weekly Limits', () => {
      it('should allow when below weekly limit', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        // Mock weekly usage below limit (250/300 for premium tier)
        mockGetWeeklyUsage.mockResolvedValue(250);

        const result = await billingServiceInstance.isAllowed('user123', 'premium');

        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('ok');
      });

      it('should block when at weekly limit', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        // Mock weekly usage at limit (300/300 for premium tier)
        mockGetWeeklyUsage.mockResolvedValue(300);

        const result = await billingServiceInstance.isAllowed('user123', 'premium');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('weekly_cap');
        expect(result.resetETA).toBeDefined();
        expect(result.resetETA).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    describe('Monthly Soft Caps', () => {
      it('should allow when below monthly soft cap', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'free',
          status: 'active',
        });
        
        // Mock monthly usage below cap (250/300 for economy tier)
        mockGetMonthlySoftCap.mockResolvedValue(250);

        const result = await billingServiceInstance.isAllowed('user123', 'economy');

        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('ok');
      });

      it('should block when at monthly soft cap', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'free',
          status: 'active',
        });
        
        // Mock monthly usage at cap (300/300 for economy tier)
        mockGetMonthlySoftCap.mockResolvedValue(300);

        const result = await billingServiceInstance.isAllowed('user123', 'economy');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('soft_cap');
        expect(result.resetETA).toBeDefined();
        expect(result.resetETA).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    describe('Cost Guard', () => {
      it('should allow when below 90% budget', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        mockCheckCostGuard.mockResolvedValue({
          allowed: true,
          reason: 'ok',
          currentCogsEUR: 5,
          budgetEUR: 10,
          percentageUsed: 50,
        } as CostGuardResult);

        const result = await billingServiceInstance.isAllowed('user123', 'premium');

        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('ok');
      });

      it('should allow with warning when between 90-110% budget', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        mockCheckCostGuard.mockResolvedValue({
          allowed: true,
          reason: 'cost_guard_warning',
          currentCogsEUR: 9.5,
          budgetEUR: 10,
          percentageUsed: 95,
        } as CostGuardResult);

        const result = await billingServiceInstance.isAllowed('user123', 'premium');

        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('ok'); // Note: isAllowed only cares about allowed boolean
      });

      it('should block when above 110% budget', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        mockCheckCostGuard.mockResolvedValue({
          allowed: false,
          reason: 'cost_guard_blocked',
          currentCogsEUR: 11.5,
          budgetEUR: 10,
          percentageUsed: 115,
        } as CostGuardResult);

        const result = await billingServiceInstance.isAllowed('user123', 'premium');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('cost_guard');
        expect(result.resetETA).toBeDefined();
      });
    });

    describe('Different Subscription Plans', () => {
      it('should use free plan limits when no subscription', async () => {
        mockSubscriptionFindOne.mockResolvedValue(null); // No subscription
        
        // Mock rolling window usage at free plan limit (10/10 for economy tier)
        mockGetRollingWindowUsage.mockResolvedValue(10);

        const result = await billingServiceInstance.isAllowed('user123', 'economy');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('window_cap');
        expect(mockGetRollingWindowUsage).toHaveBeenCalledWith('user123', 'economy', 18000);
      });

      it('should use basic plan limits', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        // Mock rolling window usage at basic plan limit (15/15 for premium tier)
        mockGetRollingWindowUsage.mockResolvedValue(15);

        const result = await billingServiceInstance.isAllowed('user123', 'premium');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('window_cap');
        expect(mockGetRollingWindowUsage).toHaveBeenCalledWith('user123', 'premium', 10800);
      });

      it('should use pro plan limits', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'pro',
          status: 'active',
        });
        
        // Mock rolling window usage at pro plan limit (160/160 for premium tier)
        mockGetRollingWindowUsage.mockResolvedValue(160);

        const result = await billingServiceInstance.isAllowed('user123', 'premium');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('window_cap');
        expect(mockGetRollingWindowUsage).toHaveBeenCalledWith('user123', 'premium', 10800);
      });

      it('should use pro_plus plan limits', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'pro_plus',
          status: 'active',
        });
        
        // Mock rolling window usage at pro_plus plan limit (60/60 for flagship tier)
        mockGetRollingWindowUsage.mockResolvedValue(60);

        const result = await billingServiceInstance.isAllowed('user123', 'flagship');

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('window_cap');
        expect(mockGetRollingWindowUsage).toHaveBeenCalledWith('user123', 'flagship', 10800);
      });
    });

    it('should handle errors gracefully', async () => {
      mockSubscriptionFindOne.mockRejectedValue(new Error('Database error'));

      const result = await billingServiceInstance.isAllowed('user123', 'economy');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('error');
      expect(result.resetETA).toBeUndefined();
    });
  });

  describe('chooseTier()', () => {
    describe('Successful Tier Selection', () => {
      it('should return requested tier when allowed', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        // Mock isAllowed to return true for premium tier
        jest.spyOn(billingServiceInstance, 'isAllowed').mockResolvedValue({
          allowed: true,
          reason: 'ok',
        } as AllowanceResult);

        const result = await billingServiceInstance.chooseTier('user123', 'premium');

        expect(result.effectiveTier).toBe('premium');
        expect(result.reason).toBe('ok');
      });
    });

    describe('Fallback Scenarios', () => {
      it('should fall back to standard tier when premium is not allowed', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        // Mock isAllowed to return false for premium, true for standard
        jest.spyOn(billingServiceInstance, 'isAllowed')
          .mockResolvedValueOnce({ // First call for premium
            allowed: false,
            reason: 'window_cap',
            resetETA: '2024-01-01T00:00:00.000Z',
          } as AllowanceResult)
          .mockResolvedValueOnce({ // Second call for standard
            allowed: true,
            reason: 'ok',
          } as AllowanceResult);

        const result = await billingServiceInstance.chooseTier('user123', 'premium');

        expect(result.effectiveTier).toBe('standard');
        expect(result.reason).toBe('ok');
      });

      it('should fall back to standard_mini when both premium and standard are not allowed', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        // Mock isAllowed to return false for premium and standard, true for standard_mini
        jest.spyOn(billingServiceInstance, 'isAllowed')
          .mockResolvedValueOnce({ // premium
            allowed: false,
            reason: 'window_cap',
            resetETA: '2024-01-01T00:00:00.000Z',
          })
          .mockResolvedValueOnce({ // standard
            allowed: false,
            reason: 'weekly_cap',
            resetETA: '2024-01-07T23:59:59.999Z',
          })
          .mockResolvedValueOnce({ // standard_mini
            allowed: true,
            reason: 'ok',
          } as AllowanceResult);

        const result = await billingServiceInstance.chooseTier('user123', 'premium');

        expect(result.effectiveTier).toBe('standard_mini');
        expect(result.reason).toBe('ok');
      });

      it('should return mini tier with reason even when not allowed (final fallback)', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'basic',
          status: 'active',
        });
        
        // Mock isAllowed to return false for all tiers in fallback chain
        jest.spyOn(billingServiceInstance, 'isAllowed')
          .mockResolvedValue({ // All calls return false
            allowed: false,
            reason: 'window_cap',
            resetETA: '2024-01-01T00:00:00.000Z',
          } as AllowanceResult);

        const result = await billingServiceInstance.chooseTier('user123', 'premium');

        expect(result.effectiveTier).toBe('standard_mini');
        expect(result.reason).toBe('window_cap');
        expect(result.resetETA).toBe('2024-01-01T00:00:00.000Z');
      });
    });

    describe('Different Subscription Plans', () => {
      it('should use free plan fallback chain', async () => {
        mockSubscriptionFindOne.mockResolvedValue(null); // No subscription -> free plan
        
        // Mock isAllowed to return false for economy, true for economy_mini
        jest.spyOn(billingServiceInstance, 'isAllowed')
          .mockResolvedValueOnce({ // economy
            allowed: false,
            reason: 'window_cap',
          })
          .mockResolvedValueOnce({ // economy_mini
            allowed: true,
            reason: 'ok',
          } as AllowanceResult);

        const result = await billingServiceInstance.chooseTier('user123', 'economy');

        expect(result.effectiveTier).toBe('economy_mini');
        expect(result.reason).toBe('ok');
      });

      it('should use pro_plus plan fallback chain', async () => {
        mockSubscriptionFindOne.mockResolvedValue({
          planId: 'pro_plus',
          status: 'active',
        });
        
        // Mock isAllowed to return false for flagship, premium, standard, true for standard_mini
        jest.spyOn(billingServiceInstance, 'isAllowed')
          .mockResolvedValueOnce({ // flagship
            allowed: false,
            reason: 'window_cap',
          })
          .mockResolvedValueOnce({ // premium
            allowed: false,
            reason: 'weekly_cap',
          })
          .mockResolvedValueOnce({ // standard
            allowed: false,
            reason: 'soft_cap',
          })
          .mockResolvedValueOnce({ // standard_mini
            allowed: true,
            reason: 'ok',
          } as AllowanceResult);

        const result = await billingServiceInstance.chooseTier('user123', 'flagship');

        expect(result.effectiveTier).toBe('standard_mini');
        expect(result.reason).toBe('ok');
      });
    });

    it('should handle errors gracefully', async () => {
      mockSubscriptionFindOne.mockRejectedValue(new Error('Database error'));

      const result = await billingServiceInstance.chooseTier('user123', 'premium');

      expect(result.effectiveTier).toBe('economy_mini');
      expect(result.reason).toBe('error');
      expect(result.resetETA).toBeUndefined();
    });
  });
});