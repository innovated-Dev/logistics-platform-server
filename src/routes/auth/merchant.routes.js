// src/routes/auth/merchant.routes.js
import { Router } from 'express';
import { signUpMerchant, signInMerchant } from '../../controllers/auth/merchant.controller.js';
import { validate }        from '../../middleware/validate.js';
import { loginLimiter, signupSlowdown } from '../../middleware/rateLimiter.js';
import {
  merchantSignupSchema,
  merchantLoginSchema,
} from '../../../validation/merchant.validation.js';

const router = Router();

// POST /api/auth/merchant/signup
router.post(
  '/signup',
  signupSlowdown,
  validate(merchantSignupSchema),
  signUpMerchant
);

// POST /api/auth/merchant/login
router.post(
  '/login',
  loginLimiter,
  validate(merchantLoginSchema),
  signInMerchant
);

export default router;