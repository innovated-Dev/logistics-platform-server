// src/services/orderService.js
// Pure business logic shared between the HTTP controller and the Socket.IO handler.
// No Express req/res dependencies here — callers pass in plain values.

import Order  from '../models/Order.js';
import User   from '../models/base/user.base.js';
import { getSocketServer } from '../sockets/index.js';
import { smsPickmanAssigned } from './smsService.js';
import { ValidationError }  from '../utils/errors.js';

/**
 * Atomically assigns a Pickman to an order.
 * Called by both acceptOrder (HTTP) and job:accept (Socket).
 *
 * @param {string|ObjectId} orderId
 * @param {object}          pickman   — the full user doc (must have _id, fullName, phone, vehicleType, rating)
 * @returns {object}                — { order, message }
 * @throws  ValidationError         — if the order is already taken or gone
 */
export async function assignPickmanToOrder(orderId, pickman) {
  const io = getSocketServer();

  // Atomic: only the first Pickman to hit this wins
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: 'pending' },
    {
      $set:  { pickman: pickman._id, status: 'assigned' },
      $push: { timeline: { status: 'assigned', note: 'Pickman accepted', actor: 'Pickman' } },
    },
    { new: true }
  ).populate('customer', 'firstName phone');

  if (!order) {
    throw new ValidationError('Order is no longer available (already assigned or cancelled)');
  }

  // Update assignment log
  await Order.updateOne(
    { _id: orderId, 'assignmentLog.pickman': pickman._id },
    {
      $set: {
        'assignmentLog.$.response':    'accepted',
        'assignmentLog.$.respondedAt': new Date(),
      },
    }
  );

  // Notify customer via socket + SMS
  io?.to(`user:${order.customer._id}`).emit('order:pickman_assigned', {
    orderId,
    pickman: {
      name:        pickman.fullName,
      phone:       pickman.phone,
      vehicleType: pickman.vehicleType,
      rating:      pickman.rating,
    },
  });

  smsPickmanAssigned(
    order.customer.phone,
    pickman.fullName,
    Pickman.phone,
    order.orderRef
  );

  return { order, message: 'Job accepted! Navigate to pickup location.' };
}