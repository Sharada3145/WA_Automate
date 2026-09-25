// src/controllers/report.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service';

const reportService = new ReportService();

export const exportCampaignCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const campaignId = Number(req.params.id);
    const csvData = await reportService.generateCsv(userId, campaignId);
    
    res.header('Content-Type', 'text/csv');
    res.attachment(`campaign_${campaignId}_report.csv`);
    res.send(csvData);
  } catch (err) {
    next(err);
  }
};

export const exportCampaignExcel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const campaignId = Number(req.params.id);
    const excelBuffer = await reportService.generateExcel(userId, campaignId);
    
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.attachment(`campaign_${campaignId}_report.xlsx`);
    res.send(excelBuffer);
  } catch (err) {
    next(err);
  }
};

export const exportCampaignPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const campaignId = Number(req.params.id);
    const pdfBuffer = await reportService.generatePdf(userId, campaignId);
    
    res.header('Content-Type', 'application/pdf');
    res.attachment(`campaign_${campaignId}_report.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};
