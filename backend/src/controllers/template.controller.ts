// src/controllers/template.controller.ts
import { Request, Response, NextFunction } from 'express';
import { TemplateService } from '../services/template.service';

const templateService = new TemplateService();

export const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    // ensure variables is a string (JSON stringified array)
    if (Array.isArray(data.variables)) {
      data.variables = JSON.stringify(data.variables);
    }
    if (typeof data.components === 'object') {
      data.components = JSON.stringify(data.components);
    }
    const template = await templateService.create(data);
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
};

export const listTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { wabaId } = req.query;
    const templates = await templateService.list(wabaId as string);
    res.json(templates);
  } catch (err) {
    next(err);
  }
};

export const getTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const template = await templateService.getById(id);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (err) {
    next(err);
  }
};
