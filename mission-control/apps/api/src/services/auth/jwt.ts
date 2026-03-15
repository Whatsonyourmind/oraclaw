/**
 * JWT Token Service
 * Handles token generation and verification for ORACLE authentication
 */

import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
  tier: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'oracle-dev-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'oracle-refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export function generateTokens(payload: JWTPayload): TokenPair {
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'oracle-api',
    subject: payload.userId,
  });

  const refreshToken = jwt.sign(
    { userId: payload.userId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: 'oracle-api',
      subject: payload.userId,
    }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
  };
}

export function verifyAccessToken(token: string): JWTPayload {
  const decoded = jwt.verify(token, JWT_SECRET, {
    issuer: 'oracle-api',
  }) as jwt.JwtPayload & JWTPayload;

  return {
    userId: decoded.userId,
    email: decoded.email,
    tier: decoded.tier,
  };
}

export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
    issuer: 'oracle-api',
  }) as jwt.JwtPayload & { userId: string };

  return {
    userId: decoded.userId,
  };
}

export const jwtService = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
};
