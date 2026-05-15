// src/validation/common.validation.js
import Joi from 'joi';

export const sseEmailSchema = Joi.object({
  email: Joi.string().email({ tlds:  {allow: true}}).required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required'
  })

});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: true } }).required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
  }),
});

export const verifyResetOTPSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: true } }).required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
  }),
  otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length':       'OTP must be 6 digits',
    'string.pattern.base': 'OTP must contain only numbers',
    'string.empty':        'OTP is required',
  }),
});

export const resendResetOTPSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: true } }).required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
  }),
});

export const resetPasswordSchema = Joi.object({
  password: Joi.string().min(8).max(128).required().messages({
    'string.min':   'Password must be at least 8 characters',
    'string.max':   'Password is too long',
    'string.empty': 'Password is required',
  }),
  passwordConfirm: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only':     'Passwords do not match',
    'string.empty': 'Password confirmation is required',
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Current password is required',
  }),
  newPassword: Joi.string().min(8).max(128).required().messages({
    'string.min':   'New password must be at least 8 characters',
    'string.empty': 'New password is required',
  }),
});

export const verifyEmailQuerySchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Verification token is required',
  }),
});