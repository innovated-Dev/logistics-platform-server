/**
 * KYC Routes
 *
 * Mount this in your main app.js:
 *   const kycRoutes = require('./routes/kyc.routes');
 *   app.use('/api/kyc', kycRoutes);
 */

// src/routes/business-logic/kyc.routes.js
import express  from 'express';
import multer   from 'multer';
import crypto   from 'crypto';
import { authenticate, requireRole }          from '../../middleware/auth.js';
import KycApplication       from '../../models/kyc.js';
import KYC_CONFIG           from '../../config/kyc.js';
import { uploadFile, deleteFile, buildFileKey } from '../../services/b2.service.js';
import { validateFile }     from '../../utils/fileValidator.js';


const router = express.Router();

// multer — store in memory (we stream straight to B2, no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB hard limit at multer level
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/kyc/requirements
// Returns the list of documents required for this rider's vehicle type.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/requirements', authenticate, requireRole('pickman'), async (req, res) => {
  try {
    const { vehicleType, countryCode = 'NG' } = req.user;

    if (!vehicleType) {
      return res.status(400).json({ error: 'No vehicle type set on your account.' });
    }

    const countryConfig = KYC_CONFIG[countryCode];
    if (!countryConfig) {
      return res.status(400).json({ error: `No KYC config for country: ${countryCode}` });
    }

    const docs = countryConfig[vehicleType];
    if (!docs) {
      return res.status(400).json({ error: `No KYC config for vehicle type: ${vehicleType}` });
    }

    // Find or create the rider's KYC application
    let application = await KycApplication.findOne({ riderId: req.user.id });
    if (!application) {
      application = await KycApplication.create({
        riderId:     req.user.id,
        vehicleType,
        countryCode,
        status:      'draft',
      });
    }

    // Mark which docs are already uploaded
    const uploadedKeys = application.documents.map((d) => d.docKey);

    const docsWithStatus = docs.map((doc) => ({
      ...doc,
      uploaded: uploadedKeys.includes(doc.key),
    }));

    res.json({
      applicationId: application._id,
      vehicleType,
      countryCode,
      status:        application.status,
      faceVerified:  application.faceVerified,
      docs:     docsWithStatus,
      uploadedCount: uploadedKeys.length,
      totalRequired: docs.filter((d) => d.required).length,
    });
  } catch (err) {
    console.error('[KYC requirements]', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/kyc/status
// Returns the rider's current KYC status — safe to send to frontend.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', authenticate, requireRole('pickman'), async (req, res) => {
  try {
    const application = await KycApplication.findOne({ riderId: req.user.id });
    if (!application) {
      return res.json({ status: 'not_started' });
    }
    res.json(application.toSafeStatus());
  } catch (err) {
    console.error('[KYC status]', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/kyc/upload
// Upload a single KYC document.
// Body: multipart/form-data with field 'document' (file) and 'docKey' (string)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload', authenticate, requireRole('pickman'), upload.single('document'), async (req, res) => {
  try {
    const { docKey } = req.body;
    const file       = req.file;

    // ── Basic input validation ──
    if (!docKey) {
      return res.status(400).json({ error: 'docKey is required.' });
    }
    if (!file) {
      return res.status(400).json({ error: 'No file received.' });
    }

    // ── Confirm this docKey is valid for their vehicle type ──
    const { vehicleType, countryCode = 'NG' } = req.user;
    const allowedDocs = KYC_CONFIG[countryCode]?.[vehicleType] || [];
    const docConfig   = allowedDocs.find((d) => d.key === docKey);

    if (!docConfig) {
      return res.status(400).json({
        error: `'${docKey}' is not a valid document for ${vehicleType} pickmen.`,
      });
    }

    // ── Validate file type and size by reading actual bytes ──
    const { valid, mimeType, extension, error: fileError } = validateFile(
      file.buffer,
      docConfig.maxSizeMB
    );
    if (!valid) {
      return res.status(400).json({ error: fileError });
    }

    // ── Find the KYC application ──
    const application = await KycApplication.findOne({ riderId: req.user.id });
    if (!application) {
      return res.status(404).json({ error: 'KYC application not found. Please refresh.' });
    }

    // ── If this doc was uploaded before, delete the old file from B2 ──
    const existingDoc = application.getDoc(docKey);
    if (existingDoc) {
      try {
        await deleteFile(existingDoc.b2FileKey);
      } catch (delErr) {
        console.warn('[KYC upload] Could not delete old file:', delErr.message);
        // non-fatal — continue with upload
      }
      // Remove from documents array
      application.documents = application.documents.filter((d) => d.docKey !== docKey);
    }

    // ── Upload to Backblaze B2 ──
    const fileKey = buildFileKey(req.user.id, docKey, extension);
    await uploadFile(fileKey, file.buffer, mimeType);

    // ── Save to database ──
    application.documents.push({
      docKey,
      b2FileKey:     fileKey,
      fileName:      file.originalname,
      fileType:      mimeType,
      fileSizeBytes: file.size,
    });

    await application.save();

    // ── Return safe response (no B2 key, no URLs) ──
    const uploadedKeys = application.documents.map((d) => d.docKey);

    res.json({
      success:      true,
      docKey,
      uploadedDocs: uploadedKeys,
      uploadedCount: uploadedKeys.length,
    });
  } catch (err) {
    console.error('[KYC upload]', err);
    res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/kyc/personal
// Save Step 1 personal info (date of birth, address, NIN)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/personal', authenticate, requireRole('pickman'), async (req, res) => {
  try {
    const { dateOfBirth, homeAddress, ninNumber } = req.body;

    if (!dateOfBirth || !homeAddress || !ninNumber) {
      return res.status(400).json({
        error: 'Date of birth, home address, and NIN are all required.',
      });
    }

    // Basic NIN format check — 11 digits
    if (!/^\d{11}$/.test(ninNumber.trim())) {
      return res.status(400).json({ error: 'NIN must be exactly 11 digits.' });
    }

    let application = await KycApplication.findOne({ riderId: req.user.id });
    if (!application) {
      const { vehicleType, countryCode = 'NG' } = req.rider;
      application = new KycApplication({ riderId: req.user.id, vehicleType, countryCode });
    }

    application.dateOfBirth = new Date(dateOfBirth);
    application.homeAddress = homeAddress.trim();
    application.ninNumber   = ninNumber.trim();

    await application.save();

    res.json({ success: true });
  } catch (err) {
    console.error('[KYC personal]', err);
    res.status(500).json({ error: 'Could not save personal info. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/kyc/guarantor/invite
// Rider submits guarantor info → system sends WhatsApp/SMS link.
// (Termii integration wired in Phase 3 — stub returns success for now)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/guarantor/invite', authenticate, requireRole('pickman'), async (req, res) => {
  try {
    const { fullName, phone, address, relationship } = req.body;

    if (!fullName || !phone || !address || !relationship) {
      return res.status(400).json({ error: 'All guarantor fields are required.' });
    }

    // Nigerian phone number: 080xxxxxxxx or +23480xxxxxxxx
    const cleanPhone = phone.replace(/\s+/g, '');
    if (!/^(\+?234|0)[789]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Enter a valid Nigerian phone number.' });
    }

    const application = await KycApplication.findOne({ riderId: req.user.id });
    if (!application) {
      return res.status(404).json({ error: 'KYC application not found.' });
    }

    // Generate a secure token (Phase 3 will hash this and send via Termii)
    const rawToken  = crypto.randomBytes(32).toString('hex'); // 64-char hex string
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry    = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    application.guarantor = {
      fullName,
      phone:        cleanPhone,
      address,
      relationship,
      tokenHash,
      tokenExpiry:  expiry,
      linkSentAt:   new Date(),
      channel:      'sms', // Phase 3 will detect WhatsApp and update this
      submitted:    false,
    };

    // TODO Phase 3: check Termii if phone is on WhatsApp, send accordingly
    // For now we log the link so you can test manually
    const guarantorLink = `${process.env.KYC_BASE_URL}/guarantor?token=${rawToken}`;
    console.log(`[GUARANTOR LINK — test only] ${guarantorLink}`);

    await application.save();

    res.json({
      success: true,
      message: 'Guarantor invite sent. Waiting for them to verify.',
      // We send the raw token back ONCE so the frontend can show the link during testing
      // In production, remove this — the token goes to the guarantor only
      _devLink: process.env.NODE_ENV !== 'production' ? guarantorLink : undefined,
    });
  } catch (err) {
    console.error('[KYC guarantor invite]', err);
    res.status(500).json({ error: 'Could not send guarantor invite. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/kyc/submit
// Rider confirms everything and submits for review.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/submit', authenticate, requireRole('pickman'), async (req, res) => {
  try {
    const application = await KycApplication.findOne({ riderId: req.user.id });
    if (!application) {
      return res.status(404).json({ error: 'KYC application not found.' });
    }

    if (application.status !== 'draft') {
      return res.status(400).json({
        error: `Cannot submit — current status is '${application.status}'.`,
      });
    }

    // Confirm all required documents are uploaded
    const { vehicleType, countryCode = 'NG' } = application;
    const requiredDocs = (KYC_CONFIG[countryCode]?.[vehicleType] || [])
      .filter((d) => d.required)
      .map((d) => d.key);

    const uploadedKeys = application.documents.map((d) => d.docKey);
    const missing      = requiredDocs.filter((k) => !uploadedKeys.includes(k));

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required documents: ${missing.join(', ')}`,
        missingDocs: missing,
      });
    }

    // Confirm guarantor link was sent
    if (!application.guarantor?.tokenHash) {
      return res.status(400).json({ error: 'Please complete the guarantor step first.' });
    }

    application.status      = 'pending_guarantor';
    application.submittedAt = new Date();
    await application.save();

    res.json({
      success: true,
      status:  'pending_guarantor',
      message: 'Submitted! Waiting for your guarantor to verify.',
    });
  } catch (err) {
    console.error('[KYC submit]', err);
    res.status(500).json({ error: 'Submission failed. Please try again.' });
  }
});


export default router;
