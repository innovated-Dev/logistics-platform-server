// src/utils/response.js — Standardised JSON response helpers
// Every controller calls one of these instead of writing res.json() by hand.
// This guarantees a consistent shape across the entire API:
// Success: { success: true, data: {...} }
// Error:   { success: false, message: "...", code: "ERROR_CODE" }
// This shape is what api.js on the frontend relies on for error detection.

export const ok = (res, data = {}, status = 200) =>
  res.status(status).json({ success: true, ...data });

export const created = (res, data = {}) =>
  res.status(201).json({ success: true, ...data });

export const badRequest = (res, message, code = 'BAD_REQUEST') =>
  res.status(400).json({ success: false, message, code });

export const unauthorized = (res, message = 'Authentication required') =>
  res.status(401).json({ success: false, message, code: 'UNAUTHORIZED' });

export const forbidden = (res, message = 'Access denied') =>
  res.status(403).json({ success: false, message, code: 'FORBIDDEN' });

export const notFound = (res, message = 'Resource not found') =>
  res.status(404).json({ success: false, message, code: 'NOT_FOUND' });

export const conflict = (res, message) =>
  res.status(409).json({ success: false, message, code: 'CONFLICT' });

export const serverError = (res, message = 'Internal server error') =>
  res.status(500).json({ success: false, message, code: 'SERVER_ERROR' });