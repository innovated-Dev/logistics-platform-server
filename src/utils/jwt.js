// src/utils/jwt.js
import env  from '../config/env.js';
import jwt    from 'jsonwebtoken';
import crypto from 'crypto';

const { JsonWebTokenError } = jwt;

// ── Access Token ──
// Carries userId, role, AND jti so Redis blocklist can kill it on logout
// ── Access Token ──


export function generateAccessToken(userId, role, tokenVersion = 0, extra = {}) {
  const jti = crypto.randomUUID();
  return jwt.sign(
      { userId, role, jti, tokenVersion, ...extra },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRE || '15m' }
    );
}

export function verifyAccessToken(token) {
  if (typeof token !== 'string' || !token.includes('.'))
    throw new JsonWebTokenError('jwt malformed');
  return jwt.verify(token, env.JWT_SECRET);
}

// ── Refresh Token ──
// Carries userId and the family ID for reuse-detection chaining
export function generateRefreshToken(userId, family) {
  return jwt.sign({ userId, family }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRE || '7d',
  });
}

export function verifyRefreshToken(token) {
  if (typeof token !== 'string' || !token.includes('.'))
    throw new JsonWebTokenError('jwt malformed');
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET);
}

// ── Reset Token (password reset step 2) ──
export function generateResetToken(userId) {
  return jwt.sign({ userId }, env.JWT_RESET_SECRET, {
    expiresIn: env.JWT_RESET_EXPIRE || '15m',
  });
}

export function verifyResetToken(token) {
  if (typeof token !== 'string' || !token.includes('.'))
    throw new JsonWebTokenError('jwt malformed');
  return jwt.verify(token, env.JWT_RESET_SECRET);
}

// ── Admin tokens (separate secret namespace) ──
export function generateAdminAccessToken(adminId) {
  const jti = crypto.randomUUID();
  return jwt.sign({ userId: adminId, role: 'admin', jti }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE || '15m',
  });
}

export function generateAdminRefreshToken(adminId, customExpiry = null) {
  const family = crypto.randomUUID();
  return jwt.sign({ userId: adminId, family }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: customExpiry || env.REFRESH_TOKEN_EXPIRE || '1d',
  });
}

export const verifyAdminAccessToken  = verifyAccessToken;
export const verifyAdminRefreshToken = verifyRefreshToken;