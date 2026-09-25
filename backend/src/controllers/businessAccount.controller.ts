// src/controllers/businessAccount.controller.ts
import { Request, Response, NextFunction } from 'express';
import { BusinessAccountService } from '../services/businessAccount.service';

const service = new BusinessAccountService();

// Create a new WhatsApp Business Account (placeholder, real account created via WhatsApp Cloud API later)
export const createBusinessAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { accountId, name, accessToken } = req.body;
    const result = await service.create(userId, accountId, name, accessToken);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const listBusinessAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const accounts = await service.list(userId);
    res.json(accounts);
  } catch (err) {
    next(err);
  }
};

export const getBusinessAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const id = Number(req.params.id);
    const account = await service.getById(userId, id);
    if (!account) return res.status(404).json({ message: 'Not found' });
    res.json(account);
  } catch (err) {
    next(err);
  }
};
