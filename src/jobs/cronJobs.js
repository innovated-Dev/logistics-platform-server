// src/jobs/cronJobs.js — Scheduled background tasks
import cron    from 'node-cron';
import User    from '../models/base/user.base.js';
import Order   from '../models/Order.js';
import Wallet  from '../models/Wallet.js';
import { logger } from '../utils/logger.js';
import { sendSMS } from '../services/smsService.js';

export function startCronJobs() {
  // ── Every 5 minutes: mark riders as offline if lastSeen > 10 min ago ──
  // Handles riders who lose network without explicitly going offline.
  cron.schedule('*/5 * * * *', async () => {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const result = await User.updateMany(
      { role: 'rider', isOnline: true, lastSeen: { $lt: cutoff } },
      { isOnline: false }
    );
    if (result.modifiedCount > 0) {
      logger.info(`Cron: marked ${result.modifiedCount} riders offline (stale heartbeat)`);
    }
  });

  // ── Every midnight: send COD debit reminders to riders with outstanding fees ──
  cron.schedule('0 0 * * *', async () => {
    const wallets = await Wallet.find({ codPendingDebit: { $gt: 0 } })
      .populate('owner', 'phone firstName');
    for (const w of wallets) {
      if (w.owner?.phone) {
        await sendSMS(w.owner.phone,
          `OffScape: You have ₦${w.codPendingDebit.toLocaleString()} in uncleared COD fees. Settle via your wallet to unlock withdrawals.`
        );
      }
    }
    logger.info(`Cron: sent COD reminders to ${wallets.length} riders`);
  });

  // ── Every Monday 8am: weekly earnings summary to riders ──
  cron.schedule('0 8 * * 1', async () => {
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const topRiders = await Order.aggregate([
      { $match: { status: 'delivered', deliveredAt: { $gte: weekStart } } },
      { $group: { _id: '$rider', earnings: { $sum: { $subtract: ['$fees.total','$fees.platformFee'] } }, trips: { $sum: 1 } } },
      { $sort: { earnings: -1 } },
      { $limit: 100 },
    ]);
    for (const r of topRiders) {
      const user = await User.findById(r._id).select('phone firstName');
      if (user?.phone) {
        await sendSMS(user.phone,
          `OffScape Week Summary: ${r.trips} deliveries, ₦${r.earnings.toLocaleString()} earned. Keep it up, ${user.firstName}!`
        );
      }
    }
    logger.info(`Cron: sent weekly summaries to ${topRiders.length} riders`);
  });

  logger.info('✅  Cron jobs started');
}