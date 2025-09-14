import BillingService, { ChooseTierOptions } from '../BillingService';
import AIService from '../AIService';
import { ModelTier } from '@librechat/data-schemas/billing';
// Use the same import path as in BillingService
import Subscription from '../../../../models/Subscription';
import { usageService } from '../usageInitializer';

// Mock dependencies
jest.mock('../AIService');
jest.mock('../../../models/Subscription');
jest.mock('../usageInitializer');

describe('BillingService AI Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('chooseTier with AI mode', () => {
    it('should use AI recommendation when mode is auto and prompt is provided', async () => {
      // Mock subscription
      (Subscription.findOne as jest.Mock).mockResolvedValue({
        planId: 'basic'
      });

      // Mock usage service responses
      (usageService.getRollingWindowUsage as jest.Mock).mockResolvedValue(5);
      (usageService.getWeeklyUsage as jest.Mock).mockResolvedValue(50);
      (usageService.getMonthlySoftCap as jest.Mock).mockResolvedValue(100);
      (usageService.checkCostGuard as jest.Mock).mockResolvedValue({
        allowed: true,
        reason: 'ok'
      });

      // Mock AI service to recommend expensive
      (AIService.selectModelTier as jest.Mock).mockResolvedValue({
        recommendedTier: 'expensive'
      });

      const options: ChooseTierOptions = {
        mode: 'auto',
        prompt: 'Explain quantum physics in detail',
        conversationContext: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      };

      const result = await BillingService.chooseTier('test-user', 'premium' as ModelTier, options);

      // Should have called AI service
      expect(AIService.selectModelTier).toHaveBeenCalledWith(
        'test-user',
        'Explain quantum physics in detail',
        [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ],
        expect.objectContaining({
          cheapRemaining: expect.any(Number),
          expensiveRemaining: expect.any(Number)
        })
      );

      // Should return premium tier (mapped from expensive)
      expect(result.effectiveTier).toBe('premium');
      expect(result.reason).toBe('ai_recommendation');
    });

    it('should fallback to normal logic when AI service fails', async () => {
      // Mock subscription
      (Subscription.findOne as jest.Mock).mockResolvedValue({
        planId: 'basic'
      });

      // Mock usage service responses
      (usageService.getRollingWindowUsage as jest.Mock).mockResolvedValue(5);
      (usageService.getWeeklyUsage as jest.Mock).mockResolvedValue(50);
      (usageService.getMonthlySoftCap as jest.Mock).mockResolvedValue(100);
      (usageService.checkCostGuard as jest.Mock).mockResolvedValue({
        allowed: true,
        reason: 'ok'
      });

      // Mock AI service to fail
      (AIService.selectModelTier as jest.Mock).mockRejectedValue(
        new Error('AI service down')
      );

      const options: ChooseTierOptions = {
        mode: 'auto',
        prompt: 'Test prompt'
      };

      const result = await BillingService.chooseTier('test-user', 'premium' as ModelTier, options);

      // Should have called AI service but then fallen back
      expect(AIService.selectModelTier).toHaveBeenCalled();
      // Should return the originally requested tier (premium) since it's allowed
      expect(result.effectiveTier).toBe('premium');
      expect(result.reason).toBe('ok');
    });

    it('should force premium tier when mode is premium', async () => {
      // Mock subscription
      (Subscription.findOne as jest.Mock).mockResolvedValue({
        planId: 'basic'
      });

      // Mock usage service responses - premium is allowed
      (usageService.getRollingWindowUsage as jest.Mock).mockResolvedValue(5);
      (usageService.getWeeklyUsage as jest.Mock).mockResolvedValue(50);
      (usageService.getMonthlySoftCap as jest.Mock).mockResolvedValue(100);
      (usageService.checkCostGuard as jest.Mock).mockResolvedValue({
        allowed: true,
        reason: 'ok'
      });

      const options: ChooseTierOptions = {
        mode: 'premium'
      };

      const result = await BillingService.chooseTier('test-user', 'economy' as ModelTier, options);

      // Should not call AI service
      expect(AIService.selectModelTier).not.toHaveBeenCalled();
      // Should return premium tier (forced mode)
      expect(result.effectiveTier).toBe('premium');
      expect(result.reason).toBe('forced_premium');
    });

    it('should force standard tier when mode is standard', async () => {
      // Mock subscription
      (Subscription.findOne as jest.Mock).mockResolvedValue({
        planId: 'basic'
      });

      // Mock usage service responses - standard is allowed
      (usageService.getRollingWindowUsage as jest.Mock).mockResolvedValue(5);
      (usageService.getWeeklyUsage as jest.Mock).mockResolvedValue(50);
      (usageService.getMonthlySoftCap as jest.Mock).mockResolvedValue(100);
      (usageService.checkCostGuard as jest.Mock).mockResolvedValue({
        allowed: true,
        reason: 'ok'
      });

      const options: ChooseTierOptions = {
        mode: 'standard'
      };

      const result = await BillingService.chooseTier('test-user', 'premium' as ModelTier, options);

      // Should not call AI service
      expect(AIService.selectModelTier).not.toHaveBeenCalled();
      // Should return standard tier (forced mode)
      expect(result.effectiveTier).toBe('standard');
      expect(result.reason).toBe('forced_standard');
    });

    it('should use normal mode when no mode specified', async () => {
      // Mock subscription
      (Subscription.findOne as jest.Mock).mockResolvedValue({
        planId: 'basic'
      });

      // Mock usage service responses - premium is allowed
      (usageService.getRollingWindowUsage as jest.Mock).mockResolvedValue(5);
      (usageService.getWeeklyUsage as jest.Mock).mockResolvedValue(50);
      (usageService.getMonthlySoftCap as jest.Mock).mockResolvedValue(100);
      (usageService.checkCostGuard as jest.Mock).mockResolvedValue({
        allowed: true,
        reason: 'ok'
      });

      const options: ChooseTierOptions = {
        // No mode specified, defaults to 'standard'
      };

      const result = await BillingService.chooseTier('test-user', 'premium' as ModelTier, options);

      // Should not call AI service
      expect(AIService.selectModelTier).not.toHaveBeenCalled();
      // Should return the requested tier (normal mode)
      expect(result.effectiveTier).toBe('premium');
      expect(result.reason).toBe('ok');
    });
  });

  describe('mapAITierToModelTier', () => {
    it('should map expensive to premium', () => {
      const result = (BillingService as any).mapAITierToModelTier('expensive');
      expect(result).toBe('premium');
    });

    it('should map cheap to standard', () => {
      const result = (BillingService as any).mapAITierToModelTier('cheap');
      expect(result).toBe('standard');
    });
  });
});