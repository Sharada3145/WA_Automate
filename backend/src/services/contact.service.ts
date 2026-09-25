import { Contact } from '@prisma/client';
import { google } from 'googleapis';
import { Readable } from 'stream';
import csv from 'csv-parser';
import { normalizePhoneNumber } from '../utils/phoneUtil';
import prisma from '../prisma/client';

interface CreateContactDto {
  firstName?: string;
  lastName?: string;
  phoneNumber: string;
  email?: string;
  city?: string;
  consentGiven?: boolean;
}

export class ContactService {
  private prisma = prisma;

  constructor() {}

  /** Get all contacts belonging to a user */
  async getAll(userId: number): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get paginated contacts with optional search */
  async getPaginated(userId: number, page: number = 1, size: number = 20, search?: string): Promise<{ contacts: Contact[]; total: number }> {
    const take = Math.min(Math.max(size, 1), 100);
    const currentPage = Math.max(page, 1);
    const skip = (currentPage - 1) * take;
    const where: any = { userId };
    if (search && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { phoneNumber: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.contact.count({ where }),
    ]);
    return { contacts, total };
  }

  /** Get a single contact scoped by user */
  async getById(userId: number, contactId: number): Promise<Contact | null> {
    return this.prisma.contact.findFirst({
      where: { id: contactId, userId },
    });
  }

  /** Create a new contact for the user */
  async create(userId: number, data: CreateContactDto): Promise<Contact> {
    if (!data.phoneNumber || typeof data.phoneNumber !== 'string' || data.phoneNumber.trim() === '') {
      const err: any = new Error('phoneNumber is required');
      err.statusCode = 400;
      throw err;
    }
    return this.prisma.contact.create({
      data: {
        userId,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber.trim(),
        email: data.email,
        city: data.city,
        consentGiven: data.consentGiven ?? false,
      },
    });
  }

  /** Update an existing contact owned by the user */
  async update(userId: number, contactId: number, data: Partial<CreateContactDto>): Promise<Contact> {
    // Ensure the contact belongs to the user
    const existing = await this.prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!existing) {
      const err: any = new Error('Contact not found');
      err.statusCode = 404;
      throw err;
    }
    // If phoneNumber is provided, validate it
    if (data.phoneNumber !== undefined) {
      if (!data.phoneNumber || typeof data.phoneNumber !== 'string' || data.phoneNumber.trim() === '') {
        const err: any = new Error('phoneNumber cannot be empty');
        err.statusCode = 400;
        throw err;
      }
      data.phoneNumber = data.phoneNumber.trim();
    }
    return this.prisma.contact.update({
      where: { id: contactId },
      data,
    });
  }

  /** Import contacts from CSV */
  async importCsv(userId: number, fileBuffer: Buffer, country?: string) {
    // Parse CSV
    const results: any[] = [];
    const errors: { row: number; reason: string }[] = [];
    const seenNumbers = new Set<string>();
    const validContacts: any[] = [];
    let totalRows = 0;
    const stream = Readable.from(fileBuffer);
    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on('data', (row) => {
          totalRows++;
          const rowNum = totalRows; // for reporting
          // Trim all values
          const phoneRaw = (row['phoneNumber'] || row['phone_number'] || row['PhoneNumber'] || '').trim();
          const firstName = (row['firstName'] || row['first_name'] || '').trim();
          const lastName = (row['lastName'] || row['last_name'] || '').trim();
          const email = (row['email'] || '').trim();

          if (!phoneRaw) {
            errors.push({ row: rowNum, reason: 'Missing phoneNumber' });
            return;
          }
          const normalized = normalizePhoneNumber(phoneRaw, country);
          if (!normalized) {
            errors.push({ row: rowNum, reason: 'Invalid phone number' });
            return;
          }
          // Email validation if provided
          if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            errors.push({ row: rowNum, reason: 'Invalid email' });
            return;
          }
          // Duplicate within CSV
          if (seenNumbers.has(normalized)) {
            // count as duplicate, not an error
            return;
          }
          seenNumbers.add(normalized);
          // Prepare for bulk insert (store normalized phoneNumber)
          validContacts.push({
            userId,
            phoneNumber: normalized,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            email: email || undefined,
            consentGiven: false,
          });
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    // Detect duplicates against existing contacts
    const existing = await this.prisma.contact.findMany({
      where: { userId, phoneNumber: { in: Array.from(seenNumbers) } },
      select: { phoneNumber: true },
    });
    const existingNumbers = new Set(existing.map((c) => c.phoneNumber));
    const contactsToCreate = validContacts.filter((c) => !existingNumbers.has(c.phoneNumber));
    const duplicateCount = validContacts.length - contactsToCreate.length;

    // Insert contacts in a transaction
    if (contactsToCreate.length > 0) {
      await this.prisma.$transaction([
        this.prisma.contact.createMany({ data: contactsToCreate, skipDuplicates: false }),
      ]);
    }

    const imported = contactsToCreate.length;
    const failed = errors.length;
    return {
      totalRows,
      imported,
      duplicates: duplicateCount,
      failed,
      errors,
    };
  }
  /** Import contacts from Excel (.xlsx) */
  async importExcel(userId: number, fileBuffer: Buffer, country?: string) {
    const XLSX = require('xlsx');
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const errors: { row: number; reason: string }[] = [];
    const seenNumbers = new Set<string>();
    const validContacts: any[] = [];
    let totalRows = 0;

    for (const row of rows) {
      totalRows++;
      const rowNum = totalRows;
      const phoneRaw = (row['phoneNumber'] || row['phone_number'] || row['PhoneNumber'] || '').toString().trim();
      const firstName = (row['firstName'] || row['first_name'] || '').toString().trim();
      const lastName = (row['lastName'] || row['last_name'] || '').toString().trim();
      const email = (row['email'] || '').toString().trim();

      if (!phoneRaw) {
        errors.push({ row: rowNum, reason: 'Missing phoneNumber' });
        continue;
      }
      const normalized = normalizePhoneNumber(phoneRaw, country);
      if (!normalized) {
        errors.push({ row: rowNum, reason: 'Invalid phone number' });
        continue;
      }
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        errors.push({ row: rowNum, reason: 'Invalid email' });
        continue;
      }
      if (seenNumbers.has(normalized)) {
        // duplicate within file, count as duplicate later
        continue;
      }
      seenNumbers.add(normalized);
      validContacts.push({
        userId,
        phoneNumber: normalized,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: email || undefined,
        consentGiven: false,
      });
    }

    // Detect duplicates against existing contacts
    const existing = await this.prisma.contact.findMany({
      where: { userId, phoneNumber: { in: Array.from(seenNumbers) } },
      select: { phoneNumber: true },
    });
    const existingNumbers = new Set(existing.map((c) => c.phoneNumber));
    const contactsToCreate = validContacts.filter((c) => !existingNumbers.has(c.phoneNumber));
    const duplicateCount = validContacts.length - contactsToCreate.length;

    if (contactsToCreate.length > 0) {
      await this.prisma.$transaction([
        this.prisma.contact.createMany({ data: contactsToCreate, skipDuplicates: false }),
      ]);
    }

    const imported = contactsToCreate.length;
    const failed = errors.length;
    return { totalRows, imported, duplicates: duplicateCount, failed, errors };
  }

  /** Import contacts from Google Sheets */
  async importGoogleSheets(
    userId: number,
    sheetUrl: string,
    sheetName?: string,
    country?: string,
  ) {
    // Validate env credentials
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;
    if (!serviceAccountEmail || !privateKeyRaw) {
      const err: any = new Error('Google API credentials not configured');
      err.statusCode = 500;
      throw err;
    }
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    // Validate sheet URL and extract spreadsheetId
    const match = sheetUrl.match(/\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      const err: any = new Error('Invalid Google Sheet URL');
      err.statusCode = 400;
      throw err;
    }
    const spreadsheetId = match[1];

    // Authorize JWT client
    const auth = new google.auth.JWT(
      serviceAccountEmail,
      undefined,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    );
    try {
      await auth.authorize();
    } catch (e) {
      const err: any = new Error('Failed to authorize with Google Sheets API');
      err.statusCode = 500;
      err.inner = e;
      throw err;
    }
    const sheets = google.sheets({ version: 'v4', auth });

    // Determine sheet name (tab)
    let targetSheetName = sheetName;
    if (!targetSheetName) {
      const metaResp = await sheets.spreadsheets.get({ spreadsheetId });
      const firstSheet = metaResp.data.sheets?.[0];
      targetSheetName = firstSheet?.properties?.title || 'Sheet1';
    }

    // Fetch values
    const range = `${targetSheetName}!A:Z`;
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = resp.data.values || [];

    // Enforce row limit (excluding header)
    const maxRows = 10000;
    if (rows.length - 1 > maxRows) {
      const err: any = new Error(`Row limit exceeded: maximum ${maxRows} rows allowed`);
      err.statusCode = 400;
      throw err;
    }

    // Process header row
    const headerRow = rows[0] || [];
    const headerMap: Record<string, number> = {};
    headerRow.forEach((h, idx) => {
      const key = h?.toString().trim().toLowerCase();
      headerMap[key] = idx;
    });

    const errors: { row: number; reason: string }[] = [];
    const seenNumbers = new Set<string>();
    const validContacts: any[] = [];
    const totalRows = rows.length - 1;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const phoneRaw = (row[headerMap['phonenumber']] || '').toString().trim();
      const firstName = (row[headerMap['firstname']] || '').toString().trim();
      const lastName = (row[headerMap['lastname']] || '').toString().trim();
      const email = (row[headerMap['email']] || '').toString().trim();

      if (!phoneRaw) {
        errors.push({ row: i + 1, reason: 'Missing phoneNumber' });
        continue;
      }
      const normalized = normalizePhoneNumber(phoneRaw, country);
      if (!normalized) {
        errors.push({ row: i + 1, reason: 'Invalid phone number' });
        continue;
      }
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        errors.push({ row: i + 1, reason: 'Invalid email' });
        continue;
      }
      if (seenNumbers.has(normalized)) {
        continue;
      }
      seenNumbers.add(normalized);
      validContacts.push({
        userId,
        phoneNumber: normalized,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: email || undefined,
        consentGiven: false,
      });
    }

    // Detect duplicates against existing contacts
    const existing = await this.prisma.contact.findMany({
      where: { userId, phoneNumber: { in: Array.from(seenNumbers) } },
      select: { phoneNumber: true },
    });
    const existingNumbers = new Set(existing.map(c => c.phoneNumber));
    const contactsToCreate = validContacts.filter(c => !existingNumbers.has(c.phoneNumber));
    const duplicateCount = validContacts.length - contactsToCreate.length;

    if (contactsToCreate.length > 0) {
      await this.prisma.$transaction([
        this.prisma.contact.createMany({ data: contactsToCreate, skipDuplicates: false }),
      ]);
    }

    const imported = contactsToCreate.length;
    const failed = errors.length;
    return { totalRows, imported, duplicates: duplicateCount, failed, errors };
  }

  /** Delete a contact owned by the user */
  async delete(userId: number, contactId: number): Promise<void> {
    const existing = await this.prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!existing) {
      const err: any = new Error('Contact not found');
      err.statusCode = 404;
      throw err;
    }
    await this.prisma.contact.delete({ where: { id: contactId } });
  }

  /** Get merged message history for a contact */
  async getContactHistory(userId: number, contactId: number): Promise<any[]> {
    // We already verified ownership in controller
    
    // Fetch outbound messages
    const outbound = await this.prisma.message.findMany({
      where: { contactId },
      include: { campaign: { select: { name: true } }, media: true },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch incoming messages
    const incoming = await this.prisma.incomingMessage.findMany({
      where: { contactId },
      include: { media: true },
      orderBy: { receivedAt: 'desc' }
    });

    // Merge and sort
    const merged = [
      ...outbound.map(m => ({
        ...m,
        direction: 'outbound',
        timestamp: m.createdAt
      })),
      ...incoming.map(m => ({
        ...m,
        direction: 'inbound',
        timestamp: m.receivedAt
      }))
    ];

    merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return merged;
  }
}
