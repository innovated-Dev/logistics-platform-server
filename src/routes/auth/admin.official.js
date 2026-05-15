// src/routes/admin.routes.js
// All routes here require a valid token AND role === 'admin'.
// authenticate + requireAdmin run as router-level middleware so they
// apply to every handler without repeating them per route.
import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { apiLimiter } from '../../middleware/rateLimiter.js';
import {
  getStats,
  getKycQueue,
  approveKyc,
  rejectKyc,
  getUsers,
  suspendUser,
  reactivateUser,
  getOrders,
  getDisputes,
  resolveDispute,
  getCompensationPool,
  topupPool,
  getConfig,
  updateConfig,
  getZones,
  createZone,
  getFinance,
} from '../../controllers/auth/admin.official.js';

const router = Router();
router.use(authenticate, requireAdmin, apiLimiter);

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get('/stats',    getStats);
router.get('/finance',  getFinance);

// ── KYC ───────────────────────────────────────────────────────────────────
router.get('/kyc-queue',                          getKycQueue);
router.patch('/riders/:riderId/kyc-approve',      approveKyc);
router.patch('/riders/:riderId/kyc-reject',       rejectKyc);

// ── User management ────────────────────────────────────────────────────────
router.get('/users',                              getUsers);
router.patch('/users/:id/suspend',                suspendUser);
router.patch('/users/:id/reactivate',             reactivateUser);

// ── Orders ─────────────────────────────────────────────────────────────────
router.get('/orders',                             getOrders);

// ── Disputes ───────────────────────────────────────────────────────────────
router.get('/disputes',                           getDisputes);
router.patch('/disputes/:orderId/resolve',        resolveDispute);

// ── Compensation pool ──────────────────────────────────────────────────────
router.get('/compensation-pool',                  getCompensationPool);
router.post('/compensation-pool/topup',           topupPool);

// ── Platform config ────────────────────────────────────────────────────────
router.get('/config',                             getConfig);
router.patch('/config',                           updateConfig);

// ── Zone management ────────────────────────────────────────────────────────
router.get('/zones',                              getZones);
router.post('/zones',                             createZone);

export default router;