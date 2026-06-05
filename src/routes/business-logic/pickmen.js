// src/routes/pickmans.routes.js
// All pickman-specific endpoints. Every route requires role === 'pickman'.
import { Router }   from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { apiLimiter, uploadSlowdown } from '../../middleware/rateLimiter.js';
import { uploadSingle } from '../../middleware/upload.js';
import {
  uploadKycDocument,
  getKycStatus,
  updateOnlineStatus,
  updateLocation,
  getEarnings,
} from '../../controllers/business-logic/pickmen.controller.js';
import { updateLocationSchema } from '../../../validation/pickman.validation.js';

// Hard-block rate limiter for uploads (prevent KYC doc spam)
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedis } from '../../config/redis.js';

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,   // 10 minutes
  max:      10,
  store:    new RedisStore({
    sendCommand: (...args) => getRedis().call(...args),
    prefix: 'rl:upload:',
  }),
  message: { success: false, message: 'Too many uploads. Please wait.', code: 'RATE_LIMITED' },
});

const router = Router();
router.use(authenticate, requireRole('pickman'));

// POST /api/pickmans/kyc/upload — multipart upload of one KYC document
router.post(
  '/kyc/upload',
  uploadLimiter,
  uploadSlowdown,
  uploadSingle,
  uploadKycDocument
);

// GET /api/pickmans/kyc/status
router.get('/kyc/status', apiLimiter, getKycStatus);

// PATCH /api/pickmans/status — go online or offline
router.patch('/status', apiLimiter, updateOnlineStatus);

// PATCH /api/pickmans/location — push GPS coordinates during active delivery
router.patch(
  '/location',
  apiLimiter,
  validate(updateLocationSchema),
  updateLocation
);

// GET /api/pickmans/earnings?period=today|week|month|all
router.get('/earnings', apiLimiter, getEarnings);

export default router;