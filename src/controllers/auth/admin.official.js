// src/controllers/admin.controller.js
// FIX: was importing from '../models/User.js' — updated to base discriminator model
import User   from '../../models/base/user.base.js';
import Order  from '../../models/Order.js';
import Wallet from '../../models/Wallet.js';
import Config from '../../models/Config.js';
import { smsKycApproved, smsKycRejected } from '../../services/smsService.js';
import { sendKycApproved, sendKycRejected } from '../../services/emailService.js';
import { cacheDel }    from '../../config/redis.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { ok }          from '../../utils/response.js';

// ── GET /api/admin/stats ──
export async function getStats(req, res, next) {
  try {
    const dayStart = new Date(new Date().setHours(0, 0, 0, 0));

    const [
      activeOrders, totalUsers, ridersOnline, todayOrders,
      todayRevenue, pendingKyc, openDisputes, cityBreakdown,
    ] = await Promise.all([
      Order.countDocuments({ status: { $in: ['assigned', 'pickup_in_progress', 'picked_up', 'in_transit'] } }),
      User.countDocuments({ role: { $in: ['customer', 'merchant', 'rider'] } }),
      User.countDocuments({ role: 'rider', isOnline: true }),
      Order.countDocuments({ createdAt: { $gte: dayStart } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: dayStart }, 'payment.status': 'paid' } },
        { $group: { _id: null, total: { $sum: '$fees.total' }, fees: { $sum: '$fees.platformFee' } } },
      ]),
      User.countDocuments({ role: 'rider', 'kyc.status': 'pending' }),
      Order.countDocuments({ 'dispute.status': { $in: ['open', 'under_review'] } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: dayStart } } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const suspendedRiders = await User.countDocuments({ role: 'rider', status: 'suspended' });
    const recentSignups   = await User.find({ role: { $in: ['customer', 'merchant', 'rider'] } })
      .sort({ createdAt: -1 }).limit(10)
      .select('name email role status createdAt').lean();

    const revenue = todayRevenue[0] || { total: 0, fees: 0 };

    ok(res, {
      activeOrders, totalUsers, ridersOnline, todayOrders,
      todayGMV:        revenue.total,
      todayFees:       revenue.fees,
      pendingKyc,      openDisputes,
      totalRiders:     await User.countDocuments({ role: 'rider' }),
      suspendedRiders, cityBreakdown,
      recentSignups,
    });
  } catch (err) { next(err); }
}

// ── GET /api/admin/kyc-queue ──
export async function getKycQueue(req, res, next) {
  try {
    const riders = await User.find({ role: 'rider', 'kyc.status': 'pending' })
      .select('name phone email kyc guarantor operatingZone createdAt')
      .sort({ createdAt: 1 }).lean();
    ok(res, riders);
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/riders/:riderId/kyc-approve ──
// Validation: approveKycSchema applied on route
export async function approveKyc(req, res, next) {
  try {
    const { riderId } = req.params;
    const { guarantorCallVerified, callNotes } = req.body;

    const rider = await User.findById(riderId);
    if (!rider || rider.role !== 'rider') throw new NotFoundError('Rider not found');

    rider.kyc.status     = 'approved';
    rider.kyc.verifiedAt = new Date();
    rider.kyc.verifiedBy = req.user._id;
    rider.status         = 'active';

    if (guarantorCallVerified) {
      rider.guarantor.callVerified   = true;
      rider.guarantor.callVerifiedAt = new Date();
      rider.guarantor.callVerifiedBy = req.user._id;
      rider.guarantor.callNotes      = callNotes;
    }

    await rider.save();

    smsKycApproved(rider.phone, rider.name);
    sendKycApproved(rider.email, rider.name);

    ok(res, { message: `${rider.name} KYC approved and account activated.` });
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/riders/:riderId/kyc-reject ──
// Validation: rejectKycSchema applied on route
export async function rejectKyc(req, res, next) {
  try {
    const { riderId } = req.params;
    const { reason }  = req.body;

    const rider = await User.findById(riderId);
    if (!rider || rider.role !== 'rider') throw new NotFoundError('Rider not found');

    rider.kyc.status          = 'rejected';
    rider.kyc.rejectionReason = reason;
    await rider.save();

    smsKycRejected(rider.phone, reason);
    sendKycRejected(rider.email, rider.name, reason);

    ok(res, { message: 'KYC rejected. Rider notified via SMS and email.' });
  } catch (err) { next(err); }
}

// ── GET /api/admin/users ──
// Validation: getUsersQuerySchema applied on route (query)
export async function getUsers(req, res, next) {
  try {
    const { role, status, search, city, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (role)   filter.role   = role;
    if (status) filter.status = status;
    if (city)   filter.city   = city;
    if (search) {
      const re  = new RegExp(search, 'i');
      filter.$or = [{ name: re }, { email: re }, { phone: re }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
        .select('-password -nin').lean(),
      User.countDocuments(filter),
    ]);

    ok(res, { users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/users/:id/suspend ──
// Validation: suspendUserSchema applied on route
export async function suspendUser(req, res, next) {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'suspended' },
      { new: true }
    );
    if (!user) throw new NotFoundError('User not found');
    ok(res, { message: `${user.name} suspended.` });
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/users/:id/reactivate ──
export async function reactivateUser(req, res, next) {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true }
    );
    if (!user) throw new NotFoundError('User not found');
    ok(res, { message: `${user.name} reactivated.` });
  } catch (err) { next(err); }
}

// ── GET /api/admin/orders ──
// Validation: getOrdersQuerySchema applied on route (query)
export async function getOrders(req, res, next) {
  try {
    const { status, city, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (city)   filter['pickup.city'] = city;

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit)).limit(parseInt(limit))
        .populate('customer', 'name phone')
        .populate('rider',    'name phone').lean(),
      Order.countDocuments(filter),
    ]);

    ok(res, { orders, total, totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
}

// ── GET /api/admin/disputes ──
export async function getDisputes(req, res, next) {
  try {
    const orders = await Order.find({ 'dispute.status': { $in: ['open', 'under_review'] } })
      .populate('customer', 'name phone')
      .populate('rider',    'name phone').lean();
    ok(res, { disputes: orders });
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/disputes/:orderId/resolve ──
// Validation: resolveDisputeSchema applied on route
export async function resolveDispute(req, res, next) {
  try {
    const { orderId }                          = req.params;
    const { resolution, refundAmount, refundTarget } = req.body;

    const order = await Order.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    order.dispute.status     = 'resolved';
    order.dispute.resolution = resolution;
    order.dispute.resolvedBy = req.user._id;
    order.dispute.resolvedAt = new Date();
    order.status             = 'delivered'; // reset from 'disputed'
    if (refundAmount) order.dispute.refundAmount = refundAmount;
    await order.save();

    if (refundAmount && refundTarget) {
      const targetId = refundTarget === 'customer' ? order.customer : order.rider;
      const wallet   = await Wallet.findOne({ owner: targetId });
      await wallet.credit(refundAmount, `Dispute resolution refund: ${order.orderRef}`, order._id);
    }

    ok(res, { message: 'Dispute resolved.' });
  } catch (err) { next(err); }
}

// ── GET /api/admin/compensation-pool ──
export async function getCompensationPool(req, res, next) {
  try {
    const admin  = await User.findOne({ role: 'admin' }).select('_id').lean();
    const wallet = await Wallet.findOne({ owner: admin?._id }).lean();
    ok(res, {
      compensationPool:  wallet?.compensationPool  || 0,
      insuranceReserve:  wallet?.insuranceReserve  || 0,
    });
  } catch (err) { next(err); }
}

// ── POST /api/admin/compensation-pool/topup ──
// Validation: topupPoolSchema applied on route
export async function topupPool(req, res, next) {
  try {
    const { amount } = req.body;
    const admin  = await User.findOne({ role: 'admin' }).select('_id').lean();
    const wallet = await Wallet.findOne({ owner: admin._id });
    wallet.compensationPool = (wallet.compensationPool || 0) + amount;
    await wallet.save();
    ok(res, { compensationPool: wallet.compensationPool });
  } catch (err) { next(err); }
}

// ── GET /api/admin/config ──
export async function getConfig(req, res, next) {
  try {
    const config = await Config.findOne({ singleton: 'main' });
    ok(res, { config });
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/config ──
// Validation: updateConfigSchema applied on route
export async function updateConfig(req, res, next) {
  try {
    const config = await Config.findOneAndUpdate(
      { singleton: 'main' },
      { ...req.body, updatedBy: req.user._id },
      { new: true, upsert: true }
    );
    await cacheDel('platform:config');
    ok(res, { config, message: 'Platform config updated.' });
  } catch (err) { next(err); }
}

// ── GET/POST /api/admin/zones ──
export async function getZones(req, res, next) {
  try {
    const Zone  = (await import('../models/Zone.js')).default;
    const zones = await Zone.find().lean();
    ok(res, { zones });
  } catch (err) { next(err); }
}

export async function createZone(req, res, next) {
  try {
    const Zone = (await import('../models/Zone.js')).default;
    const zone = await Zone.create(req.body);
    ok(res, { zone });
  } catch (err) { next(err); }
}

// ── GET /api/admin/finance ──
// Validation: financeQuerySchema applied on route (query)
export async function getFinance(req, res, next) {
  try {
    const { period = 'today' } = req.query;
    const now = new Date();
    let from;
    if (period === 'today') from = new Date(new Date().setHours(0, 0, 0, 0));
    if (period === 'week')  from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (period === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);

    const [gmv, pendingPayoutsCount, recentOrders] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: from }, 'payment.status': 'paid' } },
        { $group: { _id: null,
            gmv:    { $sum: '$fees.total' },
            fees:   { $sum: '$fees.platformFee' },
            riders: { $sum: { $subtract: ['$fees.total', '$fees.platformFee'] } },
        }},
      ]),
      Order.countDocuments({ status: 'delivered', 'payment.status': { $ne: 'paid' } }),
      Order.find({ createdAt: { $gte: from } })
        .sort({ createdAt: -1 }).limit(20)
        .populate('customer', 'name').populate('rider', 'name').lean(),
    ]);

    const g = gmv[0] || { gmv: 0, fees: 0, riders: 0 };
    ok(res, {
      todayGMV:           g.gmv,
      todayFees:          g.fees,
      todayRiderPayouts:  g.riders,
      pendingPayoutsCount,
      recentOrders: recentOrders.map(o => ({
        ...o,
        riderPayout: (o.fees?.total || 0) - (o.fees?.platformFee || 0),
      })),
    });
  } catch (err) { next(err); }
}