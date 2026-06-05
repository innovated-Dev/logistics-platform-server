// src/routes/zones.routes.js
import { Router }       from 'express';
import { apiLimiter }   from '../../middleware/rateLimiter.js';
import { optionalAuth } from '../../middleware/auth.js';
import {
  getZones,
  resolveZoneByCoords,
  geocodeAndResolve,
} from '../../controllers/business-logic/zones.controller.js';

const router = Router();

// Rate limit all zone endpoints
router.use(apiLimiter);

// GET /api/zones?city=ibadan
// Public — pickman signup + customer order form fetch zones here
router.get('/', optionalAuth, getZones);

// GET /api/zones/resolve?lat=7.38&lng=3.95
// Public — order creation detects pickup zone from coordinates
router.get('/resolve', resolveZoneByCoords);

// POST /api/zones/geocode
// Public — customer address → coordinates + zone detection
router.post('/geocode', geocodeAndResolve);

export default router;