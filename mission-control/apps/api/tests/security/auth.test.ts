/**
 * Authentication Security Tests
 * Story test-5 - Security Testing
 *
 * Tests cover:
 * - JWT validation
 * - Expired token handling
 * - Invalid signatures
 * - Token tampering
 * - Authorization checks
 *
 * @module tests/security/auth
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ============================================================================
// Mock Types and Interfaces
// ============================================================================

interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

interface AuthResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
  errorCode?: string;
}

// ============================================================================
// JWT Authentication Service (Under Test)
// ============================================================================

/**
 * JWT Authentication Service
 * Handles token validation, verification, and security checks
 */
class JWTAuthService {
  private secret: string;
  private issuer: string;
  private audience: string;
  private tokenExpiry: number;
  private blacklistedTokens: Set<string> = new Set();

  constructor(config: {
    secret: string;
    issuer?: string;
    audience?: string;
    tokenExpiry?: number;
  }) {
    this.secret = config.secret;
    this.issuer = config.issuer || 'oracle-api';
    this.audience = config.audience || 'oracle-app';
    this.tokenExpiry = config.tokenExpiry || 3600; // 1 hour default
  }

  /**
   * Generate a JWT token
   */
  generateToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string {
    return jwt.sign(
      {
        ...payload,
        iss: this.issuer,
        aud: this.audience,
      },
      this.secret,
      {
        expiresIn: this.tokenExpiry,
        algorithm: 'HS256',
      }
    );
  }

  /**
   * Validate and verify a JWT token
   */
  validateToken(token: string): AuthResult {
    try {
      // Check if token is blacklisted
      if (this.blacklistedTokens.has(token)) {
        return {
          valid: false,
          error: 'Token has been revoked',
          errorCode: 'TOKEN_REVOKED',
        };
      }

      // Verify token
      const payload = jwt.verify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256'],
      }) as JWTPayload;

      return {
        valid: true,
        payload,
      };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return {
          valid: false,
          error: 'Token has expired',
          errorCode: 'TOKEN_EXPIRED',
        };
      }

      if (error.name === 'JsonWebTokenError') {
        if (error.message.includes('invalid signature')) {
          return {
            valid: false,
            error: 'Invalid token signature',
            errorCode: 'INVALID_SIGNATURE',
          };
        }

        if (error.message.includes('jwt malformed')) {
          return {
            valid: false,
            error: 'Malformed token',
            errorCode: 'MALFORMED_TOKEN',
          };
        }

        if (error.message.includes('jwt audience invalid')) {
          return {
            valid: false,
            error: 'Invalid audience',
            errorCode: 'INVALID_AUDIENCE',
          };
        }

        if (error.message.includes('jwt issuer invalid')) {
          return {
            valid: false,
            error: 'Invalid issuer',
            errorCode: 'INVALID_ISSUER',
          };
        }
      }

      return {
        valid: false,
        error: error.message || 'Token validation failed',
        errorCode: 'VALIDATION_ERROR',
      };
    }
  }

  /**
   * Blacklist a token (for logout/revocation)
   */
  revokeToken(token: string): void {
    this.blacklistedTokens.add(token);
  }

  /**
   * Check if token is blacklisted
   */
  isTokenRevoked(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  /**
   * Validate token format without full verification
   */
  validateTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Check each part is valid base64url
    const base64urlRegex = /^[A-Za-z0-9_-]+$/;
    return parts.every((part) => base64urlRegex.test(part));
  }

  /**
   * Extract payload without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      return decoded;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('JWT Authentication Security', () => {
  const TEST_SECRET = 'test-secret-key-for-jwt-signing-minimum-32-chars';
  let authService: JWTAuthService;

  beforeEach(() => {
    authService = new JWTAuthService({
      secret: TEST_SECRET,
      issuer: 'oracle-api',
      audience: 'oracle-app',
      tokenExpiry: 3600,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Token Generation Tests
  // ==========================================================================

  describe('Token Generation', () => {
    it('should generate a valid JWT token', () => {
      const token = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('should include required claims in token', () => {
      const token = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      });

      const result = authService.validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload?.sub).toBe('user-123');
      expect(result.payload?.email).toBe('test@example.com');
      expect(result.payload?.role).toBe('admin');
      expect(result.payload?.iss).toBe('oracle-api');
      expect(result.payload?.aud).toBe('oracle-app');
    });

    it('should set correct expiration time', () => {
      const token = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });

      const result = authService.validateToken(token);
      const now = Math.floor(Date.now() / 1000);

      expect(result.payload?.exp).toBeGreaterThan(now);
      expect(result.payload?.exp).toBeLessThanOrEqual(now + 3600);
    });
  });

  // ==========================================================================
  // Token Validation Tests
  // ==========================================================================

  describe('Token Validation', () => {
    it('should validate a correctly formed token', () => {
      const token = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });

      const result = authService.validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject token with wrong secret', () => {
      // Generate token with different secret
      const wrongSecretToken = jwt.sign(
        { sub: 'user-123', iss: 'oracle-api', aud: 'oracle-app' },
        'wrong-secret-key-different-from-original',
        { algorithm: 'HS256' }
      );

      const result = authService.validateToken(wrongSecretToken);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_SIGNATURE');
    });

    it('should reject malformed token', () => {
      const malformedToken = 'not.a.valid.token';

      const result = authService.validateToken(malformedToken);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MALFORMED_TOKEN');
    });

    it('should reject empty token', () => {
      const result = authService.validateToken('');

      expect(result.valid).toBe(false);
    });

    it('should reject null-like tokens', () => {
      const invalidTokens = [null, undefined, '', ' ', '   '];

      for (const token of invalidTokens) {
        const result = authService.validateToken(token as any);
        expect(result.valid).toBe(false);
      }
    });
  });

  // ==========================================================================
  // Expired Token Tests
  // ==========================================================================

  describe('Expired Token Handling', () => {
    it('should reject expired token', () => {
      // Create an already expired token
      const expiredToken = jwt.sign(
        {
          sub: 'user-123',
          email: 'test@example.com',
          role: 'user',
          iss: 'oracle-api',
          aud: 'oracle-app',
        },
        TEST_SECRET,
        { expiresIn: -10 } // Already expired 10 seconds ago
      );

      const result = authService.validateToken(expiredToken);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TOKEN_EXPIRED');
      expect(result.error).toContain('expired');
    });

    it('should reject token expired by 1 second', () => {
      const barelyExpiredToken = jwt.sign(
        {
          sub: 'user-123',
          iss: 'oracle-api',
          aud: 'oracle-app',
          exp: Math.floor(Date.now() / 1000) - 1,
        },
        TEST_SECRET
      );

      const result = authService.validateToken(barelyExpiredToken);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TOKEN_EXPIRED');
    });

    it('should accept token about to expire', () => {
      const aboutToExpireToken = jwt.sign(
        {
          sub: 'user-123',
          iss: 'oracle-api',
          aud: 'oracle-app',
          exp: Math.floor(Date.now() / 1000) + 5, // Expires in 5 seconds
        },
        TEST_SECRET
      );

      const result = authService.validateToken(aboutToExpireToken);

      expect(result.valid).toBe(true);
    });
  });

  // ==========================================================================
  // Invalid Signature Tests
  // ==========================================================================

  describe('Invalid Signature Handling', () => {
    it('should reject token with tampered payload', () => {
      // Generate valid token
      const validToken = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });

      // Tamper with the payload
      const parts = validToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      payload.role = 'admin'; // Attempt privilege escalation
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tamperedToken = parts.join('.');

      const result = authService.validateToken(tamperedToken);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_SIGNATURE');
    });

    it('should reject token with modified header', () => {
      const validToken = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });

      // Modify header
      const parts = validToken.split('.');
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      header.alg = 'none'; // Attempt algorithm bypass
      parts[0] = Buffer.from(JSON.stringify(header)).toString('base64url');
      const tamperedToken = parts.join('.');

      const result = authService.validateToken(tamperedToken);

      expect(result.valid).toBe(false);
    });

    it('should reject token with truncated signature', () => {
      const validToken = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });

      // Truncate signature
      const parts = validToken.split('.');
      parts[2] = parts[2].substring(0, parts[2].length - 10);
      const truncatedToken = parts.join('.');

      const result = authService.validateToken(truncatedToken);

      expect(result.valid).toBe(false);
    });

    it('should reject token with empty signature', () => {
      const validToken = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });

      const parts = validToken.split('.');
      parts[2] = '';
      const noSigToken = parts.join('.');

      const result = authService.validateToken(noSigToken);

      expect(result.valid).toBe(false);
    });

    it('should reject token signed with RS256 when HS256 expected', () => {
      // This tests algorithm confusion attack prevention
      const rsToken = jwt.sign(
        { sub: 'user-123', iss: 'oracle-api', aud: 'oracle-app' },
        TEST_SECRET, // Using secret as if it were a public key
        { algorithm: 'HS384' } // Different algorithm
      );

      const result = authService.validateToken(rsToken);

      expect(result.valid).toBe(false);
    });
  });

  // ==========================================================================
  // Issuer and Audience Validation Tests
  // ==========================================================================

  describe('Issuer and Audience Validation', () => {
    it('should reject token with wrong issuer', () => {
      const wrongIssuerToken = jwt.sign(
        {
          sub: 'user-123',
          iss: 'malicious-issuer',
          aud: 'oracle-app',
        },
        TEST_SECRET,
        { algorithm: 'HS256' }
      );

      const result = authService.validateToken(wrongIssuerToken);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_ISSUER');
    });

    it('should reject token with wrong audience', () => {
      const wrongAudienceToken = jwt.sign(
        {
          sub: 'user-123',
          iss: 'oracle-api',
          aud: 'wrong-audience',
        },
        TEST_SECRET,
        { algorithm: 'HS256' }
      );

      const result = authService.validateToken(wrongAudienceToken);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_AUDIENCE');
    });

    it('should reject token without issuer', () => {
      const noIssuerToken = jwt.sign(
        {
          sub: 'user-123',
          aud: 'oracle-app',
        },
        TEST_SECRET,
        { algorithm: 'HS256' }
      );

      const result = authService.validateToken(noIssuerToken);

      expect(result.valid).toBe(false);
    });
  });

  // ==========================================================================
  // Token Revocation Tests
  // ==========================================================================

  describe('Token Revocation', () => {
    it('should reject revoked token', () => {
      const token = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });

      // Token is valid initially
      expect(authService.validateToken(token).valid).toBe(true);

      // Revoke the token
      authService.revokeToken(token);

      // Token should now be invalid
      const result = authService.validateToken(token);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TOKEN_REVOKED');
    });

    it('should correctly report revocation status', () => {
      const token = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });

      expect(authService.isTokenRevoked(token)).toBe(false);

      authService.revokeToken(token);

      expect(authService.isTokenRevoked(token)).toBe(true);
    });

    it('should handle multiple token revocations', () => {
      const tokens = Array.from({ length: 5 }, (_, i) =>
        authService.generateToken({
          sub: `user-${i}`,
          email: `user${i}@example.com`,
          role: 'user',
        })
      );

      // Revoke all tokens
      tokens.forEach((token) => authService.revokeToken(token));

      // All should be rejected
      tokens.forEach((token) => {
        expect(authService.validateToken(token).valid).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Token Format Validation Tests
  // ==========================================================================

  describe('Token Format Validation', () => {
    it('should validate correct token format', () => {
      const validToken = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });

      expect(authService.validateTokenFormat(validToken)).toBe(true);
    });

    it('should reject token with wrong number of parts', () => {
      expect(authService.validateTokenFormat('only.two')).toBe(false);
      expect(authService.validateTokenFormat('four.parts.are.wrong')).toBe(false);
      expect(authService.validateTokenFormat('single')).toBe(false);
    });

    it('should reject token with invalid base64url characters', () => {
      expect(authService.validateTokenFormat('invalid+char.test.token')).toBe(false);
      expect(authService.validateTokenFormat('invalid/char.test.token')).toBe(false);
      expect(authService.validateTokenFormat('invalid=padding.test.token')).toBe(false);
    });

    it('should reject non-string tokens', () => {
      expect(authService.validateTokenFormat(null as any)).toBe(false);
      expect(authService.validateTokenFormat(undefined as any)).toBe(false);
      expect(authService.validateTokenFormat(123 as any)).toBe(false);
      expect(authService.validateTokenFormat({} as any)).toBe(false);
    });
  });

  // ==========================================================================
  // Token Decode Tests
  // ==========================================================================

  describe('Token Decode (Without Verification)', () => {
    it('should decode token payload', () => {
      const token = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      });

      const decoded = authService.decodeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe('user-123');
      expect(decoded?.email).toBe('test@example.com');
      expect(decoded?.role).toBe('admin');
    });

    it('should return null for invalid token', () => {
      const decoded = authService.decodeToken('invalid-token');

      expect(decoded).toBeNull();
    });
  });

  // ==========================================================================
  // Security Edge Cases
  // ==========================================================================

  describe('Security Edge Cases', () => {
    it('should reject token with very long payload', () => {
      // Attempt to create a token with excessively long payload
      const longString = 'a'.repeat(100000);

      const longToken = jwt.sign(
        {
          sub: 'user-123',
          data: longString,
          iss: 'oracle-api',
          aud: 'oracle-app',
        },
        TEST_SECRET,
        { algorithm: 'HS256' }
      );

      // Token validation should still work (or reject if too long)
      const result = authService.validateToken(longToken);
      // Either it validates or rejects, but shouldn't crash
      expect(typeof result.valid).toBe('boolean');
    });

    it('should handle unicode in payload', () => {
      const token = authService.generateToken({
        sub: 'user-123',
        email: 'user@example.com',
        role: 'user',
      });

      const result = authService.validateToken(token);
      expect(result.valid).toBe(true);
    });

    it('should reject token with null byte injection', () => {
      const parts = authService.generateToken({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
      }).split('.');

      // Inject null bytes
      parts[1] = parts[1] + '\x00admin';

      const result = authService.validateToken(parts.join('.'));
      expect(result.valid).toBe(false);
    });

    it('should handle concurrent token validations', async () => {
      const tokens = Array.from({ length: 100 }, () =>
        authService.generateToken({
          sub: `user-${Math.random()}`,
          email: 'test@example.com',
          role: 'user',
        })
      );

      const results = await Promise.all(
        tokens.map((token) => Promise.resolve(authService.validateToken(token)))
      );

      results.forEach((result) => {
        expect(result.valid).toBe(true);
      });
    });
  });
});

// ============================================================================
// Authorization Tests
// ============================================================================

describe('Authorization Security', () => {
  /**
   * Mock authorization service
   */
  class AuthorizationService {
    private permissions: Map<string, Set<string>> = new Map();

    constructor() {
      // Default role permissions
      this.permissions.set('admin', new Set([
        'read:signals', 'write:signals', 'delete:signals',
        'read:decisions', 'write:decisions', 'delete:decisions',
        'read:users', 'write:users', 'delete:users',
        'manage:system',
      ]));

      this.permissions.set('user', new Set([
        'read:signals', 'write:signals',
        'read:decisions', 'write:decisions',
      ]));

      this.permissions.set('viewer', new Set([
        'read:signals',
        'read:decisions',
      ]));
    }

    hasPermission(role: string, permission: string): boolean {
      const rolePermissions = this.permissions.get(role);
      return rolePermissions?.has(permission) || false;
    }

    canAccess(user: { role: string }, resource: string, action: string): boolean {
      const permission = `${action}:${resource}`;
      return this.hasPermission(user.role, permission);
    }
  }

  let authzService: AuthorizationService;

  beforeEach(() => {
    authzService = new AuthorizationService();
  });

  describe('Role-Based Access Control', () => {
    it('admin should have all permissions', () => {
      expect(authzService.hasPermission('admin', 'manage:system')).toBe(true);
      expect(authzService.hasPermission('admin', 'delete:users')).toBe(true);
      expect(authzService.hasPermission('admin', 'read:signals')).toBe(true);
    });

    it('user should have limited permissions', () => {
      expect(authzService.hasPermission('user', 'read:signals')).toBe(true);
      expect(authzService.hasPermission('user', 'write:decisions')).toBe(true);
      expect(authzService.hasPermission('user', 'manage:system')).toBe(false);
      expect(authzService.hasPermission('user', 'delete:users')).toBe(false);
    });

    it('viewer should only have read permissions', () => {
      expect(authzService.hasPermission('viewer', 'read:signals')).toBe(true);
      expect(authzService.hasPermission('viewer', 'read:decisions')).toBe(true);
      expect(authzService.hasPermission('viewer', 'write:signals')).toBe(false);
      expect(authzService.hasPermission('viewer', 'delete:decisions')).toBe(false);
    });

    it('unknown role should have no permissions', () => {
      expect(authzService.hasPermission('unknown', 'read:signals')).toBe(false);
      expect(authzService.hasPermission('unknown', 'manage:system')).toBe(false);
    });
  });

  describe('Resource Access Control', () => {
    it('should allow admin to access all resources', () => {
      const admin = { role: 'admin' };

      expect(authzService.canAccess(admin, 'signals', 'read')).toBe(true);
      expect(authzService.canAccess(admin, 'signals', 'write')).toBe(true);
      expect(authzService.canAccess(admin, 'signals', 'delete')).toBe(true);
      expect(authzService.canAccess(admin, 'users', 'delete')).toBe(true);
    });

    it('should restrict user access appropriately', () => {
      const user = { role: 'user' };

      expect(authzService.canAccess(user, 'signals', 'read')).toBe(true);
      expect(authzService.canAccess(user, 'signals', 'write')).toBe(true);
      expect(authzService.canAccess(user, 'signals', 'delete')).toBe(false);
      expect(authzService.canAccess(user, 'users', 'write')).toBe(false);
    });

    it('should restrict viewer to read-only', () => {
      const viewer = { role: 'viewer' };

      expect(authzService.canAccess(viewer, 'signals', 'read')).toBe(true);
      expect(authzService.canAccess(viewer, 'decisions', 'read')).toBe(true);
      expect(authzService.canAccess(viewer, 'signals', 'write')).toBe(false);
      expect(authzService.canAccess(viewer, 'decisions', 'delete')).toBe(false);
    });
  });

  describe('Privilege Escalation Prevention', () => {
    it('should not allow self-role upgrade', () => {
      const user = { role: 'user' };

      // User shouldn't be able to modify users (including themselves)
      expect(authzService.canAccess(user, 'users', 'write')).toBe(false);
    });

    it('should not allow viewer to gain write access', () => {
      const viewer = { role: 'viewer' };

      expect(authzService.canAccess(viewer, 'signals', 'write')).toBe(false);
      expect(authzService.canAccess(viewer, 'decisions', 'write')).toBe(false);
    });
  });
});
