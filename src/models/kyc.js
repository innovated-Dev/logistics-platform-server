import mongoose from 'mongoose';

// ─── KYC Document subdocument ───────────────────────────────────────────────
const KycDocumentSchema = new mongoose.Schema({
  docKey: {
    type: String,
    required: true,
    // e.g. 'nin_document', 'drivers_licence', 'plate_photo'
  },
  b2FileKey: {
    type: String,
    required: true,
    // The path in Backblaze B2 — NEVER sent to frontend
    // e.g. 'kyc/64abc.../nin_document/1716400000000.pdf'
  },
  fileName:   { type: String },   // original file name for admin display
  fileType:   { type: String },   // 'image/jpeg' | 'image/png' | 'application/pdf'
  fileSizeBytes: { type: Number },
  uploadedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['uploaded', 'rejected'],
    default: 'uploaded',
  },
});

// ─── Guarantor subdocument ───────────────────────────────────────────────────
const GuarantorSchema = new mongoose.Schema({
  fullName:     { type: String },
  phone:        { type: String },
  address:      { type: String },
  relationship: { type: String }, // family | colleague | employer | neighbour

  // Token (we store the HASH — never the raw token)
  tokenHash:    { type: String },
  tokenExpiry:  { type: Date },
  tokenUsedAt:  { type: Date },
  channel:      { type: String, enum: ['whatsapp', 'sms'] },
  linkSentAt:   { type: Date },

  // Guarantor's own submission
  submitted:       { type: Boolean, default: false },
  submittedAt:     { type: Date },
  yearsKnown:      { type: Number },
  capacity:        { type: String }, // family | work | community
  declaration:     { type: Boolean, default: false },
  signatureB2Key:  { type: String }, // stored in private B2
});

// ─── Main KYC Application ───────────────────────────────────────────────────
const KycApplicationSchema = new mongoose.Schema(
  {
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vehicleType: {
      type: String,
      enum: ['motorcycle', 'bicycle', 'car', 'van'],
      required: true,
    },
    countryCode: {
      type: String,
      default: 'NG',
    },

    // ── Overall status machine ──
    // draft             → rider is still filling forms
    // pending_guarantor → submitted, waiting for guarantor to click link
    // pending_admin     → guarantor done, waiting for admin review
    // approved          → admin approved, rider can get orders
    // rejected          → admin rejected, rider must fix and resubmit
    status: {
      type: String,
      enum: ['draft', 'pending_guarantor', 'pending_admin', 'approved', 'rejected'],
      default: 'draft',
      index: true,
    },

    // ── Personal info (Step 1) ──
    dateOfBirth: { type: Date },
    homeAddress: { type: String },
    ninNumber: {
      type: String,
      // stored as-is — NOT exposed to frontend after save
    },

    // ── Face verification (Smile Identity) ──
    faceVerified:    { type: Boolean, default: false },
    smileSessionId:  { type: String },
    smileVerifiedAt: { type: Date },

    // ── Documents (Step 2) ──
    documents: [KycDocumentSchema],

    // ── Guarantor (Step 3) ──
    guarantor: GuarantorSchema,

    // ── Submission + review ──
    submittedAt:  { type: Date },
    reviewedAt:   { type: Date },
    reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNote:    { type: String }, // shown to rider on rejection
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
  }
);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns the document entry for a given docKey, or null.
 */
KycApplicationSchema.methods.getDoc = function (docKey) {
  return this.documents.find((d) => d.docKey === docKey) || null;
};

/**
 * True if this docKey has already been uploaded.
 */
KycApplicationSchema.methods.hasDoc = function (docKey) {
  return this.documents.some((d) => d.docKey === docKey);
};

/**
 * Safe status object — safe to send to frontend.
 * Never includes b2FileKey, tokenHash, ninNumber.
 */
KycApplicationSchema.methods.toSafeStatus = function () {
  const uploadedKeys = this.documents.map((d) => d.docKey);
  return {
    id:           this._id,
    status:       this.status,
    vehicleType:  this.vehicleType,
    countryCode:  this.countryCode,
    faceVerified: this.faceVerified,
    uploadedDocs: uploadedKeys,
    guarantor: this.guarantor
      ? {
          fullName:    this.guarantor.fullName,
          phone:       this.guarantor.phone,
          relationship:this.guarantor.relationship,
          linkSentAt:  this.guarantor.linkSentAt,
          submitted:   this.guarantor.submitted,
          channel:     this.guarantor.channel,
        }
      : null,
    adminNote:   this.adminNote,
    submittedAt: this.submittedAt,
    reviewedAt:  this.reviewedAt,
  };
};

const KycApplication = mongoose.model('KycApplication', KycApplicationSchema);

export default KycApplication;