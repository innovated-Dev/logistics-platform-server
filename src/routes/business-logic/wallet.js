// src/routes/wallet.routes.js
// Wallet top-up, withdrawal, airtime conversion, COD settlement.
// authenticate runs on all routes; rider-only routes have an extra guard.
import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { apiLimiter, paymentLimiter } from '../../middleware/rateLimiter.js';
import {
  getWallet,
  getTransactions,
  listBanks,
  verifyTopup,
  initiateTopup,
  verifyBank,
  withdraw,
  convertAirtime,
  getCodDebit,
  settleCodDebit,
} from '../../controllers/business-logic/wallet.controller.js';

const router = Router();
router.use(authenticate);

// GET /api/wallet
router.get('/',              apiLimiter,     getWallet);

// GET /api/wallet/transactions?page=1&type=credit
router.get('/transactions',  apiLimiter,     getTransactions);

// GET /api/wallet/banks — list Nigerian banks for withdrawal setup
router.get('/banks',         apiLimiter,     listBanks);

// GET /api/wallet/verify?ref=xxx — verify Paystack callback after redirect
router.get('/verify',        apiLimiter,     verifyTopup);

// POST /api/wallet/topup — initialise Paystack payment
router.post('/topup',        paymentLimiter, initiateTopup);

// POST /api/wallet/verify-bank — confirm account name before saving bank details
router.post('/verify-bank',  apiLimiter,     verifyBank);

// POST /api/wallet/withdraw
router.post('/withdraw',     paymentLimiter, withdraw);

// POST /api/wallet/airtime — convert airtime to wallet cash
router.post('/airtime',      apiLimiter,     convertAirtime);

// GET  /api/wallet/cod-debit   — rider sees outstanding platform fee
// POST /api/wallet/settle-cod  — rider clears COD fee from wallet balance
router.get('/cod-debit',   requireRole('rider'), apiLimiter,     getCodDebit);
router.post('/settle-cod', requireRole('rider'), paymentLimiter, settleCodDebit);

export default router;