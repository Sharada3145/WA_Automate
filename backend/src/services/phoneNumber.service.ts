// src/services/phoneNumber.service.ts
import { WhatsAppPhoneNumber } from '@prisma/client';
import prisma from '../prisma/client';

export class PhoneNumberService {
  /** Create a new authorized phone number linked to a user */
  async create(userId: number, phoneNumber: string, displayName?: string, businessAccountId?: number): Promise<WhatsAppPhoneNumber> {
    if (!/^\+\d{10,15}$/.test(phoneNumber)) {
      throw new Error('Invalid phone number format. Expected E.164.');
    }

    let wabaId = businessAccountId;
    if (!wabaId) {
      const waba = await prisma.whatsAppBusinessAccount.findFirst({ where: { userId } });
      if (waba) {
        wabaId = waba.id;
      } else {
        const newWaba = await prisma.whatsAppBusinessAccount.create({
          data: {
            userId,
            accountId: `waba_${Date.now()}`,
            name: 'Default Business Account',
          },
        });
        wabaId = newWaba.id;
      }
    }

    return prisma.whatsAppPhoneNumber.create({
      data: {
        userId,
        phoneNumber,
        displayName,
        status: 'unconnected',
        businessAccountId: wabaId,
      },
    });
  }

  async list(userId: number): Promise<WhatsAppPhoneNumber[]> {
    return prisma.whatsAppPhoneNumber.findMany({ where: { userId } });
  }

  async setStatus(userId: number, phoneId: number, status: 'connected' | 'inactive' | 'error') {
    const phone = await prisma.whatsAppPhoneNumber.findFirst({ where: { id: phoneId, userId } });
    if (!phone) throw new Error('Phone number not found');
    return prisma.whatsAppPhoneNumber.update({
      where: { id: phoneId },
      data: { status },
    });
  }
}
