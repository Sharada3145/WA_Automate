import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma/client';
import { getRedisConnection } from '../src/config/redis';

jest.setTimeout(30000);

describe('Campaign Worker Execution Path (End-to-End)', () => {
  let authToken: string;
  let userId: number;
  let testContactId: number;
  let testCampaignId: number;
  let phoneId: number;

  beforeAll(async () => {
    // Clean up test data for clean slate
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
    await prisma.user.deleteMany({ where: { email: 'worker_test@example.com' } });

    // 1. Register & Login User
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'worker_test@example.com', password: 'Password123!' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'worker_test@example.com', password: 'Password123!' });

    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // 2. Setup WABA and Phone Number
    const wabaRes = await request(app)
      .post('/api/business-accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Worker Test WABA', accountId: 'waba_worker_123', accessToken: 'mock_token' });

    const phoneRes = await request(app)
      .post('/api/whatsapp/numbers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ phoneNumber: '+19998887777', displayName: 'Sender Line', businessAccountId: wabaRes.body.id });

    phoneId = phoneRes.body.id;

    // 3. Create Contact
    const contactRes = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ firstName: 'Sharada', lastName: 'Devi', phoneNumber: '+19998887777', consentGiven: true });

    testContactId = contactRes.body.data.id;

    // 4. Create Draft Campaign
    const campRes = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Worker Test Offer',
        whatsappPhoneNumberId: phoneId,
        messageType: 'text',
        messageContent: 'Special offer for Sharada!',
      });

    testCampaignId = campRes.body.id;

    // 5. Add Recipient
    await request(app)
      .post(`/api/campaigns/${testCampaignId}/contacts`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ contactIds: [testContactId] });
  }, 30000);

  afterAll(async () => {
    const redis = getRedisConnection();
    await redis.disconnect();
    await prisma.$disconnect();
  });

  it('should process campaign start → job enqueue → worker execution → message persistence → status updated to sent', async () => {
    // Verify recipient status BEFORE start is 'pending'
    const initialCc = await prisma.campaignContact.findFirst({
      where: { campaignId: testCampaignId, contactId: testContactId }
    });
    expect(initialCc?.status).toBe('pending');

    // 1. Start Campaign via API
    const startRes = await request(app)
      .post(`/api/campaigns/${testCampaignId}/start`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(startRes.status).toBe(200);
    expect(startRes.body.status).toBe('running');

    // Wait for in-memory / worker queue processing
    await new Promise(resolve => setTimeout(resolve, 300));

    // 2. Verify CampaignContact status updated from 'pending' to 'sent'
    const updatedCc = await prisma.campaignContact.findFirst({
      where: { campaignId: testCampaignId, contactId: testContactId }
    });
    expect(updatedCc?.status).toBe('sent');

    // 3. Verify Message record persisted with apiMessageId
    const messageRecord = await prisma.message.findFirst({
      where: { campaignId: testCampaignId, contactId: testContactId }
    });
    expect(messageRecord).not.toBeNull();
    expect(messageRecord?.status).toBe('submitted');
    expect(messageRecord?.apiMessageId).toBeDefined();

    // 4. Verify Campaign sentCount incremented
    const updatedCampaign = await prisma.campaign.findUnique({
      where: { id: testCampaignId }
    });
    expect(updatedCampaign?.sentCount).toBe(1);
  });
});
