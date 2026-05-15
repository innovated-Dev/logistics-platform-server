// src/middleware/auth.js
import { verifyAccessToken }  from '../utils/jwt.js';
import { isTokenBlocked }     from '../config/redis.js';
import { AuthError, ForbiddenError } from '../utils/errors.js';
import User from '../models/base/user.base.js';

// ── protect ──
// Verifies the access token from Authorization header,
// checks it hasn't been Redis-blocklisted (logout),
// and checks tokenVersion matches the user's current version.
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return next(new AuthError('No access token provided'));

    const token = header.slice(7);
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      return next(new AuthError(
        err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token'
      ));
    }

    // Check Redis blocklist (token was invalidated on logout)
    if (decoded.jti && await isTokenBlocked(decoded.jti))
      return next(new AuthError('Token has been invalidated'));

    // Fetch user and check tokenVersion (password reset increments this)
    const user = await User.findById(decoded.userId).select('+tokenVersion');
    if (!user)
      return next(new AuthError('User no longer exists'));

    if (user.tokenVersion !== decoded.tokenVersion)
      return next(new AuthError('Session invalidated. Please sign in again.'));

    req.user      = user;
    req.tokenPayload = decoded; // full payload for logout jti extraction
    next();
  } catch (err) {
    next(err);
  }
};

export const authenticate = protect;

// ==== optional role ====
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(); // unauthenticated is fine
  // reuse protect logic but swallow auth errors
  try {
    const token = header.slice(7);
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);
    if (user) req.user = user;
  } catch(_) {}
  next();
}

// ── requireRole ──
// Factory: requireRole('admin') or requireRole('customer', 'merchant')
// Must come AFTER protect in the middleware chain.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user)
      return next(new AuthError('Not authenticated'));

    if (!roles.includes(req.user.role))
      return next(new ForbiddenError(
        `Access denied. Required role: ${roles.join(' or ')}`
      ));

    next();
  };
}

// ── Convenience role guards ──
// Usage: router.get('/profile', protect, requireCustomer, handler)
export const requireCustomer = requireRole('customer');
export const requireMerchant = requireRole('merchant');
export const requireRider    = requireRole('rider');
export const requireAdmin    = requireRole('admin');
export const requireSupport  = requireRole('support');