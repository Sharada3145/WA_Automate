// src/routes/template.routes.ts
import { Router } from 'express';
import { createTemplate, listTemplates, getTemplate } from '../controllers/template.controller';

const router = Router();

router.post('/', createTemplate);
router.get('/', listTemplates);
router.get('/:id', getTemplate);

export default router;
