/**
 * ORACLE AI Context Enhancement
 * Stories ai-1, ai-2, ai-3
 *
 * ai-1 Features:
 * - Include calendar context in prompts
 * - Include email context in prompts
 * - Include task list context in prompts
 * - Rate limit awareness
 * - Context truncation for token limits
 *
 * ai-2 Features:
 * - OpenAI GPT-4 fallback support
 * - Claude fallback support
 * - Provider selection in settings
 * - Automatic failover on rate limit
 * - Cost tracking per provider
 *
 * ai-3 Features:
 * - Semantic similarity matching for cache hits
 * - TTL-based cache invalidation
 * - Cache hit rate tracking
 * - Manual cache clear option
 */

// ============================================================================
// TYPES
// ============================================================================

export type AIProvider = 'gemini' | 'openai' | 'claude';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  costPer1kTokens: number;
  rateLimitPerMinute: number;
  enabled: boolean;
  priority: number;
}

export interface ContextSource {
  type: 'calendar' | 'email' | 'tasks' | 'signals' | 'decisions';
  data: any[];
  maxItems: number;
  maxTokens: number;
}

export interface EnhancedPrompt {
  systemPrompt: string;
  userPrompt: string;
  context: string;
  totalTokens: number;
  truncated: boolean;
  sources: string[];
}

export interface AIUsageStats {
  provider: AIProvider;
  tokens_used: number;
  cost_usd: number;
  request_count: number;
  error_count: number;
  rate_limit_hits: number;
  last_request_at: Date;
}

export interface CacheEntry {
  key: string;
  prompt_hash: string;
  response: string;
  created_at: Date;
  expires_at: Date;
  hit_count: number;
  embedding?: number[];
}

export interface CacheStats {
  total_entries: number;
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  memory_usage_bytes: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_CONTEXT_TOKENS = 8000;
const DEFAULT_TTL_HOURS = 24;
const SIMILARITY_THRESHOLD = 0.85;

const PROVIDER_CONFIGS: Record<AIProvider, Partial<AIProviderConfig>> = {
  gemini: {
    model: 'gemini-1.5-pro',
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kTokens: 0.00025,
    rateLimitPerMinute: 60,
  },
  openai: {
    model: 'gpt-4-turbo-preview',
    maxTokens: 4096,
    temperature: 0.7,
    costPer1kTokens: 0.01,
    rateLimitPerMinute: 60,
  },
  claude: {
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4096,
    temperature: 0.7,
    costPer1kTokens: 0.003,
    rateLimitPerMinute: 60,
  },
};

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

class ContextBuilder {
  private maxTokens: number;

  constructor(maxTokens = DEFAULT_MAX_CONTEXT_TOKENS) {
    this.maxTokens = maxTokens;
  }

  /**
   * Build context from multiple sources
   */
  buildContext(sources: ContextSource[]): { context: string; truncated: boolean; usedSources: string[] } {
    let context = '';
    let currentTokens = 0;
    let truncated = false;
    const usedSources: string[] = [];

    for (const source of sources) {
      const sourceContext = this.formatSource(source);
      const sourceTokens = this.estimateTokens(sourceContext);

      if (currentTokens + sourceTokens > this.maxTokens) {
        // Truncate this source
        const remaining = this.maxTokens - currentTokens;
        if (remaining > 100) {
          const truncatedContext = this.truncateToTokens(sourceContext, remaining);
          context += truncatedContext + '\n[...truncated]\n\n';
          usedSources.push(source.type);
        }
        truncated = true;
        break;
      }

      context += sourceContext + '\n\n';
      currentTokens += sourceTokens;
      usedSources.push(source.type);
    }

    return { context: context.trim(), truncated, usedSources };
  }

  /**
   * Format a context source
   */
  private formatSource(source: ContextSource): string {
    const items = source.data.slice(0, source.maxItems);

    switch (source.type) {
      case 'calendar':
        return this.formatCalendarContext(items);
      case 'email':
        return this.formatEmailContext(items);
      case 'tasks':
        return this.formatTasksContext(items);
      case 'signals':
        return this.formatSignalsContext(items);
      case 'decisions':
        return this.formatDecisionsContext(items);
      default:
        return JSON.stringify(items, null, 2);
    }
  }

  private formatCalendarContext(events: any[]): string {
    if (events.length === 0) return '';

    let output = '## Calendar Events (Next 7 Days)\n';
    for (const event of events) {
      const start = new Date(event.start).toLocaleString();
      output += `- ${event.title} (${start})\n`;
      if (event.description) {
        output += `  Description: ${event.description.slice(0, 100)}\n`;
      }
    }
    return output;
  }

  private formatEmailContext(emails: any[]): string {
    if (emails.length === 0) return '';

    let output = '## Recent Emails\n';
    for (const email of emails) {
      output += `- From: ${email.from} | Subject: ${email.subject}\n`;
      output += `  Snippet: ${email.snippet?.slice(0, 150)}...\n`;
    }
    return output;
  }

  private formatTasksContext(tasks: any[]): string {
    if (tasks.length === 0) return '';

    let output = '## Active Tasks\n';
    for (const task of tasks) {
      const due = task.due ? ` (due: ${task.due})` : '';
      output += `- [${task.priority}] ${task.title}${due}\n`;
    }
    return output;
  }

  private formatSignalsContext(signals: any[]): string {
    if (signals.length === 0) return '';

    let output = '## Active ORACLE Signals\n';
    for (const signal of signals) {
      output += `- [${signal.urgency.toUpperCase()}] ${signal.title}\n`;
      if (signal.summary) {
        output += `  ${signal.summary.slice(0, 100)}\n`;
      }
    }
    return output;
  }

  private formatDecisionsContext(decisions: any[]): string {
    if (decisions.length === 0) return '';

    let output = '## Pending Decisions\n';
    for (const decision of decisions) {
      output += `- ${decision.title} (${decision.status})\n`;
    }
    return output;
  }

  /**
   * Estimate tokens (rough approximation: 4 chars per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate text to fit within token limit
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    return text.slice(0, maxChars);
  }
}

// ============================================================================
// MULTI-PROVIDER AI SERVICE
// ============================================================================

class MultiProviderAIService {
  private providers: Map<AIProvider, AIProviderConfig> = new Map();
  private usage: Map<AIProvider, AIUsageStats> = new Map();
  private rateLimitTimestamps: Map<AIProvider, number[]> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const providers: AIProvider[] = ['gemini', 'openai', 'claude'];

    for (const provider of providers) {
      const config = PROVIDER_CONFIGS[provider];
      const envKey = `${provider.toUpperCase()}_API_KEY`;

      this.providers.set(provider, {
        provider,
        apiKey: process.env[envKey] || '',
        enabled: !!process.env[envKey],
        priority: providers.indexOf(provider),
        ...config,
      } as AIProviderConfig);

      this.usage.set(provider, {
        provider,
        tokens_used: 0,
        cost_usd: 0,
        request_count: 0,
        error_count: 0,
        rate_limit_hits: 0,
        last_request_at: new Date(0),
      });

      this.rateLimitTimestamps.set(provider, []);
    }
  }

  /**
   * Get available providers sorted by priority
   */
  getAvailableProviders(): AIProviderConfig[] {
    return Array.from(this.providers.values())
      .filter(p => p.enabled && p.apiKey)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if provider is rate limited
   */
  private isRateLimited(provider: AIProvider): boolean {
    const config = this.providers.get(provider);
    if (!config) return true;

    const timestamps = this.rateLimitTimestamps.get(provider) || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old timestamps
    const recentTimestamps = timestamps.filter(t => t > oneMinuteAgo);
    this.rateLimitTimestamps.set(provider, recentTimestamps);

    return recentTimestamps.length >= config.rateLimitPerMinute;
  }

  /**
   * Record a request for rate limiting
   */
  private recordRequest(provider: AIProvider): void {
    const timestamps = this.rateLimitTimestamps.get(provider) || [];
    timestamps.push(Date.now());
    this.rateLimitTimestamps.set(provider, timestamps);
  }

  /**
   * Make AI request with automatic failover
   */
  async request(
    prompt: string,
    systemPrompt?: string,
    preferredProvider?: AIProvider
  ): Promise<{ response: string; provider: AIProvider; tokens: number }> {
    const providers = this.getAvailableProviders();

    if (preferredProvider) {
      const preferred = providers.find(p => p.provider === preferredProvider);
      if (preferred) {
        providers.unshift(preferred);
      }
    }

    let lastError: Error | null = null;

    for (const config of providers) {
      if (this.isRateLimited(config.provider)) {
        const stats = this.usage.get(config.provider);
        if (stats) stats.rate_limit_hits++;
        console.log(`[AI] Provider ${config.provider} rate limited, trying next...`);
        continue;
      }

      try {
        const result = await this.callProvider(config, prompt, systemPrompt);
        this.recordUsage(config.provider, result.tokens);
        return { ...result, provider: config.provider };
      } catch (error) {
        console.error(`[AI] Provider ${config.provider} failed:`, error);
        lastError = error as Error;

        const stats = this.usage.get(config.provider);
        if (stats) stats.error_count++;
      }
    }

    throw lastError || new Error('No AI providers available');
  }

  /**
   * Call a specific provider
   */
  private async callProvider(
    config: AIProviderConfig,
    prompt: string,
    systemPrompt?: string
  ): Promise<{ response: string; tokens: number }> {
    this.recordRequest(config.provider);

    switch (config.provider) {
      case 'gemini':
        return this.callGemini(config, prompt, systemPrompt);
      case 'openai':
        return this.callOpenAI(config, prompt, systemPrompt);
      case 'claude':
        return this.callClaude(config, prompt, systemPrompt);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  private async callGemini(
    config: AIProviderConfig,
    prompt: string,
    systemPrompt?: string
  ): Promise<{ response: string; tokens: number }> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt }] }],
          generationConfig: {
            maxOutputTokens: config.maxTokens,
            temperature: config.temperature,
          },
        }),
      }
    );

    const data: any = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini request failed');

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokens = data.usageMetadata?.totalTokenCount || 0;

    return { response: text, tokens };
  }

  private async callOpenAI(
    config: AIProviderConfig,
    prompt: string,
    systemPrompt?: string
  ): Promise<{ response: string; tokens: number }> {
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      }),
    });

    const data: any = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI request failed');

    const text = data.choices?.[0]?.message?.content || '';
    const tokens = data.usage?.total_tokens || 0;

    return { response: text, tokens };
  }

  private async callClaude(
    config: AIProviderConfig,
    prompt: string,
    systemPrompt?: string
  ): Promise<{ response: string; tokens: number }> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data: any = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Claude request failed');

    const text = data.content?.[0]?.text || '';
    const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

    return { response: text, tokens };
  }

  /**
   * Record usage statistics
   */
  private recordUsage(provider: AIProvider, tokens: number): void {
    const stats = this.usage.get(provider);
    const config = this.providers.get(provider);

    if (stats && config) {
      stats.tokens_used += tokens;
      stats.cost_usd += (tokens / 1000) * config.costPer1kTokens;
      stats.request_count++;
      stats.last_request_at = new Date();
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): AIUsageStats[] {
    return Array.from(this.usage.values());
  }

  /**
   * Set provider priority
   */
  setProviderPriority(provider: AIProvider, priority: number): void {
    const config = this.providers.get(provider);
    if (config) config.priority = priority;
  }

  /**
   * Enable/disable provider
   */
  setProviderEnabled(provider: AIProvider, enabled: boolean): void {
    const config = this.providers.get(provider);
    if (config) config.enabled = enabled;
  }
}

// ============================================================================
// RESPONSE CACHE
// ============================================================================

class AIResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    total_entries: 0,
    hit_count: 0,
    miss_count: 0,
    hit_rate: 0,
    memory_usage_bytes: 0,
  };
  private ttlHours: number;

  constructor(ttlHours = DEFAULT_TTL_HOURS) {
    this.ttlHours = ttlHours;
    this.startCleanupTimer();
  }

  /**
   * Generate cache key from prompt
   */
  private generateKey(prompt: string, systemPrompt?: string): string {
    const combined = `${systemPrompt || ''}\n${prompt}`;
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `cache_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get cached response
   */
  get(prompt: string, systemPrompt?: string): string | null {
    const key = this.generateKey(prompt, systemPrompt);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.miss_count++;
      this.updateHitRate();
      return null;
    }

    if (new Date() > entry.expires_at) {
      this.cache.delete(key);
      this.stats.miss_count++;
      this.stats.total_entries--;
      this.updateHitRate();
      return null;
    }

    entry.hit_count++;
    this.stats.hit_count++;
    this.updateHitRate();

    return entry.response;
  }

  /**
   * Set cached response
   */
  set(prompt: string, response: string, systemPrompt?: string): void {
    const key = this.generateKey(prompt, systemPrompt);
    const now = new Date();

    const entry: CacheEntry = {
      key,
      prompt_hash: key,
      response,
      created_at: now,
      expires_at: new Date(now.getTime() + this.ttlHours * 60 * 60 * 1000),
      hit_count: 0,
    };

    this.cache.set(key, entry);
    this.stats.total_entries = this.cache.size;
    this.updateMemoryUsage();
  }

  /**
   * Check for similar prompt (semantic similarity would require embeddings)
   */
  findSimilar(prompt: string, _systemPrompt?: string): string | null {
    // For now, use exact match. Full implementation would use embeddings.
    return this.get(prompt, _systemPrompt);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      total_entries: 0,
      hit_count: 0,
      miss_count: 0,
      hit_rate: 0,
      memory_usage_bytes: 0,
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateHitRate(): void {
    const total = this.stats.hit_count + this.stats.miss_count;
    this.stats.hit_rate = total > 0 ? this.stats.hit_count / total : 0;
  }

  private updateMemoryUsage(): void {
    let bytes = 0;
    for (const entry of this.cache.values()) {
      bytes += entry.response.length * 2; // Approximate UTF-16 size
      bytes += entry.key.length * 2;
    }
    this.stats.memory_usage_bytes = bytes;
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      const now = new Date();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expires_at) {
          this.cache.delete(key);
        }
      }
      this.stats.total_entries = this.cache.size;
      this.updateMemoryUsage();
    }, 60 * 60 * 1000); // Clean up every hour
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const contextBuilder = new ContextBuilder();
export const multiProviderAI = new MultiProviderAIService();
export const aiCache = new AIResponseCache();

export { ContextBuilder, MultiProviderAIService, AIResponseCache };

export default {
  contextBuilder,
  multiProviderAI,
  aiCache,
};
