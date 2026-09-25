import { Request, Response } from 'express';
import { ContactService } from '../services/contact.service';

const contactService = new ContactService();

export class ContactController {
  /** GET /api/contacts */
  static async getAll(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const search = req.query.search as string | undefined;

      if (page < 1 || size < 1) {
        return res.status(400).json({ success: false, message: 'Invalid pagination parameters' });
      }

      const { contacts, total } = await contactService.getPaginated(userId, page, size, search);
      const totalPages = Math.ceil(total / Math.min(size, 100));
      return res.status(200).json({
        success: true,
        data: contacts,
        pagination: { page, size, total, totalPages },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /** GET /api/contacts/:id */
  static async getById(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const contactId = Number(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ success: false, message: 'Invalid contact id' });
      }
      const contact = await contactService.getById(userId, contactId);
      if (!contact) {
        return res.status(404).json({ success: false, message: 'Contact not found' });
      }
      return res.status(200).json({ success: true, data: contact });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /** POST /api/contacts */
  static async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { firstName, lastName, phoneNumber, email, city, consentGiven } = req.body;
      // Basic validation
      if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
        return res.status(400).json({ success: false, message: 'phoneNumber is required' });
      }
      const contact = await contactService.create(userId, {
        firstName,
        lastName,
        phoneNumber,
        email,
        city,
        consentGiven,
      });
      return res.status(201).json({ success: true, data: contact });
    } catch (err) {
      if ((err as any).statusCode) {
        const { statusCode, message } = err as any;
        return res.status(statusCode).json({ success: false, message });
      }
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /** PUT /api/contacts/:id */
  static async update(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const contactId = Number(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ success: false, message: 'Invalid contact id' });
      }
      const { firstName, lastName, phoneNumber, email, city, consentGiven } = req.body;
      const updated = await contactService.update(userId, contactId, {
        firstName,
        lastName,
        phoneNumber,
        email,
        city,
        consentGiven,
      });
      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      if ((err as any).statusCode) {
        const { statusCode, message } = err as any;
        return res.status(statusCode).json({ success: false, message });
      }
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /** POST /api/contacts/import/csv */
  /** POST /api/contacts/import/excel */
  static async importExcel(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'Excel file is required' });
      }
      const country = (req.body.country as string) || undefined;
      const result = await contactService.importExcel(userId, file.buffer, country);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      console.error(err);
      const status = (err as any).statusCode || 500;
      const message = (err as any).message || 'Server error';
      return res.status(status).json({ success: false, message });
    }
  }

  /** POST /api/contacts/import/csv */
  static async importCsv(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'CSV file is required' });
      }
      const country = (req.body.country as string) || undefined;
      const result = await contactService.importCsv(userId, file.buffer, country);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      console.error(err);
      const status = (err as any).statusCode || 500;
      const message = (err as any).message || 'Server error';
      return res.status(status).json({ success: false, message });
    }
  }






  /** POST /api/contacts/import/google-sheets */
  static async importGoogleSheets(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { sheetUrl, sheetName, country } = req.body;
      if (!sheetUrl) {
        return res.status(400).json({ success: false, message: 'sheetUrl is required' });
      }
      const result = await contactService.importGoogleSheets(userId, sheetUrl, sheetName, country);
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      console.error(err);
      const status = (err as any).statusCode || 500;
      const message = (err as any).message || 'Server error';
      return res.status(status).json({ success: false, message });
    }
  }

  /** DELETE /api/contacts/:id */
  static async delete(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const contactId = Number(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ success: false, message: 'Invalid contact id' });
      }
      await contactService.delete(userId, contactId);
      return res.status(200).json({ success: true, message: 'Contact deleted' });
    } catch (err) {
      if ((err as any).statusCode) {
        const { statusCode, message } = err as any;
        return res.status(statusCode).json({ success: false, message });
      }
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  /** GET /api/contacts/:id/history */
  static async getContactHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const contactId = Number(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ success: false, message: 'Invalid contact id' });
      }

      // Verify contact belongs to user
      const contact = await contactService.getById(userId, contactId);
      if (!contact) {
        return res.status(404).json({ success: false, message: 'Contact not found' });
      }

      const history = await contactService.getContactHistory(userId, contactId);
      return res.status(200).json({ success: true, data: history });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }

}

export default ContactController;
