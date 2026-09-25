// src/routes/inbox.routes.ts
import { Router } from 'express';
import { getInbox } from '../controllers/inbox.controller';

const router = Router();

router.get('/', getInbox);

export default router;
