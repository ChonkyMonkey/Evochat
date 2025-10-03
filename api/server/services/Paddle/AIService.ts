import logger from '../../../utils/logger';
import { EModelEndpoint } from 'librechat-data-provider';
import { getProviderConfig } from '../../services/Endpoints';
import { Request } from 'express';

export interface AIModelSelectionResult {
  recommendedTier: 'primitive' | 'normal' | 'smart';
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UsageInfo {
  primitiveRemaining: number;
  normalRemaining: number;
  smartRemaining: number;
}

export class AIService {
  private decisionModel: string;
  private primitiveModels: string[];
  private normalModels: string[];
  private smartModels: string[];

  constructor() {
    this.decisionModel = process.env.AI_DECISION_MODEL || 'gpt-5-nano-2025-08-07';
    this.primitiveModels = this.parseModelList(process.env.PRIMITIVE_MODELS, ['gpt-5-nano-2025-08-07', 'gemini-2.5-flash-lite']);
    this.normalModels = this.parseModelList(process.env.NORMAL_MODELS, ['gpt-5-mini-2025-08-07', 'gemini-2.5-flash']);
    this.smartModels = this.parseModelList(process.env.SMART_MODELS, ['gpt-5-2025-08-07', 'claude-sonnet-4-20250514']);
  }

  /**
   * Parse comma-separated model list from environment variable
   */
  private parseModelList(envValue: string | undefined, defaultModels: string[]): string[] {
    if (!envValue) {
      return defaultModels;
    }
    try {
      // Try to parse as JSON array first
      const parsed = JSON.parse(envValue);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // If JSON parsing fails, try comma-separated list
      return envValue.split(',').map(model => model.trim()).filter(model => model.length > 0);
    }
    return defaultModels;
  }

  /**
   * Initialize AI client using LibreChat's endpoint system
   */
  private async initializeAIClient(req: Request, model: string): Promise<any> {
    try {
      const { getOptions } = await getProviderConfig(EModelEndpoint.openAI);
      const clientOptions = await getOptions({
        req,
        endpointOption: { modelOptions: { model } },
        optionsOnly: false
      });
      
      return clientOptions.client;
    } catch (error) {
      logger.error('[AIService] Error initializing AI client:', error);
      throw new Error('Failed to initialize AI client');
    }
  }

  /**
   * Select model tier using AI model for three-tier choice
   * @param userId User ID for caching and logging
   * @param currentPrompt Current user prompt content
   * @param conversationHistory Recent conversation history
   * @param usageInfo User's remaining usage quotas
   * @returns Recommended tier with reasoning
   */
  async selectModelTier(
    userId: string,
    currentPrompt: string,
    conversationHistory: ConversationMessage[] = [],
    usageInfo?: UsageInfo,
    req?: Request,
    conversationId?: string
  ): Promise<AIModelSelectionResult> {
    try {

      // Prepare prompt for AI model
      const systemPrompt = this.buildSystemPrompt(usageInfo);
      const userPrompt = this.buildUserPrompt(currentPrompt, conversationHistory);

      // Initialize client and call through LibreChat's system
      if (!req) {
        throw new Error('Request object required for AI client initialization');
      }

      const client = await this.initializeAIClient(req, this.decisionModel);
      
      // Use LibreChat's client system instead of direct API calls
      const response = await client.sendMessage(userPrompt, {
        user: userId,
        conversationId: `ai-tier-selection-${userId}-${Date.now()}`,  // AI HALLUCINATIONS!! DANGEROUS!! NEED TO FIX LATER!!
        modelOptions: { model: this.decisionModel },
        promptPrefix: systemPrompt,
        temperature: 0.1,
        max_tokens: 1,
        response_format: 'text'
      });

      // Extract the response text from LibreChat's response format
      let output: string;
      if (typeof response === 'string') {
        output = response;
      } else if (response?.text) {
        output = response.text;
      } else {
        throw new Error(`Invalid response format from ${this.decisionModel}`);
      }

      output = output.trim().toLowerCase();

      // Validate and parse output
      let recommendedTier: 'primitive' | 'normal' | 'smart';
      if (output === 'p') {
        recommendedTier = 'primitive';
      } else if (output === 'n') {
        recommendedTier = 'normal';
      } else if (output === 's') {
        recommendedTier = 'smart';
      } else {
        logger.warn(`[AIService] Invalid output from ${this.decisionModel}: "${output}", falling back to normal`);
        recommendedTier = 'normal';
      }

      const result: AIModelSelectionResult = {
        recommendedTier
      };

      logger.debug(`[AIService] User ${userId}: Recommended ${recommendedTier} for prompt`);
      return result;

    } catch (error) {
      logger.error(`[AIService] Error selecting model tier for user ${userId}:`, error);
      
      // Fallback logic: use normal tier if AI service is unavailable
      // Consider usage limits in fallback
      if (usageInfo) {
        // Try smart first, then normal, then primitive
        const fallbackTier = usageInfo.smartRemaining > 0 ? 'smart' :
                            usageInfo.normalRemaining > 0 ? 'normal' : 'primitive';
        return {
          recommendedTier: fallbackTier
        };
      }

      return {
        recommendedTier: 'normal'
      };
    }
  }

  /**
   * Build system prompt for AI model with strict output constraints
   */
  private buildSystemPrompt(usageInfo?: UsageInfo): string {
    let prompt = `You are a model tier selection assistant. Analyze the user's prompt and conversation context to determine the appropriate intelligence level: PRIMITIVE ("p"), NORMAL ("n"), or SMART ("s").

STRICT OUTPUT RULES:
- Output ONLY a single character: "p" for primitive, "n" for normal, or "s" for smart
- No explanations, no additional text, just one character
- Consider prompt complexity, technical depth, and user needs
- BE CONSERVATIVE when usage limits are low - prioritize lower tiers

INTELLIGENCE LEVELS:
- PRIMITIVE ("p"): Basic models suitable for simple tasks and conversations
- NORMAL ("n"): Capable models for most everyday use cases and standard problem solving
- SMART ("s"): Advanced models for complex reasoning and specialized tasks

PRIMITIVE TIER (output "p") is recommended for:
- Very simple questions and casual conversation
- Basic factual lookups and definitions
- Low-complexity interactions and greetings

NORMAL TIER (output "n") is recommended for:
- Most everyday questions and conversations
- Standard problem solving and explanations
- General assistance and information retrieval
- The majority of user requests (default choice)

SMART TIER (output "s") is recommended ONLY for:
- Complex technical questions requiring deep expertise
- Advanced creative writing, analysis, and synthesis
- Professional or academic content requiring high quality
- Situations where normal tier models have previously failed
- Tasks demanding maximum intellectual capability
- When sufficient smart usage is available and truly justified`;

    if (usageInfo) {
      prompt += `\n\nUSER USAGE LIMITS:
- Primitive requests remaining: ${usageInfo.primitiveRemaining}
- Normal requests remaining: ${usageInfo.normalRemaining}
- Smart requests remaining: ${usageInfo.smartRemaining}

Consider usage limits when making recommendations. Be more conservative when smart requests are low.`;
    }

    return prompt;
  }

  /**
   * Build user prompt with current context
   */
  private buildUserPrompt(currentPrompt: string, conversationHistory: ConversationMessage[]): string {
    let prompt = `CURRENT PROMPT: "${currentPrompt}"`;

    if (conversationHistory.length > 0) {
      prompt += '\n\nCONVERSATION HISTORY:\n';
      conversationHistory.forEach((msg, index) => {
        const prefix = msg.role === 'user' ? 'USER' : 'ASSISTANT';
        prompt += `${prefix} ${index + 1}: "${msg.content}"\n`;
      });
    }

    prompt += '\n\nOUTPUT (single character only):';
    return prompt;
  }
}

// Export singleton instance
export default new AIService();
