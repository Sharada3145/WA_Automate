// src/services/template.service.ts
import { Template } from '@prisma/client';
import prisma from '../prisma/client';

export class TemplateService {
  async create(data: {
    wabaId?: string;
    metaTemplateId?: string;
    name: string;
    language: string;
    category?: string;
    components?: string;
    variables: string;
    bodyText?: string;
    headerType?: string;
    headerContent?: string;
    footerText?: string;
  }): Promise<Template> {
    return prisma.template.create({
      data,
    });
  }

  async list(wabaId?: string): Promise<Template[]> {
    const where = wabaId ? { wabaId } : {};
    return prisma.template.findMany({ where });
  }

  async getById(id: number): Promise<Template | null> {
    return prisma.template.findUnique({ where: { id } });
  }

  async updateStatus(id: number, status: string): Promise<Template> {
    return prisma.template.update({
      where: { id },
      data: { status },
    });
  }
}
