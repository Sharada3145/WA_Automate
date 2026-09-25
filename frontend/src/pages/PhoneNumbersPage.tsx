import { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Phone, Plus, Trash2, X, AlertCircle, CheckCircle
} from 'lucide-react';

interface PhoneNumber {
  id: number;
  phoneNumber: string;
  displayName: string | null;
  businessAccountId?: number;
  status?: string;
  createdAt: string;
}

export default function PhoneNumbersPage() {
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form
  const [formPhone, setFormPhone] = useState('');
  const [formName, setFormName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadPhones(); }, []);

  const loadPhones = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/whatsapp/numbers');
      setPhones(Array.isArray(data) ? data : (data.data || []));
    } catch { setPhones([]); }
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.post('/whatsapp/numbers', {
        phoneNumber: formPhone,
        displayName: formName || undefined,
      });
      setShowAdd(false);
      setFormPhone(''); setFormName('');
      setSuccess('Phone number added');
      loadPhones();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to add phone number');
    }
    setCreating(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this phone number?')) return;
    try {
      await api.delete(`/whatsapp/numbers/${id}`);
      setSuccess('Phone number removed');
      loadPhones();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to remove phone number');
      setTimeout(() => setError(''), 3000);
    }
  };

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
          <h1 className="flex items-center gap-2"><Phone size={24} /> Phone Numbers</h1>
          <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
            {phones.length} authorized numbers
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Number
        </button>
      </div>

      <div className="page-body">
        {success && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 20,
            background: 'var(--green-muted)', borderRadius: 'var(--radius-md)',
            color: 'var(--green)', fontSize: '0.8125rem'
          }}>
            <CheckCircle size={16} /> {success}
          </div>
        )}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 20,
            background: 'var(--red-muted)', borderRadius: 'var(--radius-md)',
            color: 'var(--red)', fontSize: '0.8125rem'
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {phones.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {phones.map(p => (
              <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: 40, height: 40, borderRadius: 'var(--radius-md)',
                      background: 'var(--green-muted)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', color: 'var(--green)'
                    }}>
                      <Phone size={20} />
                    </div>
                    <div>
                      <div className="font-medium">{p.displayName || 'Phone Number'}</div>
                      <div className="text-sm text-secondary">{p.phoneNumber}</div>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(p.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`badge ${p.status === 'connected' || !p.status ? 'badge-green' : 'badge-amber'}`}>
                    {p.status || 'Active'}
                  </span>
                  <span className="text-xs text-tertiary">
                    Added {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><Phone size={28} /></div>
            <h3 style={{ marginBottom: 4 }}>No phone numbers</h3>
            <p className="text-sm text-secondary">Add a WhatsApp Business phone number to start sending messages.</p>
          </div>
        )}
      </div>

      {/* Add Phone Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Phone Number</h3>
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
                  <input className="input" placeholder="+1234567890" value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)} required />
                  <span className="text-xs text-tertiary">Include country code (e.g. +1)</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input className="input" placeholder="Main Business Line" value={formName}
                    onChange={(e) => setFormName(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <div className="spinner" /> : 'Add Number'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
