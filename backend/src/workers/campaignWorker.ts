// src/workers/campaignWorker.ts
import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { env } from '../config/env';
import prisma from '../prisma/client';
import { WhatsAppCloudApi, MockWhatsAppApi } from '../integrations/whatsappCloudApi';
import { CampaignService } from '../services/campaign.service';

const whatsappApi = env.useMockWhatsApp ? new MockWhatsAppApi() : new WhatsAppCloudApi();

let workerInstance: Worker | null = null;
let isWorkerStarted = false;

export async function processCampaignJob(data: {
  campaignId: number;
  contactId: number;
  campaignContactId: number;
  idempotencyKey: string;
}): Promise<{ success: boolean; apiMessageId?: string; error?: string; permanent?: boolean; status?: string }> {
  const { campaignId, contactId, campaignContactId, idempotencyKey } = data;

  // Throttle messages if configured
  if (env.messageSendDelayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, env.messageSendDelayMs));
  }

  // 1. Fetch Campaign and Contact Data
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true, whatsappPhoneNumber: true, media: true }
  });

  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  // 2. Idempotency Check: check if message already created and sent
  let messageRecord = await prisma.message.findUnique({
    where: { internalMessageId: idempotencyKey }
  });

  if (messageRecord && messageRecord.status !== 'failed' && messageRecord.status !== 'pending') {
    // Already processed successfully
    return { success: true, apiMessageId: messageRecord.apiMessageId || undefined, status: messageRecord.status };
  }

  // 3. Check if campaign is still running (prevent sending if paused/stopped/completed)
  if (campaign.status !== 'running') {
    throw new Error(`Campaign is ${campaign.status}, halting job.`);
  }

  const campaignContact = await prisma.campaignContact.findUnique({
    where: { id: campaignContactId }
  });

  if (!campaignContact || !campaignContact.eligible) {
    throw new Error(`Contact not eligible or not found for campaign`);
  }

  const phoneTo = campaignContact.snapshotPhone;
  if (!phoneTo) throw new Error('No phone number snapshot found');

  const fromPhoneId = campaign.whatsappPhoneNumber?.phoneNumberId;
  if (!fromPhoneId && !env.useMockWhatsApp) {
    throw new Error('WhatsApp Phone Number ID is missing on the sender account');
  }



  if (!messageRecord) {
    messageRecord = await prisma.message.create({
      data: {
        campaignId,
        contactId,
        whatsappPhoneNumberId: campaign.whatsappPhoneNumberId,
        internalMessageId: idempotencyKey,
        type: campaign.messageType,
        status: 'submitted',
        mediaId: campaign.mediaId,
      }
    });
  }

  // 4. Send Message via WhatsApp API
  try {
    let apiResponse;
    if (campaign.messageType === 'text' && campaign.messageContent) {
      apiResponse = await whatsappApi.sendText(phoneTo, campaign.messageContent, fromPhoneId || 'mock_id');
    } else if (campaign.messageType === 'template' && campaign.template) {
      apiResponse = await whatsappApi.sendTemplate(
        phoneTo,
        campaign.template.name,
        campaign.template.language,
        [],
        fromPhoneId || 'mock_id'
      );
    } else if (['image', 'video', 'document'].includes(campaign.messageType) && campaign.media) {
      const mediaId = campaign.media.whatsappMediaId || 'mock_media_id';
      apiResponse = await whatsappApi.sendMedia(
        phoneTo,
        mediaId,
        campaign.messageType as any,
        campaign.messageContent || undefined,
        fromPhoneId || 'mock_id'
      );
    } else {
      // Fallback message sending
      apiResponse = await whatsappApi.sendText(
        phoneTo,
        campaign.messageContent || `Hello from campaign ${campaign.name}`,
        fromPhoneId || 'mock_id'
      );
    }

    const apiMessageId = apiResponse?.messages?.[0]?.id || `wamid.mock.${Date.now()}`;

    // 5. Update DB (Success Path: status -> submitted / sent)
    await prisma.$transaction([
      prisma.message.update({
        where: { id: messageRecord.id },
        data: { status: 'submitted', apiMessageId }
      }),
      prisma.campaignContact.update({
        where: { id: campaignContactId },
        data: { status: 'sent' }
      }),
      prisma.campaign.update({
        where: { id: campaignId },
        data: { sentCount: { increment: 1 } }
      })
    ]);

    // Check if campaign is now completed
    await CampaignService.checkAndUpdateCompletion(campaignId);

    return { success: true, apiMessageId, status: 'submitted' };
  } catch (apiError: any) {
    const errorMessage = apiError.response?.data?.error?.message || apiError.message;
    const errorCode = apiError.response?.data?.error?.code?.toString();

    const isPermanent = ['131009', '100', '400'].includes(errorCode);

    await prisma.$transaction([
      prisma.message.update({
        where: { id: messageRecord.id },
        data: {
          status: 'failed',
          errorMessage,
          errorCode,
          errorCategory: isPermanent ? 'permanent' : 'transient'
        }
      }),
      prisma.campaignContact.update({
        where: { id: campaignContactId },
        data: { status: 'failed' }
      }),
      prisma.campaign.update({
        where: { id: campaignId },
        data: { failedCount: { increment: 1 } }
      })
    ]);

    if (!isPermanent) {
      throw apiError;
    } else {
      // Check if campaign is completed despite this failed recipient
      await CampaignService.checkAndUpdateCompletion(campaignId);
      return { success: false, error: errorMessage, permanent: true };
    }
  }
}

export function initCampaignWorker() {
  if (isWorkerStarted) return workerInstance;
  isWorkerStarted = true;

  console.log('==================================================');
  console.log(`[Queue System] Redis Mode: ${env.useMockRedis ? 'MOCK (USE_MOCK_REDIS=true)' : `REAL (${env.redisUrl})`}`);
  console.log(`[Queue System] Queue Name: campaign-queue`);
  console.log(`[Queue System] Worker Status: STARTED and listening`);
  console.log('==================================================');

  if (!env.useMockRedis) {
    workerInstance = new Worker(
      'campaign-queue',
      async (job: Job) => {
        return processCampaignJob(job.data);
      },
      {
        connection: getRedisConnection() as any,
        concurrency: env.campaignWorkerConcurrency,
      }
    );

    workerInstance.on('failed', (job, err) => {
      console.error(`[BullMQWorker] Job ${job?.id} failed: ${err.message}`);
    });

    workerInstance.on('completed', (job) => {
      console.log(`[BullMQWorker] Job ${job?.id} completed successfully`);
    });
  }

  return workerInstance;
}

// Export campaignWorker object with processFn helper for compatibility with test suites
export const campaignWorker: any = {
  processFn: async (job: { data: any }) => processCampaignJob(job.data),
};

// Auto-start worker when module is loaded
initCampaignWorker();
