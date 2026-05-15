// src/models/Config.js — Platform configuration stored in DB.
// This lets the admin change fees, timeouts, and rates through the
// admin dashboard without a code deploy. The in-memory default in
// env.js is the fallback when this record doesn't exist yet.
// There is exactly ONE Config document (singleton pattern).
import mongoose from 'mongoose';

const configSchema = new mongoose.Schema({
  singleton:  { type: String, default: 'main', unique: true },  // ensures exactly one record

  fees: {
    platformFeePercent: { type: Number, default: 5   },
    codHandlingFee:     { type: Number, default: 100 },
    expressMultiplier:  { type: Number, default: 1.5 },
    economyMultiplier:  { type: Number, default: 0.7 }, // ← add this
    insuranceRate:      { type: Number, default: 0.5 },
    minInsuranceFee:    { type: Number, default: 50  },
  },

  cancellation: {
    earlyWindowMinutes:    { type: Number, default: 5 },
    earlyCompensation:     { type: Number, default: 300 },   // ₦300 from pool
    lateCancelChargeRate:  { type: Number, default: 50 },    // 50% of total
  },

  assignment: {
    timeoutSeconds:        { type: Number, default: 90 },
    maxRetryBatches:       { type: Number, default: 3 },
    batchSize:             { type: Number, default: 3 },
  },

  airtimeRates: {
    mtn:     { type: Number, default: 78 },   // 78% of face value
    airtel:  { type: Number, default: 75 },
    glo:     { type: Number, default: 72 },
    etisalat:{ type: Number, default: 70 },
  },

  baseFees: {
    document:    { type: Number, default: 300  },
    fragile:     { type: Number, default: 1000 },
    small_parcel:{ type: Number, default: 500  },
    large_parcel:{ type: Number, default: 800  },
    groceries:   { type: Number, default: 600  },
    large_items: { type: Number, default: 1500 },
    bulk:        { type: Number, default: 2000 },
  },

  distanceRates: {
    motorcycle: { type: Number, default: 80 },  // ₦/km
    bicycle:    { type: Number, default: 50 },
    car:        { type: Number, default: 120 },
    van:        { type: Number, default: 200 },
  },

  weightSurchargePerKg:   { type: Number, default: 150 },  // ₦/kg above 2kg
  weightSurchargeThreshold: { type: Number, default: 2 },  // kg

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('Config', configSchema);