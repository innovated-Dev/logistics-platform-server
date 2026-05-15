// src/middleware/errorHandler.js
// Global Express error handler — must be registered LAST with app.use().
// Catches errors thrown from controllers and services, maps them to
// the correct HTTP status, and ensures the response shape is always
// { success, message, code } so the frontend api.js can parse it uniformly.
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  // Log every error with request context for traceability
  logger.error({
    message: err.message,
    code:    err.code,
    status:  err.statusCode,
    path:    req.path,
    method:  req.method,
    userId:  req.user?._id,
    stack:   err.isOperational ? undefined : err.stack,  // stack only for bugs
  });

  // Operational errors — expected failures (bad input, auth fail, not found)
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message,
      code:    err.code || 'ERROR',
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({
      success: false,
      message: `${field ? field.charAt(0).toUpperCase() + field.slice(1) : 'Value'} already registered`,
      code: 'CONFLICT',
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: messages[0],
      code: 'VALIDATION_ERROR',
    });
  }

  // Mongoose cast error (bad ObjectId in URL param)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      code: 'BAD_REQUEST',
    });
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 5MB.',
      code: 'FILE_TOO_LARGE',
    });
  }

  // Unknown programmer errors — never expose stack trace in production
  const message = process.env.NODE_ENV === 'production'
    ? 'An internal error occurred. Our team has been notified.'
    : err.message;

  res.status(500).json({ success: false, message, code: 'SERVER_ERROR' });
}

// ── 404 handler — register before errorHandler ──
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
  });
}