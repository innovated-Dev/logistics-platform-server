/**
 * Backblaze B2 Service
 *
 * All KYC documents go here — private bucket, no public access.
 * The frontend NEVER sees a B2 URL directly.
 * Admins get presigned URLs that expire in 15 minutes.
 *
 * Uses the official @aws-sdk/client-s3 — B2 is S3-compatible.
 * This means you use the same SDK you'd use for AWS S3.
 *
 * Setup steps (do this once):
 *   1. Go to backblaze.com → sign up → Create a Bucket
 *   2. Set bucket to PRIVATE (not public)
 *   3. Go to App Keys → Add a New Application Key
 *   4. Give it Read + Write access to your bucket
 *   5. Copy the keyID and applicationKey into your .env
 *   6. Find your bucket endpoint in the bucket details page
 *      It looks like: s3.us-west-004.backblazeb2.com
 */

import   env  from '../config/env.js'; // load env vars
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Client setup ────────────────────────────────────────────────────────────
// B2 is S3-compatible so we use the S3Client pointed at the B2 endpoint.
const b2Client = new S3Client({
  endpoint: `https://${env.B2_ENDPOINT}`, // e.g. s3.us-west-004.backblazeb2.com
  region: env.B2_REGION || 'us-west-004', // match your bucket region
  credentials: {
    accessKeyId:     env.B2_APPLICATION_KEY_ID,
    secretAccessKey: env.B2_APPLICATION_KEY,
  },
});

const BUCKET = env.B2_BUCKET_NAME;

// ─── Upload a file ───────────────────────────────────────────────────────────
/**
 * Upload a Buffer to Backblaze B2 (private).
 *
 * @param {string} fileKey   - The path inside the bucket
 *                             e.g. 'kyc/64abc123/nin_document/1716400000000.jpg'
 * @param {Buffer} buffer    - The file contents
 * @param {string} mimeType  - e.g. 'image/jpeg'
 * @returns {Promise<string>} - The fileKey (stored in DB, never sent to client)
 */
const uploadFile = async (fileKey, buffer, mimeType) => {
  const command = new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         fileKey,
    Body:        buffer,
    ContentType: mimeType,
    // No ACL — bucket is private, files inherit private access
  });

  await b2Client.send(command);
  return fileKey; // we only store the key, never the full URL
};

// ─── Generate a presigned URL (admin only) ───────────────────────────────────
/**
 * Generate a temporary URL for admin to view a document.
 * Expires in 15 minutes — after that the link is dead.
 *
 * @param {string} fileKey - The b2FileKey stored in the database
 * @returns {Promise<string>} - Temporary URL valid for 15 minutes
 */
const getPresignedUrl = async (fileKey) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key:    fileKey,
  });

  const url = await getSignedUrl(b2Client, command, {
    expiresIn: 15 * 60, // 15 minutes in seconds
  });

  return url;
};

// ─── Delete a file ───────────────────────────────────────────────────────────
/**
 * Delete a file from B2. Used when a rider replaces a document.
 *
 * @param {string} fileKey
 */
const deleteFile = async (fileKey) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key:    fileKey,
  });

  await b2Client.send(command);
};

// ─── Build a file key ────────────────────────────────────────────────────────
/**
 * Build a consistent file path for a KYC document.
 *
 * @param {string} riderId    - MongoDB ObjectId as string
 * @param {string} docKey     - e.g. 'nin_document'
 * @param {string} extension  - e.g. 'jpg', 'pdf'
 * @returns {string}          - e.g. 'kyc/64abc123/nin_document/1716400000000.jpg'
 */
const buildFileKey = (riderId, docKey, extension) => {
  const timestamp = Date.now();
  return `kyc/${riderId}/${docKey}/${timestamp}.${extension}`;
};

export { uploadFile, getPresignedUrl, deleteFile, buildFileKey };
