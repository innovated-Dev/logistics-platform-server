/**
 * File validation utilities.
 *
 * We validate by reading the actual file bytes (magic numbers),
 * NOT just the file extension — because extensions can be faked.
 */

// Allowed MIME types and their magic byte signatures
const SIGNATURES = {
  'image/jpeg': [
    [0xff, 0xd8, 0xff],
  ],
  'image/png': [
    [0x89, 0x50, 0x4e, 0x47],
  ],
  'application/pdf': [
    [0x25, 0x50, 0x44, 0x46], // %PDF
  ],
};

const EXTENSION_MAP = {
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'application/pdf': 'pdf',
};

/**
 * Detect the real MIME type of a buffer by checking magic bytes.
 * Returns null if the file type is not recognised or not allowed.
 *
 * @param {Buffer} buffer
 * @returns {string|null} mimeType
 */
const detectMimeType = (buffer) => {
  for (const [mime, sigs] of Object.entries(SIGNATURES)) {
    for (const sig of sigs) {
      const matches = sig.every((byte, i) => buffer[i] === byte);
      if (matches) return mime;
    }
  }
  return null;
};

/**
 * Validate an uploaded file buffer.
 *
 * @param {Buffer} buffer
 * @param {number} maxSizeMB
 * @returns {{ valid: boolean, mimeType: string|null, extension: string|null, error: string|null }}
 */
const validateFile = (buffer, maxSizeMB = 5) => {
  // Check file size
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (buffer.length > maxBytes) {
    return {
      valid: false,
      mimeType: null,
      extension: null,
      error: `File too large. Maximum size is ${maxSizeMB}MB.`,
    };
  }

  // Check file is not empty
  if (buffer.length === 0) {
    return {
      valid: false,
      mimeType: null,
      extension: null,
      error: 'File is empty.',
    };
  }

  // Check actual file type by magic bytes
  const mimeType = detectMimeType(buffer);
  if (!mimeType) {
    return {
      valid: false,
      mimeType: null,
      extension: null,
      error: 'Invalid file type. Only JPG, PNG, and PDF files are accepted.',
    };
  }

  return {
    valid: true,
    mimeType,
    extension: EXTENSION_MAP[mimeType],
    error: null,
  };
};


export { validateFile };