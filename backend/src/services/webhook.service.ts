import prisma from '../prisma/client';
import { CampaignService } from './campaign.service';

export class WebhookService {
  /**
   * Helper to generate a mock WhatsApp status webhook payload for local/test simulation.
   */
  static createMockStatusPayload(apiMessageId: string, status: string, recipientPhone: string = '15551234567'): any {
    return {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'mock_waba_id',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: recipientPhone,
                  phone_number_id: 'mock_phone_number_id',
                },
                statuses: [
                  {
                    id: apiMessageId,
                    status: status, // 'sent' | 'delivered' | 'read' | 'failed'
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    recipient_id: recipientPhone,
                  },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  /**
   * Process incoming WhatsApp webhook payloads.
   * Handles both message status updates (sent, delivered, read, failed)
   * and incoming messages from contacts.
   */
  async processPayload(payload: any): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') {
      return;
    }

    if (!payload.entry || !Array.isArray(payload.entry)) {
      return;
    }

    for (const entry of payload.entry) {
      if (!entry.changes || !Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;
        
        const value = change.value;
        const wabaId = entry.id; // WhatsApp Business Account ID
        const metadata = value.metadata;
        const phoneNumberId = metadata?.phone_number_id;

        // Process message statuses (Sent/Delivered/Read/Failed)
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            await this.processMessageStatus(status);
          }
        }

        // Process incoming messages
        if (value.messages && Array.isArray(value.messages)) {
          for (const message of value.messages) {
            const contactInfo = value.contacts?.find((c: any) => c.wa_id === message.from);
            await this.processIncomingMessage(message, contactInfo, phoneNumberId);
          }
        }
      }
    }
  }

  private async processMessageStatus(statusData: any): Promise<void> {
    const apiMessageId = statusData.id;
    const statusType = statusData.status; // 'sent', 'delivered', 'read', 'failed'
    
    // Find our message by apiMessageId
    const messageRecord = await prisma.message.findFirst({
      where: { apiMessageId },
      include: { campaign: true }
    });

    if (!messageRecord) {
      console.warn(`Webhook received status '${statusType}' for unknown message ID: ${apiMessageId}`);
      return;
    }

    // Record the event
    await prisma.messageEvent.create({
      data: {
        messageId: messageRecord.id,
        eventType: statusType,
        details: JSON.stringify(statusData),
        timestamp: statusData.timestamp ? new Date(parseInt(statusData.timestamp) * 1000) : new Date(),
      }
    });

    // Update message status if it's progressing forward
    const statusPrecedence: Record<string, number> = {
      'pending': 0, 'submitted': 1, 'sent': 2, 'delivered': 3, 'read': 4, 'failed': 5
    };
    
    const currentWeight = statusPrecedence[messageRecord.status] || 0;
    const newWeight = statusPrecedence[statusType] || 0;

    // Only update if the new status is "heavier" or it's a first-time failure
    if (newWeight > currentWeight || (statusType === 'failed' && messageRecord.status !== 'failed')) {
      const updateData: any = { status: statusType };
      
      if (statusType === 'failed' && statusData.errors) {
         updateData.errorCode = statusData.errors[0]?.code?.toString();
         updateData.errorMessage = statusData.errors[0]?.message || statusData.errors[0]?.title;
      }

      await prisma.message.update({
        where: { id: messageRecord.id },
        data: updateData
      });

      // Update Campaign metrics
      const campaignUpdate: any = {};
      if (statusType === 'delivered' && messageRecord.status !== 'delivered' && messageRecord.status !== 'read') {
         campaignUpdate.deliveredCount = { increment: 1 };
      } else if (statusType === 'read' && messageRecord.status !== 'read') {
         campaignUpdate.readCount = { increment: 1 };
      } else if (statusType === 'failed' && messageRecord.status !== 'failed') {
         campaignUpdate.failedCount = { increment: 1 };
      }

      if (Object.keys(campaignUpdate).length > 0) {
        await prisma.campaign.update({
          where: { id: messageRecord.campaignId },
          data: campaignUpdate
        });
      }
      
      // Update CampaignContact status
      await prisma.campaignContact.updateMany({
        where: { 
           campaignId: messageRecord.campaignId,
           contactId: messageRecord.contactId
        },
        data: { status: statusType }
      });

      // Check if campaign is completed after recipient status update
      await CampaignService.checkAndUpdateCompletion(messageRecord.campaignId);
    }
  }

  private async processIncomingMessage(messageData: any, contactInfo: any, phoneNumberId: string): Promise<void> {
    const fromPhone = `+${messageData.from}`; // Normalize slightly
    
    // 1. Find the WhatsAppPhoneNumber
    const waPhone = await prisma.whatsAppPhoneNumber.findFirst({
      where: { phoneNumberId }
    });

    if (!waPhone) {
      console.warn(`Incoming message to unknown phoneNumberId: ${phoneNumberId}`);
      return;
    }

    // 2. Find or create the Contact for the user that owns this WA Phone
    let contact = await prisma.contact.findFirst({
      where: { 
        userId: waPhone.userId || 0,
        phoneNumber: fromPhone
      }
    });

    if (!contact && waPhone.userId) {
      // Auto-create contact
      const profileName = contactInfo?.profile?.name;
      contact = await prisma.contact.create({
        data: {
          userId: waPhone.userId,
          phoneNumber: fromPhone,
          firstName: profileName,
          consentGiven: false, 
        }
      });
    }

    if (!contact) return;

    // 3. Extract content
    let content = '';
    let mediaId = undefined;
    const type = messageData.type;

    if (type === 'text') {
      content = messageData.text?.body || '';
    } else if (['image', 'video', 'document', 'audio'].includes(type)) {
      const mediaObj = messageData[type];
      content = mediaObj?.caption || '';
      // TODO: In a real app, you would download the media from WhatsApp and save it locally
      // For now, we just record that we received it.
    } else if (type === 'button') {
      content = messageData.button?.text || '';
    } else if (type === 'interactive') {
       if (messageData.interactive?.type === 'button_reply') {
          content = messageData.interactive.button_reply.title || '';
       } else if (messageData.interactive?.type === 'list_reply') {
          content = messageData.interactive.list_reply.title || '';
       }
    }

    // 4. Save to Inbox
    await prisma.incomingMessage.create({
      data: {
        contactId: contact.id,
        whatsappPhoneNumberId: waPhone.id,
        messageId: messageData.id,
        type,
        content,
        mediaId,
        receivedAt: new Date((parseInt(messageData.timestamp) || Date.now() / 1000) * 1000),
      }
    });
  }
}
