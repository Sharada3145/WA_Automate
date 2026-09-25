// src/services/media.service.ts
import { Media } from '@prisma/client';
import prisma from '../prisma/client';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

export class MediaService {
  /** Uploads a file locally and creates a DB record */
  async upload(userId: number, file: Express.Multer.File): Promise<Media> {
    const uploadDir = path.resolve(process.cwd(), env.mediaUploadDir);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const ext = path.extname(safeOriginalName);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadDir, filename);

    // If using memory storage for multer, file.buffer is available
    fs.writeFileSync(filePath, file.buffer);

    // In a real app, URL might be an S3 URL or a local static route
    const url = `/media/${filename}`;

    return prisma.media.create({
      data: {
        userId,
        filename: safeOriginalName,
        mimeType: file.mimetype,
        size: file.size,
        url,
      },
    });
  }

  async getById(id: number): Promise<Media | null> {
    return prisma.media.findUnique({ where: { id } });
  }

  async saveWhatsAppMediaId(id: number, whatsappMediaId: string): Promise<Media> {
    return prisma.media.update({
      where: { id },
      data: { whatsappMediaId },
    });
  }
}
