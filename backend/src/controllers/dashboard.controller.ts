// src/controllers/dashboard.controller.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;

    const [
      totalContacts,
      totalCampaigns,
      messagesSent,
      incomingMessages
    ] = await Promise.all([
      prisma.contact.count({ where: { userId } }),
      prisma.campaign.count({ where: { userId } }),
      prisma.message.count({ 
         where: { 
           campaign: { userId }, 
           status: { in: ['sent', 'delivered', 'read'] } 
         } 
      }),
      prisma.incomingMessage.count({
         where: { contact: { userId } }
      })
    ]);

    // Optional: Get last 5 campaigns for quick overview
    const recentCampaigns = await prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        totalRecipients: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        createdAt: true,
      }
    });

    res.json({
      totalContacts,
      totalCampaigns,
      messagesSent,
      incomingMessages,
      recentCampaigns
    });
  } catch (err) {
    next(err);
  }
};
