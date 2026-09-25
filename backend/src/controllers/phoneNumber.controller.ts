// src/controllers/phoneNumber.controller.ts
import { Request, Response, NextFunction } from 'express';
import { PhoneNumberService } from '../services/phoneNumber.service';

const phoneNumberService = new PhoneNumberService();

// Assume authentication middleware populates req.user with { id: number }
export const createPhoneNumber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { phoneNumber, displayName } = req.body;
    const result = await phoneNumberService.create(userId, phoneNumber, displayName);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const listPhoneNumbers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const list = await phoneNumberService.list(userId);
    res.json(list);
  } catch (err) {
    next(err);
  }
};

export const setPhoneNumberStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const phoneId = Number(req.params.id);
    const { status } = req.body; // expected: connected | inactive | error
    const updated = await phoneNumberService.setStatus(userId, phoneId, status);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};
