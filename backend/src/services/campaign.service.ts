// src/services/campaign.service.ts
import { Campaign } from '@prisma/client';
import prisma from '../prisma/client';
import crypto from 'crypto';
import { getCampaignQueue } from './queue.service';

function stateError(message: string, statusCode: number = 400) {
  const err = new Error(message) as any;
  err.statusCode = statusCode;
  return err;
}

export class CampaignService {
  /** Create a new campaign */
  async create(data: {
    userId: number;
    name: string;
    whatsappPhoneNumberId: number;
    templateId?: number;
    messageType: string;
    messageContent?: string;
    mediaId?: number;
    scheduledAt?: Date;
    templateVariables?: string;
  }): Promise<Campaign> {
    return prisma.campaign.create({
      data,
    });
  }

  /** Retrieve a campaign by ID */
  async getById(userId: number, id: number): Promise<Campaign | null> {
    return prisma.campaign.findFirst({
      where: { id, userId },
      include: {
        campaignContacts: true,
        whatsappPhoneNumber: true,
      },
    });
  }

  /** List campaigns for user */
  async list(userId: number): Promise<Campaign[]> {
    return prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Add contacts to a campaign and check eligibility/suppression */
  async addContacts(userId: number, campaignId: number, contactIds: number[]): Promise<any> {
    // 1. Get contacts and check suppression
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        userId,
      },
      include: { suppression: true },
    });

    const campaignContactsData = contacts.map(c => {
      let eligible = true;
      let ineligibleReason = null;

      if (c.optOut || c.suppression) {
        eligible = false;
        ineligibleReason = c.suppression?.reason || c.optOutReason || 'Opted out';
      }

      return {
        campaignId,
        contactId: c.id,
        eligible,
        ineligibleReason,
        snapshotPhone: c.phoneNumber,
        snapshotFirstName: c.firstName,
        snapshotLastName: c.lastName,
        snapshotEmail: c.email,
        status: 'pending',
      };
    });

    // 2. Insert CampaignContacts, ignoring duplicates
    const result = await prisma.campaignContact.createMany({
      data: campaignContactsData,
      skipDuplicates: true,
    });

    // 3. Update campaign total recipients count
    const total = await prisma.campaignContact.count({ where: { campaignId } });
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { totalRecipients: total },
    });

    return { added: result.count, total };
  }

  /** Start a campaign (enqueue eligible contacts) */
  async startCampaign(userId: number, campaignId: number): Promise<Campaign> {
    const campaign = await this.getById(userId, campaignId);
    if (!campaign) throw stateError('Campaign not found', 404);
    if (campaign.status === 'running') throw stateError('Campaign is already running', 409);
    if (campaign.status === 'stopped') throw stateError('Cannot start a stopped campaign', 400);

    // 1. Get eligible pending/failed contacts
    const contactsToProcess = await prisma.campaignContact.findMany({
      where: {
        campaignId,
        eligible: true,
        status: { in: ['pending', 'failed'] }, // allow retry on start for failed
      }
    });

    if (contactsToProcess.length === 0 && campaign.status !== 'paused') {
      throw stateError('No eligible pending contacts found for this campaign', 400);
    }

    // 2. Update campaign status
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'running', startedAt: campaign.startedAt || new Date() },
    });

    // 3. Enqueue jobs if any pending contacts exist
    if (contactsToProcess.length > 0) {
      const jobs = contactsToProcess.map(cc => ({
        name: 'send-message',
        data: {
          campaignId,
          contactId: cc.contactId,
          campaignContactId: cc.id,
          idempotencyKey: crypto.randomUUID(), // generate idempotency key
        },
        opts: {
          jobId: `camp-${campaignId}-contact-${cc.contactId}`, // Idempotent job ID
        }
      }));

      const queue = getCampaignQueue();
      await queue.addBulk(jobs);
    }

    return updatedCampaign;
  }

  /** Pause a campaign */
  async pauseCampaign(userId: number, campaignId: number): Promise<Campaign> {
    const campaign = await this.getById(userId, campaignId);
    if (!campaign) throw stateError('Campaign not found', 404);
    if (campaign.status !== 'running') throw stateError(`Cannot pause a campaign that is ${campaign.status}`, 400);
    return prisma.campaign.update({
      where: { id: campaignId, userId },
      data: { status: 'paused' },
    });
  }

  /** Resume a paused campaign */
  async resumeCampaign(userId: number, campaignId: number): Promise<Campaign> {
    const campaign = await this.getById(userId, campaignId);
    if (!campaign) throw stateError('Campaign not found', 404);
    if (campaign.status !== 'paused') throw stateError(`Cannot resume a campaign that is ${campaign.status}`, 400);
    return this.startCampaign(userId, campaignId);
  }

  /** Stop a campaign */
  async stopCampaign(userId: number, campaignId: number): Promise<Campaign> {
    const campaign = await this.getById(userId, campaignId);
    if (!campaign) throw stateError('Campaign not found', 404);
    if (campaign.status === 'stopped') throw stateError('Campaign is already stopped', 409);
    return prisma.campaign.update({
      where: { id: campaignId, userId },
      data: { status: 'stopped', completedAt: new Date() },
    });
  }

  /** Emergency Stop ALL running campaigns */
  async emergencyStopAll(userId: number): Promise<{ count: number }> {
    const result = await prisma.campaign.updateMany({
      where: { userId, status: 'running' },
      data: { status: 'stopped', completedAt: new Date() },
    });
    return { count: result.count };
  }

  /** Check if all campaign recipients have reached a terminal state and mark completed if so */
  static async checkAndUpdateCompletion(campaignId: number): Promise<boolean> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.status !== 'running') {
      return false;
    }

    const pendingCount = await prisma.campaignContact.count({
      where: {
        campaignId,
        status: { in: ['pending', 'queued', 'submitting'] },
      },
    });

    if (pendingCount === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
      return true;
    }

    return false;
  }
}
