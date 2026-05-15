// src/routes/webhook.routes.js
// IMPORTANT: This router must be mounted BEFORE express.json() in server.js
// so that req.rawBody (Buffer) is available for Paystack signature verification.
// In server.js, mount it as: app.use('/api/webhook', webhookRouter)
// Do NOT use router.use(express.json()) here.
import { Router }  from 'express';
import { verifyWebhookSignature } from '../../services/paystackService.js';
import Order       from '../../models/Order.js';
import Wallet      from '../../models/Wallet.js';
import User        from '../../models/base/user.base.js';
import { cacheGet, cacheSet } from '../../config/redis.js';
import { logger }  from '../../utils/logger.js';
import { dispatchOrder } from '../../controllers/business-logic/orders.controller.js';
import { getSocketServer } from '../../sockets/index.js';

const router = Router();

router.post('/paystack', async (req, res) => {
  // 1. Verify signature — reject anything that doesn't match
  const sig = req.headers['x-paystack-signature'];
  if (!verifyWebhookSignature(req.rawBody || req.body, sig)) {
    logger.warn('Invalid Paystack webhook signature rejected');
    return res.status(400).end();
  }

  // 2. Respond 200 immediately — Paystack retries if we're slow
  res.status(200).end();

  // 3. Process asynchronously so the HTTP response is never delayed
  let event;
  try {
    event = JSON.parse(req.rawBody || req.body);
  } catch (err) {
    logger.error(`Webhook JSON parse error: ${err.message}`);
    return;
  }

  processWebhookEvent(event).catch(err =>
    logger.error(`Webhook processing error: ${err.message}`)
  );
});

async function processWebhookEvent(event) {
  if (event.event !== 'charge.success') return;

  const { reference, metadata, amount } = event.data;

  // Idempotency — skip if already processed
  const processed = await cacheGet(`webhook:${reference}`);
  if (processed) return;
  await cacheSet(`webhook:${reference}`, true, 86400 * 7); // 7-day TTL

  const amountNaira = amount / 100;
  const { type, orderId, userId } = metadata || {};

  // ── Wallet top-up ──
  if (type === 'topup' || !orderId) {
    const wallet = await Wallet.findOne({ owner: userId });
    if (wallet) {
      await wallet.credit(
        amountNaira,
        'Wallet top-up via Paystack',
        null,
        { paystackRef: reference }
      );
      logger.info(`Webhook: topped up ₦${amountNaira} for user ${userId}`);
    }
    return;
  }

  // ── Order payment ──
  if (orderId) {
    const order = await Order.findById(orderId);
    if (!order || order.payment.status === 'paid') return;

    order.payment.status     = 'paid';
    order.payment.paidAt     = new Date();
    order.payment.paystackRef = reference;
    await order.save();
    logger.info(`Webhook: order ${order.orderRef} marked paid`);

    // Trigger auto-dispatch now that payment is confirmed
    const io = getSocketServer();
    dispatchOrder(orderId, io).catch(err =>
      logger.error(`Dispatch failed after webhook: ${err.message}`)
    );
  }
}

export default router;