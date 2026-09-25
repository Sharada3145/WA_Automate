// src/routes/media.routes.ts
import { Router } from 'express';
import { uploadMedia } from '../controllers/media.controller';
import { uploadCsv } from '../middleware/upload.middleware'; // reusing multer or create new one

const router = Router();

import multer from 'multer';
import path from 'path';
import { env } from '../config/env';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/amr',
  'video/mp4', 'video/3gp',
  'application/pdf', 'text/plain', 'text/csv',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const upload = multer({
  limits: { fileSize: env.maxMediaFileSize },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.csv', '.xlsx', '.docx', '.mp4', '.mp3', '.ogg'].includes(ext);
    const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.mimetype);
    if (!isAllowedExt || !isAllowedMime) {
      return cb(new Error('Unsupported file type or extension'));
    }
    cb(null, true);
  }
});

router.post('/', upload.single('file'), uploadMedia);

export default router;
