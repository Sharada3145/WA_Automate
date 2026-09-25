import { Router } from 'express';
import { verifyWebhook, receiveWebhook, simulateMockStatus } from '../controllers/webhook.controller';

const router = Router();

// Meta webhook verification (GET)
router.get('/', verifyWebhook);

// Meta webhook event payload (POST)
router.post('/', receiveWebhook);

// Mock webhook event simulation (POST) - local/dev mode only
router.post('/mock-status', simulateMockStatus);

export default router;

