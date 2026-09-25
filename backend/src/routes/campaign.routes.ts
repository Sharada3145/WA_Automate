// src/routes/campaign.routes.ts
import { Router } from 'express';
import * as CampaignController from '../controllers/campaign.controller';

const router = Router();

router.post('/', CampaignController.createCampaign);
router.get('/', CampaignController.listCampaigns);
router.get('/:id', CampaignController.getCampaign);
router.post('/:id/contacts', CampaignController.addContacts);
router.post('/:id/start', CampaignController.startCampaign);
router.post('/:id/pause', CampaignController.pauseCampaign);
router.post('/:id/resume', CampaignController.resumeCampaign);
router.post('/:id/stop', CampaignController.stopCampaign);

// Global emergency stop
router.post('/emergency-stop', CampaignController.emergencyStop);

export default router;
