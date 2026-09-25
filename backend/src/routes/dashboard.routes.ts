// src/routes/dashboard.routes.ts
import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';

const router = Router();

router.get('/', getDashboardStats);

export default router;
