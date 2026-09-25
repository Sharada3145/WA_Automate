import { Router } from 'express';
import ContactController from '../controllers/contact.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { uploadCsv, uploadExcel } from '../middleware/upload.middleware';




const router = Router();


router.get('/', ContactController.getAll);
router.get('/:id', ContactController.getById);
router.post('/', ContactController.create);
router.put('/:id', ContactController.update);
router.get('/:id/history', ContactController.getContactHistory);
router.delete('/:id', ContactController.delete);

// CSV import endpoint
router.post('/import/csv', uploadCsv.single('file'), ContactController.importCsv);
router.post('/import/google-sheets', ContactController.importGoogleSheets);

export default router;
