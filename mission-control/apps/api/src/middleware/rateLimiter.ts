/**
 * ORACLE Rate Limiter Middleware
 * Story sec-3 - User-level rate limiting
 *
 * Features:
 * - Per-user rate limits
 * - Tier-based limits (free/premium)
 * - Rate limit headers in responses
 * - Graceful degradation on limit
 */

import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export type UserTier = 'free' | 'basic' | 'premium' | 'enterprise';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  maxAIRequests: number;
  maxBatchRequests: number;
  maxBatchOperations: number;
  gracePeriodMs: number;
  penaltyMultiplier: number;
}

export interface RateLimitState {
  userId: string;
  tier: UserTier;
  windowStart: number;
  requestCount: number;
  aiRequestCount: number;
  batchRequestCount: number;
  isLimited: boolean;
  limitResetAt: number;
  penaltyCount: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface RateLimiterOptions {
  redis?: any; // Redis client for distributed rate limiting
  supabase?: SupabaseClient;
  defaultTier?: UserTier;
  enableGracePeriod?: boolean;
  enablePenalties?: boolean;
  customLimits?: Partial<Record<UserTier, Partial<RateLimitConfig>>>;
  onRateLimited?: (userId: string, tier: UserTier, info: RateLimitInfo) => void;
}

// ============================================================================
// DEFAULT RATE LIMITS BY TIER
// ============================================================================

const DEFAULT_LIMITS: Record<UserTier, RateLimitConfig> = {
  free: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    maxAIRequests: 10,
    maxBatchRequests: 5,
    maxBatchOperations: 20,
    gracePeriodMs: 5000,
    penaltyMultiplier: 1.5,
  },
  basic: {
    windowMs: 60 * 1000,
    maxRequests: 120,
    maxAIRequests: 30,
    maxBatchRequests: 10,
    maxBatchOperations: 50,
    gracePeriodMs: 3000,
    penaltyMultiplier: 1.3,
  },
  premium: {
    windowMs: 60 * 1000,
    maxRequests: 300,
    maxAIRequests: 100,
    maxBatchRequests: 30,
    maxBatchOperations: 100,
    gracePeriodMs: 2000,
    penaltyMultiplier: 1.2,
  },
  enterprise: {
    windowMs: 60 * 1000,
    maxRequests: 1000,
    maxAIRequests: 500,
    maxBatchRequests: 100,
    maxBatchOperations: 500,
    gracePeriodMs: 1000,
    penaltyMultiplier: 1.1,
  },
};

// ============================================================================
// IN-MEMORY STORE (for single-instance deployments)
// ============================================================================

class InMemoryStore {
  private states: Map<string, RateLimitState> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up old entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get(userId: string): Promise<RateLimitState | null> {
    return this.states.get(userId) || null;
  }

  async set(userId: string, state: RateLimitState): Promise<void> {
    this.states.set(userId, state);
  }

  async increment(
    userId: string,
    field: 'requestCount' | 'aiRequestCount' | 'batchRequestCount',
    tier: UserTier
  ): Promise<RateLimitState> {
    let state = this.states.get(userId);
    const now = Date.now();
    const limits = DEFAULT_LIMITS[tier];

    if (!state || now - state.windowStart >= limits.windowMs) {
      // New window
      state = {
        userId,
        tier,
        windowStart: now,
        requestCount: 0,
        aiRequestCount: 0,
        batchRequestCount: 0,
        isLimited: false,
        limitResetAt: now + limits.windowMs,
        penaltyCount: 0,
      };
    }

    state[field]++;
    this.states.set(userId, state);
    return state;
  }

  async setLimited(userId: string, resetAt: number): Promise<void> {
    const state = this.states.get(userId);
    if (state) {
      state.isLimited = true;
      state.limitResetAt = resetAt;
      state.penaltyCount++;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [userId, state] of this.states.entries()) {
      if (now - state.windowStart > maxAge) {
        this.states.delete(userId);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.states.clear();
  }
}

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

export class RateLimiter {
  private store: InMemoryStore;
  private options: RateLimiterOptions;
  private limits: Record<UserTier, RateLimitConfig>;
  private userTierCache: Map<string, { tier: UserTier; expires: number }> = new Map();

  constructor(options: RateLimiterOptions = {}) {
    this.store = new InMemoryStore();
    this.options = options;

    // Merge custom limits with defaults
    this.limits = { ...DEFAULT_LIMITS };
    if (options.customLimits) {
      for (const [tier, config] of Object.entries(options.customLimits)) {
        this.limits[tier as UserTier] = {
          ...DEFAULT_LIMITS[tier as UserTier],
          ...config,
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // User Tier Management
  // --------------------------------------------------------------------------

  private async getUserTier(userId: string): Promise<UserTier> {
    // Check cache first
    const cached = this.userTierCache.get(userId);
    if (cached && cached.expires > Date.now()) {
      return cached.tier;
    }

    // Fetch from database
    let tier: UserTier = this.options.defaultTier || 'free';

    if (this.options.supabase) {
      try {
        const { data } = await this.options.supabase
          .from('user_subscriptions')
          .select('tier')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single();

        if (data?.tier) {
          tier = data.tier as UserTier;
        }
      } catch {
        // Use default tier
      }
    }

    // Cache for 5 minutes
    this.userTierCache.set(userId, {
      tier,
      expires: Date.now() + 5 * 60 * 1000,
    });

    return tier;
  }

  // --------------------------------------------------------------------------
  // Rate Limit Checking
  // --------------------------------------------------------------------------

  async checkLimit(
    userId: string,
    requestType: 'standard' | 'ai' | 'batch' = 'standard',
    batchOperationCount = 1
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const tier = await this.getUserTier(userId);
    const limits = this.limits[tier];

    // Get current state
    let state = await this.store.get(userId);
    const now = Date.now();

    // Check if currently limited
    if (state?.isLimited && state.limitResetAt > now) {
      return {
        allowed: false,
        info: {
          limit: limits.maxRequests,
          remaining: 0,
          reset: Math.ceil(state.limitResetAt / 1000),
          retryAfter: Math.ceil((state.limitResetAt - now) / 1000),
        },
      };
    }

    // Increment appropriate counter
    const field = requestType === 'ai' ? 'aiRequestCount' :
                  requestType === 'batch' ? 'batchRequestCount' : 'requestCount';

    state = await this.store.increment(userId, field, tier);

    // Check limits based on request type
    let isOverLimit = false;
    let maxLimit = limits.maxRequests;

    if (requestType === 'ai') {
      isOverLimit = state.aiRequestCount > limits.maxAIRequests;
      maxLimit = limits.maxAIRequests;
    } else if (requestType === 'batch') {
      isOverLimit = state.batchRequestCount > limits.maxBatchRequests;
      maxLimit = limits.maxBatchRequests;

      // Also check batch operation limit
      if (batchOperationCount > limits.maxBatchOperations) {
        isOverLimit = true;
      }
    } else {
      isOverLimit = state.requestCount > limits.maxRequests;
    }

    if (isOverLimit) {
      // Calculate penalty time
      let resetAt = state.windowStart + limits.windowMs;

      if (this.options.enablePenalties !== false && state.penaltyCount > 0) {
        const penaltyMultiplier = Math.pow(limits.penaltyMultiplier, state.penaltyCount);
        const penaltyMs = limits.windowMs * penaltyMultiplier - limits.windowMs;
        resetAt += penaltyMs;
      }

      await this.store.setLimited(userId, resetAt);

      // Notify callback
      this.options.onRateLimited?.(userId, tier, {
        limit: maxLimit,
        remaining: 0,
        reset: Math.ceil(resetAt / 1000),
        retryAfter: Math.ceil((resetAt - now) / 1000),
      });

      return {
        allowed: false,
        info: {
          limit: maxLimit,
          remaining: 0,
          reset: Math.ceil(resetAt / 1000),
          retryAfter: Math.ceil((resetAt - now) / 1000),
        },
      };
    }

    // Calculate remaining
    const remaining = requestType === 'ai'
      ? limits.maxAIRequests - state.aiRequestCount
      : requestType === 'batch'
      ? limits.maxBatchRequests - state.batchRequestCount
      : limits.maxRequests - state.requestCount;

    return {
      allowed: true,
      info: {
        limit: maxLimit,
        remaining: Math.max(0, remaining),
        reset: Math.ceil((state.windowStart + limits.windowMs) / 1000),
      },
    };
  }

  // --------------------------------------------------------------------------
  // Express Middleware
  // --------------------------------------------------------------------------

  middleware(requestType: 'standard' | 'ai' | 'batch' = 'standard') {
    return async (req: Request, res: Response, next: NextFunction) => {
      const userId = (req as any).userId || req.ip || 'anonymous';

      // For batch requests, get operation count
      let batchOperationCount = 1;
      if (requestType === 'batch' && req.body?.operations) {
        batchOperationCount = req.body.operations.length;
      }

      const { allowed, info } = await this.checkLimit(userId, requestType, batchOperationCount);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', info.limit.toString());
      res.setHeader('X-RateLimit-Remaining', info.remaining.toString());
      res.setHeader('X-RateLimit-Reset', info.reset.toString());

      if (!allowed) {
        res.setHeader('Retry-After', info.retryAfter?.toString() || '60');

        return res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
            retryAfter: info.retryAfter,
            limit: info.limit,
            reset: info.reset,
          },
        });
      }

      return next();
    };
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  async getRateLimitStatus(userId: string): Promise<{
    tier: UserTier;
    limits: RateLimitConfig;
    current: RateLimitState | null;
  }> {
    const tier = await this.getUserTier(userId);
    const state = await this.store.get(userId);

    return {
      tier,
      limits: this.limits[tier],
      current: state,
    };
  }

  async resetUserLimit(userId: string): Promise<void> {
    const tier = await this.getUserTier(userId);
    const now = Date.now();

    await this.store.set(userId, {
      userId,
      tier,
      windowStart: now,
      requestCount: 0,
      aiRequestCount: 0,
      batchRequestCount: 0,
      isLimited: false,
      limitResetAt: now + this.limits[tier].windowMs,
      penaltyCount: 0,
    });
  }

  clearTierCache(userId?: string): void {
    if (userId) {
      this.userTierCache.delete(userId);
    } else {
      this.userTierCache.clear();
    }
  }

  destroy(): void {
    this.store.destroy();
    this.userTierCache.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

let defaultRateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!defaultRateLimiter) {
    defaultRateLimiter = new RateLimiter();
  }
  return defaultRateLimiter;
}

export function initRateLimiter(options: RateLimiterOptions): RateLimiter {
  if (defaultRateLimiter) {
    defaultRateLimiter.destroy();
  }
  defaultRateLimiter = new RateLimiter(options);
  return defaultRateLimiter;
}

// ============================================================================
// MIDDLEWARE FACTORIES
// ============================================================================

export function standardRateLimiter() {
  return getRateLimiter().middleware('standard');
}

export function aiRateLimiter() {
  return getRateLimiter().middleware('ai');
}

export function batchRateLimiter() {
  return getRateLimiter().middleware('batch');
}

export default RateLimiter;
