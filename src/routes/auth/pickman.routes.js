// src/routes/auth/pickman.routes.js
import { Router } from 'express';
import { signUpPickman, signInPickman } from '../../controllers/auth/pickman.controller.js';
import { validate }     from '../../middleware/validate.js';
import { loginLimiter, signupSlowdown } from '../../middleware/rateLimiter.js';
import {
  pickmanSignupSchema,
  pickmanLoginSchema,
} from '../../../validation/pickman.validation.js';

const router = Router();

// POST /api/auth/pickman/signup
router.post(
  '/signup',
  signupSlowdown,
  validate(pickmanSignupSchema),
  signUpPickman
);

// POST /api/auth/pickman/login
router.post(
  '/login',
  loginLimiter,
  validate(pickmanLoginSchema),
  signInPickman
);

export default router;