// src/config/cloudinary.js — Cloudinary initialisation
// Used exclusively for KYC document uploads from multer memory storage.
// Files never touch the disk — they flow straight from the browser
// through multer (memory buffer) into Cloudinary's upload stream.
import { v2 as cloudinary } from 'cloudinary';
import  env   from './env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_NAME,
  api_key:    env.CLOUDINARY_KEY,
  api_secret: env.CLOUDINARY_SECRET,
  secure:     true,
});

/**
 * Upload a buffer directly to Cloudinary.
 * Returns { url, publicId }.
 */
export async function uploadBuffer(buffer, folder, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:            `offscape/${folder}`,
        public_id:         filename,
        resource_type:     'auto',  // handles image + PDF
        allowed_formats:   ['jpg','jpeg','png','pdf'],
        transformation:    [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export { cloudinary };