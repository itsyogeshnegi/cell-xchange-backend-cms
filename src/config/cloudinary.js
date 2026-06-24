import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Cloudinary only if credentials exist
const hasCloudinaryCreds =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (hasCloudinaryCreds) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('Cloudinary Storage Client Initialized');
} else {
  console.log('Cloudinary credentials missing. Using local filesystem storage.');
  // Ensure local uploads directory exists
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

/**
 * Upload a file (either to Cloudinary or Local Storage)
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

  // 1. Cloudinary Upload
  if (hasCloudinaryCreds) {
    try {
      return new Promise((resolve, reject) => {
        // Strip extension to use unique suffix as public_id
        const publicId = key.substring(0, key.lastIndexOf('.'));
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            resource_type: 'auto',
            folder: 'phone_cms',
          },
          (error, result) => {
            if (error) {
              console.error('Error uploading to Cloudinary:', error);
              // Fallback to local storage on error
              try {
                const uploadPath = path.join(__dirname, '../../uploads', key);
                fs.writeFileSync(uploadPath, buffer);
                resolve(`/uploads/${key}`);
              } catch (localError) {
                reject(localError);
              }
            } else {
              resolve(result.secure_url);
            }
          }
        );
        stream.end(buffer);
      });
    } catch (error) {
      console.error('Cloudinary upload stream initialization error:', error);
      // Fallback to local storage
    }
  }

  // 2. Local Storage Fallback (if credentials missing or stream error)
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

  // 2. Cloudinary deletion
  if (hasCloudinaryCreds) {
    try {
      // Extract public_id from URL
      const parts = fileUrl.split('/upload/');
      if (parts.length >= 2) {
        const pathAfterUpload = parts[1];
        const segments = pathAfterUpload.split('/');
        // Remove version segment (e.g. v1625072000)
        if (segments[0].match(/^v\d+$/)) {
          segments.shift();
        }
        const filenameWithExtension = segments.join('/');
        const lastDotIdx = filenameWithExtension.lastIndexOf('.');
        const publicId = lastDotIdx === -1 ? filenameWithExtension : filenameWithExtension.substring(0, lastDotIdx);

        if (publicId) {
          const resourceType = fileUrl.includes('/raw/upload/') ? 'raw' : fileUrl.includes('/video/upload/') ? 'video' : 'image';
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
          console.log(`Successfully deleted file from Cloudinary: ${publicId}`);
        }
      }
    } catch (error) {
      console.error('Error deleting file from Cloudinary:', error);
    }
  }
};
