// scratch script to thoroughly test Contacts API including CSV import

// Node 18+ provides global fetch and FormData; no external modules needed.
const base = 'http://localhost:3000/api';

async function main() {
  // 1. Register a unique test user
  const unique = Date.now();
  const email = `csv-test-${unique}@example.com`;
  const password = 'StrongPassword123';
  const regRes = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  console.log('Register', regRes.status);

  // 2. Login to obtain JWT
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginData = await loginRes.json();
  const token = loginData?.token;
  console.log('Login', loginRes.status, token ? 'OK' : 'FAIL');
  if (!token) throw new Error('Authentication failed');

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 3. Verify unauthenticated access is blocked
  const unauthGet = await fetch(`${base}/contacts`);
  console.log('Unauth GET contacts status', unauthGet.status);

  // 4. Create a contact (used later to test duplicate detection against DB)
  const contactPayload = { phoneNumber: '+1234567890', firstName: 'Existing', lastName: 'User' };
  const createRes = await fetch(`${base}/contacts`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(contactPayload)
  });
  const createData = await createRes.json();
  console.log('Create contact status', createRes.status);
  const existingContactId = createData?.data?.id;

  // 5. Upload CSV containing various rows
  const csvPath = 'scratch/import_test.csv';
  const fs = require('fs');
  const csvBuffer = fs.readFileSync(csvPath);
  const form = new FormData();
  form.append('file', new Blob([csvBuffer]), 'import_test.csv');
  // optional country for normalization (e.g., IN for Indian numbers)
  form.append('country', 'IN');
  const importRes = await fetch(`${base}/contacts/import/csv`, {
    method: 'POST',
    headers: { ...authHeaders }, // fetch will set correct multipart headers
    body: form
  });
  const importResult = await importRes.json();
  console.log('CSV import status', importRes.status, importResult);

  // 6. Validate import summary
  const summary = importResult?.data;
  if (!summary) throw new Error('Missing import summary');
  console.log('Import summary', summary);

  // 7. Fetch contacts list to verify imported records belong to the user
  const listRes = await fetch(`${base}/contacts`, { headers: authHeaders });
  const listData = await listRes.json();
  console.log('List contacts status', listRes.status, 'count', listData?.data?.length);

  // 8. Clean up: delete all contacts created for this user
  const contacts = listData?.data || [];
  for (const c of contacts) {
    await fetch(`${base}/contacts/${c.id}`, { method: 'DELETE', headers: authHeaders });
  }
  console.log('Deleted all test contacts');

  console.log('Test script completed');
}

main().catch(err => console.error('Test script error:', err));
