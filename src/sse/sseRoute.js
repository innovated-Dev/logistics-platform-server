// src/sse/sseRoutes.js
import express from 'express';
import { addClient, removeClient } from './sseManager.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { sseEmailSchema } from '../../validation/common.validation.js';

const sseRouter = express.Router();

sseRouter.get('/verify-status', apiLimiter, validate(sseEmailSchema, 'query'), (req, res) => {
  const email = req.sanitizedData?.email;
  
  addClient(email, res);
  
  req.on('close', () => removeClient(email, res));
});

export default sseRouter;