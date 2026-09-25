// src/controllers/inbox.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';

export const getInbox = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    
    // Group incoming messages by contact
    const messages = await prisma.incomingMessage.findMany({
      where: {
        contact: {
          userId
        }
      },
      include: {
        contact: true,
        whatsappPhoneNumber: true,
      },
      orderBy: {
        receivedAt: 'desc'
      },
      take: 100 // limit for now
    });
    
    res.json(messages);
  } catch (err) {
    next(err);
  }
};
