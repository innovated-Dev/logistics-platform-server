// src/validation/admin.validation.js
import Joi from 'joi';

// ── KYC approval ──
export const approveKycSchema = Joi.object({
  guarantorCallVerified: Joi.boolean().required().messages({
    'any.required': 'Please confirm whether the guarantor call was completed',
  }),
  callNotes: Joi.when('guarantorCallVerified', {
    is:   true,
    then: Joi.string().trim().min(5).max(1000).required().messages({
      'string.min':   'Call notes must be at least 5 characters',
      'string.empty': 'Call notes are required when guarantor was verified',
    }),
    otherwise: Joi.string().trim().max(1000).optional().allow('', null),
  }),
});

// ── KYC rejection ──
export const rejectKycSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required().messages({
    'string.min':   'Rejection reason must be at least 5 characters',
    'string.empty': 'Rejection reason is required',
  }),
});

// ── Suspend a user ──
export const suspendUserSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required().messages({
    'string.min':   'Suspension reason must be at least 5 characters',
    'string.empty': 'Suspension reason is required',
  }),
});

// ── Resolve a dispute ──
export const resolveDisputeSchema = Joi.object({
  resolution: Joi.string().trim().min(10).max(2000).required().messages({
    'string.min':   'Resolution must be at least 10 characters',
    'string.empty': 'Resolution is required',
  }),
  refundAmount: Joi.number().positive().optional().messages({
    'number.positive': 'Refund amount must be positive',
  }),
  refundTarget: Joi.when('refundAmount', {
    is:        Joi.number().positive().exist(),
    then:      Joi.string().valid('customer', 'pickman').required().messages({
      'any.only':     'Refund target must be either customer or pickman',
      'any.required': 'Refund target is required when a refund amount is specified',
    }),
    otherwise: Joi.optional(),
  }),
});

// ── Top up compensation pool ──
export const topupPoolSchema = Joi.object({
  amount: Joi.number().positive().min(1000).required().messages({
    'number.min':      'Minimum pool top-up is ₦1,000',
    'number.positive': 'Amount must be positive',
    'any.required':    'Amount is required',
  }),
});

// ── User list query params ──
export const getUsersQuerySchema = Joi.object({
  role:   Joi.string().valid('customer', 'merchant', 'pickman', 'support').optional(),
  status: Joi.string().valid('active', 'suspended', 'pending_kyc').optional(),
  search: Joi.string().trim().max(100).optional().allow('', null),
  city:   Joi.string().trim().optional(),
  page:   Joi.number().integer().positive().default(1),
  limit:  Joi.number().integer().positive().max(100).default(30),
});

// ── Order list query params ──
export const getOrdersQuerySchema = Joi.object({
  status: Joi.string().valid(
    'pending','assigned','pickup_in_progress',
    'picked_up','in_transit','delivered','cancelled','disputed'
  ).optional(),
  city:  Joi.string().trim().optional(),
  page:  Joi.number().integer().positive().default(1),
  limit: Joi.number().integer().positive().max(100).default(30),
});

// ── Finance report query ──
export const financeQuerySchema = Joi.object({
  period: Joi.string().valid('today', 'week', 'month').default('today').messages({
    'any.only': "Period must be 'today', 'week', or 'month'",
  }),
});

// ── Platform config update (partial update — all fields optional) ──
export const updateConfigSchema = Joi.object({
  cancellation: Joi.object({
    earlyWindowMinutes:    Joi.number().integer().positive().optional(),
    earlyCompensation:     Joi.number().positive().optional(),
    lateCancelChargeRate:  Joi.number().min(0).max(100).optional(),
  }).optional(),

  assignment: Joi.object({
    timeoutSeconds: Joi.number().integer().positive().min(30).max(300).optional(),
  }).optional(),

  fees: Joi.object({
    baseFees: Joi.object({
      document:      Joi.number().positive().optional(),
      small_parcel:  Joi.number().positive().optional(),
      large_parcel:  Joi.number().positive().optional(),
      fragile:       Joi.number().positive().optional(),
    }).optional(),
    distanceRatePerKm: Joi.object({
      motorcycle: Joi.number().positive().optional(),
      car:        Joi.number().positive().optional(),
    }).optional(),
    platformFeePercent:  Joi.number().min(0).max(50).optional(),
    insuranceRatePercent: Joi.number().min(0).max(10).optional(),
    codHandlingFee:       Joi.number().min(0).optional(),
  }).optional(),
}).min(1).messages({
  'object.min': 'At least one config field must be provided',
});