# OffScape Technical Code Architecture & Implementation Guide

> **Deep Technical Documentation for Code-Level Understanding & Team Collaboration**

---

## 📋 TABLE OF CONTENTS
1. [Code Organization Structure](#code-organization-structure)
2. [Current Implementation Analysis](#current-implementation-analysis)
3. [Database Layer Architecture](#database-layer-architecture)
4. [API Request Pipeline](#api-request-pipeline)
5. [Authentication & JWT Flow](#authentication--jwt-flow)
6. [Real-Time Architecture (WebSockets)](#real-time-architecture-websockets)
7. [Service Layer Patterns](#service-layer-patterns)
8. [Critical Fixes Implementation](#critical-fixes-implementation)
9. [Decentralized Platform Extension](#decentralized-platform-extension)
10. [Team Collaboration & Scaling Guide](#team-collaboration--scaling-guide)

---

## 📁 CODE ORGANIZATION STRUCTURE

### Current Directory Layout
```
offscape/
├── server.js                    # Entry point, HTTP server setup
├── cluster.js                   # Multi-core clustering
├── package.json                 # Dependencies
├── src/
│   ├── config/                  # Configuration & connections
│   │   ├── env.js               # Environment validation
│   │   ├── database.js          # MongoDB connection pool
│   │   ├── redis.js             # Redis client & helpers
│   │   ├── cloudinary.js        # Image storage config
│   │   └── kyc.js               # KYC service config
│   │
│   ├── models/                  # Mongoose schemas
│   │   ├── base/
│   │   │   └── user.base.js     # Base user schema (discriminator pattern)
│   │   ├── user/
│   │   │   ├── customer.role.js
│   │   │   ├── merchant.role.js
│   │   │   ├── pickman.role.js
│   │   │   ├── admin.official.js
│   │   │   └── support.official.js
│   │   ├── Order.js             # Order schema (core operational model)
│   │   ├── Wallet.js            # Financial transactions
│   │   ├── Zone.js              # Delivery zones
│   │   ├── Session.js           # User sessions
│   │   ├── Ticket.js            # Support tickets
│   │   ├── kyc.js               # Identity verification
│   │   └── Config.js            # Platform configuration
│   │
│   ├── routes/                  # Express route handlers
│   │   ├── business-logic/
│   │   │   ├── main.js          # Router aggregator
│   │   │   ├── orders.js        # POST/GET/PATCH /api/orders
│   │   │   ├── wallet.js        # /api/wallet endpoints
│   │   │   ├── zones.js         # /api/zones (geolocation)
│   │   │   ├── pickmen.js       # /api/pickmen (rider management)
│   │   │   ├── kyc.js           # /api/kyc (identity verification)
│   │   │   ├── webhook.js       # /api/webhook/paystack (special: raw body)
│   │   │   └── admin.kyc.routes.js
│   │   └── auth/
│   │       ├── main.routes.js   # Auth router aggregator
│   │       ├── customer.routes.js
│   │       ├── merchant.routes.js
│   │       ├── pickman.routes.js
│   │       ├── admin.official.js
│   │       ├── support.official.js
│   │       └── common.routes.js
│   │
│   ├── controllers/             # Business logic handlers
│   │   ├── auth/
│   │   │   ├── auth.base.js     # Common auth functions (issueTokens)
│   │   │   ├── customer.controller.js
│   │   │   ├── merchant.controller.js
│   │   │   ├── pickman.controller.js
│   │   │   ├── admin.official.js
│   │   │   ├── common.auth.controller.js  # Shared (logout, refresh, etc)
│   │   │   └── support.official.js
│   │   └── business-logic/
│   │       ├── orders.controller.js
│   │       ├── wallet.controller.js
│   │       ├── pickmen.controller.js
│   │       └── zones.controller.js
│   │
│   ├── services/                # External API integrations & business logic
│   │   ├── paystackService.js   # Payment processing & webhooks
│   │   ├── emailService.js      # Brevo email sending
│   │   ├── smsService.js        # Termii SMS service
│   │   ├── orderService.js      # Order creation, assignment
│   │   ├── feeCalculator.js     # Dynamic fee calculation engine
│   │   ├── zoneEngine.js        # Zone lookup & geolocation
│   │   ├── b2.service.js        # Backblaze B2 cloud storage
│   │   └── [FUTURE] blockchainService.js  # Smart contracts
│   │
│   ├── middleware/              # Express middleware functions
│   │   ├── auth.js              # JWT verification, role checking
│   │   ├── rateLimiter.js       # Redis-backed rate limiting
│   │   ├── validate.js          # Joi input validation
│   │   ├── errorHandler.js      # Global error handler
│   │   ├── sanitize.middleware.js # NoSQL injection prevention
│   │   └── upload.js            # Multer file upload config
│   │
│   ├── utils/                   # Utility functions
│   │   ├── jwt.js               # Token generation/verification
│   │   ├── logger.js            # Winston structured logging
│   │   ├── errors.js            # Custom error classes
│   │   ├── encryption.js        # AES-256-GCM encryption
│   │   ├── validator.js         # Joi schema definitions
│   │   ├── response.js          # Standard response formatting
│   │   ├── otp.js               # OTP generation/verification
│   │   ├── fileValidator.js     # File validation rules
│   │   └── ip.js                # IP extraction (behind proxy)
│   │
│   ├── jobs/                    # Background scheduled tasks
│   │   └── cronJobs.js          # node-cron job definitions
│   │
│   ├── sockets/                 # Real-time communication
│   │   └── index.js             # Socket.IO server setup & handlers
│   │
│   ├── sse/                     # Server-sent events (fallback)
│   │   ├── sseRoute.js
│   │   └── sseManager.js
│   │
│   ├── seeds/                   # Database seeding
│   │   ├── zones.js
│   │   ├── config.js
│   │   └── admin.js
│   │
│   └── validation/              # [Empty - use utils/validator.js]
│
├── docs/                        # Documentation (created)
│   ├── ARCHITECTURE-ROADMAP.md
│   ├── ARCHITECTURE-DIAGRAM.md
│   ├── CRITICAL-ISSUES-DEEP-DIVE.md
│   └── [NEW] TECHNICAL-CODE-ARCHITECTURE.md
│
└── scripts/                     # Utility scripts
    ├── deploy.sh
    └── setup.sh
```

### Code Flow Summary
```
User Request (HTTP/WebSocket)
    ↓
[Load Balancer] / Nginx
    ↓
[Express App] → server.js:3-95
    ↓
Middleware Stack (Order Matters):
  1. Helmet (security headers)
  2. CORS (origin check)
  3. Morgan (HTTP logging)
  4. Express.json (body parsing)
  5. Rate Limiter (Redis check)
  6. JWT Auth (if protected route)
  7. Input Validator (Joi schema)
  8. Sanitizer (NoSQL injection)
    ↓
[Route Handler]
    ↓
[Controller] (business logic)
    ↓
[Service Layer] (external APIs, calculations)
    ↓
[Database Layer] (Mongoose queries)
    ↓
[Response] formatted & sent back
    ↓
[Error Handler] (if any errors)
    ↓
Client Receives Response
```

---

## 🔍 CURRENT IMPLEMENTATION ANALYSIS

### 1. Server Initialization (server.js)

**Current Code Structure:**
```javascript
// server.js lines 1-45
import 'dotenv/config';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

// Configuration imports
import { validateEnv, env } from './src/config/env.js';
import { connectDB } from './src/config/database.js';
import { connectRedis } from './src/config/redis.js';
import { initSocketIO } from './src/sockets/index.js';
import { startCronJobs } from './src/jobs/cronJobs.js';

// Middleware imports
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';
import { logger } from './src/utils/logger.js';

// Routes
import webhookRoutes from './src/routes/business-logic/webhook.js';
import mainRouter from './src/routes/business-logic/main.js';

// Initialization sequence
validateEnv();  // CRITICAL: Exits if env vars missing
const app = express();
const server = http.createServer(app);

// Trust proxy for rate limiter (behind Nginx/HAProxy)
app.set('trust proxy', 1);  // Read X-Forwarded-For header
```

**Analysis:**
- ✅ Proper initialization order (validate → create → configure)
- ✅ Separates HTTP server from Express app (needed for WebSockets)
- ✅ Middleware registration in correct order
- ✅ Webhook route BEFORE body parser (preserves raw body)

**Technical Implications:**
```
If middleware order is wrong:
  express.json() before webhook route
    → req.body is already parsed
    → req.rawBody is undefined
    → Paystack signature verification fails
    → Payment webhooks rejected (CRITICAL BUG)
```

### 2. Cluster Mode (cluster.js)

**Current Code:**
```javascript
// cluster.js lines 29-73
import cluster from 'cluster';
import os from 'os';

const NUM_WORKERS = env.WORKERS || os.cpus().length;

if (cluster.isPrimary) {
  // Primary process
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = cluster.fork({ NODE_APP_INSTANCE: i });
  }
  
  cluster.on('exit', (worker, code, signal) => {
    cluster.fork();  // Auto-restart crashed worker
  });
} else {
  // Worker process
  await import('./server.js');
}
```

**Technical Details:**
```
Process Model:
  Primary (PID: 1000)
    ├─ Worker 0 (PID: 1001) → Listening on :4000
    ├─ Worker 1 (PID: 1002) → Listening on :4000
    ├─ Worker 2 (PID: 1003) → Listening on :4000
    └─ Worker 3 (PID: 1004) → Listening on :4000
    
  Load Distribution (OS level):
    Incoming connection → OS kernel → Round-robin to worker
    No shared memory between workers (isolation)
    Each worker has own database connection pool
    Each worker has own Redis client connection

Critical Note:
  Cron jobs run ONLY on Worker 0 (server.js:110-111)
  This prevents duplicate sends in cluster mode
```

---

## 💾 DATABASE LAYER ARCHITECTURE

### 1. MongoDB Connection Pool (src/config/database.js)

**Current Implementation:**
```javascript
// database.js: 9-36
const OPTIONS = {
  maxPoolSize: 50,          // MAX 50 concurrent connections
  minPoolSize: 5,           // MIN 5 warm connections
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
};

export async function connectDB(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, OPTIONS);
      // Successfully connected
      return;
    } catch(err) {
      if (attempt === retries) {
        process.exit(1);  // Kill process on final failure
      }
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
}
```

**Connection Pool Mechanics:**
```
Request 1: Gets connection #1 from pool
Request 2: Gets connection #2 from pool
Request 3: Gets connection #3 from pool
...
Request 50: Gets connection #50 from pool
Request 51: WAITS in queue ⏳

When Request 1 completes:
  Connection #1 returned to pool
  Request 51: GETS connection #1
  
Performance:
  At 50 concurrent requests: ~0ms wait
  At 100 concurrent requests: ~100ms wait per request
  At 200+ concurrent requests: Timeout errors start
```

**Correct Version (Phase 1 Fix):**
```javascript
// IMPROVED: Larger pool for scaling
const OPTIONS = {
  maxPoolSize: 200,         // ← INCREASED from 50
  minPoolSize: 20,          // ← INCREASED from 5
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  maxStalenessSeconds: 60,  // NEW: Replica staleness threshold
  retryWrites: true,        // NEW: Automatic write retry
  retryReads: true,         // NEW: Automatic read retry
};
```

### 2. Mongoose Schema Architecture

**Base User Pattern (Discriminator):**
```javascript
// models/base/user.base.js - Single schema, multiple roles
const userBaseSchema = new Schema({
  // Identity fields
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { 
    type: String, 
    required: true,
    unique: true,  // ← PROBLEM: Global unique, blocks same email different role
    lowercase: true 
  },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true, minlength: 8, select: false },
  
  // Role-specific (inherited by child schemas)
  role: { type: String, enum: ['customer','merchant','pickman','admin','support'] },
  
  // Security fields
  loginAttempts: { type: Number, default: 0, select: false },
  lockUntil: { type: Date, select: false },
  tokenVersion: { type: Number, default: 0 },  // Invalidate all tokens on password reset
  
  // Verification
  emailVerified: { type: Boolean, default: false },
  emailVerifyToken: { type: String, select: false },
  emailVerifyExpires: Date,
  
  // Soft delete
  deletedAt: Date,
  
}, { 
  discriminatorKey: 'role',
  collection: 'users',
  timestamps: true,
  toJSON: { virtuals: true },
});

// Indexes
userBaseSchema.index({ email: 1, role: 1 }, { unique: true });  // ← Allows same email, different role
userBaseSchema.index({ phone: 1 });
userBaseSchema.index({ role: 1, status: 1 });
userBaseSchema.index({ city: 1, role: 1 });
```

**Discriminator Usage:**
```javascript
// In individual role files
const Customer = User.discriminator('customer', customerSchema);
const Merchant = User.discriminator('merchant', merchantSchema);
const Pickman = User.discriminator('pickman', pickmanSchema);

// MongoDB Storage (Single Collection, Multiple Document Types)
Users Collection:
{
  _id: ObjectId("..."),
  firstName: "John",
  email: "john@example.com",
  role: "customer",      // ← Discriminator field
  phone: "08012345678",
  customerSpecificField: "..."
}

{
  _id: ObjectId("..."),
  firstName: "John",
  email: "john@example.com",  // Same email allowed (different role)
  role: "merchant",           // ← Different role
  phone: "08087654321",       // Different phone required (unique globally)
  merchantSpecificField: "..."
}
```

### 3. Order Schema (Core Operational Model)

**Structure Analysis:**
```javascript
const orderSchema = new Schema({
  // Reference
  orderRef: { type: String, unique: true },  // e.g., "OS-LAG-08421"
  
  // Parties
  customer: { type: ObjectId, ref: 'User', required: true },
  merchant: { type: ObjectId, ref: 'User' },
  pickman: { type: ObjectId, ref: 'User' },
  
  // Locations (Denormalized for audit trail)
  pickup: {
    address: String,
    coordinates: { lat: Number, lng: Number },
    senderName: String,      // DENORMALIZED (customer.firstName)
    senderPhone: String,     // DENORMALIZED (customer.phone)
  },
  delivery: { ... },
  
  // Package details
  package: {
    category: { enum: ['document','fragile','parcel',...] },
    weight: Number,
    fragile: Boolean,
    insured: Boolean,
  },
  
  // Fees calculated server-side only
  fees: {
    baseFee: Number,
    distanceFee: Number,
    platformFee: Number,     // 5% of base+distance
    insurance: Number,
    codHandlingFee: Number,
    total: Number,           // Sum of all fees
  },
  
  // Payment
  payment: {
    method: { enum: ['paystack','wallet','cod'] },
    status: { enum: ['pending','paid','failed','refunded'] },
    paystackRef: String,
    paidAt: Date,
  },
  
  // Pay-on-delivery
  cod: {
    collected: Boolean,
    feeDebited: Boolean,
    otpHash: String,         // bcrypt hash of 6-digit OTP
    otpVerified: Boolean,
    otpVerifiedAt: Date,
  },
  
  // Status tracking
  status: { enum: ['pending','assigned','pickup_in_progress','picked_up','in_transit','delivered','cancelled','disputed'] },
  
  // Timeline (Immutable audit trail)
  timeline: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String,
    actor: String,  // 'system','customer','pickman','admin'
  }],
  
}, { timestamps: true });
```

**Key Design Patterns:**
```
1. Denormalization Strategy:
   - Stores senderName, senderPhone in order
   - If customer deletes account, order still has data
   - Good for disputes and audit trails
   - Trade-off: Extra storage, but worth it

2. Timeline Pattern:
   - Array of events with immutable history
   - Each status change appended (not modified)
   - Perfect for "what happened" questions
   - Enables order replay/debugging

3. Fee Breakdown:
   - Explicitly stored (not calculated on demand)
   - Prevents fee disputes
   - Audit trail for finance team
   - Can't accidentally change fee calculation retroactively

4. Payment Pattern:
   - Supports multiple payment methods
   - COD (cash on delivery) with OTP verification
   - Paystack webhook integration
   - Wallet direct debit
```

---

## 🔐 API REQUEST PIPELINE

### Request Flow (Middleware Chain)

**Step 1: Helmet Security Headers**
```javascript
// server.js line 39
app.use(helmet({
  crossOriginEmbedderPolicy: false,  // Allow CDN tiles
  contentSecurityPolicy: false,      // Configure separately if needed
}));

// What Helmet does:
- Strict-Transport-Security: Force HTTPS
- X-Frame-Options: Prevent clickjacking
- X-Content-Type-Options: Prevent MIME type sniffing
- X-XSS-Protection: Legacy XSS protection
- Expect-CT: Certificate transparency
```

**Step 2: CORS (Cross-Origin Resource Sharing)**
```javascript
// server.js line 45
app.use(cors({
  origin: [
    env.FRONTEND_URL,
    'http://localhost:3001',
    'http://localhost:5173',
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// How it works:
Client makes request with Origin: http://localhost:3001
    ↓
CORS middleware checks:
  Is http://localhost:3001 in whitelist? YES
    ↓
Add response header: Access-Control-Allow-Origin: http://localhost:3001
    ↓
Browser allows response to be read by JavaScript
```

**Step 3: Webhook Raw Body (Special Case)**
```javascript
// server.js line 62-69
app.use(
  '/api/webhook',
  express.raw({ type: '*/*' }),  // Raw Buffer, not parsed
  (req, _res, next) => {
    req.rawBody = req.body;       // Store raw buffer
    next();
  },
  webhookRoutes
);

// Why: Paystack signature verification
//   Signature is HMAC-SHA512 of request body
//   Must be raw bytes, not parsed JSON
//   If parsed first: bytes != signature (verification fails)
```

**Step 4: Body Parser (Everything Else)**
```javascript
// server.js line 73
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Converts raw bytes → JavaScript object
// { limit: '10mb' } prevents oversized uploads
```

**Step 5: Rate Limiting**
```javascript
// Applied per-route in route handlers
router.post('/login', loginLimiter, async (req, res) => {
  // loginLimiter = 5 attempts per 15 minutes per IP
});

// Implementation (rateLimiter.js):
import RedisStore from 'rate-limit-redis';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15-minute sliding window
  max: 5,                     // Max 5 requests
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'rl:login:',      // Redis key prefix
  }),
  skipSuccessfulRequests: true,  // Only count failed attempts
});

// Flow:
Request arrives
  ↓
Rate limiter checks Redis: rl:login:user_ip
  ↓
Count exists? (0-5) → Increment
  ↓
Count > 5? YES → Return 429 Too Many Requests
           NO → Continue to next middleware
```

**Step 6: JWT Authentication**
```javascript
// middleware/auth.js: 7-45
async function protect(req, res, next) {
  const header = req.headers.authorization;
  
  if (!header?.startsWith('Bearer '))
    return next(new AuthError('No access token provided'));
  
  const token = header.slice(7);  // Remove "Bearer "
  
  try {
    const decoded = verifyAccessToken(token);
    // decoded = { userId, role, jti, tokenVersion, iat, exp }
  } catch (err) {
    return next(new AuthError('Invalid or expired token'));
  }
  
  // Check Redis blocklist (logout invalidation)
  const isBlocked = await isTokenBlocked(decoded.jti);
  if (isBlocked) 
    return next(new AuthError('Token has been invalidated'));
  
  // Fetch user and verify token version
  const user = await User.findById(decoded.userId).select('+tokenVersion');
  if (user.tokenVersion !== decoded.tokenVersion)
    return next(new AuthError('Session invalidated'));
  
  // Attach to request
  req.user = user;
  req.tokenPayload = decoded;
  next();
}

// Token verification process:
1. Extract token from Authorization header
2. Verify signature (JWT_SECRET)
3. Check expiration (default 15 minutes)
4. Check Redis blocklist (jti)
5. Fetch user and verify token version
6. Attach user to request
```

**Step 7: Input Validation (Joi)**
```javascript
// middleware/validate.js
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,      // All errors, not first
      stripUnknown: true,     // Remove extra fields
    });
    
    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: details,
      });
    }
    
    req.body = value;  // Cleaned and validated
    next();
  };
};

// Usage in routes
router.post(
  '/signup',
  validate(customerSignupSchema),  // Validates req.body
  customerController.signUp
);

// Joi schema example
const customerSignupSchema = Joi.object({
  firstName: Joi.string().required().max(60),
  lastName: Joi.string().required().max(60),
  email: Joi.string().email().required().lowercase().trim(),
  phone: Joi.string().required().min(11),
  password: Joi.string().required().min(8),
  city: Joi.string().valid('lagos', 'ibadan').required(),
});
```

**Step 8: NoSQL Injection Prevention**
```javascript
// middleware/sanitize.middleware.js
import expressMongoSanitize from '@exortek/express-mongo-sanitize';

export const sanitizeInput = expressMongoSanitize({
  replaceWith: '_',  // Replace $ and . with underscore
});

// Attack it prevents:
// Input: { "email": {"$gt": ""}, "password": {"$gt": ""} }
// (Empty string > anything, bypasses login)
//
// After sanitization: { "email": "", "password": "" }
// Safe!

// How it works:
- Scans all incoming data (body, query, params)
- Finds $ and . characters (MongoDB operators)
- Replaces or removes them
- Prevents NoSQL injection
```

---

## 🔐 AUTHENTICATION & JWT FLOW

### JWT Architecture

**Token Composition:**
```javascript
// utils/jwt.js
export function generateAccessToken(userId, role, tokenVersion = 0, extra = {}) {
  const jti = crypto.randomUUID();  // Unique token ID for blocklist
  
  return jwt.sign(
    {
      userId,                // User identifier
      role,                  // 'customer','merchant','pickman','admin'
      jti,                   // For logout blocklist
      tokenVersion,          // Password reset invalidates all tokens
      ...extra               // Optional extra claims
    },
    env.JWT_SECRET,          // Secret key for signing
    { expiresIn: env.JWT_EXPIRE || '15m' }  // Expires in 15 minutes
  );
}

// Token structure (JWT standard):
// HEADER.PAYLOAD.SIGNATURE
// {
//   "alg": "HS256",
//   "typ": "JWT"
// }
// {
//   "userId": "123abc",
//   "role": "customer",
//   "jti": "uuid-1234",
//   "tokenVersion": 0,
//   "iat": 1695000000,
//   "exp": 1695000900
// }
// SIGNATURE = HMAC-SHA256(header.payload, secret)
```

**Refresh Token Pattern:**
```javascript
// When access token expires, use refresh token
export function generateRefreshToken(userId, family) {
  return jwt.sign(
    { userId, family },     // family = reuse detection chain
    env.REFRESH_TOKEN_SECRET,
    { expiresIn: env.REFRESH_TOKEN_EXPIRE || '7d' }
  );
}

// Purpose of "family":
// Detects token reuse attack
// If someone steals a refresh token:
//   They generate new access token
//   Original user refreshes token
//   Sees different family ID
//   Knows account compromised!
//   Invalidates all tokens
```

**Complete Authentication Flow:**

```
1. SIGNUP
User submits: { email, password, ... }
  ↓
Controller: signUpCustomer()
  ↓
Hash password: bcryptjs.hash(password, 10)
  ↓
Create user in MongoDB
  ↓
Send verification email (async, outside transaction)
  ↓
Return: { success: true, emailSent: true, user }

2. EMAIL VERIFICATION
User clicks link: /verify-email?token=abc123def456
  ↓
Controller: verifyEmail(req.body.token)
  ↓
Hash token: SHA256(token)
  ↓
Find user with emailVerifyToken = hash
  ↓
Check emailVerifyExpires > now
  ↓
Set emailVerified = true
  ↓
Delete emailVerifyToken
  ↓
Return: { success: true, message: 'Email verified' }

3. LOGIN
User submits: { email, password }
  ↓
Rate limiter: loginLimiter (5 per 15 min)
  ↓
Find user by email
  ↓
Check isLocked? (accountLocked until lockUntil time) → Error
  ↓
Check isActive? (admin deactivated account) → Error
  ↓
Verify password: bcryptjs.compare(password, hash)
  ↓
If wrong: loginAttempts++, check if > 5 → Lock account
  ↓
Check emailVerified? → If not, ask to verify email first
  ↓
Reset loginAttempts = 0
  ↓
Generate tokens:
  accessToken (15m) + refreshToken (7d)
  ↓
Return: {
  success: true,
  accessToken,
  refreshToken,
  user
}

4. PROTECTED REQUEST
Client sends: GET /api/orders
  Header: Authorization: Bearer eyJhbGc...
  ↓
Middleware: protect()
  ↓
Extract token from header
  ↓
Verify JWT signature (JWT_SECRET)
  ↓
Check expiration (now < exp)
  ↓
Check Redis blocklist: blocklist:{jti}
  ↓
Fetch user from DB
  ↓
Verify tokenVersion (matches current user)
  ↓
Attach req.user = user
  ↓
Continue to controller

5. TOKEN REFRESH
Client sends: POST /api/auth/refresh
  Body: { refreshToken: eyJhbGc... }
  ↓
Verify refresh token signature
  ↓
Check MongoDB for token family
  ↓
Generate new accessToken (same family)
  ↓
Return: { accessToken }
  
6. LOGOUT
Client sends: POST /api/auth/logout
  Header: Authorization: Bearer accessToken
  ↓
Extract jti from token payload
  ↓
Add to Redis blocklist:
  Key: blocklist:{jti}
  Value: '1'
  TTL: token expiration time
  ↓
Return: { success: true, message: 'Logged out' }
  
When logged out user tries to use token:
  Middleware checks Redis: blocklist:{jti}
  Finds it exists → Reject with "Token invalidated"

7. PASSWORD RESET
Step 1: Request reset
  User submits: { email }
    ↓
  Find user
    ↓
  Generate reset token: crypto.randomBytes(32).toString('hex')
    ↓
  Hash token: SHA256
    ↓
  Store in user:
    passwordResetToken = hash
    passwordResetExpires = now + 15 minutes
    ↓
  Email reset link: /reset-password?token=abc123
    ↓
  Return: { success: true, message: 'Check email' }

Step 2: Reset password (with token)
  User submits: { token, newPassword }
    ↓
  Hash token: SHA256
    ↓
  Find user with passwordResetToken = hash
    ↓
  Check passwordResetExpires > now
    ↓
  Hash new password
    ↓
  Update user:
    password = newHash
    passwordResetToken = null  // Clear reset token
    tokenVersion++             // IMPORTANT: Invalidates all existing tokens!
    ↓
  Return: { success: true, message: 'Password reset' }

Why tokenVersion++?
  All existing access/refresh tokens have tokenVersion: 0
  New token verification checks:
    decoded.tokenVersion === user.tokenVersion
    0 === 1? NO → Reject!
  Forces re-login after password reset (security)
```

---

## 🔌 REAL-TIME ARCHITECTURE (WEBSOCKETS)

### Socket.IO Setup

**Initialization (src/sockets/index.js:20-51)**

```javascript
export function initSocketIO(httpServer) {
  _io = new Server(httpServer, {
    cors: {
      origin: [env.FRONTEND_URL, 'http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],  // Try WS first, fallback to polling
    pingTimeout: 60000,   // 60s before considering client dead
    pingInterval: 25000,  // Send ping every 25s
    maxHttpBufferSize: 1e6,  // 1MB max message size
  });
  
  // Redis adapter (enables cross-worker communication)
  if (env.REDIS_URL) {
    (async () => {
      const { createAdapter } = await import('@socket.io/redis-adapter');
      const { createClient } = await import('redis');
      
      const pub = createClient({ url: env.REDIS_URL });
      const sub = pub.duplicate();
      
      await Promise.all([pub.connect(), sub.connect()]);
      _io.adapter(createAdapter(pub, sub));
      // Now: Events from Worker 0 reach clients in Worker 3
    })();
  }
}
```

**Authentication (src/sockets/index.js:53-69)**

```javascript
_io.use(async (socket, next) => {
  try {
    // Extract token from socket handshake
    const token = socket.handshake.auth?.token 
                  || socket.handshake.query?.token;
    
    if (!token) 
      return next(new Error('Authentication required'));
    
    // Verify JWT
    const decoded = jwt.verify(token, env.JWT_SECRET);
    
    // Fetch user
    const user = await User.findById(decoded.id)
      .select('_id role city firstName status')
      .lean();  // Don't hydrate Mongoose document
    
    if (!user || user.status === 'suspended')
      return next(new Error('User not found or suspended'));
    
    // Attach to socket
    socket.user = user;
    next();
  } catch(err) {
    next(new Error('Invalid token'));
  }
});
```

**Connection Handler (src/sockets/index.js:72-80)**

```javascript
_io.on('connection', (socket) => {
  const { user } = socket;
  
  logger.debug(`Socket connected: ${socket.id} | user:${user._id}`);
  
  // Join personal room
  socket.join(`user:${user._id}`);
  
  // Pickmen also join city room (for job broadcasts)
  if (user.role === 'pickman') {
    socket.join(`pickmen:${user.city}`);
  }
  
  // Event handlers
  socket.on('location:update', handleLocationUpdate);
  socket.on('order:accept', handleOrderAccept);
  // ... etc
});
```

**Room Structure:**

```
Socket.IO Rooms:

user:customer123
  └─ Socket connections for customer (might be multiple tabs)
  └─ Events: order updates, notifications

user:merchant456
  └─ Socket connections for merchant
  └─ Events: new orders, order updates

user:pickman789
  └─ Socket connections for rider
  └─ Events: order assignments, order updates, route changes

pickmen:lagos
  └─ All riders in Lagos
  └─ Events: job availability, broadcast job assignments

order:order-123-abc
  └─ Everyone watching order (customer + merchant + rider)
  └─ Events: status updates, location changes

system:notifications
  └─ All connected users
  └─ Events: maintenance alerts, system notifications
```

**Broadcasting Example:**

```javascript
// In order controller, after order is marked delivered
async function markOrderDelivered(req, res, next) {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status: 'delivered', deliveredAt: new Date() },
    { new: true }
  );
  
  // Get Socket.IO server
  const io = getSocketServer();
  
  // Notify all watchers
  io.to(`order:${order._id}`).emit('order:delivered', {
    orderId: order._id,
    deliveredAt: order.deliveredAt,
    status: 'delivered',
  });
  
  // Also notify customer in their room
  io.to(`user:${order.customer}`).emit('order:status-change', {
    orderId: order._id,
    newStatus: 'delivered',
  });
  
  res.json(order);
}

// With Redis adapter (cluster mode):
Worker 0 processes request
  ↓
io.to(`user:${customerId}`).emit(...)
  ↓
Event published to Redis Pub/Sub channel
  ↓
Redis broadcasts to all workers
  ↓
Worker 1, 2, 3 receive event
  ↓
Each worker emits to its connected clients
  ↓
All clients watching order get update instantly
```

---

## 🏗️ SERVICE LAYER PATTERNS

### Pattern 1: External API Service (Payment Gateway)

```javascript
// services/paystackService.js
import axios from 'axios';
import { env } from '../config/env.js';

export async function initializePayment(amount, email, orderId) {
  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        amount: amount * 100,  // In kobo (1 naira = 100 kobo)
        email,
        reference: generateUniqueRef(),
        metadata: {
          orderId,
          type: 'order_payment'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      authUrl: response.data.data.authorization_url,
      accessCode: response.data.data.access_code,
      reference: response.data.data.reference,
    };
  } catch (err) {
    throw new PaymentError(`Payment initialization failed: ${err.message}`);
  }
}

export function verifyWebhookSignature(rawBody, signature) {
  // Paystack sends: X-Paystack-Signature header
  // Format: HMAC-SHA512(rawBody, SECRET_KEY)
  
  const hash = crypto
    .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  
  return hash === signature;
}

export async function chargeCard(email, amount, authorizationCode) {
  const response = await axios.post(
    'https://api.paystack.co/transaction/charge_authorization',
    {
      email,
      amount: amount * 100,
      authorization_code: authorizationCode,
    },
    {
      headers: { 'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}` }
    }
  );
  
  return response.data.data;
}
```

### Pattern 2: Calculation Engine (Fee Calculator)

```javascript
// services/feeCalculator.js
export async function calculateOrderFee(pickup, delivery, packageData) {
  // Inputs:
  // - pickup: { coordinates: { lat, lng }, zone: Zone }
  // - delivery: { coordinates: { lat, lng }, zone: Zone }
  // - packageData: { weight, category, insured, speed }
  
  // Step 1: Calculate distance
  const distance = haversineDistance(
    pickup.coordinates,
    delivery.coordinates
  );  // Returns km
  
  // Step 2: Base fee (lookup from database)
  const baseConfig = await Config.findOne({ key: 'pricing' });
  const baseFee = baseConfig.pricing.baseFee;  // e.g., 2000 naira
  
  // Step 3: Distance fee
  const distanceFee = distance * baseConfig.pricing.perKm;  // e.g., 100/km
  
  // Step 4: Category surcharge
  const categoryFee = getCategorySurcharge(packageData.category);
  
  // Step 5: Insurance fee (optional)
  let insuranceFee = 0;
  if (packageData.insured) {
    insuranceFee = (baseFee + distanceFee) * 0.02;  // 2% of subtotal
  }
  
  // Step 6: Speed multiplier
  const speedMultiplier = {
    'standard': 1.0,
    'express': 1.3,
    'economy': 0.8,
  }[packageData.speed];
  
  // Step 7: Subtotal
  const subtotal = (baseFee + distanceFee + categoryFee) * speedMultiplier;
  
  // Step 8: Platform fee
  const platformFee = subtotal * 0.05;  // 5% of subtotal
  
  // Step 9: COD handling fee (if payment method is COD)
  let codFee = 0;
  if (paymentMethod === 'cod') {
    codFee = subtotal * 0.03;  // 3% COD fee
  }
  
  // Total
  const total = subtotal + platformFee + insuranceFee + codFee;
  
  return {
    baseFee,
    distanceFee,
    categoryFee,
    insuranceFee,
    codFee,
    platformFee,
    speedMultiplier,
    subtotal,
    total,
    distanceKm: distance,
  };
}

function haversineDistance(coord1, coord2) {
  const R = 6371;  // Earth radius in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(coord1.lat * Math.PI / 180) * 
            Math.cos(coord2.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

### Pattern 3: Business Logic Service (Order Management)

```javascript
// services/orderService.js
export async function createOrder(orderData, session) {
  // Inputs from controller:
  // - customer ID
  // - merchant ID (optional)
  // - pickup/delivery locations
  // - package details
  // - payment method
  
  // Step 1: Calculate fees
  const fees = await calculateOrderFee(
    orderData.pickup,
    orderData.delivery,
    orderData.package
  );
  
  // Step 2: Validate payment method
  if (orderData.payment.method === 'wallet') {
    const wallet = await Wallet.findOne({ owner: orderData.customer });
    if (wallet.balance < fees.total) {
      throw new PaymentError('Insufficient wallet balance');
    }
  }
  
  // Step 3: Create order
  const order = await Order.create(
    [{
      orderRef: generateOrderRef(),
      customer: orderData.customer,
      merchant: orderData.merchant,
      pickup: orderData.pickup,
      delivery: orderData.delivery,
      package: orderData.package,
      fees,
      payment: { ...orderData.payment, status: 'pending' },
      status: 'pending',
      timeline: [{
        status: 'pending',
        timestamp: new Date(),
        actor: 'system',
        note: 'Order created'
      }]
    }],
    { session }  // MongoDB transaction
  );
  
  // Step 4: If wallet payment, debit immediately
  if (orderData.payment.method === 'wallet') {
    const wallet = await Wallet.findOne({ owner: orderData.customer });
    await wallet.debit(fees.total, 'Order payment', order._id, { session });
    
    order.payment.status = 'paid';
    order.payment.paidAt = new Date();
    await order.save({ session });
  }
  
  return order;
}

export async function assignPickmanToOrder(orderId) {
  const order = await Order.findById(orderId);
  
  // Find available pickmen in same city
  const pickmen = await User.find({
    role: 'pickman',
    city: order.pickup.zone.city,
    isOnline: true,
    'currentLocation': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [order.pickup.coordinates.lng, order.pickup.coordinates.lat]
        },
        $maxDistance: 5000  // 5km radius
      }
    }
  });
  
  if (!pickmen.length) {
    throw new NotFoundError('No available pickmen in area');
  }
  
  // Smart assignment algorithm
  const pickman = pickmen[0];  // Closest pickman (MongoDB sorting)
  
  order.pickman = pickman._id;
  order.status = 'assigned';
  order.timeline.push({
    status: 'assigned',
    timestamp: new Date(),
    actor: 'system',
    note: `Assigned to ${pickman.firstName}`
  });
  
  await order.save();
  
  // Notify rider
  const io = getSocketServer();
  io.to(`user:${pickman._id}`).emit('order:assigned', {
    orderId: order._id,
    orderRef: order.orderRef,
    pickup: order.pickup,
    delivery: order.delivery,
    fees: order.fees,
  });
  
  return order;
}
```

---

## 🔧 CRITICAL FIXES IMPLEMENTATION

### FIX #1: Database Connection Pool Enhancement

**Current Code Issue:**
```javascript
// src/config/database.js line 10
const OPTIONS = {
  maxPoolSize: 50,  // ← BOTTLENECK at ~50 concurrent requests
};
```

**Implementation (Phase 1 - Week 1):**

```javascript
// src/config/database.js - CORRECTED VERSION
const OPTIONS = {
  // --- Connection Pooling ---
  maxPoolSize: 200,         // Increased from 50 → 4x capacity
  minPoolSize: 20,          // Increased from 5 → Keep more warm
  
  // --- Timeout Configuration ---
  serverSelectionTimeoutMS: 10000,  // 10s to find server
  socketTimeoutMS: 45000,           // 45s per query
  heartbeatFrequencyMS: 10000,      // Check server health every 10s
  
  // --- Replica Set Configuration ---
  retryWrites: true,        // NEW: Auto-retry writes on transient errors
  retryReads: true,         // NEW: Auto-retry reads
  maxStalenessSeconds: 60,  // NEW: Mark secondaries stale after 60s
  
  // --- Connection Management ---
  maxPoolSizePerServer: 200,  // NEW: Per-server limit
  waitQueueTimeoutMS: 10000,  // NEW: Timeout waiting for connection
  
  // --- Monitoring ---
  maxPoolSizePerHost: 200,  // NEW: Track per-host limits
};

// Usage in connectDB:
export async function connectDB(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, OPTIONS);
      
      // NEW: Log connection pool status
      const client = mongoose.connection.getClient();
      logger.info({
        event: 'db_connected',
        poolSize: client.topology.s.sessionPool.s.totalSessionsCreated,
        connectionStatus: 'ready'
      });
      
      return;
    } catch(err) {
      logger.error(`Attempt ${attempt}/${retries}: ${err.message}`);
      if (attempt === retries) {
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
}

// NEW: Add monitoring middleware
export function addDBPoolMonitoring(app) {
  app.get('/health/db-pool', (req, res) => {
    const stats = mongoose.connection.getClient().topology.s.sessionPool.s;
    res.json({
      status: 'ok',
      poolSize: stats.totalSessionsCreated,
      availableConnections: stats.availableSessionsCount,
      checkedOutConnections: stats.checkedOutCount,
      usagePercent: ((stats.checkedOutCount / 200) * 100).toFixed(1),
      warning: stats.checkedOutCount > 180 ? 'Pool near capacity' : 'OK'
    });
  });
}

// Apply monitoring in server.js
addDBPoolMonitoring(app);
```

**Expected Performance Improvement:**
```
BEFORE (maxPoolSize: 50):
  50 concurrent requests: 0ms wait
  100 concurrent requests: Wait time increasing
  200+ concurrent requests: Timeouts (>30s)

AFTER (maxPoolSize: 200):
  50 concurrent requests: 0ms wait
  200 concurrent requests: 0-10ms wait
  400+ concurrent requests: Timeouts start
  
Capacity Improvement: 4x
```

---

### FIX #2: Email Uniqueness Compound Index

**Current Issue:**
```javascript
// models/base/user.base.js line 9
email: { type: String, required: true, unique: true }  // ← WRONG
  
// Line 60 is correct but line 9 overrides it
userBaseSchema.index({ email: 1, role: 1 }, { unique: true });
```

**Problem:**
```
User 1: { email: "john@example.com", role: "customer" } ✓
User 2: { email: "john@example.com", role: "merchant" } ✗ BLOCKED

Error: E11000 duplicate key error
Reason: Both unique: true indexes conflict
```

**Fix (Phase 1 - 30 mins):**

```javascript
// models/base/user.base.js - CORRECTED
const userBaseSchema = new Schema({
  // ... other fields ...
  
  email: {
    type: String,
    required: true,
    // REMOVE: unique: true,  ← DELETE THIS LINE
    unique: false,  // NEW: Explicitly false
    lowercase: true,
    trim: true,
    sparse: true,   // NEW: Optimize index usage
  },
  
  phone: {
    type: String,
    required: true,
    unique: true,   // Still globally unique
    trim: true,
  },
  
  // ... rest of schema ...
});

// Line 60 - KEEP UNCHANGED
userBaseSchema.index({ email: 1, role: 1 }, { unique: true });

// NEW: Add other important indexes
userBaseSchema.index({ role: 1, status: 1 });
userBaseSchema.index({ city: 1, role: 1 });
userBaseSchema.index({ createdAt: -1 });  // For pagination
userBaseSchema.index({ phone: 1, role: 1 });
```

**Migration (if already deployed):**
```javascript
// scripts/migrateEmailIndex.js
import mongoose from 'mongoose';
import User from '../src/models/base/user.base.js';

async function migrate() {
  const db = mongoose.connection.db;
  
  // Drop old index
  try {
    await db.collection('users').dropIndex('email_1');
    console.log('Dropped old email_1 index');
  } catch(err) {
    console.log('email_1 index does not exist');
  }
  
  // Create new compound index
  await db.collection('users').createIndex(
    { email: 1, role: 1 },
    { unique: true }
  );
  
  console.log('Created new email_1_role_1 index');
}

migrate().catch(console.error);
```

---

### FIX #3: Missing Database Indexes

**Current Performance Issue:**
```javascript
// Query without index:
db.orders.find({ status: 'in_transit' })

// MongoDB checks EVERY document
// Time: 10-30 seconds (at 1M+ orders)
```

**Implementation (Phase 1 - 1 day):**

```javascript
// models/Order.js - ADD after schema definition
const orderSchema = new Schema({ /* ... */ });

// --- Status and Lifecycle Indexes ---
orderSchema.index({ status: 1 });  // Most common filter
orderSchema.index({ status: 1, createdAt: -1 });  // Sorted status
orderSchema.index({ 'payment.status': 1 });  // Payment filtering

// --- Pagination and Sorting ---
orderSchema.index({ createdAt: -1 });  // Time-based sorting
orderSchema.index({ updatedAt: -1 });  // Recent updates

// --- User-based Queries ---
orderSchema.index({ customer: 1, status: 1 });  // My orders
orderSchema.index({ customer: 1, createdAt: -1 });  // My order history
orderSchema.index({ merchant: 1, status: 1 });  // Merchant orders
orderSchema.index({ pickman: 1, status: 1 });  // Rider orders

// --- Payment Tracking ---
orderSchema.index({ 'payment.status': 1, createdAt: -1 });  // Unpaid orders
orderSchema.index({ 'payment.paystackRef': 1 });  // Webhook lookup

// --- Timeline Queries ---
orderSchema.index({ 'timeline.timestamp': -1 });  // Recent activities

// --- Geospatial (nearby delivery spots) ---
orderSchema.index({ 'pickup.coordinates': '2dsphere' });
orderSchema.index({ 'delivery.coordinates': '2dsphere' });

// --- Archival Strategy (Phase 2) ---
orderSchema.index({ archivedAt: 1, createdAt: -1 });

// --- Compound Indexes (Common Together) ---
orderSchema.index({ customer: 1, status: 1, createdAt: -1 });
orderSchema.index({ pickman: 1, status: 1, createdAt: -1 });
orderSchema.index({ 'payment.status': 1, status: 1 });

export default mongoose.model('Order', orderSchema);
```

**Build Indexes on Existing Database:**

```bash
# Command line
mongo "mongodb+srv://user:pass@cluster.mongodb.net/offscape"

# In MongoDB shell
db.orders.createIndex({ status: 1 })
db.orders.createIndex({ status: 1, createdAt: -1 })
db.orders.createIndex({ customer: 1, status: 1 })
db.orders.createIndex({ customer: 1, createdAt: -1 })
# ... continue with all indexes

# Or programmatically
// scripts/buildIndexes.js
const Order = require('./models/Order');

async function buildIndexes() {
  try {
    await Order.collection.createIndex({ status: 1 });
    await Order.collection.createIndex({ status: 1, createdAt: -1 });
    // ... etc
    console.log('✅ All indexes built');
  } catch(err) {
    console.error('❌ Index build failed:', err);
  }
}

buildIndexes();
```

**Performance Improvement:**
```
BEFORE indexes:
  "Find all in-transit orders" - 15-30 seconds
  "Find customer's orders" - 10-20 seconds
  "Find unpaid orders" - 5-10 minutes (nightly job)

AFTER indexes:
  "Find all in-transit orders" - 100-500ms (50-100x faster)
  "Find customer's orders" - 50-200ms
  "Find unpaid orders" - 30-60 seconds (10x faster)
```

---

### FIX #4: Request Tracing (Observability)

**Current Issue:**
```
Log 1: [14:23:45] Error: Validation failed
Log 2: [14:23:45] Error: Database timeout
Log 3: [14:23:45] Error: Payment failed

Problem: Which error is from which request?
         Can't trace request through system
```

**Implementation (Phase 1 - 2-3 hours):**

```javascript
// server.js - ADD after Morgan middleware (line 57)
import crypto from 'crypto';

// Request ID middleware - FIRST middleware
app.use((req, res, next) => {
  // Generate unique ID per request
  req.id = crypto.randomUUID();
  
  // Add to response header
  res.setHeader('X-Request-ID', req.id);
  
  // Record start time
  req.startTime = Date.now();
  
  // Log request entry
  logger.info({
    event: 'request_start',
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent']?.substring(0, 100),
  });
  
  // Capture response
  const originalJson = res.json;
  res.json = function(data) {
    logger.info({
      event: 'request_response',
      requestId: req.id,
      status: res.statusCode,
      duration: `${Date.now() - req.startTime}ms`,
    });
    return originalJson.call(this, data);
  };
  
  next();
});

// Update error handler
// middleware/errorHandler.js
export function errorHandler(err, req, res, next) {
  // Log with request context
  logger.error({
    requestId: req.id,  // ← ADD THIS
    timestamp: new Date().toISOString(),
    message: err.message,
    code: err.code,
    status: err.statusCode || 500,
    path: req.path,
    method: req.method,
    userId: req.user?._id,
    duration: req.startTime ? `${Date.now() - req.startTime}ms` : 'unknown',
    stack: err.isOperational ? undefined : err.stack,
  });

  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message,
      code: err.code || 'ERROR',
      requestId: req.id,  // NEW: Return request ID to client
    });
  }

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    requestId: req.id,
    code: 'SERVER_ERROR'
  });
}
```

**Usage in Services/Controllers:**

```javascript
// Example: Order creation
export async function createOrder(req, res, next) {
  const requestId = req.id;  // From middleware
  
  try {
    logger.info({
      requestId,
      event: 'order_creation_started',
      customerId: req.body.customerId,
    });
    
    const order = await orderService.createOrder(
      req.body,
      requestId  // Pass to service
    );
    
    logger.info({
      requestId,
      event: 'order_creation_completed',
      orderId: order._id,
    });
    
    res.status(201).json({ success: true, order });
  } catch(err) {
    logger.error({
      requestId,
      event: 'order_creation_failed',
      error: err.message,
    });
    next(err);
  }
}

// In service layer
export async function createOrder(data, requestId) {
  logger.debug({
    requestId,
    event: 'calculating_fees',
  });
  
  const fees = await calculateOrderFee(data.pickup, data.delivery);
  
  logger.debug({
    requestId,
    event: 'saving_order_to_db',
  });
  
  const order = await Order.create(data);
  
  return order;
}
```

**Log Aggregation (Production):**

```
Winston logger writes to:
  - Console (development)
  - File (production)
  - Third-party service (Datadog, Splunk, ELK)

With request ID tracing:
  [2025-05-26 10:30:45] req:abc123 order_creation_started
  [2025-05-26 10:30:46] req:abc123 calculating_fees
  [2025-05-26 10:30:46] req:abc123 saving_order_to_db
  [2025-05-26 10:30:47] req:abc123 order_creation_completed

Now you can:
  - Search logs by request ID: requestId:abc123
  - See complete request timeline
  - Identify bottlenecks (which step is slow)
  - Debug production issues
```

---

## 🌐 DECENTRALIZED PLATFORM EXTENSION

### Architecture for Decentralization

**Vision:**
```
Centralized (Current):
  All orders → Single database
  All payments → Single payment processor
  All users trust → Single company
  
Decentralized (Future):
  Orders → Blockchain smart contracts
  Payments → Multiple payment processors / crypto
  Users → Self-sovereign identity
  Governance → DAO (Decentralized Autonomous Organization)
```

### Phase 1: Blockchain Order Recording

**Architecture Addition:**

```javascript
// services/blockchainService.js (NEW)
import Web3 from 'web3';
import contract from '../contracts/OffscapeOrders.json';

const web3 = new Web3(process.env.ETHEREUM_RPC_URL);
const offscapeContract = new web3.eth.Contract(
  contract.abi,
  process.env.OFFSCAPE_CONTRACT_ADDRESS
);

export async function recordOrderOnBlockchain(order) {
  try {
    // Create order hash (immutable record)
    const orderHash = web3.utils.soliditySha3(
      order._id.toString(),
      order.customer.toString(),
      order.merchant?.toString() || '0x0',
      order.pickup.coordinates.lat.toString(),
      order.pickup.coordinates.lng.toString(),
      order.delivery.coordinates.lat.toString(),
      order.delivery.coordinates.lng.toString(),
      order.fees.total.toString(),
      order.createdAt.getTime().toString()
    );
    
    // Record on blockchain
    const tx = await offscapeContract.methods.recordOrder(
      orderHash,
      order.customer.toString(),
      order.fees.total
    ).send({
      from: process.env.OFFSCAPE_WALLET_ADDRESS,
      gas: 200000,
    });
    
    logger.info({
      event: 'order_recorded_blockchain',
      orderId: order._id,
      txHash: tx.transactionHash,
      blockNumber: tx.blockNumber,
    });
    
    // Store blockchain reference
    order.blockchainTx = tx.transactionHash;
    order.blockchainHash = orderHash;
    await order.save();
    
    return tx;
  } catch(err) {
    logger.error({
      event: 'blockchain_recording_failed',
      orderId: order._id,
      error: err.message,
    });
    // Don't fail order creation if blockchain fails
  }
}

export async function verifyOrderOnBlockchain(orderId, orderHash) {
  try {
    const recorded = await offscapeContract.methods
      .getOrderHash(orderId)
      .call();
    
    return recorded === orderHash;  // Cryptographically verified
  } catch(err) {
    return false;
  }
}
```

**Smart Contract (Solidity):**

```solidity
// contracts/OffscapeOrders.sol
pragma solidity ^0.8.0;

contract OffscapeOrders {
  // Order hash registry
  mapping(bytes32 => OrderRecord) public orders;
  
  // Order structure
  struct OrderRecord {
    bytes32 orderHash;
    address customer;
    uint256 amount;
    uint256 timestamp;
    bool exists;
  }
  
  // Event for tracking
  event OrderRecorded(
    bytes32 indexed orderHash,
    address indexed customer,
    uint256 amount,
    uint256 timestamp
  );
  
  // Record order on blockchain
  function recordOrder(
    bytes32 orderHash,
    address customer,
    uint256 amount
  ) public onlyOwner returns (bool) {
    require(customer != address(0), "Invalid customer");
    require(amount > 0, "Invalid amount");
    
    orders[orderHash] = OrderRecord({
      orderHash: orderHash,
      customer: customer,
      amount: amount,
      timestamp: block.timestamp,
      exists: true
    });
    
    emit OrderRecorded(orderHash, customer, amount, block.timestamp);
    return true;
  }
  
  // Retrieve order hash
  function getOrderHash(bytes32 orderHash) 
    public 
    view 
    returns (bool exists, address customer, uint256 amount) 
  {
    OrderRecord storage order = orders[orderHash];
    return (order.exists, order.customer, order.amount);
  }
}
```

### Phase 2: Decentralized Payments (Multiple Processors)

```javascript
// services/paymentProcessor.js (NEW - Multi-gateway)
import paystackService from './paystackService';
import stripeService from './stripeService';
import flutterwaveService from './flutterwaveService';

export async function selectPaymentProcessor(customer, amount) {
  // Logic: Choose best processor based on:
  // - Customer location
  // - Payment method preference
  // - Processor fees
  // - Availability
  
  if (customer.country === 'NG') {
    if (customer.preferredProcessor === 'paystack') {
      return paystackService;
    }
    return paystackService;  // Default for Nigeria
  } else if (customer.country === 'KE') {
    return mpesaService;
  } else {
    return stripeService;
  }
}

export async function processPaymentMultiGateway(orderData) {
  const processors = [
    paystackService,
    flutterwaveService,
    // Add more
  ];
  
  for (const processor of processors) {
    try {
      const result = await processor.charge(
        orderData.amount,
        orderData.email
      );
      
      if (result.success) {
        return {
          processor: processor.name,
          reference: result.reference,
          ...result
        };
      }
    } catch(err) {
      logger.warn(`${processor.name} failed, trying next...`);
      continue;
    }
  }
  
  throw new PaymentError('All payment processors failed');
}
```

### Phase 3: Distributed Identity (Self-Sovereign Identity)

```javascript
// services/identityService.js (NEW - DID Implementation)
import { VerifiableCredential, VerifiablePresentation } from '@veramo/core';

export async function issueUserCredential(user) {
  // Issue verifiable credential for user identity
  // Uses DID (Decentralized Identifier)
  
  const credential = {
    '@context': 'https://www.w3.org/2018/credentials/v1',
    type: ['VerifiableCredential', 'OffscapeUserCredential'],
    issuer: process.env.OFFSCAPE_DID,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: user.did,  // Decentralized Identifier
      name: user.firstName + ' ' + user.lastName,
      email: user.email,
      role: user.role,
      verifiedAt: new Date().toISOString(),
    },
    // Signed proof
    proof: await signCredential(credential),
  };
  
  return credential;
}

export async function verifyUserPresentation(presentation) {
  // Verify that user owns their DID
  // Verify credentials in presentation
  
  try {
    const verified = await verifier.verify(presentation);
    return verified.verified;  // true if all signatures valid
  } catch(err) {
    return false;
  }
}

// User data model with DID
userSchema.add({
  did: { 
    type: String, 
    unique: true,
    // Format: did:ethereum:0x1234... or did:polygon:...
  },
  credentials: [{
    id: String,
    type: String,
    verified: Boolean,
    issuer: String,
    issuedAt: Date,
  }],
  keys: [{
    id: String,
    publicKey: String,
    type: 'RSA-2048',
  }],
});
```

### Phase 4: DAO Governance

```javascript
// services/daoService.js (NEW)
import { governance } from '../contracts/governance.abi';

export async function createGovernanceProposal(proposal) {
  // Any token holder can create proposal
  // Proposal examples:
  // - Change platform fee (5% → 4%)
  // - Add new delivery zone
  // - Allocate platform treasury funds
  
  const tx = await governanceContract.methods.createProposal(
    proposal.title,
    proposal.description,
    proposal.actions
  ).send({
    from: proposal.creator,
  });
  
  return {
    proposalId: tx.events.ProposalCreated.returnValues.proposalId,
    createdAt: new Date(),
    votingEnds: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
}

export async function voteOnProposal(proposalId, vote, voter) {
  // vote: 0 (against), 1 (for), 2 (abstain)
  // voter must hold OffscapeToken
  
  const votePower = await tokenContract.methods
    .balanceOf(voter)
    .call();
  
  if (votePower === 0) {
    throw new Error('Must hold OffscapeToken to vote');
  }
  
  const tx = await governanceContract.methods.vote(
    proposalId,
    vote,
    votePower
  ).send({ from: voter });
  
  return tx;
}

export async function executeProposal(proposalId) {
  // If voting passes, execute proposal
  // Examples:
  // - Update fee structure
  // - Add new zone
  // - Allocate treasury
  
  const proposal = await governanceContract.methods
    .getProposal(proposalId)
    .call();
  
  if (!proposal.passed) {
    throw new Error('Proposal did not pass');
  }
  
  const tx = await governanceContract.methods
    .executeProposal(proposalId)
    .send();
  
  return tx;
}
```

**Decentralization Timeline:**

```
PHASE 0 (NOW): Centralized
  ├─ MongoDB (single DB)
  ├─ Paystack (single payment processor)
  ├─ Admin-controlled
  └─ Capacity: ~1B req/day

PHASE 1 (Month 9-12): Blockchain Recording
  ├─ Orders recorded on-chain
  ├─ Immutable order history
  ├─ Blockchain proof-of-delivery
  └─ Capacity: Same, add blockchain layer

PHASE 2 (Month 13-18): Multi-Gateway Payments
  ├─ Paystack + Stripe + Flutterwave
  ├─ Crypto payments (stablecoins)
  ├─ No single processor dependency
  └─ Reduced payment failures

PHASE 3 (Month 19-24): Decentralized Identity
  ├─ Self-sovereign identity (DID)
  ├─ Verifiable credentials
  ├─ Users own their data
  ├─ No central database
  └─ Data portability

PHASE 4 (Year 2+): DAO Governance
  ├─ Token holders vote on decisions
  ├─ Decentralized platform governance
  ├─ Community-controlled fee structure
  ├─ Treasury managed by DAO
  └─ Truly decentralized platform
```

---

## 👥 TEAM COLLABORATION & SCALING GUIDE

### Development Team Structure

**Suggested Team Organization (As You Scale):**

```
Director/CTO
  ├─ Backend Team Lead
  │  ├─ Senior Developer (Database, Scaling)
  │  ├─ Senior Developer (API, Services)
  │  └─ Mid-level Developer (Features, Tests)
  │
  ├─ Frontend Team Lead
  │  ├─ Senior Developer (Architecture)
  │  └─ Mid-level Developer (Features)
  │
  ├─ DevOps Team Lead
  │  ├─ DevOps Engineer (Infrastructure)
  │  └─ DevOps Engineer (Monitoring)
  │
  ├─ Data/Analytics Engineer
  │  └─ Business Intelligence
  │
  └─ QA Lead
     ├─ QA Engineer (Manual)
     └─ QA Engineer (Automation)
```

### Sharing Code Architecture with Team

**Document Structure for Team Onboarding:**

```
1. Architecture Overview (1-2 hours)
   ├─ Read: ARCHITECTURE-ROADMAP.md
   ├─ Study: ARCHITECTURE-DIAGRAM.md
   └─ Understanding: How system works

2. Code Architecture Deep-Dive (2-3 hours)
   ├─ Read: TECHNICAL-CODE-ARCHITECTURE.md (this document)
   ├─ Study: models/, routes/, services/
   └─ Task: Trace one request end-to-end

3. First Task Assignment (1-2 days)
   ├─ Small bugfix or feature
   ├─ Uses routing, controller, service layers
   └─ Goal: Understand request pipeline

4. Scaling Phase Assignment (ongoing)
   ├─ Assign by phase (1, 2, 3, 4)
   ├─ Everyone knows what's next
   └─ Parallel work possible
```

### Phase-Based Work Assignment

**Phase 1 Tasks (Database & Performance):**

```
Task 1: Database Connection Pool Upgrade
  Owner: Backend Team Lead
  Time: 2-3 days
  Implementation:
    - Increase maxPoolSize 50 → 200
    - Add monitoring endpoint
    - Load test
  PR Review: Critical, performance metrics required

Task 2: Add Missing Indexes
  Owner: Senior Developer (Database)
  Time: 1-2 days
  Implementation:
    - Add 15+ indexes to Order and User schemas
    - Build indexes on prod database
    - Monitor query performance
  PR Review: Query plan analysis required

Task 3: Request Tracing
  Owner: Mid-level Developer
  Time: 1-2 days
  Implementation:
    - Add request ID middleware
    - Update all logging calls
    - Add /health/tracing endpoint
  PR Review: Logging consistency check

Task 4: Redis Cluster Planning
  Owner: DevOps Team Lead
  Time: 3-5 days
  Implementation:
    - Design cluster topology (3 nodes)
    - Update client config
    - Test failover
  PR Review: Failover tests passing
```

**Phase 2 Tasks (Microservices Setup):**

```
Task 1: API Gateway (Kong)
  Owner: DevOps Engineer
  Time: 5-7 days
  Services affected:
    - All API routes go through gateway
    - Rate limiting at gateway level
    - Request routing to microservices
  Dependencies: Kubernetes setup

Task 2: Split Auth Service
  Owner: Senior Developer (API)
  Time: 7-10 days
  New service:
    - Independent authentication service
    - Shared JWT validation
    - Token endpoints isolated
  Dependencies: API Gateway

Task 3: Split Order Service
  Owner: Senior Developer (Database)
  Time: 7-10 days
  New service:
    - Order creation, assignment
    - Payment integration
    - Real-time order updates
  Dependencies: API Gateway, Job Queue
```

### Code Review Checklist (Per Phase)

**Phase 1 Review Checklist:**

```
Database/Performance Changes:
  ☐ Query performance metrics included
  ☐ Load test results provided
  ☐ Database pool settings documented
  ☐ Index build strategy clear
  ☐ Monitoring dashboard added
  ☐ No breaking changes to API
  ☐ Backward compatible

Request Tracing:
  ☐ All log calls include requestId
  ☐ X-Request-ID returned in response
  ☐ /health/tracing endpoint works
  ☐ No sensitive data in logs
  ☐ Log aggregation setup complete

Testing:
  ☐ Unit tests added/updated
  ☐ Integration tests pass
  ☐ Load test results included
  ☐ No performance regression
```

**Phase 2 Review Checklist:**

```
Microservices Changes:
  ☐ Service has own database
  ☐ API Gateway integration tested
  ☐ Service discovery configured
  ☐ Health check endpoint provided
  ☐ Service-to-service auth setup
  ☐ Error handling for network failures
  ☐ Circuit breakers implemented
  ☐ Load test at expected scale
  ☐ Graceful shutdown implemented
  ☐ Logging & monitoring integrated

Deployment:
  ☐ Docker image builds
  ☐ Kubernetes manifests valid
  ☐ ConfigMaps for env vars
  ☐ Persistent volume claims correct
  ☐ Resource limits appropriate
  ☐ Liveness/readiness probes set
  ☐ Horizontal Pod Autoscaler config
```

### Knowledge Sharing Documents

**For Each Phase, Create:**

1. **Architecture Decision Record (ADR)**
   ```
   # ADR-001: Redis Clustering Strategy
   
   Date: 2025-06-01
   Status: Accepted
   
   Context:
     Redis single instance bottleneck at 50K ops/sec
     
   Decision:
     Implement Redis Cluster with 3 nodes
     
   Rationale:
     - 150K ops/sec capacity
     - Auto-failover
     - Data persistence
     
   Consequences:
     - More complex operations
     - Key distribution logic needed
     - 2x infrastructure cost
     
   Alternatives Considered:
     - Redis Sentinel (simpler)
     - In-memory cache (limited)
   ```

2. **Implementation Guide**
   ```
   # Phase 1 Implementation Guide
   
   Prerequisites:
     - MongoDB 4.4+
     - Node.js 18+
     - Redis 7.0+
   
   Steps:
     1. Backup current database
     2. Update database.js with new options
     3. Build indexes (step-by-step)
     4. Add request tracing middleware
     5. Deploy and monitor
   
   Rollback Plan:
     - Revert database.js
     - Rebuild old indexes
     - Downgrade if critical
   ```

3. **Monitoring Playbook**
   ```
   # Phase 1 Monitoring Playbook
   
   Key Metrics:
     - DB connection pool usage
     - Query latency (p50, p95, p99)
     - Request processing time
     - Error rates
   
   Alerts to Set:
     - Pool usage > 90%
     - Query latency > 1s
     - Error rate > 0.1%
   
   Response Procedures:
     - Alert fires → Check dashboard
     - Diagnose using request traces
     - Scale or optimize as needed
   ```

### Git Workflow (Team Coordination)

**Branch Strategy:**

```
main
  ├─ develop (staging)
  │  ├─ feature/phase1-db-pool (PR #1)
  │  ├─ feature/phase1-indexes (PR #2)
  │  ├─ feature/phase1-tracing (PR #3)
  │  └─ feature/phase2-api-gateway (PR #4)
  │
  └─ production (releases only)
     ├─ release/v1.1.0 (Phase 1 complete)
     └─ release/v2.0.0 (Phase 2 complete)

Commit Convention:
  [PHASE-1] feat: Increase database pool to 200
  [PHASE-1] fix: Add compound email+role index
  [PHASE-2] feat: Implement API gateway routing
  [PHASE-2] ops: Add Kubernetes manifests
```

---

## 📊 SUMMARY: Complete Technical Reference

This document covers:

✅ **Code Organization** - Where everything lives  
✅ **Request Pipeline** - How requests flow through middleware  
✅ **Database Architecture** - Connection pooling, schemas, indexes  
✅ **Authentication** - JWT flows, token management  
✅ **Real-Time Updates** - Socket.IO setup and pub/sub  
✅ **Service Patterns** - External APIs, calculations, business logic  
✅ **Critical Fixes** - Implementation details for all issues  
✅ **Decentralization** - Smart contracts, DIDs, governance  
✅ **Team Collaboration** - Onboarding, code review, knowledge sharing  

**Total Content:** Deep technical reference for independent code modification and team collaboration

**Usage:** Use as reference when:
- Making architectural decisions
- Implementing new features
- Fixing critical issues
- Training team members
- Planning scaling phases

---

**Document Status:** ✅ Complete  
**Version:** 1.0  
**Last Updated:** 2025-05-26  
**Audience:** Architects, Senior Developers, Tech Leads
