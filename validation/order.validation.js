// src/validation/order.validation.js
import Joi from 'joi';

const ZONES = ['Bodija', 'UI', 'Agbowo', 'Challenge', 'Sango', 'Mokola', 'Dugbe'];
const PAYMENT_METHODS  = ['wallet', 'paystack', 'cod'];
const ASSIGNMENT_MODES = ['auto', 'budget', 'open_bid'];
const PACKAGE_CATEGORIES = ['document', 'small_parcel', 'large_parcel', 'fragile'];
const SPEED_OPTIONS = ['standard', 'express'];

// Reusable coordinate sub-schema
const coordsSchema = Joi.object({
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
});

// Reusable address sub-schema
const addressSchema = Joi.object({
  address:  Joi.string().trim().min(5).max(300).required().messages({
    'string.min':   'Address must be at least 5 characters',
    'string.empty': 'Address is required',
  }),
  landmark: Joi.string().trim().max(200).optional().allow('', null),
  lat:      Joi.number().optional(),
  lng:      Joi.number().optional(),
  city:     Joi.string().trim().optional(),
});

// ── Order creation ──
export const createOrderSchema = Joi.object({
  pickup: addressSchema.keys({
    senderName:  Joi.string().trim().min(2).max(100).required().messages({
      'string.empty': 'Sender name is required',
    }),
    senderPhone: Joi.string().pattern(/^(?:\+234|0)[7-9][0-1]\d{8}$/).required().messages({
      'string.pattern.base': 'Please provide a valid sender phone number',
      'string.empty':        'Sender phone is required',
    }),
  }).required(),

  delivery: addressSchema.keys({
    recipientName:  Joi.string().trim().min(2).max(100).required().messages({
      'string.empty': 'Recipient name is required',
    }),
    recipientPhone: Joi.string().pattern(/^(?:\+234|0)[7-9][0-1]\d{8}$/).required().messages({
      'string.pattern.base': 'Please provide a valid recipient phone number',
      'string.empty':        'Recipient phone is required',
    }),
  }).required(),

  package: Joi.object({
    category:      Joi.string().valid(...PACKAGE_CATEGORIES).required().messages({
      'any.only':     `Package category must be one of: ${PACKAGE_CATEGORIES.join(', ')}`,
      'string.empty': 'Package category is required',
    }),
    description:   Joi.string().trim().max(300).optional().allow('', null),
    weight:        Joi.number().positive().max(100).default(1).messages({
      'number.positive': 'Weight must be a positive number',
      'number.max':      'Maximum weight is 100kg',
    }),
    quantity:      Joi.number().integer().positive().max(100).default(1),
    declaredValue: Joi.number().min(0).max(10_000_000).default(0).messages({
      'number.min': 'Declared value cannot be negative',
      'number.max': 'Declared value cannot exceed ₦10,000,000',
    }),
    fragile:  Joi.boolean().default(false),
    speed:    Joi.string().valid(...SPEED_OPTIONS).default('express').messages({
      'any.only': `Speed must be one of: ${SPEED_OPTIONS.join(', ')}`,
    }),
    insured:  Joi.boolean().default(false),
  }).required(),

  payment: Joi.object({
    method: Joi.string().valid(...PAYMENT_METHODS).required().messages({
      'any.only':     `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`,
      'string.empty': 'Payment method is required',
    }),
  }).required(),

  assignmentMode: Joi.string().valid(...ASSIGNMENT_MODES).default('auto').messages({
    'any.only': `Assignment mode must be one of: ${ASSIGNMENT_MODES.join(', ')}`,
  }),

  // Merchant-only: budget cap for 'budget' and 'open_bid' modes
  budgetCap: Joi.number().positive().optional().messages({
    'number.positive': 'Budget cap must be a positive number',
  }),
});

// ── Fee quote (no auth required, lighter schema) ──
export const getQuoteSchema = Joi.object({
  pickup: Joi.object({
    address: Joi.string().trim().min(5).required().messages({
      'string.empty': 'Pickup address is required',
    }),
    lat: Joi.number().optional(),
    lng: Joi.number().optional(),
    city: Joi.string().optional(),
  }).required(),

  delivery: Joi.object({
    address: Joi.string().trim().min(5).required().messages({
      'string.empty': 'Delivery address is required',
    }),
    lat: Joi.number().optional(),
    lng: Joi.number().optional(),
    city: Joi.string().optional(),
  }).required(),

  package: Joi.object({
    category:      Joi.string().valid(...PACKAGE_CATEGORIES).default('small_parcel'),
    weight:        Joi.number().positive().max(100).default(1),
    speed:         Joi.string().valid(...SPEED_OPTIONS).default('express'),
    declaredValue: Joi.number().min(0).default(0),
    insured:       Joi.boolean().default(false),
  }).optional(),

  paymentMethod: Joi.string().valid(...PAYMENT_METHODS).default('paystack'),
});

// ── Cancel order ──
export const cancelOrderSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required().messages({
    'string.min':   'Please provide a reason with at least 5 characters',
    'string.empty': 'Cancellation reason is required',
  }),
});

// ── Confirm delivery (COD requires OTP) ──
export const confirmDeliverySchema = Joi.object({
  otp: Joi.string().length(6).pattern(/^\d+$/).optional().messages({
    'string.length':       'OTP must be 6 digits',
    'string.pattern.base': 'OTP must contain only numbers',
  }),
});

// ── Rate a delivered order ──
export const rateOrderSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.min':  'Rating must be at least 1',
    'number.max':  'Rating cannot exceed 5',
    'any.required': 'Rating is required',
  }),
  comment: Joi.string().trim().max(500).optional().allow('', null),
});

// ── Open dispute on an order ──
export const openDisputeSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(1000).required().messages({
    'string.min':   'Please describe the issue in at least 10 characters',
    'string.empty': 'Dispute reason is required',
  }),
});

// ── Pickman submits a bid on a merchant open-bid order ──
export const submitBidSchema = Joi.object({
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Bid amount must be a positive number',
    'any.required':    'Bid amount is required',
  }),
  note: Joi.string().trim().max(300).optional().allow('', null),
});

// ── List orders query params ──
export const listOrdersQuerySchema = Joi.object({
  status: Joi.string().valid(
    'pending','assigned','pickup_in_progress',
    'picked_up','in_transit','delivered','cancelled','disputed'
  ).optional(),
  page:  Joi.number().integer().positive().default(1),
  limit: Joi.number().integer().positive().max(100).default(20),
});