import mongoose from 'mongoose';
import User from '../base/user.base.js';
import { encrypt, decrypt } from '../../utils/encryption.js';

// ── KYC subdocument ──
const kycDocSchema = new mongoose.Schema({
  url:      String,
  publicId: String,
  verified: { type: Boolean, default: false },
}, { _id: false });

const kycSchema = new mongoose.Schema({
  ninDocument:      kycDocSchema,
  driversLicence:   kycDocSchema,
  vehicleInsurance: kycDocSchema,
  platePhoto:       kycDocSchema,
  guarantorForm:    kycDocSchema,
  status: {
    type:    String,
    enum:    ['not_submitted', 'pending', 'approved', 'rejected'],
    default: 'not_submitted',
  },
  rejectionReason: String,
  verifiedAt:      Date,
  verifiedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

// ── Guarantor subdocument ──
const guarantorSchema = new mongoose.Schema({
  fullName:       String,
  phone:          String,
  address:        String,
  relationship:   String,
  callVerified:   { type: Boolean, default: false },
  callVerifiedAt: Date,
  callVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  callNotes:      String,
}, { _id: false });

// ── Rider schema ──
const IsriderSchema = new mongoose.Schema({

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

  // ── KYC & guarantor ──
  kyc:          kycSchema,
  guarantor:    guarantorSchema,
  kycSubmitted: { type: Boolean, default: false },

  // ── Real-time state ──
  isOnline: { type: Boolean, default: false },
  lastSeen: Date,

  // ── Location: NO defaults — only set when rider sends GPS coords ──
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
IsriderSchema.index({ totalDeliveries: -1 });
IsriderSchema.index({ completionRate: 1 });
IsriderSchema.index({ isOnline: 1, city: 1 });
// sparse: true — skips riders who have no location yet, prevents the GeoJSON error
IsriderSchema.index({ currentLocation: '2dsphere' }, { sparse: true });

// ── Encrypt NIN only when it changes ──
IsriderSchema.pre('save', async function () {
  if (this.isModified('nin') && this.nin) {
    this.nin = encrypt(this.nin);
  }
});

// ── Decrypt NIN when needed ──
IsriderSchema.virtual('ninDecrypted').get(function () {
  try {
    return this.nin ? decrypt(this.nin) : null;
  } catch {
    return null;
  }
});

const Rider = User.discriminator('rider', IsriderSchema);
export default Rider;