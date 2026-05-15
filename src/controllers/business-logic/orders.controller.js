// src/controllers/order.controller.js
import Order   from '../../models/Order.js';
import Wallet  from '../../models/Wallet.js';
import Config  from '../../models/Config.js';
import { env } from '../../config/env.js';
import { assignRiderToOrder } from '../../services/orderService.js';

// FIX: was '../models/User.js' (old monolithic model)
import User from '../../models/base/user.base.js';

import { calculateFees }  from '../../services/feeCalculator.js';
import { geocodeAddress, resolveZone, findNearestRiders } from '../../services/zoneEngine.js';
import { initializePayment } from '../../services/paystackService.js';
import {
  sendOTP, verifyOTP,
  smsOrderPlaced, smsRiderAssigned,
  smsOrderDelivered, smsRiderPayout, smsCodOtp,
} from '../../services/smsService.js';
import { NotFoundError, ValidationError, PaymentError, ForbiddenError } from '../../utils/errors.js';
import { ok, created } from '../../utils/response.js';
import { getSocketServer } from '../../sockets/index.js';
import { logger } from '../../utils/logger.js';

// ── POST /api/orders ──
// Validation: createOrderSchema applied on route
export async function createOrder(req, res, next) {
  try {
    const io = getSocketServer();
    const { pickup, delivery, package: pkg, payment, assignmentMode, budgetCap } = req.body;

    const pickupCoords   = await geocodeAddress(pickup.address, req.user.city);
    const deliveryCoords = await geocodeAddress(delivery.address, req.user.city);

    const pickupZone   = await resolveZone(pickupCoords.lat, pickupCoords.lng);
    const deliveryZone = await resolveZone(deliveryCoords.lat, deliveryCoords.lng);

    // Server-side fee calc — frontend value is never trusted
    const fees = await calculateFees({
      pickupCoords,
      deliveryCoords,
      packageCategory: pkg.category,
      weight:          pkg.weight  || 1,
      speed:           pkg.speed   || 'express',
      declaredValue:   pkg.declaredValue || 0,
      insurePackage:   pkg.insured || false,
      paymentMethod:   payment.method,
    });

    const orderData = {
      customer:       req.user._id,
      pickup:         { ...pickup,   coordinates: pickupCoords,   zone: pickupZone?._id },
      delivery:       { ...delivery, coordinates: deliveryCoords, zone: deliveryZone?._id },
      package:        pkg,
      fees,
      payment:        { method: payment.method, status: 'pending' },
      assignmentMode: assignmentMode || 'auto',
      timeline:       [{ status: 'pending', note: 'Order created', actor: 'customer' }],
    };

    if (req.user.role === 'merchant') {
      orderData.merchant  = req.user._id;
      orderData.budgetCap = budgetCap || null;
    }

    // ── Payment handling ──
    if (payment.method === 'wallet') {
      const wallet = await Wallet.findOne({ owner: req.user._id });
      if (!wallet || wallet.balance < fees.total) {
        throw new PaymentError(
          `Insufficient wallet balance. You have ₦${wallet?.balance?.toLocaleString() || 0}, need ₦${fees.total.toLocaleString()}.`
        );
      }
      await wallet.debit(fees.total, 'Order payment', null);
      orderData.payment.status = 'paid';
      orderData.payment.paidAt  = new Date();

      const adminWallet = await Wallet.findOne({ owner: await getAdminId() });
      if (adminWallet) {
        await adminWallet.credit(fees.platformFee, 'Platform fee credit', null);
        if (fees.insurance > 0) {
          adminWallet.insuranceReserve = (adminWallet.insuranceReserve || 0) + fees.insurance;
          await adminWallet.save();
        }
      }
    } else if (payment.method === 'cod') {
      const otpHash = await sendOTP(null, '{{OTP}}');
      orderData.cod    = { otpHash, collected: false, feeDebited: false };
      orderData.payment.status = 'pending';
    }
    // paystack: status stays 'pending' — webhook marks it paid

    const order = await Order.create(orderData);

    // Paystack: return auth URL immediately
    if (payment.method === 'paystack') {
      const psData = await initializePayment({
        email:       req.user.email,
        amount:      fees.total,
        reference:   `OS-${order._id}-${Date.now()}`,
        callbackUrl: `${env.FRONTEND_URL}/payment/verify`,
        metadata:    { orderId: order._id, userId: req.user._id },
      });
      order.payment.paystackRef = psData.reference;
      await order.save();
      return created(res, { order, authorizationUrl: psData.authorization_url });
    }

    // Auto-dispatch
    const readyForDispatch = payment.method === 'wallet' || payment.method === 'cod';
    if (readyForDispatch && orderData.assignmentMode === 'auto') {
      dispatchOrder(order._id, io).catch(err =>
        logger.error(`Dispatch failed for order ${order._id}: ${err.message}`)
      );
    } else if (orderData.assignmentMode === 'open_bid') {
      order.bidWindowEnds = new Date(Date.now() + 5 * 60 * 1000);
      await order.save();
      io.to(`zone:${pickupZone?._id}`).emit('new:bid:opportunity', {
        orderId:    order._id,
        orderRef:   order.orderRef,
        pickup:     pickup.address,
        delivery:   delivery.address,
        budgetCap:  order.budgetCap,
        windowEnds: order.bidWindowEnds,
      });
    }

    smsOrderPlaced(req.user.phone, order.orderRef, null);
    created(res, { order });
  } catch (err) {
    next(err);
  }
}

// ── Background dispatch (unchanged, just wrapped with try/catch) ──
export async function dispatchOrder(orderId, io) {
  try {
    const order = await Order.findById(orderId).lean();
    if (!order || !order.pickup?.zone) {
      logger.warn(`Cannot dispatch order ${orderId}: no pickup zone`);
      return;
    }

    const riders = await findNearestRiders(order.pickup.zone, order.pickup.coordinates, 3);
    if (!riders.length) {
      logger.warn(`No available riders for order ${orderId}`);
      io?.to(`user:${order.customer}`).emit('order:no_riders', {
        orderId,
        message: 'No riders available in your zone right now. Please try again shortly.',
      });
      return;
    }

    const cfg        = await Config.findOne({ singleton: 'main' });
    const timeoutSec = cfg?.assignment?.timeoutSeconds || 90;
    const logEntries = riders.map(r => ({ rider: r._id, offeredAt: new Date(), response: 'pending' }));

    await Order.findByIdAndUpdate(orderId, { $push: { assignmentLog: { $each: logEntries } } });

    for (const rider of riders) {
      io?.to(`user:${rider._id}`).emit('new:job:offer', {
        orderId:   order._id,
        orderRef:  order.orderRef,
        pickup:    { address: order.pickup.address, coordinates: order.pickup.coordinates },
        delivery:  { address: order.delivery.address },
        fees:      order.fees,
        package:   order.package,
        timeoutSec,
      });
    }

    setTimeout(async () => {
      const fresh = await Order.findById(orderId).lean();
      if (fresh && fresh.status === 'pending') {
        logger.info(`Order ${orderId}: timeout — retrying dispatch`);
        dispatchOrder(orderId, io);
      }
    }, timeoutSec * 1000);
  } catch (err) {
    logger.error(`dispatchOrder error for ${orderId}: ${err.message}`);
  }
}

// ── POST /api/riders/accept/:orderId ──
// Validation: no body schema needed — orderId is a URL param
export async function acceptOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    const riderId = req.user._id;
    const io = getSocketServer();

    const order = await Order.findOneAndUpdate(
      { _id: orderId, status: 'pending' },
      {
        $set:  { rider: riderId, status: 'assigned' },
        $push: { timeline: { status: 'assigned', note: 'Rider accepted', actor: 'rider' } },
      },
      { new: true }
    ).populate('customer', 'name phone');

    if (!order)
      throw new ValidationError('Order is no longer available (already assigned or cancelled)');

    await Order.updateOne(
      { _id: orderId, 'assignmentLog.rider': riderId },
      { $set: { 'assignmentLog.$.response': 'accepted', 'assignmentLog.$.respondedAt': new Date() } }
    );

    const rider = req.user;
    io?.to(`user:${order.customer._id}`).emit('order:rider_assigned', {
      orderId,
      rider: { name: rider.name, phone: rider.phone, rating: rider.rating },
    });
    smsRiderAssigned(order.customer.phone, rider.name, rider.phone, order.orderRef);

    ok(res, { order, message: 'Job accepted! Navigate to pickup location.' });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/orders/:id/cancel ──
// Validation: cancelOrderSchema applied on route
export async function cancelOrder(req, res, next) {
  try {
    const { id }    = req.params;
    const { reason } = req.body;
    const io = getSocketServer();

    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('Order not found');

    const isCustomer = order.customer.toString() === req.user._id.toString();
    const isMerchant = order.merchant?.toString() === req.user._id.toString();
    const isRider    = order.rider?.toString()    === req.user._id.toString();
    const isAdmin    = req.user.role === 'admin';
    if (!isCustomer && !isMerchant && !isRider && !isAdmin)
      throw new ForbiddenError('Not authorised to cancel this order');

    const minutesSinceCreated = (Date.now() - new Date(order.createdAt).getTime()) / 60000;
    const riderEnRoute = order.status === 'pickup_in_progress';
    const cfg = await Config.findOne({ singleton: 'main' });
    const earlyWindowMin = cfg?.cancellation?.earlyWindowMinutes || 5;

    let cancellationType, compensationAmount = 0, lateFeeCharged = 0;

    if (minutesSinceCreated <= earlyWindowMin && !riderEnRoute) {
      cancellationType   = 'early';
      compensationAmount = cfg?.cancellation?.earlyCompensation || 300;

      if (order.payment.status === 'paid' && order.payment.method !== 'cod') {
        const wallet = await Wallet.findOne({ owner: order.customer });
        await wallet.credit(order.fees.total, `Refund: cancelled order ${order.orderRef}`, order._id);
      }

      if (order.rider) {
        const adminWallet = await Wallet.findOne({ owner: await getAdminId() });
        if (adminWallet && adminWallet.compensationPool >= compensationAmount) {
          adminWallet.compensationPool -= compensationAmount;
          await adminWallet.save();
          const riderWallet = await Wallet.findOne({ owner: order.rider });
          await riderWallet.credit(
            compensationAmount,
            `Cancellation compensation: ${order.orderRef}`,
            order._id
          );
        }
      }
    } else if (riderEnRoute) {
      cancellationType = 'late';
      const lateRate   = cfg?.cancellation?.lateCancelChargeRate || 50;
      lateFeeCharged   = Math.round(order.fees.total * (lateRate / 100));

      if (isCustomer) {
        const wallet = await Wallet.findOne({ owner: order.customer });
        try {
          await wallet.debit(lateFeeCharged, `Late cancellation fee: ${order.orderRef}`, order._id);
        } catch (_) {
          lateFeeCharged = 0;
        }
        if (order.rider && lateFeeCharged > 0) {
          const riderWallet = await Wallet.findOne({ owner: order.rider });
          await riderWallet.credit(
            lateFeeCharged,
            `Late cancellation payment: ${order.orderRef}`,
            order._id
          );
        }
      }
    } else {
      cancellationType = 'early';
      if (order.payment.status === 'paid' && order.payment.method !== 'cod') {
        const wallet = await Wallet.findOne({ owner: order.customer });
        await wallet.credit(order.fees.total, `Refund: cancelled order ${order.orderRef}`, order._id);
      }
    }

    order.status       = 'cancelled';
    order.cancellation = {
      cancelledBy: req.user.role,
      reason,
      cancelledAt: new Date(),
      type:        cancellationType,
      compensationPaid:   compensationAmount > 0,
      compensationAmount,
      lateFeeCharged,
    };
    order.timeline.push({ status: 'cancelled', note: reason || 'Cancelled', actor: req.user.role });
    await order.save();

    if (order.rider) io?.to(`user:${order.rider}`).emit('order:cancelled', { orderId: id, reason });
    io?.to(`user:${order.customer}`).emit('order:cancelled', { orderId: id, reason });

    ok(res, { order, cancellationType, compensationAmount, lateFeeCharged });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/orders/:id/confirm ──
// Validation: confirmDeliverySchema applied on route
export async function confirmDelivery(req, res, next) {
  try {
    const { id }  = req.params;
    const { otp } = req.body;
    const io = getSocketServer();

    const order = await Order.findById(id).select('+cod.otpHash');
    if (!order) throw new NotFoundError('Order not found');
    if (order.status !== 'in_transit')
      throw new ValidationError('Order is not in transit');

    // COD gate: OTP must be present and correct
    if (order.payment.method === 'cod') {
      if (!otp) throw new ValidationError('OTP is required for cash-on-delivery confirmation');
      const valid = await verifyOTP(otp, order.cod.otpHash);
      if (!valid) throw new ValidationError('Incorrect OTP. Ask the customer to check their SMS.');
      order.cod.otpVerified   = true;
      order.cod.otpVerifiedAt = new Date();
    }

    order.status      = 'delivered';
    order.deliveredAt = new Date();
    order.timeline.push({ status: 'delivered', note: 'Confirmed by customer/OTP', actor: 'customer' });
    await order.save();

    const riderEarnings = order.fees.total - order.fees.platformFee;

    if (order.payment.method !== 'cod') {
      const riderWallet = await Wallet.findOne({ owner: order.rider });
      await riderWallet.credit(riderEarnings, `Delivery payout: ${order.orderRef}`, order._id);
    } else {
      const riderWallet = await Wallet.findOne({ owner: order.rider });
      riderWallet.codPendingDebit = (riderWallet.codPendingDebit || 0) + order.fees.platformFee;
      order.cod.feeDebited = true;
      await riderWallet.save();
      await order.save();
    }

    await User.findByIdAndUpdate(order.rider, { $inc: { totalDeliveries: 1 } });

    io?.to(`user:${order.rider}`).emit('order:delivered', { orderId: id, earnings: riderEarnings });
    smsOrderDelivered(order.delivery.recipientPhone || '', order.orderRef);

    if (order.payment.method !== 'cod') {
      const riderDoc = await User.findById(order.rider).select('phone').lean();
      smsRiderPayout(riderDoc?.phone || '', riderEarnings, order.orderRef);
    }

    ok(res, { order, riderEarnings });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/orders/:id/rider-arrived ──
export async function riderArrived(req, res, next) {
  try {
    const { id } = req.params;
    const order  = await Order.findById(id).select('+cod.otpHash');
    if (!order) throw new NotFoundError('Order not found');

    order.timeline.push({ status: 'in_transit', note: 'Rider arrived at delivery point', actor: 'rider' });
    await order.save();

    if (order.payment.method === 'cod' && order.cod?.otpHash) {
      const bcrypt    = await import('bcryptjs');
      const rawOtp    = String(Math.floor(100000 + Math.random() * 900000));
      order.cod.otpHash   = await bcrypt.hash(rawOtp, 10);
      order.cod.otpSentAt = new Date();
      await order.save();

      const customer = await User.findById(order.customer).select('phone').lean();
      await smsCodOtp(customer?.phone || '', rawOtp);
    }

    const io = getSocketServer();
    io?.to(`user:${order.customer}`).emit('rider:arrived', { orderId: id });

    ok(res, {
      message: order.payment.method === 'cod' ? 'OTP sent to customer.' : 'Arrival recorded.',
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/orders ──
// Validation: listOrdersQuerySchema applied on route (query)
export async function getOrders(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip   = (parseInt(page) - 1) * parseInt(limit);
    const filter = {};

    if (req.user.role === 'customer')      filter.customer = req.user._id;
    else if (req.user.role === 'merchant') filter.merchant = req.user._id;
    else if (req.user.role === 'rider')    filter.rider    = req.user._id;

    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('customer', 'name phone')
        .populate('rider',    'name phone rating')
        .populate('pickup.zone',   'name')
        .populate('delivery.zone', 'name')
        .lean(),
      Order.countDocuments(filter),
    ]);

    ok(res, { orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/orders/:id ──
export async function getOrderById(req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name phone email')
      .populate('rider',    'name phone rating')
      .populate('pickup.zone',   'name city')
      .populate('delivery.zone', 'name city');

    if (!order) throw new NotFoundError('Order not found');

    const isParty = [
      order.customer?._id?.toString(),
      order.merchant?.toString(),
      order.rider?._id?.toString(),
    ].includes(req.user._id.toString());

    if (!isParty && !['admin', 'support'].includes(req.user.role))
      throw new ForbiddenError('You do not have access to this order');

    ok(res, { order });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/orders/quote ──
// Validation: getQuoteSchema applied on route
export async function getQuote(req, res, next) {
  try {
    const { pickup, delivery, package: pkg, paymentMethod } = req.body;

    const pickupCoords = (pickup.lat && pickup.lng)
      ? { lat: pickup.lat, lng: pickup.lng }
      : await geocodeAddress(pickup.address, pickup.city);

    const deliveryCoords = (delivery.lat && delivery.lng)
      ? { lat: delivery.lat, lng: delivery.lng }
      : await geocodeAddress(delivery.address, delivery.city);

    const fees = await calculateFees({
      pickupCoords,
      deliveryCoords,
      packageCategory: pkg?.category      || 'small_parcel',
      weight:          pkg?.weight        || 1,
      speed:           pkg?.speed         || 'express',
      declaredValue:   pkg?.declaredValue || 0,
      insurePackage:   pkg?.insured       || false,
      paymentMethod:   paymentMethod      || 'paystack',
    });

    ok(res, { fees, distanceKm: fees.distanceKm });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/orders/:id/rate ──
// Validation: rateOrderSchema applied on route
export async function rateOrder(req, res, next) {
  try {
    const { id }             = req.params;
    const { rating, comment } = req.body;

    const order = await Order.findById(id);
    if (!order || order.status !== 'delivered')
      throw new ValidationError('Can only rate delivered orders');
    if (order.customer.toString() !== req.user._id.toString())
      throw new ForbiddenError('Not your order');

    order.customerRating = rating;
    order.ratingNote     = comment;
    await order.save();

    if (order.rider) {
      const rider     = await User.findById(order.rider);
      const newTotal  = rider.totalRatings + 1;
      const newRating = ((rider.rating * rider.totalRatings) + rating) / newTotal;
      await User.findByIdAndUpdate(order.rider, {
        rating:       +newRating.toFixed(2),
        totalRatings: newTotal,
      });
    }

    ok(res, { message: 'Thank you for rating your delivery!' });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/orders/:id/dispute ──
// Validation: openDisputeSchema applied on route
export async function openDispute(req, res, next) {
  try {
    const { id }    = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);
    if (!order) throw new NotFoundError('Order not found');

    const isParty = [
      order.customer?.toString(),
      order.merchant?.toString(),
      order.rider?.toString(),
    ].includes(req.user._id.toString());
    if (!isParty) throw new ForbiddenError('Not a party to this order');

    if (order.dispute?.status && order.dispute.status !== 'resolved')
      throw new ValidationError('A dispute is already open on this order');

    order.dispute  = { openedBy: req.user._id, reason, status: 'open' };
    order.status   = 'disputed';
    order.timeline.push({ status: 'disputed', note: reason, actor: req.user.role });
    await order.save();

    ok(res, { message: 'Dispute opened. Our support team will review and contact you shortly.' });
  } catch (err) {
    next(err);
  }
}


// ── Helper ──
async function getAdminId() {
  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  return admin?._id;
}