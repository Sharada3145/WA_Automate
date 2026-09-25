// src/middleware/upload.middleware.ts
import multer from 'multer';
import path from 'path';

// Store files in memory to avoid writing to disk
const storage = multer.memoryStorage();

function csvFileFilter(req: any, file: any, cb: any) {
  // Accept only CSV mime types
  const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'application/csv'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
}

export const uploadExcel = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
export const uploadCsv = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
