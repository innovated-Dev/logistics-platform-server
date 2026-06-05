/**
 * Admin KYC Routes
 *
 * Mount in app.js:
 *   const adminKycRoutes = require('./routes/admin.kyc.routes');
 *   app.use('/api/admin/kyc', adminKycRoutes);
 */

// TOP — replace all require() with:
import express           from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import KycApplication    from '../../models/kyc.js';
import { getPresignedUrl } from '../../services/b2.service.js';


const router = express.Router();
router.use(authenticate, requireAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/kyc/pending
// List all applications pending admin review, newest first.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pending', async (req, res) => {
  try {
    const applications = await KycApplication.find({ status: 'pending_admin' })
      .sort({ submittedAt: -1 })
      .select('-documents.b2FileKey -guarantor.tokenHash -ninNumber') // strip sensitive fields
      .lean();

    res.json({ count: applications.length, applications });
  } catch (err) {
    console.error('[Admin KYC pending]', err);
    res.status(500).json({ error: 'Could not fetch applications.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/kyc/:id
// Single application — safe fields only (no b2FileKey, no tokenHash).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const application = await KycApplication.findById(req.params.id)
      .select('-documents.b2FileKey -guarantor.tokenHash -ninNumber')
      .lean();

    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    res.json(application);
  } catch (err) {
    console.error('[Admin KYC single]', err);
    res.status(500).json({ error: 'Could not fetch application.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/kyc/:id/document/:docKey
// Generate a 15-minute presigned URL for admin to view a document.
// The raw B2 URL is NEVER exposed — only a temporary signed URL.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/document/:docKey', async (req, res) => {
  try {
    const application = await KycApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const doc = application.getDoc(req.params.docKey);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found on this application.' });
    }

    // Generate presigned URL — expires in 15 minutes
    const url = await getPresignedUrl(doc.b2FileKey);

    res.json({
      url,
      expiresInMinutes: 15,
      docKey:   doc.docKey,
      fileType: doc.fileType,
      fileName: doc.fileName,
    });
  } catch (err) {
    console.error('[Admin KYC doc URL]', err);
    res.status(500).json({ error: 'Could not generate document URL.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/kyc/:id/approve
// Approve a KYC application.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/approve', async (req, res) => {
  try {
    const application = await KycApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (application.status !== 'pending_admin') {
      return res.status(400).json({
        error: `Cannot approve — status is '${application.status}'.`,
      });
    }

    application.status     = 'approved';
    application.reviewedAt = new Date();
    application.reviewedBy = req.user.id;
    await application.save();

    // TODO Phase 5: send Termii SMS/WhatsApp to rider
    // await termii.notify(rider.phone, 'Your OffScape account has been approved!')

    res.json({ success: true, status: 'approved' });
  } catch (err) {
    console.error('[Admin approve]', err);
    res.status(500).json({ error: 'Could not approve application.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/kyc/:id/reject
// Reject with a reason shown to the rider.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Please provide a clear rejection reason (min 10 chars).' });
    }

    const application = await KycApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    application.status     = 'rejected';
    application.adminNote  = reason.trim();
    application.reviewedAt = new Date();
    application.reviewedBy = req.rider.id;
    await application.save();

    // TODO Phase 5: send Termii SMS/WhatsApp to rider with reason

    res.json({ success: true, status: 'rejected', reason: application.adminNote });
  } catch (err) {
    console.error('[Admin reject]', err);
    res.status(500).json({ error: 'Could not reject application.' });
  }
});


export default router;