// src/middleware/auditLogger.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';

export const auditLogger = async (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', async () => {
    const duration = Date.now() - start;
    const userId = (req as any).user?.id; // auth middleware should set req.user
    if (!userId) return; // Only log authenticated actions

    const action = `${req.method} ${req.originalUrl}`;
    // Simple parsing to extract entity and id from URL (optional)
    let entity = '';
    let entityId: number | undefined;
    const match = req.originalUrl.match(/\/api\/(\w+)(?:\/(\d+))?/);
    if (match) {
      entity = match[1];
      if (match[2]) entityId = parseInt(match[2], 10);
    }
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        metadata: JSON.stringify({ status: res.statusCode, duration }),
      },
    });
  });
  next();
};
