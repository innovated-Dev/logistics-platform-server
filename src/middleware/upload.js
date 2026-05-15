// src/middleware/upload.js
// Multer configured for memory storage (files stay in RAM as Buffer,
// never written to disk) so they can be piped directly to Cloudinary.
// File type and size are validated here before the controller sees them.
import multer from 'multer';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;  // 5 MB

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and PDF files are accepted'), false);
  }
}

export const upload = multer({
  storage,
  limits:     { fileSize: MAX_SIZE_BYTES, files: 1 },
  fileFilter,
});

// Single-file upload middleware for KYC documents
export const uploadSingle = upload.single('file');