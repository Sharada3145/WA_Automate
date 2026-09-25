// src/routes/report.routes.ts
import { Router } from 'express';
import { exportCampaignCsv, exportCampaignExcel, exportCampaignPdf } from '../controllers/report.controller';

const router = Router();

router.get('/campaigns/:id/csv', exportCampaignCsv);
router.get('/campaigns/:id/xlsx', exportCampaignExcel);
router.get('/campaigns/:id/pdf', exportCampaignPdf);

export default router;
