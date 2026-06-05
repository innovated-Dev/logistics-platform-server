// src/controllers/auth/auth.base.js
// Shared helpers used by every role-specific auth controller.
// No Express handlers here — just pure utility functions.
import crypto from 'crypto';
import { Session }              from '../../models/Session.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.js';
import env                from '../../config/env.js';
import { getIPAddress }         from '../../utils/ip.js';

// Builds role-specific JWT claims — only what each role actually needs.
function buildTokenPayload(user) {
  const base = {
    status:    user.status,
    firstName: user.firstName,
    initials:  user.initials,
  };

  if (user.role === 'pickman') {
    return {
      ...base,
      vehicleType:  user.vehicleType,
      kycSubmitted: user.kycSubmitted,
    };
  }

  if (user.role === 'merchant') {
    return {
      ...base,
      businessName: user.businessName,
    };
  }

  return base; // customer
}

/**
 * Creates a Session document, issues tokens, and sets the refresh cookie.
 * Returns the raw access token for the response body.
 */
export async function issueTokens(res, user, req, rememberMe = false) {
  const family          = crypto.randomUUID();
  const rawRefresh      = generateRefreshToken(user._id, family);
  const accessToken = generateAccessToken(user._id, user.role, user.tokenVersion ?? 0, buildTokenPayload(user));  // ← add this argument);
  const refreshTokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');

  const ttlDays  = rememberMe ? 30 : 7;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await Session.create({
    userId:           user._id,
    refreshTokenHash,
    family,
    tokenVersion:     user.tokenVersion ?? 0,
    deviceInfo: {
      userAgent: req.get('user-agent') || null,
      platform:  req.headers['x-platform'] || 'web',
    },
    ipAddress: getIPAddress(req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown'),
    lastUsedAt:  new Date(),
    expiresAt,
  });

  res.cookie('refreshToken', rawRefresh, {
    httpOnly: true,
    secure:   env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   ttlDays * 24 * 60 * 60 * 1000,
    path:     '/api/auth',
  });

  return accessToken;
}

/**
 * Revokes a session by hashing the raw refresh token and marking isRevoked.
 * Safe to call even if the session doesn't exist.
 */
export async function revokeSession(rawRefreshToken) {
  if (!rawRefreshToken) return;
  const hash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  await Session.findOneAndUpdate(
    { refreshTokenHash: hash },
    { isRevoked: true }
  );
}

/**
 * Revokes ALL sessions for a user (password reset scenario).
 */
export async function revokeAllSessions(userId) {
  await Session.updateMany({ userId, isRevoked: false }, { isRevoked: true });
}