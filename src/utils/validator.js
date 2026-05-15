import Joi from 'joi'; // Add this import if not already there

// Helper: Validate email using Joi
export const validateEmail = (email) => {
  const { error } = Joi.string().email().validate(email);
  return !error;
};

// Helper: Validate password strength (min 8 chars + uppercase + lowercase + number)
export const validatePassword = (password) => {
  const { error } = Joi.string()
    .min(8)
    .pattern(/[A-Z]/)
    .pattern(/[a-z]/)
    .pattern(/\d/)
    .validate(password);
  return !error;
  // Optional: Add special char check if needed: .pattern(/[!@#$%^&*(),.?":{}|<>]/)
};