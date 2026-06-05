// src/sockets/index.js — Socket.IO server initialisation and event registry.
// Architecture: each connecting client joins a personal room (user:<id>).
// pickmen also join their city room (pickmen:<city>) for broadcast availability events.
// The Redis adapter (socket.io-redis) is used when REDIS_URL is set, which allows
// Socket.IO to work correctly across multiple cluster workers / server instances.
// Without the adapter, a user connected to worker A cannot receive events emitted
// by a request handled by worker B — the Redis adapter bridges this via pub/sub.
import { Server } from 'socket.io';
import jwt        from 'jsonwebtoken';
import env    from '../config/env.js';
import { logger } from '../utils/logger.js';
import Order      from '../models/Order.js';
import User       from '../models/base/user.base.js';
import { assignPickmanToOrder } from '../services/orderService.js';

let _io = null;

export function getSocketServer() { return _io; }

export function initSocketIO(httpServer) {
  _io = new Server(httpServer, {
    cors: {
      origin:      [env.FRONTEND_URL, 'http://localhost:3000'],
      methods:     ['GET','POST'],
      credentials: true,
    },
    transports:    ['websocket','polling'],
    pingTimeout:   60000,
    pingInterval:  25000,
    // Buffer up to 1MB per message — protects against oversized GPS payloads
    maxHttpBufferSize: 1e6,
  });

  // ── Redis adapter (enables cross-worker events) ──
  // Only applied when REDIS_URL is set. In development without Redis,
  // the in-memory adapter works fine for single-process operation.
  if (env.REDIS_URL) {
    (async () => {
      try {
        const { createAdapter } = await import('@socket.io/redis-adapter');
        const { createClient }  = await import('redis');
        const pub = createClient({ url: env.REDIS_URL });
        const sub = pub.duplicate();
        await Promise.all([pub.connect(), sub.connect()]);
        _io.adapter(createAdapter(pub, sub));
        logger.info('✅  Socket.IO Redis adapter attached (cluster-ready)');
      } catch(err) {
        logger.warn(`Socket.IO Redis adapter failed — using in-memory: ${err.message}`);
      }
    })();
  }

  // ── JWT handshake authentication ──
  // Every socket connection must carry a valid JWT in socket.auth.token.
  // Unauthenticated connections are rejected before they can join any room.
  _io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user    = await User.findById(decoded.id).select('_id role city firstName status').lean();
      if (!user)                          return next(new Error('User not found'));
      if (user.status === 'suspended')    return next(new Error('Account suspended'));
      socket.user = user;
      next();
    } catch(err) {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ──
  _io.on('connection', (socket) => {
    const { user } = socket;
    logger.debug(`Socket connected: ${socket.id} | user:${user._id} | role:${user.role}`);

    // Every user joins their personal room immediately
    socket.join(`user:${user._id}`);

    // pickmen also join city-wide room (for broadcast job availability)
    if (user.role === 'pickman') {
      socket.join(`pickmen:${user.city}`);
    }

    // ── pickman: subscribe to an order's real-time updates ──
    socket.on('watch:order', (orderId) => {
      if (!orderId) return;
      socket.join(`order:${orderId}`);
      logger.debug(`user:${user._id} watching order:${orderId}`);
    });

    socket.on('unwatch:order', (orderId) => {
      socket.leave(`order:${orderId}`);
    });

    // ── pickman: broadcast GPS position ──
    // Called by the pickman's app on a timer (every 3–5 seconds during active delivery).
    // The server forwards to the order room AND persists to gpsTrail.
    socket.on('pickman:location', async ({ orderId, lat, lng }) => {
      if (!lat || !lng || !orderId) return;

      // Forward to all watchers of this order in real time
      socket.to(`order:${orderId}`).emit('pickman:moved', { lat, lng, pickmanId: user._id });

      // Persist to GPS trail (evidence record) — fire and forget
      Order.findOneAndUpdate(
        { _id: orderId, pickman: user._id, status: { $in: ['assigned','pickup_in_progress','picked_up','in_transit'] } },
        { $push: { gpsTrail: { lat, lng, timestamp: new Date() } }, $set: { 'pickman.currentLocation': { lat, lng } } }
      ).catch(err => logger.error(`GPS persist failed: ${err.message}`));

      // Also update the User's current location for matching queries
      User.findByIdAndUpdate(user._id, {
        currentLocation: { lat, lng, updatedAt: new Date() }
      }).catch(() => {});
    });
  
    // ── pickman: accept a job offer ──
  socket.on('job:accept', async ({ orderId }, ack) => {
    try {
      const result = await assignPickmanToOrder(orderId, user);
      if (typeof ack === 'function') ack({ success: true, ...result });
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message });
    }
  });

    // ── pickman: decline a job offer ──
    socket.on('job:decline', async ({ orderId }, ack) => {
      await Order.updateOne(
        { _id: orderId, 'assignmentLog.pickman': user._id, 'assignmentLog.response': 'pending' },
        { $set: { 'assignmentLog.$.response': 'declined', 'assignmentLog.$.respondedAt': new Date() } }
      ).catch(() => {});
      if (typeof ack === 'function') ack({ success: true });
    });

    // ── pickman: update status (online/offline) ──
    socket.on('pickman:status', async ({ isOnline }) => {
      await User.findByIdAndUpdate(user._id, { isOnline, lastSeen: new Date() }).catch(() => {});
      socket.to(`pickmen:${user.city}`).emit('pickman:status_changed', { pickmanId: user._id, isOnline });
    });

    // ── Disconnect ──
    socket.on('disconnect', async (reason) => {
      logger.debug(`Socket disconnected: ${socket.id} | user:${user._id} | reason:${reason}`);
      // Mark pickman offline if they disconnect without explicitly going offline
      if (user.role === 'pickman') {
        await User.findByIdAndUpdate(user._id, { isOnline: false, lastSeen: new Date() }).catch(() => {});
      }
    });

    // ── Error ──
    socket.on('error', (err) => {
      logger.error(`Socket error for user:${user._id}: ${err.message}`);
    });
  });

  logger.info('✅  Socket.IO server initialised');
  return _io;
}

