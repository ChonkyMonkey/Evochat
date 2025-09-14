import { AIService } from '../AIService';

// Simple mock for testing
jest.mock('../../services/Endpoints', () => ({
  getProviderConfig: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  default: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default models', () => {
      expect(aiService).toBeInstanceOf(AIService);
    });
  });

  describe('parseModelList', () => {
    it('should parse comma-separated string', () => {
      const result = (aiService as any).parseModelList('model1,model2,model3', ['default']);
      expect(result).toEqual(['model1', 'model2', 'model3']);
    });

    it('should return default models when env value is empty', () => {
      const result = (aiService as any).parseModelList(undefined, ['default1', 'default2']);
      expect(result).toEqual(['default1', 'default2']);
    });
  });

  describe('buildSystemPrompt', () => {
    it('should include usage limits when provided', () => {
      const usageInfo = {
        primitiveRemaining: 5,
        normalRemaining: 10,
        smartRemaining: 2
      };

      const prompt = (aiService as any).buildSystemPrompt(usageInfo);
      
      expect(prompt).toContain('USER USAGE LIMITS:');
      expect(prompt).toContain('Primitive requests remaining: 5');
    });

    it('should not include usage limits when not provided', () => {
      const prompt = (aiService as any).buildSystemPrompt();
      expect(prompt).not.toContain('USER USAGE LIMITS:');
    });
  });

  describe('buildUserPrompt', () => {
    it('should include conversation history when provided', () => {
      const conversationHistory = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ];

      const prompt = (aiService as any).buildUserPrompt('Current question', conversationHistory);
      
      expect(prompt).toContain('CONVERSATION HISTORY:');
      expect(prompt).toContain('USER 1: "Hello"');
    });

    it('should not include conversation history when empty', () => {
      const prompt = (aiService as any).buildUserPrompt('Current question', []);
      expect(prompt).not.toContain('CONVERSATION HISTORY:');
    });
  });
});