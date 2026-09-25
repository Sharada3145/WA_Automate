// src/routes/phoneNumber.routes.ts
import { Router } from 'express';
import { createPhoneNumber, listPhoneNumbers, setPhoneNumberStatus } from '../controllers/phoneNumber.controller';

const router = Router();

// Create a new authorized WhatsApp phone number
router.post('/', createPhoneNumber);

// List all phone numbers for the authenticated user
router.get('/', listPhoneNumbers);

// Update status of a phone number (connected, inactive, error)
router.patch('/:id/status', setPhoneNumberStatus);

export default router;
