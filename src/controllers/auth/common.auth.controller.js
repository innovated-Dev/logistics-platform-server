// src/controllers/auth/common.auth.js
import crypto       from 'crypto';
import mongoose     from 'mongoose';
import bcrypt       from 'bcryptjs';
import User         from '../../models/base/user.base.js';
import { Session }  from '../../models/Session.js';
import { issueTokens, revokeSession, revokeAllSessions } from '../auth/auth.base.js';
import { generateAccessToken, verifyRefreshToken, verifyResetToken, generateResetToken } from '../../utils/jwt.js';
import { blockToken }           from '../../config/redis.js';
import { generateOTP }          from '../../utils/otp.js';
import {
  sendPasswordResetOTP,
  sendPasswordResetLink,
  sendPasswordChangeConfirmation,
  sendResendResetOTP,
  sendEmailVerification,
} from '../../services/emailService.js';
import { AuthError, ValidationError, NotFoundError } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import { notifyClient } from '../../sse/sseManager.js';

const OTP_EXPIRY_MS  = 15 * 60 * 1000;
const MAX_OTP_TRIES  = 5;
const MAX_OTP_RESEND = 3;
const RESEND_COOLDOWN = 60 * 1000;

// ── POST /api/auth/refresh ──
export async function refreshToken(req, res, next) {
  try {
    const raw = req.cookies?.refreshToken;
    if (!raw) return next(new AuthError('No refresh token provided'));

    let decoded;
    try {
      decoded = verifyRefreshToken(raw);
    } catch (err) {
      return next(new AuthError('Invalid or expired refresh token'));
    }

    const hash    = crypto.createHash('sha256').update(raw).digest('hex');
    const session = await Session.findOne({ refreshTokenHash: hash });

    // Token not found — possible replay after rotation
    if (!session) {
      // If the family still exists somewhere, it's a reuse attack — revoke the whole family
      const familyExists = await Session.findOne({ family: decoded.family });
      if (familyExists) {
        await Session.updateMany({ family: decoded.family }, { isRevoked: true });
      }
      return next(new AuthError('Refresh token reuse detected. All sessions revoked.'));
    }

    if (session.isRevoked)
      return next(new AuthError('Session has been revoked. Please sign in again.'));

    if (session.expiresAt < new Date())
      return next(new AuthError('Refresh token expired. Please sign in again.'));

    const user = await User.findById(session.userId);
    if (!user) return next(new AuthError('User not found'));

    // tokenVersion mismatch = password was reset on another device
    if (session.tokenVersion !== (user.tokenVersion ?? 0))
      return next(new AuthError('Session invalidated by a password change. Please sign in.'));

    // Rotate: revoke old session, issue new tokens
    await Session.findByIdAndDelete(session._id);
    const accessToken = await issueTokens(res, user, req);

    // Update lastUsedAt on the new session (created inside issueTokens)
    res.json({ success: true, accessToken });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/logout ──
export async function logout(req, res, next) {
  try {
    const raw = req.cookies?.refreshToken;
    await revokeSession(raw);

    // Block the access token for its remaining lifetime
    // req.tokenPayload is set by the authenticate middleware
    const { jti, exp } = req.tokenPayload ?? {};
    if (jti && exp) {
      const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 1);
      await blockToken(jti, ttl);
    }

    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/auth/me ──
export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return next(new NotFoundError('User not found'));
    res.json({ success: true, user: user.toJSON(), authenticated: true });
  } catch (err) {
    next(err);
  }
}


// ── GET /api/auth/verify-email?token=xxx ──
export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    if (!token) return next(new ValidationError('Verification token required'));

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerifyToken:   hash,
      emailVerifyExpires: { $gt: new Date() },
    });
    if (!user) return next(new AuthError('Verification link is invalid or expired'));

    user.emailVerified      = true;
    user.emailVerifyToken   = undefined;
    user.emailVerifyExpires = undefined;
    await user.save({ validateBeforeSave: false });

    await notifyClient(user.email);

    res.json({ 
      success: true, 
      token: generateAccessToken(user._id, user.role, user.tokenVersion ?? 0),
      user: user.toJSON(),
      message: 'Email verified successfully' 
    });

  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/resend-verification ──
export async function resendVerification(req, res, next) {
  try {
    const { email } = req.body; // user tells us who they are by email
  
    // Find user — always respond vaguely to prevent email enumeration
    // (an attacker shouldn't be able to discover which emails are registered)
    const user = await User.findOne({ email });
    if (!user || user.emailVerified) {
      return res.json({ 
        success: true, 
        message: 'If an unverified account exists, a new link has been sent.' 
      });
    }
    // Cooldown check — prevent someone spamming the resend button
    // We infer the last send time by working backward from the expiry
    // (expiry = sendTime + 24hr, so sendTime = expiry - 24hr)
    const lastSentAt = user.emailVerifyExpires 
      ? user.emailVerifyExpires.getTime() - (24 * 60 * 60 * 1000) 
      : 0;
    const timeSinceSent = Date.now() - lastSentAt;
    const COOLDOWN_MS = 60 * 1000; // 1 minute between resends

    if (timeSinceSent < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - timeSinceSent) / 1000);
      return res.status(429).json({ 
        success: false, 
        message: `Please wait ${waitSec} seconds before requesting another link.` 
      });
    }

    // Generate a fresh token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash     = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.emailVerifyToken   = hash;
    user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
    await sendEmailVerification(user.email, user.firstName, verifyUrl);

    res.json({ success: true, message: 'Verification email resent' });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/forgot-password ──
// Validation: forgotPasswordSchema via middleware
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body; // already validated by middleware
    const user = await User.findOne({ email });

    // Always respond 200 — never reveal if account exists
    if (!user) return res.json({ success: true, message: 'If an account exists, an OTP has been sent' });

    const otp       = generateOTP();
    const salt      = await bcrypt.genSalt(10);
    const hashedOTP = await bcrypt.hash(otp, salt);

    user.passwordResetToken    = hashedOTP;
    user. passwordResetExpires   = new Date(Date.now() + OTP_EXPIRY_MS);
    user.resetOtpAttempts      = 0;
    user.resetOtpResendCount   = 0;
    await user.save({ validateBeforeSave: false });

    await sendPasswordResetOTP(user.email, user.name, otp);

    res.json({ success: true, message: 'If an account exists, an OTP has been sent' });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/verify-reset-otp ──
// Validation: verifyResetOTPSchema via middleware
export async function verifyResetPasswordOTP(req, res, next) {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email })
      .select('+passwordResetToken + passwordResetExpires +resetOtpAttempts');

    if (!user?.passwordResetToken)
      return next(new AuthError('No active OTP. Please request a new one.'));

    if (user. passwordResetExpires < Date.now())
      return next(new AuthError('OTP has expired. Please request a new one.'));

    if (user.resetOtpAttempts >= MAX_OTP_TRIES)
      return res.status(429).json({ success: false, message: 'Too many attempts. Request a new OTP.' });

    const isMatch = await bcrypt.compare(otp, user.passwordResetToken);
    if (!isMatch) {
      user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;
      await user.save({ validateBeforeSave: false });
      const remaining = MAX_OTP_TRIES - user.resetOtpAttempts;
      return res.status(400).json({ success: false, message: `Invalid OTP. ${remaining} attempt(s) remaining.`, remaining });
    }

    // OTP correct — extend window for password reset step
    user.passwordResetVerified = true;
    user.resetOtpAttempts      = 0;
    user. passwordResetExpires   = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const resetToken = generateResetToken(user._id);
    const resetUrl   = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await sendPasswordResetLink(user.email, user.name, resetUrl);

    res.json({ success: true, message: 'OTP verified. Check your email for the reset link.', resetToken });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/resend-reset-otp ──
// Validation: resendResetOTPSchema via middleware
export async function resendResetOTP(req, res, next) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email })
      .select('+passwordResetToken + passwordResetExpires +resetOtpResendCount');

    if (!user) return res.json({ success: true, message: 'If an account exists, a new OTP has been sent' });

    if ((user.resetOtpResendCount || 0) >= MAX_OTP_RESEND)
      return res.status(429).json({ success: false, message: 'Maximum resend limit reached. Try again later.' });

    const lastSentAt     = user. passwordResetExpires ? user. passwordResetExpires - OTP_EXPIRY_MS : 0;
    const timeSinceSent  = Date.now() - lastSentAt;
    if (timeSinceSent < RESEND_COOLDOWN) {
      const waitSec = Math.ceil((RESEND_COOLDOWN - timeSinceSent) / 1000);
      return res.status(429).json({ success: false, message: `Please wait ${waitSec}s before requesting a new OTP.`, waitSeconds: waitSec });
    }

    const otp       = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    user.passwordResetToken    = hashedOTP;
    user. passwordResetExpires   = new Date(Date.now() + OTP_EXPIRY_MS);
    user.resetOtpAttempts      = 0;
    user.resetOtpResendCount   = (user.resetOtpResendCount || 0) + 1;
    await user.save({ validateBeforeSave: false });

    const resendsLeft = MAX_OTP_RESEND - user.resetOtpResendCount;
    await sendResendResetOTP(user.email, user.name, otp, resendsLeft);

    res.json({ success: true, message: 'New OTP sent', resendsRemaining: resendsLeft });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/reset-password ──
// Validation: resetPasswordSchema via middleware
// Token comes from Authorization: Bearer <resetToken>
export async function resetPassword(req, res, next) {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return next(new ValidationError('Reset token required in Authorization header'));

    const token = authHeader.slice(7);
    let decoded;
    try {
      decoded = verifyResetToken(token);
    } catch (err) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return next(new AuthError(
        err.name === 'TokenExpiredError'
          ? 'Reset token expired. Please verify OTP again.'
          : 'Invalid reset token.'
      ));
    }

    const { password } = req.body; // validated by middleware

    const user = await User.findOne({ _id: decoded.userId, passwordResetVerified: true })
      .select('+password +passwordResetToken + passwordResetExpires +passwordResetVerified')
      .session(dbSession);

    if (!user) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return next(new AuthError('Invalid reset token'));
    }

    const isSame = await user.matchPassword(password);
    if (isSame) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return next(new ValidationError('New password cannot be the same as your old password'));
    }

    // Set new password and clear all reset fields
    user.password              = password;
    user.passwordResetToken    = undefined;
    user. passwordResetExpires   = undefined;
    user.passwordResetVerified = undefined;
    user.resetOtpAttempts      = 0;
    user.resetOtpResendCount   = 0;
    user.loginAttempts         = 0;
    user.lockUntil             = undefined;

    // Increment tokenVersion — kills ALL sessions on every device
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save({ session: dbSession });

    // Revoke all sessions in DB
    await revokeAllSessions(user._id);

    await dbSession.commitTransaction();
    dbSession.endSession();

    await sendPasswordChangeConfirmation(user.email, user.name);

    res.json({ success: true, message: 'Password reset successful. Please sign in with your new password.' });
  } catch (err) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    next(err);
  }
}

// ── PATCH /api/auth/change-password ──
// Validation: changePasswordSchema via middleware (requires protect)
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return next(new AuthError('Current password is incorrect'));

    user.password     = newPassword;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    // Revoke all other sessions so other devices are kicked
    const raw = req.cookies?.refreshToken;
    await revokeAllSessions(user._id);
    // Re-issue fresh session for THIS device only
    const accessToken = await issueTokens(res, user, req);

    await sendPasswordChangeConfirmation(user.email, user.name);

    res.json({ success: true, message: 'Password changed. Other devices have been signed out.', accessToken });
  } catch (err) {
    next(err);
  }
}