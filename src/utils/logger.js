// src/utils/logger.js — Winston structured logger
// In production: JSON output (parsed by log aggregators like Datadog/Logtail)
// In development: colourised, human-readable console output
// Every log line carries a timestamp and the worker process ID,
// which is critical for debugging cluster-mode issues.

import env  from '../config/env.js';
import winston from 'winston';

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp, ...meta }) => {
    const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] [PID:${process.pid}] ${level}: ${message}${extras}`;
  })
);

const prodFormat = combine(
  timestamp(),
  json()
);

export const logger = winston.createLogger({
  level: env.isDev() ? 'debug' : 'info',
  format: env.isProd() ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    // In production add a file transport or a cloud log transport here
  ],
  // Prevent unhandled errors from crashing the logger itself
  exceptionHandlers: [ new winston.transports.Console() ],
  rejectionHandlers: [ new winston.transports.Console() ],
});