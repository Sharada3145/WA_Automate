// src/controllers/media.controller.ts
import { Request, Response, NextFunction } from 'express';
import { MediaService } from '../services/media.service';

const mediaService = new MediaService();

export const uploadMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const media = await mediaService.upload(userId, req.file);
    res.status(201).json(media);
  } catch (err) {
    next(err);
  }
};
