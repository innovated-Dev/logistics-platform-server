// src/middleware/validate.js
import Joi from 'joi';

/**
 * Joi validation middleware factory.
 * Usage in routes: router.post('/signup', validate(customerSignupSchema), controller)
 * After this runs, req.body (or req.query / req.params) is the cleaned, validated value.
 *
 * @param {Joi.Schema} schema
 * @param {'body'|'query'|'params'} property
 */
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly:  false,
      stripUnknown: true,  
    });

    if (error) {
      const details = error.details.map(detail => ({  
        field:   detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors:  details,
      });
    }

   if(req[property] === "body") req.body = value;
   if((req[property] === "query") || (req[property] === "params")) req.sanitizeData = value;
   
    next();
  };
};