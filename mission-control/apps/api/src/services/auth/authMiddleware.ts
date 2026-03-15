/**
 * Auth Middleware
 * Fastify preHandler hook that validates JWT from Authorization header
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, JWTPayload } from './jwt.js';

// Extend Fastify request type with user information
declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

/**
 * Authentication middleware - validates JWT token from Authorization header
 * Attaches user payload to request.user
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      reply.code(401).send({
        success: false,
        error: 'Authorization header is required',
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      reply.code(401).send({
        success: false,
        error: 'Authorization header must use Bearer scheme',
      });
      return;
    }

    const token = authHeader.substring(7);

    if (!token) {
      reply.code(401).send({
        success: false,
        error: 'Token is required',
      });
      return;
    }

    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';

    if (message.includes('expired')) {
      reply.code(401).send({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    reply.code(401).send({
      success: false,
      error: 'Invalid or malformed token',
    });
  }
}

/**
 * Optional auth middleware - extracts user if token is present, but does not require it
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token) {
        const payload = verifyAccessToken(token);
        request.user = payload;
      }
    }
  } catch {
    // Optional auth - don't fail if token is invalid
  }
}

/**
 * Helper to get user ID from request, with fallback for backward compatibility
 */
export function getUserId(request: FastifyRequest): string {
  if (request.user) {
    return request.user.userId;
  }
  // Fallback for backward compatibility during migration
  return 'mock-user-id';
}

export { JWTPayload };
