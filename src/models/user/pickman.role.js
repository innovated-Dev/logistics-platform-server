import mongoose from 'mongoose';
import User from '../base/user.base.js';
import { encrypt, decrypt } from '../../utils/encryption.js';

// ── pickman schema ──
const IspickmanSchema = new mongoose.Schema({

  // ── Primary address ──
  primaryAddress: {
    street:   String,
    landmark: String,
    zone:     { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },

  // ── Operating zones (single definition) ──
  operatingZones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Zone' }],

  // ── Vehicle info ──
  vehicleType:  { type: String, enum: ['motorcycle', 'bicycle', 'car', 'van'] },
  vehicleModel: String,
  plateNumber:  { type: String, uppercase: true },

  // ── NIN: encrypted at save, never returned by default ──
  // NO setter/getter here — encryption handled exclusively in pre('save')
  nin: {
    type:   String,
    select: false,
  },

 // ── KYC Application reference ──
  kycApplication: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'KycApplication' 
  },
  kycSubmitted: { type: Boolean, default: false },

  // ── Real-time state ──
  isOnline: { type: Boolean, default: false },
  lastSeen: Date,

  // ── Location: NO defaults — only set when pickman sends GPS coords ──
  currentLocation: {
    type: {
      type:  String,
      enum:  ['Point'],
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
    },
  },

  // ── Permissions ──
  permissions: [{ type: String }],

  // ── Performance metrics ──
  rating:          { type: Number, default: 5.0, min: 1, max: 5 },
  totalRatings:    { type: Number, default: 0 },
  totalDeliveries: { type: Number, default: 0 },
  completionRate:  { type: Number, default: 100 },
});

// ── Indexes ──
IspickmanSchema.index({ totalDeliveries: -1 });
IspickmanSchema.index({ completionRate: 1 });
IspickmanSchema.index({ isOnline: 1, city: 1 });
// sparse: true — skips pickmans who have no location yet, prevents the GeoJSON error
IspickmanSchema.index({ currentLocation: '2dsphere' }, { sparse: true });

// ── Encrypt NIN only when it changes ──
IspickmanSchema.pre('save', async function () {
  if (this.isModified('nin') && this.nin) {
    this.nin = encrypt(this.nin);
  }
});

// ── Decrypt NIN when needed ──
IspickmanSchema.virtual('ninDecrypted').get(function () {
  try {
    return this.nin ? decrypt(this.nin) : null;
  } catch {
    return null;
  }
});

const Pickman = User.discriminator('pickman', IspickmanSchema);
export default Pickman;