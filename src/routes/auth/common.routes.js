// src/routes/auth/common.routes.js
import { Router } from 'express';
import {
  refreshToken,
  logout,
  getMe,
  verifyEmail,
  resendVerification,
  forgotPassword,
  verifyResetPasswordOTP,
  resendResetOTP,
  resetPassword,
  changePassword,
} from '../../controllers/auth/common.auth.controller.js';
import { authenticate }  from '../../middleware/auth.js';
import { validate }      from '../../middleware/validate.js';

// Your schemas live in common.validation.js — import from there directly
import {
  forgotPasswordSchema,
  verifyResetOTPSchema,
  resendResetOTPSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailQuerySchema,
} from '../../../validation/common.validation.js';

import {
  loginLimiter,
  otpVerifyLimiter,
  otpResendLimiter,
  passWordResetLimiter,
  apiLimiter,
} from '../../middleware/rateLimiter.js';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────

// POST /api/auth/refresh
router.post('/refresh', refreshToken);

// GET /api/auth/verify-email?token=xxx
// validate against query params, not body
router.get(
  '/verify-email',
  validate(verifyEmailQuerySchema, 'query'),
  verifyEmail
);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  passWordResetLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);

// POST /api/auth/verify-reset-otp
router.post(
  '/verify-reset-otp',
  otpVerifyLimiter,
  validate(verifyResetOTPSchema),
  verifyResetPasswordOTP
);

// POST /api/auth/resend-reset-otp
router.post(
  '/resend-reset-otp',
  otpResendLimiter,
  validate(resendResetOTPSchema),
  resendResetOTP
);

// POST /api/auth/reset-password — Bearer <resetToken> in Authorization header
router.post(
  '/reset-password',
  passWordResetLimiter,
  validate(resetPasswordSchema),
  resetPassword
);

// ── Protected ─────────────────────────────────────────────────────────────────

// POST /api/auth/logout
// authenticate runs first → sets req.tokenPayload → logout reads jti/exp safely
router.post('/logout', authenticate, logout);

// GET /api/auth/me
router.get('/me', authenticate, getMe);

// POST /api/auth/resend-verification
router.post('/resend-verification', otpResendLimiter, resendVerification);

// PATCH /api/auth/change-password
router.patch(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  changePassword
);

export default router;