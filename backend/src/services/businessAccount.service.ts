// src/services/businessAccount.service.ts
import { WhatsAppBusinessAccount } from '@prisma/client';
import prisma from '../prisma/client';

export class BusinessAccountService {
  /** Create a new WhatsApp Business Account linked to the user */
  async create(userId: number, accountId: string, name?: string, accessToken?: string) {
    const account = await prisma.whatsAppBusinessAccount.create({
      data: {
        userId,
        accountId,
        name,
        accessToken,
      },
    });
    const { accessToken: _, ...safeAccount } = account;
    return safeAccount;
  }

  async list(userId: number) {
    const accounts = await prisma.whatsAppBusinessAccount.findMany({ where: { userId } });
    return accounts.map(({ accessToken, ...safe }) => safe);
  }

  async getById(userId: number, id: number) {
    const account = await prisma.whatsAppBusinessAccount.findFirst({ where: { id, userId } });
    if (!account) return null;
    const { accessToken, ...safeAccount } = account;
    return safeAccount;
  }
}
