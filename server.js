// ================================================================
// server.js — OffScape Production Server
// ================================================================
import 'dotenv/config';
import http        from 'http';
import express     from 'express';
import helmet      from 'helmet';
import cors        from 'cors';
import morgan      from 'morgan';

import { validateEnv, env }              from './src/config/env.js';
import { connectDB }                     from './src/config/database.js';
import { connectRedis }                  from './src/config/redis.js';
import { initSocketIO }                  from './src/sockets/index.js';
import { startCronJobs }                 from './src/jobs/cronJobs.js';
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';
import { logger }                        from './src/utils/logger.js';

// ── Route imports ──
// webhook.routes.js is imported separately so it can be mounted
// before express.json() — Paystack signature needs the raw Buffer body.
import webhookRoutes from './src/routes/business-logic/webhook.js';

// main.routes.js mounts everything else under /api
import mainRouter   from './src/routes/business-logic/main.js';

// ── 1. Validate environment ──
validateEnv();

// ── 2. Express app + HTTP server ──
const app    = express();
const server = http.createServer(app);

// ── 3. Trust proxy ──
// Required for express-rate-limit to read real client IP behind Render/Railway/Cloudflare
app.set('trust proxy', 1);

// ── 4. Security headers ──
app.use(helmet({
  crossOriginEmbedderPolicy: false,  // allow Leaflet CDN map tiles
  contentSecurityPolicy:     false,  // configure separately if needed
}));

// ── 5. CORS ──
app.use(cors({
  origin: [
    env.FRONTEND_URL,
    'http://localhost:3001',
    'http://localhost:5173',
  ].filter(Boolean),
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── 6. HTTP request logging ──
app.use(morgan(env.isProd() ? 'combined' : 'dev'));

// ── 7. Webhook — raw body BEFORE express.json() ──
// Paystack HMAC signature is computed over the raw bytes.
// express.json() would parse the body first and break the signature check.
app.use(
  '/api/webhook',
  express.raw({ type: '*/*' }),
  (req, _res, next) => {
    req.rawBody = req.body;   // Buffer — consumed by verifyWebhookSignature()
    next();
  },
  webhookRoutes
);

// ── 8. Body parsers (everything except /api/webhook) ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── 9. Health check — no auth, no rate limit ──
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  pid:    process.pid,
  uptime: process.uptime(),
  ts:     new Date().toISOString(),
  env:    env.NODE_ENV,
}));

// ── 10. All API routes via main router ──
// main.routes.js mounts:
//   /api/auth        → auth/main.routes.js  (customer / merchant / rider / common)
//   /api/orders      → orders.routes.js
//   /api/riders      → riders.routes.js
//   /api/wallet      → wallet.routes.js
//   /api/zones       → zones.routes.js
//   /api/support     → support.routes.js
//   /api/admin       → admin.routes.js
// Webhook is NOT in mainRouter — it's mounted above with raw body parser
app.use('/api', mainRouter);

// ── 11. 404 + global error handler (must be last) ──
app.use(notFoundHandler);
app.use(errorHandler);

// ── 12. Socket.IO (shares the HTTP server — same port) ──
initSocketIO(server);

// ── 13. Boot sequence ──
async function start() {
  await connectDB();
  await connectRedis();

  // Only run cron jobs on worker 0 to avoid duplicate sends in cluster mode
  const workerId = parseInt(process.env.NODE_APP_INSTANCE || '0');
  if (workerId === 0) startCronJobs();

  server.listen(env.PORT, () => {
    logger.info(
      `🚀  OffScape listening on :${env.PORT} [PID:${process.pid}] [${env.NODE_ENV}]`
    );
  });
}

start().catch(err => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});

// ── 14. Graceful shutdown ──
function gracefulShutdown(signal) {
  logger.info(`${signal} received — beginning graceful shutdown`);
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      const mongoose = await import('mongoose');
      await mongoose.default.connection.close(false);
      logger.info('MongoDB connection closed');
    } catch (_) {}
    logger.info('Graceful shutdown complete');
    process.exit(0);
  });
  // Force kill after 30s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forced exit after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('uncaughtException',  err => { logger.error('Uncaught exception:',  err); process.exit(1); });
process.on('unhandledRejection', err => { logger.error('Unhandled rejection:', err); process.exit(1); });


/*
based on all the technical flaws in both the backend and frontend code, can you guide me step by step how do 7 api.js fixes, the signin.js fixes i want email to be one user use to login but if number is used what is benefit over email and will email still be unique and verified as it  and the way it should because the auth depends solely on email as it designed in the code and  the auth.js  fixes, dashAdmin.js fixex, dashCustomer fixes then after the fixes rewrite docs and add the model structure make it complete and guide me how turn all this code into a real time tracking logistics framework anyone can use to build up their own logistics platform that works in real time , so the framework will be open source with which people contribute their ideas on and make it more robust as time goes on, don't use the backend doc to write the framework using the whole web app to write a fullstack open source framework that can be used by other developers, to build something like this in feature or which they integrate their own structure into it, as the web app updates the framework updates i want to build something like laravel for renda logistics framework and i want it to  be well document and easy to read and apply for mern stack - something that facebook does with react, in which  they can extend and use any payment gatweay of their choice no restricted but a very secure powerful scalable framworks that solve logistics problem so this will be version 1 then we grow and grow the docs and app become more of what we wanted it to be and by that time we will have our own payment gateway established, our browser, our quick books for finance, our email like proton umbrella app, our vpn our mobile phone like app, our own robotics and sim card
*/