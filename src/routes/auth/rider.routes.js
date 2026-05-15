// src/routes/auth/rider.routes.js
import { Router } from 'express';
import { signUpRider, signInRider } from '../../controllers/auth/rider.controller.js';
import { validate }     from '../../middleware/validate.js';
import { loginLimiter, signupSlowdown } from '../../middleware/rateLimiter.js';
import {
  riderSignupSchema,
  riderLoginSchema,
} from '../../../validation/rider.validation.js';

const router = Router();

// POST /api/auth/rider/signup
router.post(
  '/signup',
  signupSlowdown,
  validate(riderSignupSchema),
  signUpRider
);

// POST /api/auth/rider/login
router.post(
  '/login',
  loginLimiter,
  validate(riderLoginSchema),
  signInRider
);

export default router;