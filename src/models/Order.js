// src/models/Order.js — The operational heart of the platform.
// Every delivery, every fee, every GPS ping, every bid, every dispute
// lives in this collection. The schema is deliberately denormalized in
// a few places (senderName, recipientName stored directly rather than
// joined from User) because order records must be self-describing for
// disputes and audits even if users are later deleted.
import mongoose from 'mongoose';

const coordSchema = new mongoose.Schema(
  { lat: Number, lng: Number },
  { _id: false }
);

const orderSchema = new mongoose.Schema({
  orderRef: { type: String, unique: true },  // e.g. "OS-LAG-08421"

  // ── Parties ──
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // null for direct customer orders
  rider:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ── Pickup ──
  pickup: {
    address:     { type: String, required: true },
    landmark:    String,
    zone:        { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    coordinates: coordSchema,
    senderName:  String,
    senderPhone: String,   // stored as-is for tel: links
  },

  // ── Delivery ──
  delivery: {
    address:        { type: String, required: true },
    landmark:       String,
    zone:           { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    coordinates:    coordSchema,
    recipientName:  String,
    recipientPhone: String,
  },

  // ── Package ──
  package: {
    category:     {
      type: String,
      enum: ['document', 'fragile', 'small_parcel', 'large_parcel', 'groceries', 'larger_items', 'bulk'],
    },
    description:  String,
    weight:       Number,  // kg
    quantity:     { type: Number, default: 1 },
    declaredValue:{ type: Number, default: 0 },
    fragile:      { type: Boolean, default: false },
    insured:      { type: Boolean, default: false },
    speed:        { type: String, enum: ['standard','express', 'economy'], default: 'express' },
  },

  // ── Fee breakdown — calculated server-side only ──
  fees: {
    baseFee:       { type: Number, required: true },
    distanceFee:   { type: Number, required: true },
    platformFee:   { type: Number, required: true },  // 5% of base+distance
    insurance:     { type: Number, default: 0 },
    codHandlingFee:{ type: Number, default: 0 },
    total:         { type: Number, required: true },
    distanceKm:    Number,
  },

  // ── Payment ──
  payment: {
    method:      { type: String, enum: ['paystack','wallet','cod'], required: true },
    status:      { type: String, enum: ['pending','paid','failed','refunded'], default: 'pending' },
    paystackRef: String,
    paidAt:      Date,
  },

  // ── Pay-on-delivery ──
  cod: {
    collected:    { type: Boolean, default: false },
    feeDebited:   { type: Boolean, default: false },
    otpHash:      { type: String, select: false },  // bcrypt hash of 6-digit OTP
    otpVerified:  { type: Boolean, default: false },
    otpVerifiedAt:Date,
    otpSentAt:    Date,
  },

  // ── Order lifecycle status ──
  status: {
    type: String,
    enum: ['pending','assigned','pickup_in_progress','picked_up','in_transit','delivered','cancelled','disputed'],
    default: 'pending',
  },

  // ── Timestamped status timeline — the audit trail ──
  timeline: [{
    status:    String,
    timestamp: { type: Date, default: Date.now },
    note:      String,
    actor:     String,  // 'system' | 'customer' | 'rider' | 'admin'
  }],

  // ── GPS trail — every Socket.IO ping from the rider is saved here ──
  // This is the evidence record for disputes. It means the DB grows with
  // each delivery, but it's the right tradeoff for trust infrastructure.
  gpsTrail: [{
    lat:       { type: Number, required: true },
    lng:       { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
  }],

  // ── Cancellation ──
  cancellation: {
    cancelledBy: String,   // 'customer' | 'merchant' | 'rider' | 'system'
    reason:      String,
    cancelledAt: Date,
    type:        { type: String, enum: ['early','late'] },
    compensationPaid:   Boolean,
    compensationAmount: Number,
    lateFeeCharged:     Number,
  },

  // ── Location change log ──
  locationChanges: [{
    changedAt:       Date,
    changedBy:       String,
    originalAddress: String,
    newAddress:      String,
    additionalFee:   Number,
    feePaid:         { type: Boolean, default: false },
  }],

  // ── Dispute ──
  dispute: {
    openedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason:     String,
    evidence:   [String],   // Cloudinary URLs of uploaded photos
    status:     { type: String, enum: ['open','under_review','resolved','dismissed'] },
    resolution: String,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    refundAmount: Number,
  },

  // ── Assignment tracking — who was offered the job before acceptance ──
  assignmentLog: [{
    rider:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    offeredAt:   { type: Date, default: Date.now },
    response:    { type: String, enum: ['pending','accepted','declined','timeout'], default: 'pending' },
    respondedAt: Date,
  }],

  // ── Merchant bidding ──
  assignmentMode: { type: String, enum: ['auto','budget','open_bid'], default: 'auto' },
  budgetCap:      Number,   // for 'budget' mode
  bidWindowEnds:  Date,     // for 'open_bid' mode

  bids: [{
    rider:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount:      Number,
    note:        String,
    submittedAt: { type: Date, default: Date.now },
    status:      { type: String, enum: ['pending','accepted','rejected'], default: 'pending' },
  }],

  // ── Ratings ──
  customerRating: { type: Number, min: 1, max: 5 },
  riderRating:    { type: Number, min: 1, max: 5 },
  ratingNote:     String,

  deliveredAt: Date,

}, { timestamps: true });

// ── Indexes for every common query pattern ──
// Customer/merchant see their own orders
orderSchema.index({ customer: 1, status: 1, createdAt: -1 });
orderSchema.index({ merchant: 1, status: 1, createdAt: -1 });
// Rider sees their assigned orders
orderSchema.index({ rider: 1, status: 1, createdAt: -1 });
// Admin filters by city, status, date
orderSchema.index({ 'pickup.zone': 1, status: 1 });
orderSchema.index({ createdAt: -1 });
// Paystack webhook lookup
orderSchema.index({ 'payment.paystackRef': 1 }, { sparse: true });
// Order reference lookup
//orderSchema.index({ orderRef: 1 });

// ── Auto-generate order reference before insert ──
orderSchema.pre('save', async function() {
  if (!this.orderRef) {
    const count = await mongoose.model('Order').estimatedDocumentCount();
    const seq   = String(count + 1).padStart(5, '0');
    const ts    = Date.now().toString(36).slice(-4).toUpperCase();
    this.orderRef = `OS-${ts}-${seq}`;
  }
  // Just return — Mongoose handles it via the resolved Promise
  // Throwing an error here will automatically abort the save
});

export default mongoose.model('Order', orderSchema);