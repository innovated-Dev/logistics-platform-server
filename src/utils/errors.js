// src/utils/errors.js — Custom error classes
// Throwing these in controllers lets the global error handler
// pick up the HTTP status and message automatically.

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // vs programmer errors
  }
}

export class ValidationError  extends AppError { constructor(m) { super(m, 400, 'VALIDATION_ERROR'); } }
export class AuthError        extends AppError { constructor(m) { super(m, 401, 'UNAUTHORIZED'); } }
export class ForbiddenError   extends AppError { constructor(m) { super(m, 403, 'FORBIDDEN'); } }
export class NotFoundError    extends AppError { constructor(m) { super(m, 404, 'NOT_FOUND'); } }
export class ConflictError    extends AppError { constructor(m) { super(m, 409, 'CONFLICT'); } }
export class PaymentError     extends AppError { constructor(m) { super(m, 402, 'PAYMENT_ERROR'); } }