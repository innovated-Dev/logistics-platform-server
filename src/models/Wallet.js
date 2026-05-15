// src/models/Wallet.js
// Think of this schema as three overlapping financial instruments in one:
//   1. A regular user wallet (balance + transactions)
//   2. A rider COD ledger (pending debits they owe the platform)
//   3. Platform reserve accounts (insurance pool, compensation pool)
//      — these two exist on exactly one "platform" wallet record.
//
// The credit/debit methods are atomic operations using Mongoose's
// findOneAndUpdate with $inc to avoid race conditions. If two processes
// try to debit the same wallet simultaneously, MongoDB's document-level
// locking ensures only one wins, and the second fails with an insufficient
// balance error rather than producing a negative balance.
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  type:        { type: String, enum: ['credit','debit'], required: true },
  amount:      { type: Number, required: true },
  description: { type: String, required: true },
  reference:   String,
  orderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  meta:        mongoose.Schema.Types.Mixed,  // any extra context (e.g. network for airtime)
}, { timestamps: true });

const walletSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },

  balance:         { type: Number, default: 0, min: 0 },

  // Rider-specific: platform fee they collected as cash but haven't remitted yet
  codPendingDebit: { type: Number, default: 0 },

  // Platform-only: separate reserve accounts (stored on admin user's wallet)
  insuranceReserve:  { type: Number, default: 0 },
  compensationPool:  { type: Number, default: 0 },

  transactions: [transactionSchema],

  // Bank account for rider withdrawals (verified via Paystack recipient)
  bankDetails: {
    bankCode:        String,
    bankName:        String,
    accountNumber:   String,
    accountName:     String,   // confirmed name from Paystack resolve endpoint
    recipientCode:   String,   // Paystack transfer recipient code
    verifiedAt:      Date,
  },

}, { timestamps: true });



// ── credit: add money to wallet ──
// Returns the updated wallet document.
walletSchema.methods.credit = async function(amount, description, orderId = null, meta = null) {
  const update = {
    $inc: { balance: amount },
    $push: {
      transactions: {
        type: 'credit', amount, description,
        reference: `CR-${Date.now()}`,
        orderId, meta,
        createdAt: new Date(),
      }
    }
  };
  return mongoose.model('Wallet').findByIdAndUpdate(this._id, update, { new: true });
};

// ── debit: remove money from wallet ──
// Atomically checks balance before deducting. Throws if insufficient.
walletSchema.methods.debit = async function(amount, description, orderId = null, meta = null) {
  const result = await mongoose.model('Wallet').findOneAndUpdate(
    { _id: this._id, balance: { $gte: amount } },   // guard: only update if balance is sufficient
    {
      $inc: { balance: -amount },
      $push: {
        transactions: {
          type: 'debit', amount, description,
          reference: `DB-${Date.now()}`,
          orderId, meta,
          createdAt: new Date(),
        }
      }
    },
    { new: true }
  );
  if (!result) throw new Error('Insufficient wallet balance');
  return result;
};

export default mongoose.model('Wallet', walletSchema);