// src/services/orderService.js
// Pure business logic shared between the HTTP controller and the Socket.IO handler.
// No Express req/res dependencies here — callers pass in plain values.
import Order  from '../models/Order.js';
import User   from '../models/base/user.base.js';
import { getSocketServer } from '../sockets/index.js';
import { smsRiderAssigned } from './smsService.js';
import { ValidationError }  from '../utils/errors.js';

/**
 * Atomically assigns a rider to an order.
 * Called by both acceptOrder (HTTP) and job:accept (Socket).
 *
 * @param {string|ObjectId} orderId
 * @param {object}          rider   — the full user doc (must have _id, fullName, phone, vehicleType, rating)
 * @returns {object}                — { order, message }
 * @throws  ValidationError         — if the order is already taken or gone
 */
export async function assignRiderToOrder(orderId, rider) {
  const io = getSocketServer();

  // Atomic: only the first rider to hit this wins
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: 'pending' },
    {
      $set:  { rider: rider._id, status: 'assigned' },
      $push: { timeline: { status: 'assigned', note: 'Rider accepted', actor: 'rider' } },
    },
    { new: true }
  ).populate('customer', 'firstName phone');

  if (!order) {
    throw new ValidationError('Order is no longer available (already assigned or cancelled)');
  }

  // Update assignment log
  await Order.updateOne(
    { _id: orderId, 'assignmentLog.rider': rider._id },
    {
      $set: {
        'assignmentLog.$.response':    'accepted',
        'assignmentLog.$.respondedAt': new Date(),
      },
    }
  );

  // Notify customer via socket + SMS
  io?.to(`user:${order.customer._id}`).emit('order:rider_assigned', {
    orderId,
    rider: {
      name:        rider.fullName,
      phone:       rider.phone,
      vehicleType: rider.vehicleType,
      rating:      rider.rating,
    },
  });

  smsRiderAssigned(
    order.customer.phone,
    rider.fullName,
    rider.phone,
    order.orderRef
  );

  return { order, message: 'Job accepted! Navigate to pickup location.' };
}