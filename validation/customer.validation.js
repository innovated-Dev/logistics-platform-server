// src/validation/customer.validation.js
import Joi from 'joi';

const nigerianPhone = Joi.string()
  .pattern(/^0[7-9][0-1]\d{8}$/)
  .required()
  .messages({
    'string.pattern.base': 'Please provide a valid Nigerian phone number',
    'string.empty':        'Phone number is required',
});


export const customerSignupSchema = Joi.object({
   firstName:          Joi.string().trim().min(2).max(50).required().messages({
    'string.min':   'Name must be at least 2 characters',
    'string.empty': 'Name is required',
  }),
  lastName:          Joi.string().trim().min(2).max(50).required().messages({
    'string.min':   'Name must be at least 2 characters',
    'string.empty': 'Name is required',
  }),
  email:    Joi.string().email().lowercase().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
  }),
  phone:    nigerianPhone,
  password: Joi.string().min(8).max(128).required().messages({
    'string.min':   'Password must be at least 8 characters',
    'string.empty': 'Password is required',
  }),
  city: Joi.string().valid('ibadan', 'lagos').required().messages({
    'any.only': 'City must be ibadan or lagos',
  }),
});

export const customerLoginSchema = Joi.object({
  email:    Joi.string().email().required(),  
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
  }),
});




