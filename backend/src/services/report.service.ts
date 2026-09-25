// src/services/report.service.ts
import prisma from '../prisma/client';
import { createObjectCsvStringifier } from 'csv-writer';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export class ReportService {
  /** 
   * Generate Campaign Report
   * Includes campaign info and a list of all contacts and their statuses
   */
  async getCampaignData(userId: number, campaignId: number) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        campaignContacts: {
          include: { contact: true }
        }
      }
    });

    if (!campaign) throw new Error('Campaign not found');

    const data = campaign.campaignContacts.map(cc => ({
      firstName: cc.snapshotFirstName || cc.contact.firstName || '',
      lastName: cc.snapshotLastName || cc.contact.lastName || '',
      phone: cc.snapshotPhone || cc.contact.phoneNumber,
      email: cc.snapshotEmail || cc.contact.email || '',
      eligible: cc.eligible ? 'Yes' : 'No',
      ineligibleReason: cc.ineligibleReason || '',
      status: cc.status,
    }));

    return { campaign, data };
  }

  async generateCsv(userId: number, campaignId: number): Promise<string> {
    const { data } = await this.getCampaignData(userId, campaignId);
    
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'firstName', title: 'First Name' },
        { id: 'lastName', title: 'Last Name' },
        { id: 'phone', title: 'Phone' },
        { id: 'email', title: 'Email' },
        { id: 'eligible', title: 'Eligible' },
        { id: 'ineligibleReason', title: 'Ineligible Reason' },
        { id: 'status', title: 'Status' }
      ]
    });

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(data);
  }

  async generateExcel(userId: number, campaignId: number): Promise<Buffer> {
    const { campaign, data } = await this.getCampaignData(userId, campaignId);
    const workbook = new ExcelJS.Workbook();
    
    const sheet = workbook.addWorksheet(`Campaign ${campaign.id}`);
    sheet.columns = [
      { header: 'First Name', key: 'firstName', width: 20 },
      { header: 'Last Name', key: 'lastName', width: 20 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Eligible', key: 'eligible', width: 10 },
      { header: 'Ineligible Reason', key: 'ineligibleReason', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
    ];
    sheet.addRows(data);
    
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any as Buffer;
  }

  async generatePdf(userId: number, campaignId: number): Promise<Buffer> {
    const { campaign, data } = await this.getCampaignData(userId, campaignId);
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text(`Campaign Report: ${campaign.name}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Total Recipients: ${campaign.totalRecipients}`);
      doc.text(`Sent: ${campaign.sentCount}`);
      doc.text(`Delivered: ${campaign.deliveredCount}`);
      doc.text(`Read: ${campaign.readCount}`);
      doc.text(`Failed: ${campaign.failedCount}`);
      doc.moveDown();

      // Simple Table (Since pdfkit doesn't have native tables, we do simple lines)
      doc.fontSize(14).text('Contact Details', { underline: true });
      doc.moveDown();

      doc.fontSize(10);
      data.forEach(row => {
        const text = `${row.firstName} ${row.lastName} | ${row.phone} | Status: ${row.status}`;
        doc.fillColor('black').text(text);
        if (row.ineligibleReason) {
           doc.fillColor('red').text(`  - Ineligible: ${row.ineligibleReason}`);
        }
        doc.moveDown(0.5);
      });

      doc.end();
    });
  }
}
