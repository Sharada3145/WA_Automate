// scratch/test_csv_import.js
const fetch = require('node-fetch');
const FormData = require('form-data');

const base = 'http://localhost:3000/api';
const testEmail = `csv-test-${Date.now()}@example.com`;
const testPassword = 'StrongPassword123';

async function register() {
  const res = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  return res.json();
}

async function login() {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function createContact(token) {
  const res = await fetch(`${base}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ phoneNumber: '+919876543210', firstName: 'Pre', lastName: 'Existing' }),
  });
  return res.json();
}

async function importCsv(token) {
  const form = new FormData();
  const csvPath = `${process.cwd()}/backend/scratch/import_test.csv`;
  form.append('file', require('fs').createReadStream(csvPath));
  // optional country code for local numbers (India)
  form.append('country', 'IN');

  const res = await fetch(`${base}/contacts/import/csv`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function getContacts(token) {
  const res = await fetch(`${base}/contacts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

(async () => {
  try {
    console.log('Registering user');
    await register();
    const { status, json } = await login();
    if (status !== 200) throw new Error('Login failed');
    const token = json.data?.token;
    console.log('Creating pre-existing contact');
    await createContact(token);
    console.log('Importing CSV');
    const importResult = await importCsv(token);
    console.log('Import response', importResult);
    const contacts = await getContacts(token);
    console.log('Contacts after import', contacts);
  } catch (e) {
    console.error('Test error', e);
  }
})();
