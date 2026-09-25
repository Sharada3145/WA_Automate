// src/routes/businessAccount.routes.ts
import { Router } from 'express';
import * as BusinessAccountController from '../controllers/businessAccount.controller';

const router = Router();

router.post('/', BusinessAccountController.createBusinessAccount);
router.get('/', BusinessAccountController.listBusinessAccounts);
router.get('/:id', BusinessAccountController.getBusinessAccount);

export default router;
