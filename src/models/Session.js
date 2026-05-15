// src/models/Session.js
import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // You store the HASH of the refresh token, never the raw value.
    // Same principle as hashing passwords — if your DB is compromised,
    // attackers get hashes they cannot reverse into live tokens.
    refreshTokenHash: {
      type: String,
      required: true,
    },

    // Token family — every rotation chains to the same family ID.
    // If a already-used token from this family is ever replayed,
    // you revoke the ENTIRE family (reuse detection).
    family: {
      type: String,
      required: true,
      index: true,
    },

    // tokenVersion must match the user's current tokenVersion at refresh time.
    // When a password reset increments user.tokenVersion, every session
    // with the old version is dead on its next refresh attempt.
    tokenVersion: {
      type: Number,
      required: true,
    },

    // Device fingerprint + context — powers your "active sessions" UI
    // and suspicious login detection (different country, different device).
    deviceInfo: {
      userAgent:   { type: String, default: null },
      fingerprint: { type: String, default: null }, // FingerprintJS hash
      platform:    { type: String, default: null }, // 'web' | 'ios' | 'android'
    },

    ipAddress: {
      type: String,
      default: null,
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
      // MongoDB will automatically delete the document when this date passes.
      // This is your free database cleanup — no cron job needed for sessions.
      index: { expireAfterSeconds: 0 },
    },

    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true, // gives you createdAt automatically
  }
);

// Compound index — the most common query you'll run:
// "find this session by userId AND check it's not revoked"
sessionSchema.index({ userId: 1, isRevoked: 1 });

// Family index — for revoking an entire token family on reuse detection
sessionSchema.index({ family: 1, isRevoked: 1 });

export const Session = mongoose.model('Session', sessionSchema);