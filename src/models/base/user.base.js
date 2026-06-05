import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';


// ── Core identity (every role) ──
const userBaseSchema = new mongoose.Schema({
    firstName:  { type: String, required: true, trim: true, maxlength: 60 },
    lastName:   { type: String, required: true, trim: true, maxlength: 60 },
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:      { type: String, required: true, unique: true, trim: true },
    password:   { type: String, required: true, minlength: 8, select: false }, // never returned by default
    city:       { type: String, enum: ['lagos','ibadan'], required: true },
    status:     { type: String, enum: ['active','suspended','pending_kyc'], default: 'active' },

    // ── User is always active by default (New Accounts) ──
    isActive: {
      type: Boolean,
      default: true
    },

    // ── Email Verification ──
    emailVerified: { type: Boolean, default: false },
    emailVerifyToken:   { type: String, select: false},
    emailVerifyExpires: Date,

    // ── Brute force protection ──
    // These three work together: attempts counts failed logins,
    // lockUntil is the timestamp when the lock expires,
    // isLocked is a computed property(virtual) not a stored field
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    lastLogin: Date,

    // ── Password reset ──
    passwordResetToken:   { type: String, select: false},
    passwordResetExpires: Date,
    passwordResetVerified: { type: Boolean, default: false, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
    resetOtpResendCount: { type: Number, default: 0, select: false },

    // ── Multiple Device Login (Session Management) ──
    tokenVersion: { type: Number, default: 0 }, // incremented on password reset to invalidate all refresh tokens  

    // ── Wallet reference (created atomically with user) ──
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
    
    // ── Soft delete ──
    deletedAt: Date,

}, {
    discriminatorKey: 'role', // Our discrimator key, could be anything
    collection: 'users', // collection name in MongoDB
    timestamps: true, 
    toJSON: { virtuals: true }, 
    toObject: { virtuals: true } 
});

// ── Indexes for common query patterns ──
// email + role composite: same email can exist in different roles
userBaseSchema.index({ email: 1, role: 1 }, { unique: true });
//userBaseSchema.index({ phone: 1 });
userBaseSchema.index({ role: 1, status: 1 });
userBaseSchema.index({ city: 1, role: 1 });

// 2dsphere for geo-proximity matching — coordinates must be [lng, lat] for GeoJSON
userBaseSchema.index({ 'currentLocation.lat': 1, 'currentLocation.lng': 1 });

// ── Virtuals ──
userBaseSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});
userBaseSchema.virtual('initials').get(function() {
  return `${(this.firstName?.[0] || '')}${(this.lastName?.[0] || '')}`.toUpperCase();
});

// ── isLocked virtual ──
// Instead of storing isLocked as a field, we compute if from lockUntil.
// If lockUntil exists and is in the future, account is locked.
// This way the lock automatically expires without any cron job needed 
userBaseSchema.virtual('isLocked').get( function(){
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ── Pre-save: hash password only when it changes ──
userBaseSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// ── Instance method: compare password ──
userBaseSchema.methods.matchPassword = function(plainText) {
  return bcrypt.compare(plainText, this.password);
};

// ── incLoginAttempts ──
// Increments failed login counter. Locks accountafter 5 failures for 2 hours.
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 2 * 60 * 60 * 100; // 2 hours

userBaseSchema.methods.incLoginAttempts = async function (){
  // If there was a previous lock that has now expired, reset and start fresh
  if(this.lockUntil && this.lockUntil < Date.now()){
    return this.updateOne({
      $set: { loginAttempts: 1},
      $unset: { lockUntil: 1},
    });
  }

  const updates = { $inc: { loginAttempts: 1 }};

  // Lock the account if this attempt hits the max
  if( this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_DURATION_MS)};
  }

  return this.updateOne(updates);
};

// ── restLoginAttempts ──
// Called on successful login  clears the counter and any lock
userBaseSchema.methods.resetLoginAttempts = function(){
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};


// ── toSafeObject ──
// Clean object for JWT payload and frontend responses 
userBaseSchema.methods.toSafeObject = function() {
  return {
    id:         this._id,
    firstName:  this.firstName,
    lastName:   this.lastName,
    name:       this.fullName,
    email:      this.email,
    phone:      this.phone,
    role:       this.role,
    city:       this.city,
    status:     this.status,
    isActive:   this.isActive,
    initials:   this.initials,
    emailVerified: this.emailVerified,
    lastLogin:     this.lastLogin,
    // Role-specific - undefined for roles that don't have them
    businessName:   this.businessName,
    vehicleType:    this.vehicleType,
    isOnline:       this.isOnline,
    rating:         this.rating,
    totalDeliveries:this.totalDeliveries,
    kycStatus:      this.status === 'pending_kyc' ? 'pending_kyc' : undefined,
    wallet:         this.wallet,
  };
};

const User = mongoose.model('User', userBaseSchema);

export default User;