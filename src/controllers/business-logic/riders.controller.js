// src/controllers/ridersController.js
// KYC upload, status toggling, location updates, earnings, and bid submission.
import User     from '../../models/base/user.base.js';
import Order    from '../../models/Order.js';
import Wallet   from '../../models/Wallet.js';
import { uploadBuffer }  from '../../config/cloudinary.js';
import { smsKycApproved, smsKycRejected } from '../../services/smsService.js';
import { sendKycApproved, sendKycRejected } from '../../services/emailService.js';
import { dispatchOrder } from './orders.controller.js';
import { getSocketServer } from '../../sockets/index.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';
import { ok } from '../../utils/response.js';
import { cacheDel } from '../../config/redis.js';

const KYC_DOCS = ['nin_document','drivers_licence','vehicle_insurance','plate_photo','guarantor_form'];
const KYC_FIELDS = {
  nin_document:     'kyc.ninDocument',
  drivers_licence:  'kyc.driversLicence',
  vehicle_insurance:'kyc.vehicleInsurance',
  plate_photo:      'kyc.platePhoto',
  guarantor_form:   'kyc.guarantorForm',
};

// ── POST /api/riders/kyc/upload ──
export async function uploadKycDocument(req, res) {
  const { documentType } = req.body;
  if (!KYC_DOCS.includes(documentType)) throw new ValidationError('Invalid document type');
  if (!req.file) throw new ValidationError('No file uploaded');

  const user      = req.user;
  const filename  = `${user._id}-${documentType}-${Date.now()}`;
  const { url, publicId } = await uploadBuffer(req.file.buffer, `kyc/${user._id}`, filename);

  // Update the specific KYC field
  const fieldPath = KYC_FIELDS[documentType];
  const update = { [`${fieldPath}.url`]: url, [`${fieldPath}.publicId`]: publicId };
  await User.findByIdAndUpdate(user._id, { $set: update });

  // Check if all 5 docs are now uploaded → set status to pending
  const fresh = await User.findById(user._id);
  const allUploaded = KYC_DOCS.every(doc => fresh.kyc?.[toCamel(doc)]?.url);
  if (allUploaded && fresh.kyc?.status === 'not_submitted') {
    await User.findByIdAndUpdate(user._id, { $set: { 'kyc.status': 'pending', kycSubmitted: true } });
  }

  ok(res, { url, documentType, allUploaded });
}

// ── GET /api/riders/kyc/status ──
export async function getKycStatus(req, res) {
  const user = await User.findById(req.user._id).select('kyc status');
  ok(res, { status: user.kyc?.status, userStatus: user.status, kyc: user.kyc });
}

// ── PATCH /api/riders/status — go online or offline ──
export async function updateOnlineStatus(req, res) {
  const { status } = req.body;
  if (!['online','offline'].includes(status)) throw new ValidationError('Status must be online or offline');
  if (req.user.status !== 'active') throw new ForbiddenError('Your account is not yet active');
  if (req.user.kyc?.status !== 'approved') throw new ForbiddenError('KYC must be approved before going online');

  const isOnline = status === 'online';
  await User.findByIdAndUpdate(req.user._id, { isOnline, lastSeen: new Date() });

  const io = getSocketServer();
  io?.to(`riders:${req.user.city}`).emit('rider:status_changed', {
    riderId: req.user._id,
    isOnline,
  });

  ok(res, { isOnline, message: isOnline ? 'You are now online — receiving job offers.' : 'You are offline.' });
}

// ── PATCH /api/riders/location — broadcast GPS position ──
// Called by the rider's frontend on a timer (e.g. every 3 seconds during active delivery).
export async function updateLocation(req, res) {
  const { lat, lng, orderId } = req.body;
  if (!lat || !lng) throw new ValidationError('lat and lng required');

  // Update rider's current location in DB
  await User.findByIdAndUpdate(req.user._id, {
    currentLocation: { lat, lng, updatedAt: new Date() },
    lastSeen: new Date(),
  });

  // If they have an active order, append to GPS trail and broadcast
  if (orderId) {
    await Order.findOneAndUpdate(
      { _id: orderId, rider: req.user._id, status: { $in: ['assigned','pickup_in_progress','picked_up','in_transit'] } },
      { $push: { gpsTrail: { lat, lng, timestamp: new Date() } } }
    );
    const io = getSocketServer();
    io?.to(`order:${orderId}`).emit('rider:moved', { lat, lng, riderId: req.user._id });
  }

  ok(res, { lat, lng });
}

// ── POST /api/orders/:orderId/bid — submit bid on merchant open-bid order ──
export async function submitBid(req, res) {
  const { orderId } = req.params;
  const { amount, note } = req.body;
  if (!amount || amount <= 0) throw new ValidationError('Bid amount must be positive');

  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError('Order not found');
  if (order.assignmentMode !== 'open_bid') throw new ValidationError('This order does not accept bids');
  if (order.bidWindowEnds && new Date() > order.bidWindowEnds) throw new ValidationError('Bidding window has closed');
  if (order.budgetCap && amount > order.budgetCap) throw new ValidationError(`Bid exceeds merchant budget cap of ₦${order.budgetCap.toLocaleString()}`);

  // Prevent duplicate bids from same rider
  const existing = order.bids.find(b => b.rider.toString() === req.user._id.toString());
  if (existing) throw new ValidationError('You have already bid on this order');

  order.bids.push({ rider: req.user._id, amount, note });
  await order.save();

  // Notify merchant in real time
  const io = getSocketServer();
  io?.to(`user:${order.merchant || order.customer}`).emit('new:bid', {
    orderId, bidder: { name: req.user.fullName, rating: req.user.rating, vehicleType: req.user.vehicleType },
    amount, note,
  });

  ok(res, { message: 'Bid submitted successfully' });
}

// ── GET /api/riders/earnings ──
export async function getEarnings(req, res) {
  const { period = 'today' } = req.query;
  const now = new Date();
  let from;
  if (period === 'today')  from = new Date(now.setHours(0,0,0,0));
  if (period === 'week')   from = new Date(now - 7*24*60*60*1000);
  if (period === 'month')  from = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'all')    from = new Date(0);

  const [wallet, deliveries] = await Promise.all([
    Wallet.findOne({ owner: req.user._id }),
    Order.countDocuments({ rider: req.user._id, status: 'delivered', deliveredAt: { $gte: from } }),
  ]);

  const periodTransactions = (wallet?.transactions || []).filter(t =>
    t.type === 'credit' && new Date(t.createdAt) >= from
  );
  const periodEarnings = periodTransactions.reduce((sum, t) => sum + t.amount, 0);

  ok(res, {
    balance:         wallet?.balance || 0,
    codPendingDebit: wallet?.codPendingDebit || 0,
    periodEarnings,
    deliveries,
    transactions:    (wallet?.transactions || []).slice(-50).reverse(),
    bankDetails:     wallet?.bankDetails,
  });
}

// ── KYC doc key to camelCase ──
function toCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}