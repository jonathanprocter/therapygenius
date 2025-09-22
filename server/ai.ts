import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { storage } from "./storage";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// The newest Anthropic model is "claude-sonnet-4-20250514"

interface AIProviderConfig {
  enabled: boolean;
  priority: number;
  timeoutMs: number;
  maxRetries: number;
}

interface AIRouterConfig {
  openai: AIProviderConfig;
  anthropic: AIProviderConfig;
  defaultTimeout: number;
  retryDelay: number;
  circuitBreakerFailureThreshold: number;
  circuitBreakerCooldownMs: number;
  hipaaCompliant: boolean;
}

// Zod schemas for validation
const SummarizeResponseSchema = z.object({
  summary: z.string().min(1, "Summary cannot be empty")
});

const TagsResponseSchema = z.object({
  tags: z.array(z.string().min(1)).max(20, "Too many tags")
});

type SummarizeResponse = z.infer<typeof SummarizeResponseSchema>;
type TagsResponse = z.infer<typeof TagsResponseSchema>;

// HIPAA Compliance Error
class HIPAAComplianceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HIPAAComplianceError';
  }
}

interface AIMetrics {
  requests: number;
  successes: number;
  failures: number;
  timeouts: number;
  rateLimitHits: number;
  lastError?: string;
  lastErrorCause?: AIError;
  lastSuccess?: string;
  averageLatency: number;
  cooldownUntil?: Date;
  consecutiveFailures: number;
  failureRate: number;
}

interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

enum AIProvider {
  OPENAI = "openai",
  ANTHROPIC = "anthropic"
}

enum AIError {
  TIMEOUT = "timeout",
  RATE_LIMIT = "rate_limit",
  SERVER_ERROR = "server_error",
  VALIDATION_ERROR = "validation_error",
  HIPAA_COMPLIANCE = "hipaa_compliance",
  CIRCUIT_BREAKER = "circuit_breaker",
  UNKNOWN = "unknown"
}

class AIRouter {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private config: AIRouterConfig;
  private metrics: Map<AIProvider, AIMetrics> = new Map();
  // REMOVED: In-memory audit logging replaced with persistent database storage

  constructor(config?: Partial<AIRouterConfig>) {
    // CRITICAL: HIPAA Compliance Gate - Check environment variable
    const hipaaCompliant = process.env.HIPAA_SAFE_AI === 'true';
    
    this.config = {
      openai: { enabled: true, priority: 1, timeoutMs: 30000, maxRetries: 2 },
      anthropic: { enabled: true, priority: 2, timeoutMs: 30000, maxRetries: 2 },
      defaultTimeout: 30000,
      retryDelay: 1000,
      circuitBreakerFailureThreshold: 3,
      circuitBreakerCooldownMs: 60000, // 1 minute cooldown
      hipaaCompliant,
      ...config
    };

    // Log HIPAA compliance status
    console.log(`[AI Router] HIPAA Compliance Mode: ${this.config.hipaaCompliant ? 'ENABLED' : 'DISABLED'}`);
    if (!this.config.hipaaCompliant) {
      console.warn('[AI Router] ⚠️  WARNING: External AI providers are DISABLED due to HIPAA compliance. Set HIPAA_SAFE_AI=true to enable.');
    }

    // Only initialize AI clients if HIPAA compliance allows
    if (this.config.hipaaCompliant) {
      this.openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY,
        timeout: this.config.openai.timeoutMs 
      });
      
      this.anthropic = new Anthropic({ 
        apiKey: process.env.ANTHROPIC_API_KEY,
        timeout: this.config.anthropic.timeoutMs
      });
    }

    // Initialize metrics
    this.metrics.set(AIProvider.OPENAI, this.createEmptyMetrics());
    this.metrics.set(AIProvider.ANTHROPIC, this.createEmptyMetrics());
  }

  private createEmptyMetrics(): AIMetrics {
    return {
      requests: 0,
      successes: 0,
      failures: 0,
      timeouts: 0,
      rateLimitHits: 0,
      averageLatency: 0,
      consecutiveFailures: 0,
      failureRate: 0
    };
  }

  /**
   * HIPAA Compliance Gate - Validates that external AI usage is authorized
   */
  private validateHIPAACompliance(operation: string): void {
    if (!this.config.hipaaCompliant) {
      const error = `HIPAA COMPLIANCE VIOLATION: ${operation} blocked. External AI providers disabled for PHI protection. Set HIPAA_SAFE_AI=true to enable.`;
      console.error(`[AI Router] ${error}`);
      this.addAuditEntry(operation, AIProvider.OPENAI, false, 'HIPAA compliance violation');
      throw new HIPAAComplianceError(error);
    }
  }

  /**
   * PHI Safety Warning - Logs warning about potential PHI exposure
   */
  private logPHIWarning(operation: string): void {
    console.warn(`[AI Router] ⚠️  PHI SAFETY WARNING: ${operation} may process protected health information. Ensure data is de-identified before processing.`);
  }

  /**
   * HIPAA-compliant persistent audit logging without sensitive content
   */
  private async addAuditEntry(operation: string, provider: AIProvider, success: boolean, error?: string, metadata?: any): Promise<void> {
    try {
      // Remove any potentially sensitive information from metadata
      const safeMetadata = metadata ? {
        tokenCount: metadata.tokenCount,
        latency: metadata.latency,
        model: metadata.model
      } : undefined;

      // Create persistent audit log entry in database
      await storage.createAuditLog({
        operation: `ai_${operation}`,
        therapistId: null, // Will be populated by calling context if available
        success,
        errorMessage: error ? error.substring(0, 100) : undefined,
        metadata: safeMetadata,
        provider: 'ai',
        ipAddress: null,
        userAgent: null,
      });
      
      console.log(`[AI Router] [AUDIT] ${operation} via ${provider}: ${success ? 'SUCCESS' : 'FAILED'}`);
    } catch (auditError) {
      // CRITICAL: Audit logging failure is a security incident
      console.error(`[AI Router] [CRITICAL] Audit logging failed for ${operation}:`, auditError);
      // In production, this should trigger security alerts
    }
  }

  /**
   * Circuit Breaker Pattern - Check if provider is in cooldown
   */
  private isProviderInCooldown(provider: AIProvider): boolean {
    const metrics = this.metrics.get(provider);
    if (!metrics?.cooldownUntil) return false;
    
    const inCooldown = new Date() < metrics.cooldownUntil;
    if (!inCooldown) {
      // Cooldown expired, reset consecutive failures
      metrics.cooldownUntil = undefined;
      metrics.consecutiveFailures = 0;
    }
    return inCooldown;
  }

  /**
   * Circuit Breaker Pattern - Trigger cooldown if failure threshold exceeded
   */
  private checkCircuitBreaker(provider: AIProvider): void {
    const metrics = this.metrics.get(provider)!;
    
    if (metrics.consecutiveFailures >= this.config.circuitBreakerFailureThreshold) {
      metrics.cooldownUntil = new Date(Date.now() + this.config.circuitBreakerCooldownMs);
      console.warn(`[AI Router] Circuit breaker activated for ${provider}. Cooldown until ${metrics.cooldownUntil.toISOString()}`);
    }
  }

  /**
   * Health-aware provider selection with load balancing
   */
  private getProviderOrder(): AIProvider[] {
    const providers = [
      { provider: AIProvider.OPENAI, config: this.config.openai },
      { provider: AIProvider.ANTHROPIC, config: this.config.anthropic }
    ];

    // Filter enabled providers not in cooldown
    const availableProviders = providers
      .filter(p => p.config.enabled && !this.isProviderInCooldown(p.provider))
      .map(p => {
        const metrics = this.metrics.get(p.provider)!;
        return {
          provider: p.provider,
          priority: p.config.priority,
          failureRate: metrics.failureRate,
          averageLatency: metrics.averageLatency,
          healthScore: this.calculateHealthScore(p.provider)
        };
      });

    if (availableProviders.length === 0) {
      throw new Error('No healthy AI providers available. All providers are in cooldown or disabled.');
    }

    // Sort by health score (higher is better), then by priority
    return availableProviders
      .sort((a, b) => {
        if (Math.abs(a.healthScore - b.healthScore) > 0.1) {
          return b.healthScore - a.healthScore; // Higher health score first
        }
        return a.priority - b.priority; // Then by priority
      })
      .map(p => p.provider);
  }

  /**
   * Calculate health score based on failure rate and latency
   */
  private calculateHealthScore(provider: AIProvider): number {
    const metrics = this.metrics.get(provider)!;
    
    if (metrics.requests === 0) return 1.0; // No data, assume healthy
    
    const successRate = 1 - metrics.failureRate;
    const latencyScore = Math.max(0, 1 - (metrics.averageLatency / 10000)); // Normalize latency to 0-1
    
    // Weighted combination: 70% success rate, 30% latency
    return (successRate * 0.7) + (latencyScore * 0.3);
  }

  private updateMetrics(provider: AIProvider, success: boolean, latency: number, errorType?: AIError, errorMessage?: string) {
    const metrics = this.metrics.get(provider)!;
    metrics.requests++;
    
    if (success) {
      metrics.successes++;
      metrics.lastSuccess = new Date().toISOString();
      metrics.consecutiveFailures = 0; // Reset on success
      
      // Update running average latency
      metrics.averageLatency = (metrics.averageLatency * (metrics.successes - 1) + latency) / metrics.successes;
    } else {
      metrics.failures++;
      metrics.consecutiveFailures++;
      
      // Store actual error cause and timestamp
      metrics.lastError = new Date().toISOString();
      metrics.lastErrorCause = errorType;
      
      if (errorType === AIError.TIMEOUT) metrics.timeouts++;
      if (errorType === AIError.RATE_LIMIT) metrics.rateLimitHits++;
      
      // Check circuit breaker after failure
      this.checkCircuitBreaker(provider);
    }
    
    // Update failure rate (last 100 requests window)
    metrics.failureRate = Math.min(metrics.failures / Math.max(metrics.requests, 1), 1);
  }

  private classifyError(error: unknown): AIError {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
    const errorCode = (error as any)?.code || (error as any)?.status;

    // Check for HIPAA compliance errors first
    if (error instanceof HIPAAComplianceError) {
      return AIError.HIPAA_COMPLIANCE;
    }

    if (errorMessage.includes("timeout") || errorCode === "ETIMEDOUT" || errorMessage.includes("abort")) {
      return AIError.TIMEOUT;
    }
    if (errorCode === 429 || errorMessage.includes("rate limit")) {
      return AIError.RATE_LIMIT;
    }
    if (errorCode >= 500 && errorCode < 600) {
      return AIError.SERVER_ERROR;
    }
    if (errorMessage.includes("validation") || errorMessage.includes("invalid") || errorMessage.includes("parse")) {
      return AIError.VALIDATION_ERROR;
    }
    if (errorMessage.includes("circuit breaker") || errorMessage.includes("cooldown")) {
      return AIError.CIRCUIT_BREAKER;
    }
    return AIError.UNKNOWN;
  }

  private shouldRetry(error: AIError, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) return false;
    
    // Retry on timeouts, rate limits, and server errors
    return [AIError.TIMEOUT, AIError.RATE_LIMIT, AIError.SERVER_ERROR].includes(error);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private validateJsonOutput<T>(output: any, schema?: z.ZodSchema<T>): T {
    if (schema) {
      try {
        return schema.parse(output);
      } catch (error) {
        throw new Error(`JSON validation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return output;
  }

  private async executeWithProvider<T>(
    provider: AIProvider,
    operation: string,
    executor: () => Promise<T>,
    schema?: z.ZodSchema<T>,
    timeoutMs?: number
  ): Promise<T> {
    // Check circuit breaker first
    if (this.isProviderInCooldown(provider)) {
      const error = new Error(`Provider ${provider} is in circuit breaker cooldown`);
      this.addAuditEntry(operation, provider, false, 'Circuit breaker active');
      throw error;
    }

    const config = provider === AIProvider.OPENAI ? this.config.openai : this.config.anthropic;
    const effectiveTimeout = timeoutMs || config.timeoutMs;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      const startTime = Date.now();
      const abortController = new AbortController();
      
      // Set up per-call timeout beyond SDK timeout
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, effectiveTimeout + 5000); // 5s buffer beyond SDK timeout
      
      try {
        console.log(`[AI Router] Attempting ${operation} with ${provider} (attempt ${attempt + 1}/${config.maxRetries})`);
        
        // Execute with abort signal
        const result = await Promise.race([
          executor(),
          new Promise<never>((_, reject) => {
            abortController.signal.addEventListener('abort', () => {
              reject(new Error('Operation timed out by abort controller'));
            });
          })
        ]);
        
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        
        // Validate result if schema provided
        const validatedResult = this.validateJsonOutput(result, schema);
        
        this.updateMetrics(provider, true, latency);
        this.addAuditEntry(operation, provider, true, undefined, { latency, tokenCount: this.estimateTokens(result) });
        console.log(`[AI Router] Success: ${operation} with ${provider} in ${latency}ms`);
        
        return validatedResult;
      } catch (error) {
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        const errorType = this.classifyError(error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.updateMetrics(provider, false, latency, errorType, errorMessage);
        this.addAuditEntry(operation, provider, false, errorType, { latency });
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.error(`[AI Router] Error: ${operation} with ${provider} (attempt ${attempt + 1}): ${errorMessage}`);
        
        if (!this.shouldRetry(errorType, attempt, config.maxRetries)) {
          break;
        }
        
        if (attempt < config.maxRetries - 1) {
          const delayMs = this.config.retryDelay * Math.pow(2, attempt); // Exponential backoff
          console.log(`[AI Router] Retrying ${operation} with ${provider} in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }

    throw lastError || new Error('Unknown error occurred');
  }

  /**
   * Estimate token count for audit logging (rough estimation)
   */
  private estimateTokens(content: any): number {
    if (typeof content === 'string') {
      return Math.ceil(content.length / 4); // Rough estimate: 4 chars per token
    }
    if (typeof content === 'object') {
      return Math.ceil(JSON.stringify(content).length / 4);
    }
    return 0;
  }

  /**
   * Unified interface for structured JSON chat completions
   */
  async chatJSON<T>(
    messages: AIMessage[],
    schema?: z.ZodSchema<T>,
    options?: { systemPrompt?: string; maxTokens?: number }
  ): Promise<T> {
    const providers = this.getProviderOrder();
    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        return await this.executeWithProvider(
          provider,
          "chatJSON",
          async () => {
            if (provider === AIProvider.OPENAI) {
              return await this.chatJSONOpenAI(messages, options);
            } else {
              return await this.chatJSONAnthropic(messages, options);
            }
          },
          schema
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[AI Router] Provider ${provider} failed for chatJSON, trying next provider...`);
      }
    }

    throw new Error(`All AI providers failed for chatJSON. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  private async chatJSONOpenAI(
    messages: AIMessage[],
    options?: { systemPrompt?: string; maxTokens?: number }
  ): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const openaiMessages = messages.map(msg => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content
    }));

    // Add system prompt if provided
    if (options?.systemPrompt) {
      openaiMessages.unshift({
        role: "system",
        content: options.systemPrompt
      });
    }

    const response = await this.openai.chat.completions.create({
      model: "gpt-5",
      messages: openaiMessages,
      response_format: { type: "json_object" },
      max_completion_tokens: options?.maxTokens || 2048
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }

  private async chatJSONAnthropic(
    messages: AIMessage[],
    options?: { systemPrompt?: string; maxTokens?: number }
  ): Promise<any> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const anthropicMessages = messages
      .filter(msg => msg.role !== "system")
      .map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content
      }));

    // Extract system message or use provided system prompt
    const systemMessage = messages.find(msg => msg.role === "system")?.content || options?.systemPrompt || "";
    const finalSystemPrompt = systemMessage + "\n\nAlways respond with valid JSON format.";

    const response: any = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      system: finalSystemPrompt,
      messages: anthropicMessages,
      max_tokens: options?.maxTokens || 2048
    });

    const content = response.content[0];
    if (content.type === "text") {
      // Clean JSON from markdown code blocks if present
      let jsonText = content.text.trim();
      if (jsonText.startsWith('```json') || jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      return JSON.parse(jsonText);
    }
    throw new Error("Unexpected response format from Anthropic");
  }

  /**
   * OCR functionality for extracting text from images
   */
  async ocrImage(imageBuffer: Buffer): Promise<string> {
    const providers = this.getProviderOrder();
    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        return await this.executeWithProvider(
          provider,
          "ocrImage",
          async () => {
            const base64Image = imageBuffer.toString("base64");
            
            if (provider === AIProvider.OPENAI) {
              return await this.ocrImageOpenAI(base64Image);
            } else {
              return await this.ocrImageAnthropic(base64Image);
            }
          }
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[AI Router] Provider ${provider} failed for ocrImage, trying next provider...`);
      }
    }

    throw new Error(`All AI providers failed for ocrImage. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  private async ocrImageOpenAI(base64Image: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract and transcribe all text from this image. Maintain the original formatting and structure as much as possible. If the image contains handwritten text, do your best to interpret it accurately."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_completion_tokens: 2048
    });

    return response.choices[0].message.content || "";
  }

  private async ocrImageAnthropic(base64Image: string): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const response: any = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract and transcribe all text from this image. Maintain the original formatting and structure as much as possible. If the image contains handwritten text, do your best to interpret it accurately."
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }]
    });

    const content = response.content[0];
    if (content.type === "text") {
      return content.text;
    }
    throw new Error("Unexpected response format from Anthropic");
  }

  /**
   * Text summarization functionality
   */
  async summarize(text: string, options?: { maxLength?: number; style?: "brief" | "detailed" }): Promise<string> {
    const maxLength = options?.maxLength || 200;
    const style = options?.style || "brief";
    
    const prompt = `Please ${style === "brief" ? "briefly" : "comprehensively"} summarize the following text in approximately ${maxLength} words or less:\n\n${text}`;

    const response = await this.chatJSON([
      {
        role: "system",
        content: "You are an expert at creating clear, concise summaries. Always respond with a JSON object containing a 'summary' field."
      },
      {
        role: "user",
        content: prompt
      }
    ]);

    return (response as any)?.summary || "";
  }

  /**
   * Tag generation functionality
   */
  async generateTags(
    content: string, 
    context?: string, 
    options?: { maxTags?: number; category?: string }
  ): Promise<string[]> {
    const maxTags = options?.maxTags || 8;
    const category = options?.category || "therapy";
    const contextPrompt = context ? `\n\nContext: ${context}` : "";
    
    const prompt = `Generate ${maxTags} relevant ${category}-related tags for the following content. Focus on key themes, concepts, and actionable insights.${contextPrompt}\n\nContent: ${content}`;

    const response = await this.chatJSON([
      {
        role: "system",
        content: "You are an expert tagger specializing in therapeutic content. Always respond with a JSON object containing a 'tags' array of strings."
      },
      {
        role: "user",
        content: prompt
      }
    ]);

    return (response as any)?.tags || [];
  }

  /**
   * Get current metrics for monitoring
   */
  getMetrics(): Record<AIProvider, AIMetrics> {
    const result: Record<AIProvider, AIMetrics> = {} as any;
    this.metrics.forEach((metrics, provider) => {
      result[provider] = { ...metrics };
    });
    return result;
  }

  /**
   * Reset metrics (useful for monitoring windows)
   */
  resetMetrics(): void {
    this.metrics.set(AIProvider.OPENAI, this.createEmptyMetrics());
    this.metrics.set(AIProvider.ANTHROPIC, this.createEmptyMetrics());
  }

  /**
   * Get health status of providers
   */
  getHealthStatus(): Record<AIProvider, { healthy: boolean; reason?: string }> {
    const result: Record<AIProvider, { healthy: boolean; reason?: string }> = {} as any;
    
    this.metrics.forEach((metrics, provider) => {
      const config = provider === AIProvider.OPENAI ? this.config.openai : this.config.anthropic;
      
      if (!config.enabled) {
        result[provider] = { healthy: false, reason: "disabled" };
        return;
      }

      const recentFailureRate = metrics.requests > 0 ? metrics.failures / metrics.requests : 0;
      const highFailureRate = recentFailureRate > 0.5;
      const highLatency = metrics.averageLatency > config.timeoutMs * 0.8;
      
      if (highFailureRate) {
        result[provider] = { healthy: false, reason: `high failure rate: ${(recentFailureRate * 100).toFixed(1)}%` };
      } else if (highLatency) {
        result[provider] = { healthy: false, reason: `high latency: ${metrics.averageLatency}ms` };
      } else {
        result[provider] = { healthy: true };
      }
    });
    
    return result;
  }
}

// Export singleton instance
export const aiRouter = new AIRouter();

// Export types for use in other files
export type { AIMessage, AIRouterConfig, AIMetrics };
export { AIProvider, AIError };