# CSV Import Feature Implementation Plan

## Goal
Add a CSV import endpoint to the Contacts API that allows an authenticated user to upload a CSV file and bulk‑import contacts into their own account while preserving existing authentication, CRUD, pagination, and search functionality.

## Files to be Created / Modified
| Component | Action | Path |
|-----------|--------|------|
| **Route** | Add new route for CSV import | `src/routes/contact.routes.ts` |
| **Controller** | Implement `importCsv` method | `src/controllers/contact.controller.ts` |
| **Service** | Implement `importCsv` method (parsing, validation, duplicate detection, transaction) | `src/services/contact.service.ts` |
| **Middleware** | Create Multer upload config (file size limit, CSV filter) | `src/middleware/upload.middleware.ts` |
| **Utility** | Phone normalization helper using `libphonenumber-js` | `src/utils/phoneUtil.ts` |
| **DTO / Types** | Define import‑summary response type (optional) | `src/types/contact.ts` |
| **Tests (scratch)** | Temporary scripts to exercise the endpoint and verify DB state | `scratch/test_csv_import.js` (generated then removed) |
| **Cleanup script** | Remove temporary test users, contacts, CSV files after testing | `scratch/cleanup_test_data.js` (generated then removed) |

## Packages Added
- `multer` – handling `multipart/form-data` uploads.
- `csv-parser` – streaming CSV parsing.
- `libphonenumber-js` – robust phone‑number parsing/normalisation.

## Endpoint Specification
- **Method**: `POST`
- **Path**: `/api/contacts/import/csv`
- **Auth**: `authMiddleware` (same as other contacts routes).
- **Headers**: `Content-Type: multipart/form-data`
- **Form field**: `file` – the CSV file.
- **Optional query/body**: `country` (ISO‑2 code) – used when a phone number lacks a leading `+` to infer the country for parsing.

## CSV Format Supported
| Column | Required? | Notes |
|--------|-----------|-------|
| `phoneNumber` | **Yes** | Minimum field; will be trimmed and parsed/normalised. |
| `firstName` | No | Trim whitespace. |
| `lastName` | No | Trim whitespace. |
| `email` | No | If present, validated with a simple regex. |

- Column order is not important; header row is required.
- Additional columns are ignored.

## Validation & Normalisation
1. Ensure a file is present and its MIME type is `text/csv` or `application/vnd.ms‑excel` (common CSV MIME). Reject otherwise (400).
2. Enforce a file‑size limit of **5 MB** via Multer configuration.
3. For each row:
   - Trim all values.
   - `phoneNumber` must exist; parsed with `parsePhoneNumberFromString(value, country?)`.
   - Normalised number is stored in E.164 format (`+<countrycode><number>`).
   - If parsing fails → row marked as **failed** with reason.
   - If `email` present → validate with `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`.
   - Rows with missing optional fields are accepted.
4. Duplicate detection:
   - Track numbers seen in the current CSV (case‑insensitive) → internal duplicates.
   - Query existing contacts of the user for any of the normalised numbers (single `findMany` with `in` filter) to detect DB duplicates.
   - Duplicates are counted and **not** inserted.

## Database Interaction
- Use a **Prisma transaction** (`$transaction`) that creates all non‑duplicate, valid contacts in one batch (`createMany`).
- `createMany` is safe for bulk insert and skips duplicate errors when `skipDuplicates` is set, but we will pre‑filter duplicates ourselves to report accurate counts.
- Any unexpected DB error aborts the whole import and returns a 500 with an error summary.

## Import Summary Response
```json
{
  "success": true,
  "data": {
    "totalRows": 100,
    "imported": 80,
    "duplicates": 10,
    "failed": 10,
    "errors": [
      { "row": 12, "reason": "Invalid phone number" },
      { "row": 45, "reason": "Invalid email" }
    ]
  }
}
```
- Mirrors the existing API response shape (`{ success, data }`).

## Testing Strategy (scratch scripts)
1. **Create a temporary user** via the auth API and obtain a JWT.
2. **Generate a CSV file** covering:
   - Valid rows.
   - Rows missing `phoneNumber`.
   - Rows with malformed phone numbers.
   - Rows with invalid email.
   - Duplicate phone numbers inside the CSV.
   - Numbers that already exist for the user.
3. Perform **authenticated** `POST /api/contacts/import/csv` using `fetch` and `FormData`.
4. Verify the HTTP status (200) and response summary matches expectations.
5. Query the DB via Prisma to ensure only the correct contacts were created.
6. Perform an **unauthenticated** request → expect 401.
7. Attempt to upload a non‑CSV file (e.g., `.txt`) → expect 400.
8. Attempt to upload a file >5 MB → expect 400.
9. Ensure another user’s contacts are untouched.
10. Clean‑up: delete the temporary user, all contacts created, and the CSV file.

## Cleanup Plan
- `scratch/cleanup_test_data.js` will:
  - Delete the temporary auth‑test user(s).
  - Delete contacts whose `phoneNumber` values match the test data (using a `startsWith` pattern or a list of inserted numbers).
  - Remove the temporary CSV files.
- After verification, the script and CSV files will be removed from the repo.

## Verification Plan
1. Run `npm run build` – must succeed.
2. Execute the scratch test script (`node scratch/test_csv_import.js`).
3. Observe console logs for each test case; any failure will be reported.
4. Run cleanup script (`node scratch/cleanup_test_data.js`).
5. Run `npm run build` again to confirm no TypeScript errors were introduced.

## Open Questions
- **Country inference**: Should the API accept a query parameter `country` (ISO‑2) for parsing local numbers without a leading `+`? (Recommended – optional, default to `null` and treat numbers without a plus as invalid).
- **Maximum file size**: 5 MB is a reasonable default; adjust if the user has different constraints.

## User Review Required
- Confirm the chosen file‑size limit (5 MB) and whether a `country` query parameter is acceptable for local number parsing.
- Approve the duplicate‑handling approach (pre‑filter + transaction) and the response shape.

---
*Implementation will proceed once the above points are approved.*
