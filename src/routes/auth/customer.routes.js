// src/routes/auth/customer.routes.js
import { Router } from 'express';
import { signUpCustomer, signInCustomer } from '../../controllers/auth/customer.controller.js';
import { validate }        from '../../middleware/validate.js';
import { loginLimiter, signupSlowdown } from '../../middleware/rateLimiter.js';
import {
  customerSignupSchema,
  customerLoginSchema,
} from '../../../validation/customer.validation.js';

const router = Router();

// POST /api/auth/customer/signup
router.post(
  '/signup',
  signupSlowdown,
  validate(customerSignupSchema),
  signUpCustomer
);

// POST /api/auth/customer/login
router.post(
  '/login',
  loginLimiter,
  validate(customerLoginSchema),
  signInCustomer
);

export default router;