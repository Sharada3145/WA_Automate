"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const client_1 = __importDefault(require("../src/prisma/client"));
const redis_1 = require("../src/config/redis");
jest.setTimeout(30000);
describe('Backend Integration Tests', () => {
    let authToken;
    let userId;
    let testContactId;
    let testCampaignId;
    let wabaId;
    let phoneId;
    beforeAll(async () => {
        // Clear test data in reverse foreign-key order
        await client_1.default.auditLog.deleteMany();
        await client_1.default.messageEvent.deleteMany();
        await client_1.default.incomingMessage.deleteMany();
        await client_1.default.message.deleteMany();
        await client_1.default.campaignContact.deleteMany();
        await client_1.default.campaign.deleteMany();
        await client_1.default.suppressionList.deleteMany();
        await client_1.default.contactImport.deleteMany();
        await client_1.default.contact.deleteMany();
        await client_1.default.whatsAppPhoneNumber.deleteMany();
        await client_1.default.whatsAppBusinessAccount.deleteMany();
        await client_1.default.user.deleteMany({ where: { email: 'test@example.com' } });
        // 1. Authentication
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/auth/register')
            .send({ email: 'test@example.com', password: 'Password123!' });
        if (res.status === 201) {
            const loginRes = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'Password123!' });
            authToken = loginRes.body.token;
            userId = loginRes.body.user.id;
        }
    }, 30000);
    afterAll(async () => {
        // Close connections
        const redis = (0, redis_1.getRedisConnection)();
        await redis.disconnect();
        await client_1.default.$disconnect();
    });
    it('should authenticate and get me', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${authToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.id).toBe(userId);
    });
    it('should create a business account and phone number', async () => {
        const wabaRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/business-accounts')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ accountId: 'mock-waba', name: 'Test WABA' });
        expect(wabaRes.status).toBe(201);
        wabaId = wabaRes.body.id;
        const phoneRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/whatsapp/numbers')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ phoneNumber: '+1234567890', displayName: 'Test Phone' });
        expect(phoneRes.status).toBe(201);
        phoneId = phoneRes.body.id;
    });
    it('should create a contact and verify ownership', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/contacts')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ phoneNumber: '+19876543210', firstName: 'John', lastName: 'Doe', consentGiven: true });
        expect(res.status).toBe(201);
        testContactId = res.body.data.id;
        const getRes = await (0, supertest_1.default)(app_1.default)
            .get(`/api/contacts/${testContactId}`)
            .set('Authorization', `Bearer ${authToken}`);
        expect(getRes.status).toBe(200);
        expect(getRes.body.data.userId).toBe(userId); // Verifying ownership
    });
    it('should create a campaign', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
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
        const res = await (0, supertest_1.default)(app_1.default)
            .post(`/api/campaigns/${testCampaignId}/contacts`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ contactIds: [testContactId] });
        expect(res.status).toBe(200);
        expect(res.body.added).toBe(1);
        expect(res.body.total).toBe(1);
    });
    it('should start a campaign', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post(`/api/campaigns/${testCampaignId}/start`)
            .set('Authorization', `Bearer ${authToken}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('running');
    });
    it('should pause a campaign', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post(`/api/campaigns/${testCampaignId}/pause`)
            .set('Authorization', `Bearer ${authToken}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('paused');
    });
    it('should process a webhook payload', async () => {
        // We expect 200 OK because the webhook processes async and responds fast
        const res = await (0, supertest_1.default)(app_1.default)
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
        const inboxRes = await (0, supertest_1.default)(app_1.default)
            .get('/api/inbox')
            .set('Authorization', `Bearer ${authToken}`);
        expect(inboxRes.status).toBe(200);
        const dashboardRes = await (0, supertest_1.default)(app_1.default)
            .get('/api/dashboard')
            .set('Authorization', `Bearer ${authToken}`);
        expect(dashboardRes.status).toBe(200);
        expect(dashboardRes.body).toHaveProperty('totalContacts');
    });
});
