import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'hiaimenugo/menu-items',
    allowed_formats: ['jpg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
  } as any,
});

export const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Giới hạn 5MB
  }
});
