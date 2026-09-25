import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma/client';
import { getRedisConnection } from '../src/config/redis';

jest.setTimeout(30000);

describe('Backend Integration Tests', () => {
  let authToken: string;
  let userId: number;
  let testContactId: number;
  let testCampaignId: number;
  let wabaId: number;
  let phoneId: number;

  beforeAll(async () => {
    // Clear test data in reverse foreign-key order
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
    await prisma.user.deleteMany({ where: { email: 'test@example.com' } });

    // 1. Authentication
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'Password123!' });
    
    if (res.status === 201) {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password123!' });
      authToken = loginRes.body.token;
      userId = loginRes.body.user.id;
    }
  }, 30000);

  afterAll(async () => {
    // Close connections
    const redis = getRedisConnection();
    await redis.disconnect();
    await prisma.$disconnect();
  });

  it('should authenticate and get me', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe(userId);
  });

  it('should create a business account and phone number', async () => {
    const wabaRes = await request(app)
      .post('/api/business-accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ accountId: 'mock-waba', name: 'Test WABA' });
    expect(wabaRes.status).toBe(201);
    wabaId = wabaRes.body.id;

    const phoneRes = await request(app)
      .post('/api/whatsapp/numbers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ phoneNumber: '+1234567890', displayName: 'Test Phone' });
    expect(phoneRes.status).toBe(201);
    phoneId = phoneRes.body.id;
  });

  it('should create a contact and verify ownership', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ phoneNumber: '+19876543210', firstName: 'John', lastName: 'Doe', consentGiven: true });
    
    expect(res.status).toBe(201);
    testContactId = res.body.data.id;
    
    const getRes = await request(app)
      .get(`/api/contacts/${testContactId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.userId).toBe(userId); // Verifying ownership
  });

  it('should create a campaign', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Campaign',
        whatsappPhoneNumberId: phoneId,
        messageType: 'text',
        messageContent: 'Hello World'
      });
    expect(res.status).toBe(201);
    testCampaignId = res.body.id;
  });

  it('should add contacts to campaign (snapshot + eligibility)', async () => {
    const res = await request(app)
      .post(`/api/campaigns/${testCampaignId}/contacts`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ contactIds: [testContactId] });
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(1);
    expect(res.body.total).toBe(1);
  });

  it('should start a campaign', async () => {
    const res = await request(app)
      .post(`/api/campaigns/${testCampaignId}/start`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('running');
  });

  it('should pause a campaign', async () => {
    await prisma.campaign.update({
      where: { id: testCampaignId },
      data: { status: 'running' }
    });
    const res = await request(app)
      .post(`/api/campaigns/${testCampaignId}/pause`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paused');
  });

  
  it('should process a webhook payload', async () => {
    // We expect 200 OK because the webhook processes async and responds fast
    const res = await request(app)
      .post('/api/webhooks')
      .send({
        object: 'whatsapp_business_account',
        entry: [{
          id: 'mock-waba',
          changes: [{
            field: 'messages',
            value: {
               metadata: { phone_number_id: 'mock-phone-id' },
               messages: [{
                  from: '19876543210',
                  id: 'wamid.12345',
                  timestamp: '1620000000',
                  type: 'text',
                  text: { body: 'Hello back' }
               }],
               contacts: [{ wa_id: '19876543210', profile: { name: 'John' } }]
            }
          }]
        }]
      });
    expect(res.status).toBe(200); // Because we don't have the secret configured in test env, it skips validation or logs mismatch. Wait, in test env, the secret might be empty, so it skips validation.
  });

  it('should fetch inbox and dashboard stats', async () => {
    const inboxRes = await request(app)
      .get('/api/inbox')
      .set('Authorization', `Bearer ${authToken}`);
    expect(inboxRes.status).toBe(200);
    
    const dashboardRes = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body).toHaveProperty('totalContacts');
  });
});
