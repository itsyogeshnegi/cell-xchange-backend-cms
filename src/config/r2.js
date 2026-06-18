import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize S3 Client only if credentials exist
const hasR2Creds =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME;

let s3Client = null;

if (hasR2Creds) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  console.log('Cloudflare R2 Storage Client Initialized');
} else {
  console.log('Cloudflare R2 credentials missing. Using local filesystem storage.');
  // Ensure local uploads directory exists
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

/**
 * Upload a file (either to Cloudflare R2 or Local Storage)
 * @param {Object} file Multer file object
 * @returns {Promise<string>} The public URL of the uploaded file
 */
export const uploadFile = async (file) => {
  if (!file) return '';

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const fileExt = path.extname(file.originalname);

  let buffer = file.buffer;
  let key = `${uniqueSuffix}${fileExt}`;
  let mimeType = file.mimetype;

  // Compress images if the file uploaded is an image type
  if (file.mimetype.startsWith('image/')) {
    try {
      buffer = await sharp(file.buffer)
        .resize({ width: 1200, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true })
        .toBuffer();
      // Since it is compressed to JPEG, use .jpg extension and update mime type
      key = `${uniqueSuffix}.jpg`;
      mimeType = 'image/jpeg';
    } catch (error) {
      console.error('Error compressing image with sharp:', error);
      // Fallback to original buffer
    }
  }

  // 1. Cloudflare R2 Upload
  if (s3Client && hasR2Creds) {
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      await s3Client.send(command);

      const publicUrl = process.env.R2_PUBLIC_URL
        ? `${process.env.R2_PUBLIC_URL}/${key}`
        : `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`;
        
      return publicUrl;
    } catch (error) {
      console.error('Error uploading to Cloudflare R2:', error);
      // Fallback to local on upload failure
    }
  }

  // 2. Local Storage Fallback
  try {
    const uploadPath = path.join(__dirname, '../../uploads', key);
    fs.writeFileSync(uploadPath, buffer);
    return `/uploads/${key}`;
  } catch (error) {
    console.error('Error writing file locally:', error);
    throw new Error('File upload failed');
  }
};

/**
 * Delete a file from storage
 * @param {string} fileUrl The URL of the file to delete
 */
export const deleteFile = async (fileUrl) => {
  if (!fileUrl) return;

  // 1. Local storage deletion
  if (fileUrl.startsWith('/uploads/')) {
    try {
      const key = fileUrl.replace('/uploads/', '');
      const filePath = path.join(__dirname, '../../uploads', key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error deleting local file:', error);
    }
    return;
  }

  // 2. R2 deletion
  if (s3Client && hasR2Creds) {
    try {
      // Extract key from URL
      const urlParts = fileUrl.split('/');
      const key = urlParts[urlParts.length - 1];

      const command = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
    } catch (error) {
      console.error('Error deleting file from Cloudflare R2:', error);
    }
  }
};
