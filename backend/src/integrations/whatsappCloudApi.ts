// src/integrations/whatsappCloudApi.ts
import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';

export interface WhatsAppMessagePayload {
  messaging_product: string;
  to: string;
  type: string;
  text?: { body: string };
  template?: { name: string; language: { code: string }; components?: any[] };
  image?: { id: string; caption?: string };
  video?: { id: string; caption?: string };
  document?: { id: string; caption?: string };
}

export class WhatsAppCloudApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.whatsappApiBaseUrl || 'https://graph.facebook.com/v17.0',
      headers: {
        Authorization: `Bearer ${env.whatsappApiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendMessage(payload: WhatsAppMessagePayload): Promise<any> {
    const url = `/${env.whatsappBusinessId}/messages`;
    const response = await this.client.post(url, payload);
    return response.data;
  }

  async sendText(to: string, body: string, fromPhoneId: string): Promise<any> {
    const payload: WhatsAppMessagePayload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    };
    return this.sendMessage(payload);
  }

  async sendTemplate(to: string, templateName: string, languageCode: string, components: any[], fromPhoneId: string): Promise<any> {
    const payload: WhatsAppMessagePayload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };
    return this.sendMessage(payload);
  }

  async sendMedia(to: string, mediaId: string, type: 'image' | 'video' | 'document', caption?: string, fromPhoneId?: string): Promise<any> {
    const mediaPayload: any = { id: mediaId };
    if (caption) mediaPayload.caption = caption;
    const payload: WhatsAppMessagePayload = {
      messaging_product: 'whatsapp',
      to,
      type,
      [type]: mediaPayload,
    };
    return this.sendMessage(payload);
  }
}

/** Mock implementation for tests */
export class MockWhatsAppApi {
  public calls: any[] = [];

  async sendMessage(payload: WhatsAppMessagePayload): Promise<any> {
    this.calls.push(payload);
    if (payload.to.includes('FAIL') || payload.to.includes('0000')) {
      const err: any = new Error('Invalid recipient phone number');
      err.response = { data: { error: { code: '400', message: 'Invalid recipient phone number' } } };
      throw err;
    }
    // Simulate successful API response
    return { messages: [{ id: `wamid.mock.${Date.now()}.${Math.random().toString(36).substring(2, 7)}` }] };
  }

  async sendText(to: string, body: string, fromPhoneId: string): Promise<any> {
    return this.sendMessage({ messaging_product: 'whatsapp', to, type: 'text', text: { body } });
  }

  async sendTemplate(to: string, templateName: string, languageCode: string, components: any[], fromPhoneId: string): Promise<any> {
    return this.sendMessage({ messaging_product: 'whatsapp', to, type: 'template', template: { name: templateName, language: { code: languageCode }, components } });
  }

  async sendMedia(to: string, mediaId: string, type: 'image' | 'video' | 'document', caption?: string, fromPhoneId?: string): Promise<any> {
    const mediaPayload: any = { id: mediaId };
    if (caption) mediaPayload.caption = caption;
    return this.sendMessage({ messaging_product: 'whatsapp', to, type, [type]: mediaPayload });
  }
}
