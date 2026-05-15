// src/routes/orders.routes.js
// All order lifecycle endpoints. authenticate runs on every route.
// Role guards are applied per-route where behaviour differs by role.
import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate }       from '../../middleware/validate.js';
import { apiLimiter, paymentLimiter } from '../../middleware/rateLimiter.js';
import {
  createOrder,
  getQuote,
  getOrders,
  getOrderById,
  cancelOrder,
  confirmDelivery,
  riderArrived,
  rateOrder,
  acceptOrder,
} from '../../controllers/business-logic/orders.controller.js';
import { createOrderSchema } from '../../../validation/order.validation.js';

const router = Router();
router.use(authenticate);

// POST /api/orders/quote — fee preview, no order created
router.post('/quote', apiLimiter, getQuote);

// POST /api/orders — create a new order (customer or merchant only)
router.post(
  '/',
  paymentLimiter,
  requireRole('customer', 'merchant'),
  validate(createOrderSchema),
  createOrder
);

// GET /api/orders — list orders for current user (role-filtered in controller)
router.get('/', apiLimiter, getOrders);

// GET /api/orders/:id
router.get('/:id', apiLimiter, getOrderById);

// PATCH /api/orders/:id/cancel — any party on the order or admin
router.patch('/:id/cancel', apiLimiter, cancelOrder);

// PATCH /api/orders/:id/confirm — customer/merchant confirm delivery (+ COD OTP)
router.patch(
  '/:id/confirm',
  apiLimiter,
  requireRole('customer', 'merchant'),
  confirmDelivery
);

// PATCH /api/orders/:id/arrived — rider marks arrival at delivery address
router.patch(
  '/:id/arrived',
  apiLimiter,
  requireRole('rider'),
  riderArrived
);

// PATCH /api/orders/:id/rate — customer/merchant rates the delivery
router.patch(
  '/:id/rate',
  apiLimiter,
  requireRole('customer', 'merchant'),
  rateOrder
);

// POST /api/orders/:orderId/accept — rider accepts a dispatched job offer
// (also triggered via socket, but HTTP fallback is needed)
router.post(
  '/:orderId/accept',
  apiLimiter,
  requireRole('rider'),
  acceptOrder
);

// POST /api/orders/:orderId/bid — rider submits bid on open-bid order
import { submitBid } from '../../controllers/business-logic/riders.controller.js';
router.post(
  '/:orderId/bid',
  apiLimiter,
  requireRole('rider'),
  submitBid
);

export default router;