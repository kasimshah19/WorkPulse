import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import env from '../config/env.js';

// Setup multer in-memory storage with file size limit
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: env.selfieMaxBytes, // 2MB default
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      const err = new Error('INVALID_FILE_TYPE: Only JPEG and PNG image files are allowed.');
      err.code = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

/**
 * Validates the magic bytes of an image buffer to prevent file extension spoofing.
 * - JPEG starts with 0xFF, 0xD8, 0xFF
 * - PNG starts with 0x89, 0x50, 0x4E, 0x47
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
export function isValidImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return false;

  // Check JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // Check PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }

  return false;
}

/**
 * Saves a verified selfie buffer to disk under UPLOAD_DIR/selfies/<jobId>/<date>/<uuid>.jpg
 * TODO: Production should use S3/Cloudinary with pre-signed URLs.
 *
 * @param {Object} params
 * @param {Buffer} params.buffer
 * @param {string} params.jobId
 * @param {string} params.date - YYYY-MM-DD
 * @returns {Promise<{ relativePath: string, fullPath: string }>}
 */
export async function saveSelfie({ buffer, jobId, date }) {
  if (!isValidImageMagicBytes(buffer)) {
    const error = new Error('INVALID_MAGIC_BYTES: File content is not a valid JPEG or PNG image.');
    error.code = 'INVALID_MAGIC_BYTES';
    throw error;
  }

  const safeJobId = String(jobId).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeDate = String(date).replace(/[^0-9-]/g, '');
  const targetDir = path.resolve(env.uploadDir, 'selfies', safeJobId, safeDate);

  await fs.promises.mkdir(targetDir, { recursive: true });

  const filename = `${crypto.randomUUID()}.jpg`;
  const fullPath = path.join(targetDir, filename);

  await fs.promises.writeFile(fullPath, buffer);

  const relativePath = path.join('selfies', safeJobId, safeDate, filename).replace(/\\/g, '/');

  return { relativePath, fullPath };
}

/**
 * Resolves a stored relative selfie path to its full filesystem path.
 * Guards against directory traversal.
 *
 * @param {string} relativePath
 * @returns {string}
 */
export function resolveSelfiePath(relativePath) {
  if (!relativePath) return null;
  const baseUploadDir = path.resolve(env.uploadDir);
  const resolved = path.resolve(baseUploadDir, relativePath);

  // Security check: Must reside within baseUploadDir
  if (!resolved.startsWith(baseUploadDir)) {
    throw new Error('DIRECTORY_TRAVERSAL_DETECTED');
  }

  return resolved;
}

/**
 * Saves a verified incident photo buffer to disk under UPLOAD_DIR/incidents/<incidentId>/<uuid>.jpg
 * Stored outside any public folder.
 *
 * @param {Object} params
 * @param {Buffer} params.buffer
 * @param {string} params.incidentId
 * @returns {Promise<{ relativePath: string, fullPath: string }>}
 */
export async function saveIncidentPhoto({ buffer, incidentId }) {
  if (!isValidImageMagicBytes(buffer)) {
    const error = new Error('INVALID_MAGIC_BYTES: File content is not a valid JPEG or PNG image.');
    error.code = 'INVALID_MAGIC_BYTES';
    throw error;
  }

  const safeIncidentId = String(incidentId).replace(/[^a-zA-Z0-9_-]/g, '');
  const targetDir = path.resolve(env.uploadDir, 'incidents', safeIncidentId);

  await fs.promises.mkdir(targetDir, { recursive: true });

  const filename = `${crypto.randomUUID()}.jpg`;
  const fullPath = path.join(targetDir, filename);

  await fs.promises.writeFile(fullPath, buffer);

  const relativePath = path.join('incidents', safeIncidentId, filename).replace(/\\/g, '/');

  return { relativePath, fullPath };
}

/**
 * Resolves a stored relative incident photo path to its full filesystem path.
 * Guards against directory traversal.
 *
 * @param {string} relativePath
 * @returns {string}
 */
export function resolveIncidentPhotoPath(relativePath) {
  if (!relativePath) return null;
  const baseUploadDir = path.resolve(env.uploadDir);
  const resolved = path.resolve(baseUploadDir, relativePath);

  if (!resolved.startsWith(baseUploadDir)) {
    throw new Error('DIRECTORY_TRAVERSAL_DETECTED');
  }

  return resolved;
}

