// src/app.ts
import express from 'express';
import cors from 'cors';
import { json, urlencoded } from 'body-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { apiRateLimiter } from './middleware/rateLimiter';
import { auditLogger } from './middleware/auditLogger';
import { authMiddleware } from './middleware/auth.middleware';

import authRouter from './routes/auth.routes';
import contactRouter from './routes/contact.routes';
import phoneNumberRouter from './routes/phoneNumber.routes';
import businessAccountRouter from './routes/businessAccount.routes';
import templateRouter from './routes/template.routes';
import mediaRouter from './routes/media.routes';
import campaignRouter from './routes/campaign.routes';
import webhookRouter from './routes/webhook.routes';
import inboxRouter from './routes/inbox.routes';
import dashboardRouter from './routes/dashboard.routes';
import reportRouter from './routes/report.routes';

import { initCampaignWorker } from './workers/campaignWorker';

const app = express();

// Initialize Campaign Worker listener on app boot
initCampaignWorker();

// Basic security middlewares
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(urlencoded({ extended: true }));
app.use(apiRateLimiter);
app.use(auditLogger);
app.use(morgan('dev'));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Unauthenticated routes
app.use('/api/auth', authRouter);
app.use('/api/webhooks', webhookRouter); // WhatsApp Webhooks

// Authenticated routes
app.use('/api/contacts', authMiddleware, contactRouter);
app.use('/api/whatsapp/numbers', authMiddleware, phoneNumberRouter);
app.use('/api/business-accounts', authMiddleware, businessAccountRouter);
app.use('/api/templates', authMiddleware, templateRouter);
app.use('/api/media', authMiddleware, mediaRouter);
app.use('/api/campaigns', authMiddleware, campaignRouter);
app.use('/api/inbox', authMiddleware, inboxRouter);
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/reports', authMiddleware, reportRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || err.statusCode || (err.message && err.message.includes('Unsupported') ? 400 : 500);
  res.status(status).json({ success: false, message: err.message || 'Server error' });
});

export default app;
