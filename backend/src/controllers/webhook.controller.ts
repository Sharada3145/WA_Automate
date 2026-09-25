// src/controllers/webhook.controller.ts
import { Request, Response } from 'express';
import { env } from '../config/env';
import { WebhookService } from '../services/webhook.service';

const webhookService = new WebhookService();

export const verifyWebhook = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.whatsappWebhookVerifyToken) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

import crypto from 'crypto';

export const receiveWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (env.whatsappAppSecret && signature) {
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        return res.status(400).send('Missing raw body');
      }
      
      const expectedSignature = `sha256=${crypto
        .createHmac('sha256', env.whatsappAppSecret)
        .update(rawBody)
        .digest('hex')}`;
        
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        console.warn('Webhook signature mismatch');
        return res.sendStatus(403);
      }
    }

    const payload = req.body;
    await webhookService.processPayload(payload);
    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing webhook payload:', error);
  }
};

export const simulateMockStatus = async (req: Request, res: Response) => {
  if (!env.useMockRedis && !env.useMockWhatsApp) {
    return res.status(403).json({ error: 'Mock webhook simulation is disabled in production mode' });
  }

  const { apiMessageId, status, recipientPhone } = req.body;
  if (!apiMessageId || !status) {
    return res.status(400).json({ error: 'apiMessageId and status are required' });
  }

  try {
    const payload = WebhookService.createMockStatusPayload(apiMessageId, status, recipientPhone);
    await webhookService.processPayload(payload);
    return res.status(200).json({ success: true, apiMessageId, status });
  } catch (error: any) {
    console.error('Error simulating mock status webhook:', error);
    return res.status(500).json({ error: error.message || 'Failed to process mock webhook status' });
  }
};

