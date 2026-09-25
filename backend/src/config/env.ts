// src/config/env.ts
import * as dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '10000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  whatsappApiToken: process.env.WHATSAPP_API_TOKEN || '',
  whatsappBusinessId: process.env.WHATSAPP_BUSINESS_ID || '',
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsappBusinessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  whatsappApiBaseUrl: process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'supersecret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  auditLogRetentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 100),
  // Campaign worker concurrency
  campaignWorkerConcurrency: parseInt(process.env.CAMPAIGN_WORKER_CONCURRENCY || '10', 10),
  // Delay between messages in ms (throttle)
  messageSendDelayMs: parseInt(process.env.MESSAGE_SEND_DELAY_MS || '100', 10),
  // Media upload directory
  mediaUploadDir: process.env.MEDIA_UPLOAD_DIR || './uploads',
  // Max media file size in bytes (default 16MB per WhatsApp limit)
  maxMediaFileSize: parseInt(process.env.MAX_MEDIA_FILE_SIZE || String(16 * 1024 * 1024), 10),
  // Test/mock mode: when true, use mock WhatsApp API
  useMockWhatsApp: process.env.USE_MOCK_WHATSAPP === 'true' || process.env.NODE_ENV === 'test' || !process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN === 'YOUR_WHATSAPP_ACCESS_TOKEN',
  // Redis mock mode when Redis is not available
  useMockRedis: process.env.USE_MOCK_REDIS === 'true' || process.env.NODE_ENV === 'test',
};

/**
 * Returns the full WhatsApp Cloud API base URL with version.
 * e.g., https://graph.facebook.com/v21.0
 */
export function getWhatsAppApiUrl(): string {
  const base = env.whatsappApiBaseUrl.replace(/\/+$/, '');
  return `${base}/${env.whatsappApiVersion}`;
}
