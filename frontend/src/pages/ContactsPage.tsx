import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import {
  Users, Plus, Search, Upload, Trash2, ShieldCheck,
  ShieldOff, X, AlertCircle, CheckCircle, ChevronLeft, ChevronRight,
  History
} from 'lucide-react';

interface Contact {
  id: number;
  phoneNumber: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  city: string | null;
  consentGiven: boolean;
  createdAt: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showHistory, setShowHistory] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add form
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/contacts', {
        params: { page, size: perPage, search: search || undefined }
      });
      if (data.success) {
        setContacts(data.data || []);
        setTotal(data.pagination?.total || 0);
      } else {
        setContacts(Array.isArray(data) ? data : []);
      }
    } catch { setContacts([]); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const totalPages = Math.ceil(total / perPage) || 1;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/contacts', {
        phoneNumber: newPhone,
        firstName: newName || undefined,
        email: newEmail || undefined,
        consentGiven: true,
      });
      setShowAdd(false);
      setNewPhone(''); setNewName(''); setNewEmail('');
      setSuccess('Contact added successfully');
      loadContacts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to add contact');
    }
  };

  const handleOptToggle = async (contact: Contact) => {
    try {
      await api.put(`/contacts/${contact.id}`, {
        phoneNumber: contact.phoneNumber,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        consentGiven: !contact.consentGiven,
      });
      loadContacts();
    } catch {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await api.delete(`/contacts/${id}`);
      setSuccess('Contact deleted');
      loadContacts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete contact');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const form = e.target as HTMLFormElement;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput?.files?.[0]) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
      const { data } = await api.post('/contacts/import/csv', formData);
      setShowImport(false);
      const count = data.data?.imported || data.imported || 0;
      setSuccess(`Imported ${count} contacts`);
      loadContacts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Import failed');
    }
  };

  const loadHistory = useCallback(async (contactId: number) => {
    setShowHistory(contactId);
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/contacts/${contactId}/history`);
      setHistory(data.data || (Array.isArray(data) ? data : []));
    } catch {
      setHistory([]);
    }
    setHistoryLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="flex items-center gap-2"><Users size={24} /> Contacts</h1>
          <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
            {total} total contacts
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>
            <Upload size={16} /> Import CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </div>

      <div className="page-body">
        {success && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            marginBottom: 20, background: 'var(--green-muted)', borderRadius: 'var(--radius-md)',
            color: 'var(--green)', fontSize: '0.8125rem'
          }}>
            <CheckCircle size={16} /> {success}
          </div>
        )}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            marginBottom: 20, background: 'var(--red-muted)', borderRadius: 'var(--radius-md)',
            color: 'var(--red)', fontSize: '0.8125rem'
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Search */}
        <div className="relative" style={{ marginBottom: 20 }}>
          <Search size={18} style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
          <input
            type="text"
            className="input"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ paddingLeft: 42 }}
          />
        </div>

        {/* Table */}
        {contacts.length > 0 ? (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Consent</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : '—'}
                      </td>
                      <td>{c.phoneNumber}</td>
                      <td>{c.email || '—'}</td>
                      <td>
                        <span className={`badge ${c.consentGiven ? 'badge-green' : 'badge-amber'}`}>
                          {c.consentGiven ? 'Consent Given' : 'Opted Out'}
                        </span>
                      </td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            title="View History"
                            onClick={() => loadHistory(c.id)}
                          >
                            <History size={15} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            title={c.consentGiven ? 'Revoke Consent' : 'Opt-in'}
                            onClick={() => handleOptToggle(c)}
                          >
                            {c.consentGiven ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            title="Delete"
                            onClick={() => handleDelete(c.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between" style={{ marginTop: 20 }}>
                <span className="text-xs text-tertiary">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn btn-secondary btn-sm btn-icon"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="btn btn-secondary btn-sm btn-icon"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={28} /></div>
            <h3 style={{ marginBottom: 4 }}>No contacts found</h3>
            <p className="text-sm text-secondary">
              {search ? 'Try adjusting your search query.' : 'Add contacts manually or import a CSV file.'}
            </p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Contact</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowAdd(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body flex flex-col gap-4">
                {error && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                    background: 'var(--red-muted)', borderRadius: 'var(--radius-md)',
                    color: 'var(--red)', fontSize: '0.8125rem'
                  }}>
                    <AlertCircle size={16} /> {error}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    className="input"
                    placeholder="+1234567890"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    required
                  />
                  <span className="text-xs text-tertiary">Include country code (e.g. +1)</span>
                </div>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    className="input"
                    placeholder="John"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="john@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import Contacts (CSV)</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowImport(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleImport}>
              <div className="modal-body flex flex-col gap-4">
                {error && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                    background: 'var(--red-muted)', borderRadius: 'var(--radius-md)',
                    color: 'var(--red)', fontSize: '0.8125rem'
                  }}>
                    <AlertCircle size={16} /> {error}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Select CSV File</label>
                  <input type="file" accept=".csv" className="input" required />
                  <span className="text-xs text-tertiary">
                    File should contain headers: phoneNumber, firstName, email...
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowImport(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Upload & Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory !== null && (
        <div className="modal-overlay" onClick={() => setShowHistory(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>Contact Message History</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowHistory(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {historyLoading ? (
                <div className="flex items-center justify-center p-6"><div className="spinner" /></div>
              ) : history.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {history.map((h: any, idx: number) => (
                    <div key={h.id || idx} style={{
                      padding: 12, borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-input)', border: '1px solid var(--border-primary)'
                    }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                        <span className={`badge ${h.direction === 'INBOUND' ? 'badge-blue' : 'badge-green'}`}>
                          {h.direction || 'OUTBOUND'}
                        </span>
                        <span className="text-xs text-tertiary">
                          {h.createdAt || h.timestamp ? new Date(h.createdAt || h.timestamp).toLocaleString() : ''}
                        </span>
                      </div>
                      <p className="text-sm font-medium" style={{ marginTop: 4 }}>{h.content || h.body || 'Message sent'}</p>
                      {h.campaignName && (
                        <span className="text-xs text-secondary" style={{ marginTop: 4, display: 'block' }}>
                          Campaign: {h.campaignName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-secondary p-4 text-center">No message history for this contact.</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowHistory(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
