/**
 * Auth Service Tests
 * Tests JWT generation/verification, password hashing, and auth middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTokens, verifyAccessToken, verifyRefreshToken } from '../../src/services/auth/jwt';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../../src/services/auth/passwordService';
import { getUserId } from '../../src/services/auth/authMiddleware';
import type { JWTPayload } from '../../src/services/auth/jwt';

describe('JWT Service', () => {
  const testPayload: JWTPayload = {
    userId: 'test-user-123',
    email: 'test@oracle.dev',
    tier: 'pro',
  };

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const tokens = generateTokens(testPayload);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('expiresIn');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
      expect(tokens.expiresIn).toBe(900);
    });

    it('should generate different tokens for different users', () => {
      const tokens1 = generateTokens(testPayload);
      const tokens2 = generateTokens({ ...testPayload, userId: 'other-user' });

      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token and return payload', () => {
      const tokens = generateTokens(testPayload);
      const decoded = verifyAccessToken(tokens.accessToken);

      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.tier).toBe(testPayload.tier);
    });

    it('should throw on invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });

    it('should throw on tampered token', () => {
      const tokens = generateTokens(testPayload);
      const tampered = tokens.accessToken + 'x';
      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const tokens = generateTokens(testPayload);
      const decoded = verifyRefreshToken(tokens.refreshToken);

      expect(decoded.userId).toBe(testPayload.userId);
    });

    it('should throw on invalid refresh token', () => {
      expect(() => verifyRefreshToken('invalid-refresh')).toThrow();
    });

    it('should not accept access token as refresh token', () => {
      const tokens = generateTokens(testPayload);
      expect(() => verifyRefreshToken(tokens.accessToken)).toThrow();
    });
  });
});

describe('Password Service', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const hash = await hashPassword('TestPassword123');

      expect(typeof hash).toBe('string');
      expect(hash).toContain(':');
      expect(hash).not.toBe('TestPassword123');
    });

    it('should generate different hashes for same password', async () => {
      const hash1 = await hashPassword('TestPassword123');
      const hash2 = await hashPassword('TestPassword123');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const hash = await hashPassword('TestPassword123');
      const isValid = await verifyPassword('TestPassword123', hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await hashPassword('TestPassword123');
      const isValid = await verifyPassword('WrongPassword', hash);

      expect(isValid).toBe(false);
    });

    it('should reject malformed hash', async () => {
      const isValid = await verifyPassword('TestPassword123', 'not-a-hash');

      expect(isValid).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong password', () => {
      const result = validatePasswordStrength('MyStr0ngPass');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short password', () => {
      const result = validatePasswordStrength('Ab1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase', () => {
      const result = validatePasswordStrength('lowercase123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = validatePasswordStrength('UPPERCASE123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = validatePasswordStrength('NoNumbers!Here');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });
  });
});

describe('getUserId', () => {
  it('should return user ID from request.user when present', () => {
    const mockRequest = {
      user: { userId: 'real-user-123', email: 'test@test.com', tier: 'free' },
    } as any;

    expect(getUserId(mockRequest)).toBe('real-user-123');
  });

  it('should return mock-user-id when no user is set', () => {
    const mockRequest = {} as any;

    expect(getUserId(mockRequest)).toBe('mock-user-id');
  });
});
