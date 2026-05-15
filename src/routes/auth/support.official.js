// src/routes/support.routes.js
// Ticket creation, messaging, escalation.
// All routes require authentication. Ticket visibility is
// role-filtered in each handler (admin/support see all; others see own).
import { Router }      from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { apiLimiter }  from '../../middleware/rateLimiter.js';
import Ticket          from '../../models/Ticket.js';
import { ok, created } from '../../utils/response.js';
import { NotFoundError } from '../../utils/errors.js';
import { env }         from '../../config/env.js';
import { logger }      from '../../utils/logger.js';

const router = Router();
router.use(authenticate, apiLimiter);

// GET /api/support/tickets
// admin/support see all; everyone else sees only their own tickets
router.get('/tickets', async (req, res) => {
  const filter = ['admin', 'support'].includes(req.user.role)
    ? {}
    : { user: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const tickets = await Ticket.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('user', 'firstName lastName phone role')
    .lean();
  ok(res, { tickets });
});

// POST /api/support/tickets — open a new ticket
router.post('/tickets', async (req, res) => {
  const { category, subject, message, orderId } = req.body;
  const ticket = await Ticket.create({
    user:     req.user._id,
    userRole: req.user.role,
    order:    orderId || undefined,
    category,
    subject,
    messages: [{
      sender:     req.user._id,
      senderRole: req.user.role,
      body:       message,
    }],
  });
  created(res, { ticket });
});

// POST /api/support/tickets/:id/message — add a message to an existing ticket
router.post('/tickets/:id/message', async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw new NotFoundError('Ticket not found');

  // Non-admin/support users can only message their own tickets
  if (!['admin', 'support'].includes(req.user.role) &&
      ticket.user.toString() !== req.user._id.toString()) {
    throw new NotFoundError('Ticket not found');
  }

  ticket.messages.push({
    sender:     req.user._id,
    senderRole: req.user.role,
    body:       req.body.message,
  });
  ticket.status = 'in_progress';
  await ticket.save();
  ok(res, { ticket });
});

// PATCH /api/support/tickets/:id/close — admin or support only
router.patch(
  '/tickets/:id/close',
  requireRole('admin', 'support'),
  async (req, res) => {
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      {
        status:     'closed',
        resolution: req.body.note,
        resolvedAt: new Date(),
        resolvedBy: req.user._id,
      },
      { new: true }
    );
    if (!ticket) throw new NotFoundError('Ticket not found');
    ok(res, { ticket });
  }
);

// POST /api/support/tickets/:id/escalate — send to admin WhatsApp
router.post('/tickets/:id/escalate', async (req, res) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate('user', 'firstName lastName phone role');
  if (!ticket) throw new NotFoundError('Ticket not found');

  // Only the ticket owner or admin/support can escalate
  if (!['admin', 'support'].includes(req.user.role) &&
      ticket.user._id.toString() !== req.user._id.toString()) {
    throw new NotFoundError('Ticket not found');
  }

  ticket.escalatedToWhatsApp = true;
  ticket.escalatedAt         = new Date();
  ticket.status              = 'escalated';
  await ticket.save();

  const u   = ticket.user;
  const msg = encodeURIComponent(
    `🚨 OffScape Support Escalation\n` +
    `Ticket: ${ticket.ref}\n` +
    `User: ${u?.firstName} ${u?.lastName} (${u?.role})\n` +
    `Phone: ${u?.phone}\n` +
    `Subject: ${ticket.subject}\n` +
    `Category: ${ticket.category}\n` +
    `Context: ${req.body.context || 'No additional context provided.'}`
  );

  const adminNumber = (env.ADMIN_WHATSAPP || '').replace(/\D/g, '');
  const waUrl = `https://wa.me/${adminNumber}?text=${msg}`;
  logger.info(`Ticket ${ticket.ref} escalated to admin WhatsApp`);

  ok(res, {
    ticket,
    whatsappUrl: waUrl,
    message: 'Escalated to human agent. They will contact you within 15 minutes.',
  });
});

export default router;