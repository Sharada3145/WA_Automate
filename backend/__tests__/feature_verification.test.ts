import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma/client';
import { getRedisConnection } from '../src/config/redis';
import * as ExcelJS from 'exceljs';
import { campaignWorker } from '../src/workers/campaignWorker';

jest.setTimeout(60000);

describe('Feature-Level Verification Suite (A-I)', () => {
  let userAToken: string;
  let userAId: number;
  let userBToken: string;
  let userBId: number;

  let phoneIdA: number;
  let contactIdA: number;
  let campaignIdA: number;
  let wabaIdA: number;

  beforeAll(async () => {
    // Clear test data in reverse FK order
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
    await prisma.user.deleteMany({
      where: { email: { in: ['usera@example.com', 'userb@example.com'] } }
    });

    // Create User A
    const regA = await request(app)
      .post('/api/auth/register')
      .send({ email: 'usera@example.com', password: 'Password123!' });
    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'usera@example.com', password: 'Password123!' });
    userAToken = loginA.body.token;
    userAId = loginA.body.user.id;

    // Create User B
    const regB = await request(app)
      .post('/api/auth/register')
      .send({ email: 'userb@example.com', password: 'Password123!' });
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'userb@example.com', password: 'Password123!' });
    userBToken = loginB.body.token;
    userBId = loginB.body.user.id;

    // Setup initial resources for User A
    const wabaRes = await request(app)
      .post('/api/business-accounts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ accountId: 'waba-usera-123', name: 'User A WABA' });
    wabaIdA = wabaRes.body.id;

    const phoneRes = await request(app)
      .post('/api/whatsapp/numbers')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ phoneNumber: '+15550001111', displayName: 'User A Phone' });
    phoneIdA = phoneRes.body.id;

    const contactRes = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ phoneNumber: '+15559998888', firstName: 'Alice', lastName: 'Smith', consentGiven: true });
    contactIdA = contactRes.body.data.id;

    const campaignRes = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        name: 'Verification Campaign',
        whatsappPhoneNumberId: phoneIdA,
        messageType: 'text',
        messageContent: 'Hello from verification!'
      });
    campaignIdA = campaignRes.body.id;

    await request(app)
      .post(`/api/campaigns/${campaignIdA}/contacts`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ contactIds: [contactIdA] });
  }, 60000);

  afterAll(async () => {
    const redis = getRedisConnection();
    await redis.disconnect();
    await prisma.$disconnect();
  });

  // --- SECTION A: Contact History ---
  describe('A. Contact History', () => {
    it('should fetch merged, chronological contact history for owner and block cross-user access', async () => {
      // Seed an outbound and incoming message
      const msgOut = await prisma.message.create({
        data: {
          campaignId: campaignIdA,
          contactId: contactIdA,
          whatsappPhoneNumberId: phoneIdA,
          internalMessageId: 'msg-out-001',
          apiMessageId: 'wamid.out001',
          type: 'text',
          content: 'Hello Alice',
          status: 'submitted',
          createdAt: new Date(Date.now() - 10000)
        }
      });

      const msgIn = await prisma.incomingMessage.create({
        data: {
          contactId: contactIdA,
          whatsappPhoneNumberId: phoneIdA,
          messageId: 'wamid.in001',
          type: 'text',
          content: 'Thanks!',
          receivedAt: new Date(Date.now() - 5000)
        }
      });

      // User A access
      const resA = await request(app)
        .get(`/api/contacts/${contactIdA}/history`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(resA.status).toBe(200);
      expect(resA.body.success).toBe(true);
      expect(Array.isArray(resA.body.data)).toBe(true);
      expect(resA.body.data.length).toBeGreaterThanOrEqual(2);
      
      // Check chronological order (descending by timestamp)
      const history = resA.body.data;
      expect(new Date(history[0].timestamp).getTime()).toBeGreaterThanOrEqual(new Date(history[1].timestamp).getTime());

      // Check directions and metadata
      const outboundItem = history.find((h: any) => h.direction === 'outbound');
      const inboundItem = history.find((h: any) => h.direction === 'inbound');
      expect(outboundItem).toBeDefined();
      expect(outboundItem.campaign).toBeDefined();
      expect(inboundItem).toBeDefined();
      expect(inboundItem.content).toBe('Thanks!');

      // User B cross-user access attempt
      const resB = await request(app)
        .get(`/api/contacts/${contactIdA}/history`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect([403, 404]).toContain(resB.status);
    });
  });

  // --- SECTION B: Campaign Reports ---
  describe('B. Campaign Reports (CSV, XLSX, PDF)', () => {
    it('should generate valid CSV report for owner and block non-owner', async () => {
      const res = await request(app)
        .get(`/api/reports/campaigns/${campaignIdA}/csv`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain(`campaign_${campaignIdA}_report.csv`);
      expect(res.text).toContain('First Name');
      expect(res.text).toContain('Alice');
      expect(res.text).toContain('+15559998888');

      // User B unauthorized access
      const resB = await request(app)
        .get(`/api/reports/campaigns/${campaignIdA}/csv`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect([403, 404, 500]).toContain(resB.status);
    });

    it('should generate parseable XLSX report', async () => {
      const res = await request(app)
        .get(`/api/reports/campaigns/${campaignIdA}/xlsx`)
        .set('Authorization', `Bearer ${userAToken}`)
        .responseType('buffer');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain(`.xlsx`);

      // Parse XLSX workbook
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const worksheet = workbook.getWorksheet(1);
      expect(worksheet).toBeDefined();
      expect(worksheet!.rowCount).toBeGreaterThan(1);
    });

    it('should generate valid non-empty PDF report', async () => {
      const res = await request(app)
        .get(`/api/reports/campaigns/${campaignIdA}/pdf`)
        .set('Authorization', `Bearer ${userAToken}`)
        .responseType('buffer');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain(`.pdf`);

      const pdfHeader = res.body.toString('utf8', 0, 5);
      expect(pdfHeader).toBe('%PDF-');
      expect(res.body.length).toBeGreaterThan(500);
    });
  });

  // --- SECTION C: Campaign Lifecycle ---
  describe('C. Campaign Lifecycle & Invalid State Transitions', () => {
    it('should execute START -> PAUSE -> RESUME -> STOP and reject invalid transitions', async () => {
      // 1. START draft campaign
      const startRes = await request(app)
        .post(`/api/campaigns/${campaignIdA}/start`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(startRes.status).toBe(200);
      expect(startRes.body.status).toBe('running');

      // Reset campaign status to running with pending recipient for PAUSE test
      await prisma.campaign.update({
        where: { id: campaignIdA },
        data: { status: 'running' }
      });
      await prisma.campaignContact.updateMany({
        where: { campaignId: campaignIdA },
        data: { status: 'pending' }
      });

      // 2. PAUSE running campaign
      const pauseRes = await request(app)
        .post(`/api/campaigns/${campaignIdA}/pause`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.status).toBe('paused');


      // Invalid PAUSE: pausing already paused campaign
      const doublePause = await request(app)
        .post(`/api/campaigns/${campaignIdA}/pause`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect([400, 409]).toContain(doublePause.status);

      // 3. RESUME paused campaign
      const resumeRes = await request(app)
        .post(`/api/campaigns/${campaignIdA}/resume`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.status).toBe('running');

      // 4. STOP campaign
      const stopRes = await request(app)
        .post(`/api/campaigns/${campaignIdA}/stop`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(stopRes.status).toBe(200);
      expect(stopRes.body.status).toBe('stopped');

      // Invalid RESUME/START on stopped campaign
      const resumeStopped = await request(app)
        .post(`/api/campaigns/${campaignIdA}/resume`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect([400, 409]).toContain(resumeStopped.status);

      // 5. Emergency STOP ALL
      const emRes = await request(app)
        .post('/api/campaigns/emergency-stop')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(emRes.status).toBe(200);
      expect(emRes.body).toHaveProperty('count');
    });
  });

  // --- SECTION D: Webhook Status Progression & Failure ---
  describe('D. Webhook Status Progression', () => {
    it('should progress message status sent -> delivered -> read without regress or double counting', async () => {
      const waMsgId = 'wamid.webhook.test.100';

      // Seed a message pointing to phone number
      const phoneObj = await prisma.whatsAppPhoneNumber.findUnique({ where: { id: phoneIdA } });
      const phoneMetaId = phoneObj?.phoneNumberId || 'mock-phone-id';

      const msgRecord = await prisma.message.create({
        data: {
          campaignId: campaignIdA,
          contactId: contactIdA,
          whatsappPhoneNumberId: phoneIdA,
          internalMessageId: 'idempotent-key-webhook-1',
          apiMessageId: waMsgId,
          type: 'text',
          status: 'submitted'
        }
      });

      // Helper to fire webhook status payload
      const sendStatusWebhook = async (status: string) => {
        const res = await request(app)
          .post('/api/webhooks')
          .send({
            object: 'whatsapp_business_account',
            entry: [{
              id: 'mock-waba',
              changes: [{
                field: 'messages',
                value: {
                  metadata: { phone_number_id: phoneMetaId },
                  statuses: [{
                    id: waMsgId,
                    status: status,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    recipient_id: '15559998888'
                  }]
                }
              }]
            }]
          });
        await new Promise(r => setTimeout(r, 150));
        return res;
      };

      // 1. DELIVERED
      await sendStatusWebhook('delivered');
      let updatedMsg = await prisma.message.findUnique({ where: { id: msgRecord.id } });
      expect(updatedMsg?.status).toBe('delivered');

      let campaign = await prisma.campaign.findUnique({ where: { id: campaignIdA } });
      const deliveredCountInitial = campaign?.deliveredCount || 0;

      // Duplicate DELIVERED event
      await sendStatusWebhook('delivered');
      campaign = await prisma.campaign.findUnique({ where: { id: campaignIdA } });
      expect(campaign?.deliveredCount).toBe(deliveredCountInitial); // Not double incremented

      // 2. READ
      await sendStatusWebhook('read');
      updatedMsg = await prisma.message.findUnique({ where: { id: msgRecord.id } });
      expect(updatedMsg?.status).toBe('read');

      // Duplicate READ event
      await sendStatusWebhook('read');

      // 3. Out of order DELIVERED event after READ -> status remains READ
      await sendStatusWebhook('delivered');
      updatedMsg = await prisma.message.findUnique({ where: { id: msgRecord.id } });
      expect(updatedMsg?.status).toBe('read'); // Status did not regress to delivered
    });

    it('should process webhook FAILED status and persist error code/reason', async () => {
      const waFailedId = 'wamid.failed.test.200';
      const phoneObj = await prisma.whatsAppPhoneNumber.findUnique({ where: { id: phoneIdA } });

      const msgRecord = await prisma.message.create({
        data: {
          campaignId: campaignIdA,
          contactId: contactIdA,
          whatsappPhoneNumberId: phoneIdA,
          internalMessageId: 'idempotent-key-webhook-fail',
          apiMessageId: waFailedId,
          type: 'text',
          status: 'submitted'
        }
      });

      await request(app)
        .post('/api/webhooks')
        .send({
          object: 'whatsapp_business_account',
          entry: [{
            id: 'mock-waba',
            changes: [{
              field: 'messages',
              value: {
                metadata: { phone_number_id: phoneObj?.phoneNumberId || 'mock-phone-id' },
                statuses: [{
                  id: waFailedId,
                  status: 'failed',
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  recipient_id: '15559998888',
                  errors: [{ code: 131026, title: 'Message undeliverable' }]
                }]
              }
            }]
          }]
        });

      const updatedMsg = await prisma.message.findUnique({ where: { id: msgRecord.id } });
      expect(updatedMsg?.status).toBe('failed');
      expect(updatedMsg?.errorCode).toBe('131026');
      expect(updatedMsg?.errorMessage).toContain('Message undeliverable');
    });
  });

  // --- SECTION E & F: Idempotency, Workers & Retry ---
  describe('E & F. Idempotency & Retry Behavior', () => {
    it('should enforce idempotency when reprocessing duplicate worker jobs', async () => {
      const campaignContact = await prisma.campaignContact.findFirst({
        where: { campaignId: campaignIdA, contactId: contactIdA }
      });
      expect(campaignContact).toBeDefined();

      const idempotencyKey = 'unique-idempotency-key-xyz';

      // Reset campaign status to running to allow worker to process
      await prisma.campaign.update({
        where: { id: campaignIdA },
        data: { status: 'running' }
      });

      const mockJob = {
        id: 'job-101',
        data: {
          campaignId: campaignIdA,
          contactId: contactIdA,
          campaignContactId: campaignContact!.id,
          idempotencyKey
        }
      } as any;

      // Run worker job first time
      const result1 = await (campaignWorker as any).processFn(mockJob);
      expect(result1.success).toBe(true);

      const msgCount1 = await prisma.message.count({
        where: { internalMessageId: idempotencyKey }
      });
      expect(msgCount1).toBe(1);

      // Run worker job second time (duplicate job)
      const result2 = await (campaignWorker as any).processFn(mockJob);
      expect(result2.status).toBe('submitted');

      // Confirm duplicate outbound message record was NOT created
      const msgCount2 = await prisma.message.count({
        where: { internalMessageId: idempotencyKey }
      });
      expect(msgCount2).toBe(1);
    });
  });

  // --- SECTION G: File Upload Security ---
  describe('G. File Upload Security', () => {
    it('should reject invalid or unsafe file uploads', async () => {
      // 1. Unsupported extension/MIME
      const unsuppRes = await request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('console.log("malicious script")'), 'malicious.exe');

      expect([400, 500]).toContain(unsuppRes.status);

      // 2. Path traversal filename attempt
      const pathTravRes = await request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', Buffer.from('fake image content'), '../../etc/passwd.png');

      // The upload should either fail or sanitize the filename
      if (pathTravRes.status === 201) {
        expect(pathTravRes.body.filename).not.toContain('..');
      } else {
        expect(pathTravRes.status).toBe(400);
      }
    });
  });

  // --- SECTION H: Audit Logging Security ---
  describe('H. Audit Logging & Sensitive Data Exclusion', () => {
    it('should verify audit records exist and contain NO secrets or tokens', async () => {
      const logs = await prisma.auditLog.findMany({ take: 50 });
      expect(logs.length).toBeGreaterThan(0);

      for (const log of logs) {
        if (log.metadata) {
          const metaStr = typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata);
          expect(metaStr).not.toContain('Password123!');
          expect(metaStr).not.toContain('supersecret');
          expect(metaStr).not.toContain('WHATSAPP_APP_SECRET');
          expect(metaStr).not.toContain('Bearer ');
        }
      }
    });
  });

  // --- SECTION I: Cross-User Authorization ---
  describe('I. Cross-User Authorization Checks', () => {
    it('should prevent User B from accessing any resources created by User A', async () => {
      // Contact
      const cRes = await request(app)
        .get(`/api/contacts/${contactIdA}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect([403, 404]).toContain(cRes.status);

      // Campaign
      const campRes = await request(app)
        .get(`/api/campaigns/${campaignIdA}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect([403, 404]).toContain(campRes.status);

      // Business Account
      const wabaRes = await request(app)
        .get(`/api/business-accounts/${wabaIdA}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect([403, 404]).toContain(wabaRes.status);

      // Reports
      const rRes = await request(app)
        .get(`/api/reports/campaigns/${campaignIdA}/csv`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect([403, 404, 500]).toContain(rRes.status);
    });
  });
});
