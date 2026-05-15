// src/validation/merchant.validation.js
import Joi from 'joi';

const ZONES = ['Bodija', 'UI', 'Agbowo', 'Challenge', 'Sango', 'Mokola', 'Dugbe'];

const nigerianPhone = Joi.string()
  .pattern(/^0[7-9][0-1]\d{8}$/)
  .required()
  .messages({
    'string.pattern.base': 'Please provide a valid Nigerian phone number',
    'string.empty':        'Phone number is required',
  });

export const merchantSignupSchema = Joi.object({
   firstName:          Joi.string().trim().min(2).max(50).required().messages({
    'string.min':   'Name must be at least 2 characters',
    'string.empty': 'Name is required',
  }),
  lastName:          Joi.string().trim().min(2).max(50).required().messages({
    'string.min':   'Name must be at least 2 characters',
    'string.empty': 'Name is required',
  }),
  email:     Joi.string().email().lowercase().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
  }),
  phone:     nigerianPhone,
  password:  Joi.string().min(8).max(128).required().messages({
    'string.min':   'Password must be at least 8 characters',
    'string.empty': 'Password is required',
  }),
  city: Joi.string().valid('ibadan', 'lagos').required().messages({
      'any.only': 'City must be ibadan or lagos',
  }),
  businessName: Joi.string().trim().min(2).max(100).pattern(/^[a-zA-Z0-9\s&'.-]+$/).required().messages({
    'string.empty': 'Business name is required',
    'string.pattern.base': 'Business name contains invalid characters'
  }),
  businessType: Joi.string().valid('Fashion & Clothing', 'Electronics', 'Grocery & Food', 'Pharmacy', 'Documents & Printing', 'Furniture & Home', 'Other').required().messages({
    'any.only': 'Invalid business type selected'
  }),

  businessAddress: Joi.string().trim().min(10).max(200).required().messages({
    'string.empty': 'Business address is required',
    'string.min': 'Address is too short'
  }),
  
  cacNumber: Joi.string().trim().pattern(/^RC-\d{3,10}$/).optional().allow(' ').messages({
    'string.pattern.base': 'CAC number must be in format RC-123456'
  }),
});

export const merchantLoginSchema = Joi.object({
  email:    Joi.string().email().required(),  
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
  }),
});