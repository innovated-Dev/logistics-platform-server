// src/middleware/rateLimiter.js
// Rate limiters are differentiated by endpoint sensitivity.
// All counters live in Redis so limits are shared across every
// cluster worker — a user cannot bypass limits by routing to
// a different process.
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-Down';
import RedisStore from 'rate-limit-redis';
import { getRedis } from '../config/redis.js';

function makeStore(prefix) {
  return new RedisStore({
    sendCommand: (...args) => getRedis().call(...args),
    prefix: `rl:${prefix}:`,
  });
}
// === RATE LIMITERS (Hard Block) ===

/**
 * Login(Auth endpoint) Rate Limiter
 * Purpose: Prevent brute force password attacks
 * Limit: 5 attempts per 15 minutes per IP
 */
export const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // I5 minutes
  max:              5,
  store:            makeStore('login'),
  standardHeaders:  true, // Return rate limit info in `RateLimit - *` headers
  legacyHeaders:    false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: true,   // Skip successful logins only failed attempts count
  message: { 
    success: false, 
    message: 'Too many attempts. Please wait 15 minutes and try again.', 
    retryAfter: 15 * 60 * 1000, // milliseconds
    code: 'RATE_LIMITED' 
  },

  handler:(req, res) => {
    res.status(429).json({
      message: "Too many login attempts. Please try again later.",
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000), //V2: resetTime is now a Date object
      tooManyRequests:true
    });
  }  
});

/**
 * OTP Verification Rate Limiter
 * Purpose: Prevent OTP brute force
 * Limit: 5 attempts per 10 minutes per IP
 */

export const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  store:     makeStore('otp-verify'),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      messsage: 'Too many verification attempts. please wait before trying again.',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000),
      tooManyRequests:true
    });
  },
});

/**
 * OTP Resend Rate Limiter
 * Purpose: Prevent email spam
 * Limit: 3 resends per hour per IP
*/
export const otpResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  store:     makeStore('otp-resend'),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: 'You have requested too many OTPs. Please wait before requesting another.',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000),
      tooManyRequests: true
    });
  },
});


/**
 * Password Reset Rate Limiter  — even stricter (prevents email bombing)
 * Purpose: Prevent password reset spam/abuse
 * Limit: 3 attempts per hour per IP
 */
export const passWordResetLimiter = rateLimit({
  windowMs:  60 * 60 * 1000,  // 1 hour
  max:       3,
  store:     makeStore('reset'),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message:   { success: false, message: 'Too many password reset requests. Please try again in 1 hour.', code: 'RATE_LIMITED' },
});

/**
 * Payment/Critical Actions Rate Limiter
 * Purpose: Prevent financial fraud
 * Limit: 8 requests per hour per IP
 */
export const criticalActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 8,
  store:     makeStore('critical-action'),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API Rate Limiter - generous but still protective
 * Purpose: Prevent API abuse
 * Limit: 100 requests per 15 minutes per IP
*/
export const apiLimiter = rateLimit({
  windowMs:  60 * 1000,  // 1 minute
  max:       100,
  store:     makeStore('api'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Slow down.', code: 'RATE_LIMITED' },
});

// Payment initiation — prevent double-charges
export const paymentLimiter = rateLimit({
  windowMs:  60 * 1000,
  max:       5,
  store:     makeStore('payment'),
  message:   { success: false, message: 'Too many payment requests.', code: 'RATE_LIMITED' },
});


// ==================== SLOW DOWN V2 (Progressive Delay) ====================

/**
 * Signup Slowdown (v2)
 * Purpose: Slow down spam bots without blocking legitimate users
 * Starts delaying after 3 signups per hour
 * 
 * V2 Changes:
 * - delayMs is now a function: (used, req) => milliseconds
 * - delayAfter renamed to more explicit configuration
 */

export const signupSlowdown = slowDown({
  windowMs: 60 * 60 * 1000, // 1 hour 
  delayAfter: 3, //Start slowing after 3 requests

  //V2: delayMs is now a function 
  // Retruns delay in milliseconds based on how many request over the limit 
  delayMs: (used, req) => {
    const delayAfter = 3;
    const requestsOverLimit = used - delayAfter;
    
    // Each request over limit adds 1 second (1000ms)
    return requestsOverLimit * 1000;
  },

  maxDelayMs: 20000, // Max 20 seconds delay
  
  // V2: Custom validation (optional)
  validate: {
    // Ensure IP is valid
    ip: true,
    // Disable trustProxy if not behind proxy
    trustProxy: true,
  },
}); 

/**
 * Search/Query Slowdown (v2)
 * Purpose: Prevent database overload from excessive searches
 * Starts delaying after 20 searches per minute
 */
export const searchSlowdown = slowDown({
  windowMs: 60 * 1000, // 1 minute
  delayAfter: 20, // Start slowing after 20 requests
  
  // V2: Progressive delay function
  delayMs: (used) => {
    const delayAfter = 20;
    const requestsOverLimit = used - delayAfter;
    
    // Each request over limit adds 200ms
    return requestsOverLimit * 200;
  },
  
  maxDelayMs: 5000, // Max 5 seconds delay
  
  validate: {
    ip: true,
    trustProxy: true,
  },
});

/**
 * Contact Form Slowdown (v2)
 * Purpose: Prevent spam submissions
 * Starts delaying after 2 submissions per 15 minutes
 */
export const contactSlowdown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2, // Start slowing after 2 requests
  
  // V2: More aggressive delay for contact spam
  delayMs: (used) => {
    const delayAfter = 2;
    const requestsOverLimit = used - delayAfter;
    
    // Each request over limit adds 2 seconds (2000ms)
    return requestsOverLimit * 2000;
  },
  
  maxDelayMs: 30000, // Max 30 seconds delay
  
  validate: {
    ip: true,
    trustProxy: true,
  },
});

/**
 * Public Tracking Slowdown (v2)
 * Purpose: Prevent scraping of tracking data
 * Starts delaying after 10 lookups per minute
 */
export const trackingSlowdown = slowDown({
  windowMs: 60 * 1000, // 1 minute
  delayAfter: 10, // Start slowing after 10 requests
  
  // V2: Moderate delay to discourage scraping
  delayMs: (used) => {
    const delayAfter = 10;
    const requestsOverLimit = used - delayAfter;
    
    // Each request over limit adds 500ms
    return requestsOverLimit * 500;
  },
  
  maxDelayMs: 10000, // Max 10 seconds delay
  
  validate: {
    ip: true,
    trustProxy: true,
  },
});

export const uploadSlowdown = slowDown({
  windowMs: 10 * 60 * 1000, // 10 minutes
  delayAfter: 5, // Start slowing after 5 uploads
  
  // V2: Heavier delay for uploads (bandwidth intensive)
  delayMs: (used) => {
    const delayAfter = 5;
    const requestsOverLimit = used - delayAfter;
    
    // Each request over limit adds 1.5 seconds (1500ms)
    return requestsOverLimit * 1500;
  },
  
  maxDelayMs: 15000, // Max 15 seconds delay
  
  validate: {
    ip: true,
    trustProxy: true,
  },
});

/**
 * Advanced Example: Custom delay calculation
 * Exponential backoff - delay doubles with each request
 */
export const exponentialSlowdown = slowDown({
  windowMs: 60 * 1000, // 1 minute
  delayAfter: 5,
  
  // V2: Exponential delay (1s, 2s, 4s, 8s, 16s...)
  delayMs: (used) => {
    const delayAfter = 5;
    const requestsOverLimit = used - delayAfter;
    
    if (requestsOverLimit <= 0) return 0;
    
    // 2^(requests-1) * 1000ms
    // Request 6: 2^0 * 1000 = 1000ms (1s)
    // Request 7: 2^1 * 1000 = 2000ms (2s)
    // Request 8: 2^2 * 1000 = 4000ms (4s)
    // Request 9: 2^3 * 1000 = 8000ms (8s)
    return Math.pow(2, requestsOverLimit - 1) * 1000;
  },
  
  maxDelayMs: 30000, // Cap at 30 seconds
  
  validate: {
    ip: true,
    trustProxy: true,
  },
});

/**
 * Advanced Example: Custom delay with request info
 * Different delays based on endpoint or user
 */
export const customSlowdown = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 10,
  
  // V2: Access to req object for custom logic
  delayMs: (used, req) => {
    const delayAfter = 10;
    const requestsOverLimit = used - delayAfter;
    
    if (requestsOverLimit <= 0) return 0;
    
    // Example: Slower delay for authenticated users (less strict)
    // Faster delay for anonymous users (more strict)
    const isAuthenticated = req.headers.authorization;
    const baseDelay = isAuthenticated ? 200 : 500;
    
    return requestsOverLimit * baseDelay;
  },
  
  maxDelayMs: 10000,
  
  validate: {
    ip: true,
    trustProxy: true,
  },
});

