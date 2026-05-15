// src/models/Ticket.js — Support ticket schema
// Tickets flow from AI chat → human agent → admin resolution.
// Each message in the thread stores the sender role so the UI
// can render it on the correct side of the chat bubble.
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderRole:{ type: String },   // 'customer'|'merchant'|'rider'|'ai'|'agent'|'admin'
  body:      { type: String, required: true },
  isAI:      { type: Boolean, default: false },
}, { timestamps: true });

const ticketSchema = new mongoose.Schema({
  ref:       { type: String, unique: true },   // e.g. "TKT-00142"

  // Who raised it
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userRole:  String,   // denormalized for quick filtering

  // Order it relates to (optional)
  order:     { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

  category:  {
    type: String,
    enum: ['delivery_issue','payment','refund','rider_complaint','account','other'],
    required: true,
  },
  subject:   { type: String, required: true },
  priority:  { type: String, enum: ['low','medium','high','urgent'], default: 'medium' },

  status: {
    type: String,
    enum: ['open','in_progress','escalated','resolved','closed'],
    default: 'open',
  },

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // support agent / admin

  messages: [messageSchema],

  // Resolution record
  resolution:  String,
  resolvedAt:  Date,
  resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Escalation to WhatsApp flag
  escalatedToWhatsApp: { type: Boolean, default: false },
  escalatedAt:         Date,

}, { timestamps: true });

ticketSchema.index({ user: 1, status: 1 });
ticketSchema.index({ status: 1, priority: -1, createdAt: -1 });
// ticketSchema.index({ ref: 1 });

// Auto-generate ticket reference
ticketSchema.pre('save', async function(next) {
  if (!this.ref) {
    const count = await mongoose.model('Ticket').estimatedDocumentCount();
    this.ref = `TKT-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

export default mongoose.model('Ticket', ticketSchema);