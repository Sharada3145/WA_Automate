import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma/client';
import { getRedisConnection } from '../src/config/redis';

jest.setTimeout(30000);

describe('Campaign Lifecycle, Completion & Webhooks (A-G)', () => {
  let authToken: string;
  let userId: number;
  let phoneId: number;
  let contact1Id: number;
  let contact2Id: number;
  let contact3Id: number;

  beforeAll(async () => {
    // Clean database tables in FK order
    await prisma.auditLog.deleteMany();
    await prisma.messageEvent.deleteMany();
    await prisma.incomingMessage.deleteMany();
    await prisma.message.deleteMany();
    await prisma.campaignContact.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.suppressionList.deleteMany();
    await prisma.contactImport.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.whatsAppPhoneNumber.deleteMany();
    await prisma.whatsAppBusinessAccount.deleteMany();
    await prisma.user.deleteMany({ where: { email: 'lifecycle_test@example.com' } });

    // Register & Login User
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'lifecycle_test@example.com', password: 'Password123!' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lifecycle_test@example.com', password: 'Password123!' });

    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Business Account & Phone Number setup
    const wabaRes = await request(app)
      .post('/api/business-accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Lifecycle WABA', accountId: 'waba_lifecycle_123' });

    const phoneRes = await request(app)
      .post('/api/whatsapp/numbers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ phoneNumber: '+18881112222', displayName: 'Lifecycle Sender', businessAccountId: wabaRes.body.id });

    phoneId = phoneRes.body.id;

    // Contacts creation
    const c1 = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ firstName: 'Contact', lastName: 'One', phoneNumber: '+18881110001', consentGiven: true });
    contact1Id = c1.body.data.id;

    const c2 = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ firstName: 'Contact', lastName: 'Fail', phoneNumber: '+18880000000', consentGiven: true }); // triggers mock API failure
    contact2Id = c2.body.data.id;

    const c3 = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ firstName: 'Contact', lastName: 'Three', phoneNumber: '+18881110003', consentGiven: true });
    contact3Id = c3.body.data.id;
  });

  afterAll(async () => {
    const redis = getRedisConnection();
    await redis.disconnect();
    await prisma.$disconnect();
  });

  // --- A. Single Recipient Auto-Completion ---
  describe('A. Single Recipient Campaign Execution & Auto-Completion', () => {
    it('should transition campaign to completed when all recipients reach terminal state', async () => {
      const campRes = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Single Recipient Campaign',
          whatsappPhoneNumberId: phoneId,
          messageType: 'text',
          messageContent: 'Hello single recipient',
        });
      const campaignId = campRes.body.id;

      await request(app)
        .post(`/api/campaigns/${campaignId}/contacts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contactIds: [contact1Id] });

      // Start Campaign
      const startRes = await request(app)
        .post(`/api/campaigns/${campaignId}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(startRes.status).toBe(200);
      expect(startRes.body.status).toBe('running');

      // Wait for queue worker processing
      await new Promise(r => setTimeout(r, 400));

      const updatedCampaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      expect(updatedCampaign?.status).toBe('completed');
      expect(updatedCampaign?.completedAt).not.toBeNull();
      expect(updatedCampaign?.sentCount).toBe(1);

      const recipient = await prisma.campaignContact.findFirst({ where: { campaignId, contactId: contact1Id } });
      expect(recipient?.status).toBe('sent');
    });
  });

  // --- B. Multiple Recipients with Failure ---
  describe('B. Multiple Recipients Execution & Failure Isolation', () => {
    it('should process all recipients, isolate recipient failure, and update counts/completion', async () => {
      const campRes = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Multi Recipient Campaign',
          whatsappPhoneNumberId: phoneId,
          messageType: 'text',
          messageContent: 'Hello multi recipients',
        });
      const campaignId = campRes.body.id;

      // Add 3 contacts (contact1 = pass, contact2 = fail, contact3 = pass)
      await request(app)
        .post(`/api/campaigns/${campaignId}/contacts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contactIds: [contact1Id, contact2Id, contact3Id] });

      // Start Campaign
      const startRes = await request(app)
        .post(`/api/campaigns/${campaignId}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(startRes.status).toBe(200);

      // Wait for worker to finish processing all 3 jobs
      await new Promise(r => setTimeout(r, 600));

      const updatedCampaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      expect(updatedCampaign?.status).toBe('completed');
      expect(updatedCampaign?.sentCount).toBe(2);
      expect(updatedCampaign?.failedCount).toBe(1);
      expect(updatedCampaign?.totalRecipients).toBe(3);

      const r1 = await prisma.campaignContact.findFirst({ where: { campaignId, contactId: contact1Id } });
      const r2 = await prisma.campaignContact.findFirst({ where: { campaignId, contactId: contact2Id } });
      const r3 = await prisma.campaignContact.findFirst({ where: { campaignId, contactId: contact3Id } });

      expect(r1?.status).toBe('sent');
      expect(r2?.status).toBe('failed');
      expect(r3?.status).toBe('sent');
    });
  });

  // --- C. Mock Webhook Event Progression ---
  describe('C. Mock Webhook SENT -> DELIVERED -> READ Simulation', () => {
    it('should handle mock status webhooks progressing sent -> delivered -> read', async () => {
      const campRes = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Mock Webhook Campaign',
          whatsappPhoneNumberId: phoneId,
          messageType: 'text',
          messageContent: 'Webhook test content',
        });
      const campaignId = campRes.body.id;

      await request(app)
        .post(`/api/campaigns/${campaignId}/contacts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contactIds: [contact1Id] });

      await request(app)
        .post(`/api/campaigns/${campaignId}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      await new Promise(r => setTimeout(r, 400));

      const msg = await prisma.message.findFirst({ where: { campaignId } });
      expect(msg?.apiMessageId).toBeDefined();

      const apiMsgId = msg!.apiMessageId!;

      // 1. Simulate DELIVERED via mock-status endpoint
      const delivRes = await request(app)
        .post('/api/webhooks/mock-status')
        .send({ apiMessageId: apiMsgId, status: 'delivered' });
      expect(delivRes.status).toBe(200);

      let updatedMsg = await prisma.message.findUnique({ where: { id: msg!.id } });
      expect(updatedMsg?.status).toBe('delivered');

      let updatedCamp = await prisma.campaign.findUnique({ where: { id: campaignId } });
      expect(updatedCamp?.deliveredCount).toBe(1);

      // 2. Simulate READ via mock-status endpoint
      const readRes = await request(app)
        .post('/api/webhooks/mock-status')
        .send({ apiMessageId: apiMsgId, status: 'read' });
      expect(readRes.status).toBe(200);

      updatedMsg = await prisma.message.findUnique({ where: { id: msg!.id } });
      expect(updatedMsg?.status).toBe('read');

      updatedCamp = await prisma.campaign.findUnique({ where: { id: campaignId } });
      expect(updatedCamp?.readCount).toBe(1);
    });
  });

  // --- D. Duplicate Webhook Event Idempotency ---
  describe('D. Duplicate Webhook Event Idempotency', () => {
    it('should not double-increment counters or duplicate events when identical status payload is received twice', async () => {
      const campRes = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Duplicate Webhook Campaign',
          whatsappPhoneNumberId: phoneId,
          messageType: 'text',
          messageContent: 'Duplicate test',
        });
      const campaignId = campRes.body.id;

      await request(app)
        .post(`/api/campaigns/${campaignId}/contacts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contactIds: [contact1Id] });

      await request(app)
        .post(`/api/campaigns/${campaignId}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      await new Promise(r => setTimeout(r, 400));

      const msg = await prisma.message.findFirst({ where: { campaignId } });
      const apiMsgId = msg!.apiMessageId!;

      // Send DELIVERED twice
      await request(app).post('/api/webhooks/mock-status').send({ apiMessageId: apiMsgId, status: 'delivered' });
      await request(app).post('/api/webhooks/mock-status').send({ apiMessageId: apiMsgId, status: 'delivered' });

      const updatedCamp = await prisma.campaign.findUnique({ where: { id: campaignId } });
      expect(updatedCamp?.deliveredCount).toBe(1);
    });
  });

  // --- E. Status Precedence Safeguards ---
  describe('E. Status Precedence Safeguards', () => {
    it('should prevent status regression (READ cannot become DELIVERED/SENT)', async () => {
      const campRes = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Precedence Campaign',
          whatsappPhoneNumberId: phoneId,
          messageType: 'text',
          messageContent: 'Precedence test',
        });
      const campaignId = campRes.body.id;

      await request(app)
        .post(`/api/campaigns/${campaignId}/contacts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contactIds: [contact1Id] });

      await request(app)
        .post(`/api/campaigns/${campaignId}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      await new Promise(r => setTimeout(r, 400));

      const msg = await prisma.message.findFirst({ where: { campaignId } });
      const apiMsgId = msg!.apiMessageId!;

      // 1. Advance to READ
      await request(app).post('/api/webhooks/mock-status').send({ apiMessageId: apiMsgId, status: 'read' });
      let updatedMsg = await prisma.message.findUnique({ where: { id: msg!.id } });
      expect(updatedMsg?.status).toBe('read');

      // 2. Out of order DELIVERED event
      await request(app).post('/api/webhooks/mock-status').send({ apiMessageId: apiMsgId, status: 'delivered' });
      updatedMsg = await prisma.message.findUnique({ where: { id: msg!.id } });
      expect(updatedMsg?.status).toBe('read');

      // 3. Out of order SENT event
      await request(app).post('/api/webhooks/mock-status').send({ apiMessageId: apiMsgId, status: 'sent' });
      updatedMsg = await prisma.message.findUnique({ where: { id: msg!.id } });
      expect(updatedMsg?.status).toBe('read');
    });
  });

  // --- F. Campaign with Pending Recipient Remains Running ---
  describe('F. Campaign Status Control with Pending Recipients', () => {
    it('should remain in running state while recipients are still pending', async () => {
      const campRes = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Pending Recipient Campaign',
          whatsappPhoneNumberId: phoneId,
          messageType: 'text',
          messageContent: 'Pending recipient test',
        });
      const campaignId = campRes.body.id;

      await request(app)
        .post(`/api/campaigns/${campaignId}/contacts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contactIds: [contact1Id, contact3Id] });

      // Manually set campaign to running without processing jobs to simulate processing state
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'running' },
      });

      // Recipient 1 is completed
      await prisma.campaignContact.updateMany({
        where: { campaignId, contactId: contact1Id },
        data: { status: 'sent' },
      });

      // Recipient 2 is still pending
      const isCompleted = await (require('../src/services/campaign.service').CampaignService).checkAndUpdateCompletion(campaignId);
      expect(isCompleted).toBe(false);

      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      expect(campaign?.status).toBe('running');
    });
  });

  // --- G. Pause / Resume / Stop Behaviors ---
  describe('G. Pause / Resume / Stop Behaviors', () => {
    it('should preserve PAUSE, RESUME, and STOP state transitions', async () => {
      const campRes = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'State Control Campaign',
          whatsappPhoneNumberId: phoneId,
          messageType: 'text',
          messageContent: 'State test',
        });
      const campaignId = campRes.body.id;

      await request(app)
        .post(`/api/campaigns/${campaignId}/contacts`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contactIds: [contact1Id] });

      // Start
      const startRes = await request(app)
        .post(`/api/campaigns/${campaignId}/start`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(startRes.body.status).toBe('running');

      // Reset campaign status to running with pending recipient for PAUSE test
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'running' }
      });
      await prisma.campaignContact.updateMany({
        where: { campaignId },
        data: { status: 'pending' }
      });

      // Pause
      const pauseRes = await request(app)
        .post(`/api/campaigns/${campaignId}/pause`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(pauseRes.body.status).toBe('paused');


      // Resume
      const resumeRes = await request(app)
        .post(`/api/campaigns/${campaignId}/resume`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(resumeRes.body.status).toBe('running');

      // Stop
      const stopRes = await request(app)
        .post(`/api/campaigns/${campaignId}/stop`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(stopRes.body.status).toBe('stopped');
    });
  });
});
