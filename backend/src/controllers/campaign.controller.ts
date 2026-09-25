// src/controllers/campaign.controller.ts
import { Request, Response, NextFunction } from 'express';
import { CampaignService } from '../services/campaign.service';

const campaignService = new CampaignService();

export const createCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const data = { ...req.body, userId };
    
    // convert templateVariables to string if object
    if (typeof data.templateVariables === 'object') {
      data.templateVariables = JSON.stringify(data.templateVariables);
    }

    const campaign = await campaignService.create(data);
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
};

export const getCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const id = Number(req.params.id);
    const campaign = await campaignService.getById(userId, id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
};

export const listCampaigns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const campaigns = await campaignService.list(userId);
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
};

export const addContacts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const campaignId = Number(req.params.id);
    const { contactIds } = req.body; // array of numbers
    
    if (!Array.isArray(contactIds)) {
      return res.status(400).json({ message: 'contactIds must be an array' });
    }

    const result = await campaignService.addContacts(userId, campaignId, contactIds);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const startCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const campaignId = Number(req.params.id);
    const result = await campaignService.startCampaign(userId, campaignId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const pauseCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const campaignId = Number(req.params.id);
    const result = await campaignService.pauseCampaign(userId, campaignId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const resumeCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const campaignId = Number(req.params.id);
    const result = await campaignService.resumeCampaign(userId, campaignId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const stopCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const campaignId = Number(req.params.id);
    const result = await campaignService.stopCampaign(userId, campaignId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const emergencyStop = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const result = await campaignService.emergencyStopAll(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
