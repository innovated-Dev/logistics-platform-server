// src/config/database.js — MongoDB connection with retry logic
// Uses Mongoose's built-in reconnection plus a manual retry wrapper
// for the initial connection so a temporary Atlas hiccup at startup
// doesn't kill the process.
import mongoose from 'mongoose';
import env    from './env.js';
import { logger } from '../utils/logger.js';

const OPTIONS = {
  maxPoolSize:        50,   // concurrent connections — increase with load
  minPoolSize:        5,    // always keep 5 warm connections open
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS:    45000,
  heartbeatFrequencyMS: 10000,
};

export async function connectDB(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, OPTIONS);
      logger.info(`✅  MongoDB connected (attempt ${attempt})`);

      mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected — reconnecting…'));
      mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err));
      return;

    } catch(err) {
      logger.error(`MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) {
        logger.error('All MongoDB connection attempts failed. Exiting.');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, delayMs * attempt)); // exponential-ish backoff
    }
  }
}