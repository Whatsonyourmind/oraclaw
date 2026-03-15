/**
 * Authentication Routes
 * POST /api/auth/register - Register new user
 * POST /api/auth/login - Login and get tokens
 * POST /api/auth/refresh - Refresh access token
 * GET /api/auth/me - Get current user profile
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { generateTokens, verifyRefreshToken, JWTPayload } from '../services/auth/jwt.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../services/auth/passwordService.js';
import { authMiddleware } from '../services/auth/authMiddleware.js';

// In-memory user store (will be replaced by database in Task 2)
interface StoredUser {
  id: string;
  email: string;
  password_hash: string;
  subscription_tier: string;
  created_at: string;
  last_active: string;
}

const userStore = new Map<string, StoredUser>();
const emailIndex = new Map<string, string>(); // email -> userId
const refreshTokenStore = new Map<string, string>(); // refreshToken -> userId

// Request body types
interface RegisterBody {
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/register
  fastify.post('/api/auth/register', async (
    request: FastifyRequest<{ Body: RegisterBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.code(400).send({
          success: false,
          error: 'Email and password are required',
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid email format',
        });
      }

      // Validate password strength
      const passwordCheck = validatePasswordStrength(password);
      if (!passwordCheck.valid) {
        return reply.code(400).send({
          success: false,
          error: 'Password does not meet requirements',
          details: passwordCheck.errors,
        });
      }

      // Check if email already exists
      if (emailIndex.has(email.toLowerCase())) {
        return reply.code(409).send({
          success: false,
          error: 'Email already registered',
        });
      }

      // Create user
      const userId = crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      const now = new Date().toISOString();

      const user: StoredUser = {
        id: userId,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        subscription_tier: 'free',
        created_at: now,
        last_active: now,
      };

      userStore.set(userId, user);
      emailIndex.set(email.toLowerCase(), userId);

      // Generate tokens
      const tokens = generateTokens({
        userId,
        email: user.email,
        tier: user.subscription_tier,
      });

      // Store refresh token
      refreshTokenStore.set(tokens.refreshToken, userId);

      return reply.code(201).send({
        success: true,
        data: {
          user: {
            id: userId,
            email: user.email,
            subscription_tier: user.subscription_tier,
            created_at: user.created_at,
          },
          tokens,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Registration failed',
      });
    }
  });

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (
    request: FastifyRequest<{ Body: LoginBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.code(400).send({
          success: false,
          error: 'Email and password are required',
        });
      }

      // Find user by email
      const userId = emailIndex.get(email.toLowerCase());
      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid email or password',
        });
      }

      const user = userStore.get(userId);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid email or password',
        });
      }

      // Verify password
      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid email or password',
        });
      }

      // Update last active
      user.last_active = new Date().toISOString();

      // Generate tokens
      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        tier: user.subscription_tier,
      });

      // Store refresh token
      refreshTokenStore.set(tokens.refreshToken, user.id);

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            subscription_tier: user.subscription_tier,
            last_active: user.last_active,
          },
          tokens,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Login failed',
      });
    }
  });

  // POST /api/auth/refresh
  fastify.post('/api/auth/refresh', async (
    request: FastifyRequest<{ Body: RefreshBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { refreshToken } = request.body;

      if (!refreshToken) {
        return reply.code(400).send({
          success: false,
          error: 'Refresh token is required',
        });
      }

      // Verify refresh token
      let decoded;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch {
        return reply.code(401).send({
          success: false,
          error: 'Invalid or expired refresh token',
        });
      }

      // Check if refresh token is still in store
      const storedUserId = refreshTokenStore.get(refreshToken);
      if (!storedUserId || storedUserId !== decoded.userId) {
        return reply.code(401).send({
          success: false,
          error: 'Refresh token has been revoked',
        });
      }

      // Get user
      const user = userStore.get(decoded.userId);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: 'User not found',
        });
      }

      // Revoke old refresh token
      refreshTokenStore.delete(refreshToken);

      // Generate new tokens
      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        tier: user.subscription_tier,
      });

      // Store new refresh token
      refreshTokenStore.set(tokens.refreshToken, user.id);

      return reply.send({
        success: true,
        data: { tokens },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Token refresh failed',
      });
    }
  });

  // GET /api/auth/me (requires authentication)
  fastify.get('/api/auth/me', {
    preHandler: [authMiddleware],
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const userPayload = request.user as JWTPayload;
      const user = userStore.get(userPayload.userId);

      if (!user) {
        return reply.code(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          subscription_tier: user.subscription_tier,
          created_at: user.created_at,
          last_active: user.last_active,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get user profile',
      });
    }
  });
}

// Export user store for testing
export { userStore, emailIndex, refreshTokenStore };
