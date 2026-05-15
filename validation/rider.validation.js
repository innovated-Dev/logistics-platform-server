// src/validation/rider.validation.js
import Joi from 'joi';

const ZONE_IDS = [
  '69f296a3939ad811a2216fe9',
  '69f297abeea659cd534bf616',
  '69f297abeea659cd534bf617',
  '69f297abeea659cd534bf618',
  '69f297abeea659cd534bf619',
  '69f297aceea659cd534bf61a',
  '69f297aceea659cd534bf61b',
  '69f297aceea659cd534bf61c',
  '69f297aceea659cd534bf61d',
  '69f297aceea659cd534bf61e',
  '69f297aceea659cd534bf61f',
  '69f297aceea659cd534bf620',
  '69f297aceea659cd534bf621',
  '69f297aceea659cd534bf622',
  '69f297aceea659cd534bf623',
  '69f297aceea659cd534bf624',
  '69f297aceea659cd534bf625',
  '69f297aceea659cd534bf626',
  '69f297aceea659cd534bf627',
  '69f297aceea659cd534bf628',
  '69f297aceea659cd534bf629',
  '69f297aceea659cd534bf62a',
];

const VEHICLE_TYPES = ['motorcycle', 'bicycle', 'van', 'car'];

const KYC_DOCUMENT_TYPES = [
  'nin_document',
  'drivers_licence',
  'vehicle_insurance',
  'plate_photo',
  'guarantor_form',
];

// ── Reusable Nigerian phone rule ──
const nigerianPhone = Joi.string()
  .pattern(/^0[7-9][0-1]\d{8}$/)
  .required()
  .messages({
    'string.pattern.base': 'Please provide a valid Nigerian phone number (e.g. 08012345678)',
    'string.empty': 'Phone number is required',
    'any.required': 'Phone number is required',
  });

// ── Auth ──
export const riderSignupSchema = Joi.object({
  // ── Personal info ──
  firstName: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'First name must be at least 2 characters',
    'string.empty': 'First name is required',
    'any.required': 'First name is required',
  }),

  lastName: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Last name must be at least 2 characters',
    'string.empty': 'Last name is required',
    'any.required': 'Last name is required',
  }),

  email: Joi.string().email().lowercase().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
    'any.required': 'Email is required',
  }),

  phone: nigerianPhone,

  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
  }),

  city: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'City must be at least 2 characters',
    'string.empty': 'City is required',
    'any.required': 'City is required',
  }),

  // ── Zone ──
  operatingZoneId: Joi.string()
    .valid(...ZONE_IDS)
    .required()
    .messages({
      'any.only': `Operating zone must be one of the registered zones`,
      'string.empty': 'Operating zone is required',
      'any.required': 'Operating zone is required',
    }),

  // ── Vehicle info ──
  vehicleType: Joi.string()
    .trim()
    .valid(...VEHICLE_TYPES)
    .required()
    .messages({
      'any.only': `Vehicle type must be one of: ${VEHICLE_TYPES.join(', ')}`,
      'string.empty': 'Vehicle type is required',
      'any.required': 'Vehicle type is required',
    }),

  vehicleModel: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Vehicle model must be at least 2 characters',
    'string.empty': 'Vehicle model is required',
    'any.required': 'Vehicle model is required',
  }),

  plateNumber: Joi.string()
    .trim()
    .pattern(/^[A-Z]{2,4}[-\s]?\d{2,4}[-\s]?[A-Z]{1,3}$/i)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid plate number (e.g. ABC-123-DE)',
      'string.empty': 'Plate number is required',
      'any.required': 'Plate number is required',
    }),

  // ── Identity ──
  nin: Joi.string()
    .pattern(/^\d{11}$/)
    .required()
    .messages({
      'string.pattern.base': 'NIN must be exactly 11 digits with no spaces or letters',
      'string.empty': 'NIN is required',
      'any.required': 'NIN is required',
    }),

  // ── Guarantor (inline at signup) ──
  guarantorFullName: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Guarantor full name must be at least 2 characters',
    'string.empty': 'Guarantor full name is required',
    'any.required': 'Guarantor full name is required',
  }),

  guarantorPhone: Joi.string()
    .pattern(/^0[7-9][0-1]\d{8}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid guarantor phone number',
      'string.empty': 'Guarantor phone is required',
      'any.required': 'Guarantor phone is required',
    }),

  guarantorRelationship: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Relationship must be at least 2 characters',
    'string.empty': 'Guarantor relationship is required',
    'any.required': 'Guarantor relationship is required',
  }),
});

// ── Login ──
export const riderLoginSchema = Joi.object({
  email: Joi.string().email().lowercase().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
  }),
});

// ── Go online / offline ──
export const riderStatusSchema = Joi.object({
  isOnline: Joi.boolean().required().messages({
    'boolean.base': 'Online status must be a boolean',
    'any.required': 'Online status is required',
  }),
});

// ── GPS location update ──
export const updateLocationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required().messages({
    'number.min': 'Invalid latitude',
    'number.max': 'Invalid latitude',
    'any.required': 'Latitude is required',
  }),
  lng: Joi.number().min(-180).max(180).required().messages({
    'number.min': 'Invalid longitude',
    'number.max': 'Invalid longitude',
    'any.required': 'Longitude is required',
  }),
  orderId: Joi.string().hex().length(24).optional().messages({
    'string.hex': 'Invalid order ID format',
    'string.length': 'Invalid order ID length',
  }),
});

// ── KYC document upload ──
export const kycUploadSchema = Joi.object({
  documentType: Joi.string()
    .valid(...KYC_DOCUMENT_TYPES)
    .required()
    .messages({
      'any.only': `Document type must be one of: ${KYC_DOCUMENT_TYPES.join(', ')}`,
      'string.empty': 'Document type is required',
      'any.required': 'Document type is required',
    }),
});

// ── Guarantor details (standalone endpoint) ──
export const guarantorSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Guarantor full name must be at least 2 characters',
    'string.empty': 'Guarantor full name is required',
    'any.required': 'Guarantor full name is required',
  }),
  phone: Joi.string()
    .pattern(/^0[7-9][0-1]\d{8}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid guarantor phone number',
      'string.empty': 'Guarantor phone is required',
      'any.required': 'Guarantor phone is required',
    }),
  address: Joi.string().trim().min(10).max(300).required().messages({
    'string.min': 'Please provide a full address (at least 10 characters)',
    'string.empty': 'Guarantor address is required',
    'any.required': 'Guarantor address is required',
  }),
  relationship: Joi.string().trim().min(2).max(50).required().messages({
    'string.min': 'Relationship must be at least 2 characters',
    'string.empty': 'Relationship to guarantor is required',
    'any.required': 'Relationship to guarantor is required',
  }),
});