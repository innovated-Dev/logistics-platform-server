// src/validation/wallet.validation.js
import Joi from 'joi';

const NETWORKS = ['mtn', 'airtel', 'glo', 'etisalat'];

// ── Initiate Paystack top-up ──
export const initiateTopupSchema = Joi.object({
  amount: Joi.number().positive().min(100).required().messages({
    'number.min':      'Minimum top-up is ₦100',
    'number.positive': 'Amount must be a positive number',
    'any.required':    'Amount is required',
  }),
});

// ── Verify Paystack payment (query param) ──
export const verifyTopupQuerySchema = Joi.object({
  ref: Joi.string().trim().required().messages({
    'string.empty': 'Payment reference is required',
  }),
});

// ── Verify bank account before withdrawal ──
export const verifyBankSchema = Joi.object({
  accountNumber: Joi.string().length(10).pattern(/^\d+$/).required().messages({
    'string.length':       'Account number must be exactly 10 digits',
    'string.pattern.base': 'Account number must contain only digits',
    'string.empty':        'Account number is required',
  }),
  bankCode: Joi.string().trim().required().messages({
    'string.empty': 'Bank code is required',
  }),
});

// ── Withdraw to bank ──
export const withdrawSchema = Joi.object({
  amount: Joi.number().positive().min(500).required().messages({
    'number.min':      'Minimum withdrawal is ₦500',
    'number.positive': 'Amount must be positive',
    'any.required':    'Amount is required',
  }),
  accountNumber: Joi.string().length(10).pattern(/^\d+$/).required().messages({
    'string.length':       'Account number must be exactly 10 digits',
    'string.pattern.base': 'Account number must contain only digits',
    'string.empty':        'Account number is required',
  }),
  bankCode: Joi.string().trim().required().messages({
    'string.empty': 'Bank code is required',
  }),
  bankName: Joi.string().trim().required().messages({
    'string.empty': 'Bank name is required',
  }),
  accountName: Joi.string().trim().required().messages({
    'string.empty': 'Account name is required',
  }),
});

// ── Airtime to wallet conversion ──
export const convertAirtimeSchema = Joi.object({
  network: Joi.string().valid(...NETWORKS).required().messages({
    'any.only':     `Network must be one of: ${NETWORKS.join(', ')}`,
    'string.empty': 'Network is required',
  }),
  amount: Joi.number().positive().min(100).required().messages({
    'number.min':   'Minimum airtime conversion is ₦100',
    'any.required': 'Amount is required',
  }),
});

// ── Wallet transaction list query ──
export const transactionQuerySchema = Joi.object({
  page:  Joi.number().integer().positive().default(1),
  limit: Joi.number().integer().positive().max(100).default(30),
  type:  Joi.string().valid('credit', 'debit').optional(),
});