import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import {
  Megaphone, Plus, Search, Play, Pause, Square, X, AlertCircle,
  CheckCircle, Eye
} from 'lucide-react';

interface Campaign {
  id: number;
  name: string;
  status: string;
  templateId: number | null;
  scheduledAt: string | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
}

const STATUS_BADGES: Record<string, string> = {
  DRAFT: 'badge-default',
  SCHEDULED: 'badge-amber',
  IN_PROGRESS: 'badge-green',
  PAUSED: 'badge-amber',
  COMPLETED: 'badge-blue',
  STOPPED: 'badge-red',
  FAILED: 'badge-red',
};

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [phones, setPhones] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form
  const [formName, setFormName] = useState('');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formPhoneId, setFormPhoneId] = useState('');
  const [formContactIds, setFormContactIds] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/campaigns');
      setCampaigns(Array.isArray(data) ? data : (data.data || []));
    } catch { setCampaigns([]); }
    setLoading(false);
  };

  const loadDependencies = useCallback(async () => {
    try {
      const [tpl, ph, ct] = await Promise.all([
        api.get('/templates'),
        api.get('/whatsapp/numbers'),
        api.get('/contacts'),
      ]);
      setTemplates(Array.isArray(tpl.data) ? tpl.data : (tpl.data.data || []));
      setPhones(Array.isArray(ph.data) ? ph.data : (ph.data.data || []));
      setContacts(Array.isArray(ct.data?.data) ? ct.data.data : (Array.isArray(ct.data) ? ct.data : []));
    } catch {}
  }, []);

  const openCreate = async () => {
    setShowCreate(true);
    await loadDependencies();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await api.post('/campaigns', {
        name: formName,
        whatsappPhoneNumberId: parseInt(formPhoneId),
        templateId: formTemplateId ? parseInt(formTemplateId) : undefined,
        messageType: formTemplateId ? 'TEMPLATE' : 'TEXT',
      });
      const created = res.data;
      if (created && created.id && formContactIds.length > 0) {
        await api.post(`/campaigns/${created.id}/contacts`, {
          contactIds: formContactIds,
        });
      }

      setShowCreate(false);
      setFormName(''); setFormTemplateId(''); setFormPhoneId(''); setFormContactIds([]);
      setSuccess('Campaign created');
      loadCampaigns();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create campaign');
    }
    setCreating(false);
  };

  const handleAction = async (id: number, action: string) => {
    setError('');
    try {
      await api.post(`/campaigns/${id}/${action}`);
      setSuccess(`Campaign ${action} successful`);
      loadCampaigns();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || `Failed to ${action} campaign`);
      setTimeout(() => setError(''), 4000);
    }
  };

  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleContact = (id: number) => {
    setFormContactIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
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
          <h1 className="flex items-center gap-2"><Megaphone size={24} /> Campaigns</h1>
          <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
            {campaigns.length} total campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} /> New Campaign
          </button>
        </div>
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

        {/* Search */}
        <div className="relative" style={{ marginBottom: 20 }}>
          <Search size={18} style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
          <input type="text" className="input" placeholder="Search campaigns..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 42 }} />
        </div>

        {filtered.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Delivered</th>
                  <th>Read</th>
                  <th>Failed</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</td>
                    <td><span className={`badge ${STATUS_BADGES[c.status] || 'badge-default'}`}>{c.status}</span></td>
                    <td>{c.totalRecipients || 0}</td>
                    <td>{c.sentCount || 0}</td>
                    <td>{c.deliveredCount || 0}</td>
                    <td>{c.readCount || 0}</td>
                    <td>{c.failedCount || 0}</td>
                    <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-sm btn-icon" title="View Details"
                          onClick={() => navigate(`/campaigns/${c.id}`)}>
                          <Eye size={15} />
                        </button>
                        {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                          <button className="btn btn-ghost btn-sm btn-icon" title="Start"
                            onClick={() => handleAction(c.id, 'start')}>
                            <Play size={15} />
                          </button>
                        )}
                        {c.status === 'IN_PROGRESS' && (
                          <button className="btn btn-ghost btn-sm btn-icon" title="Pause"
                            onClick={() => handleAction(c.id, 'pause')}>
                            <Pause size={15} />
                          </button>
                        )}
                        {c.status === 'PAUSED' && (
                          <button className="btn btn-ghost btn-sm btn-icon" title="Resume"
                            onClick={() => handleAction(c.id, 'resume')}>
                            <Play size={15} />
                          </button>
                        )}
                        {(c.status === 'IN_PROGRESS' || c.status === 'PAUSED') && (
                          <button className="btn btn-ghost btn-sm btn-icon" title="Stop"
                            onClick={() => handleAction(c.id, 'stop')}>
                            <Square size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><Megaphone size={28} /></div>
            <h3 style={{ marginBottom: 4 }}>No campaigns</h3>
            <p className="text-sm text-secondary">Create a campaign to start sending messages.</p>
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Create Campaign</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowCreate(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
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
                  <label className="form-label">Campaign Name *</label>
                  <input className="input" placeholder="Summer Sale 2024" value={formName}
                    onChange={(e) => setFormName(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Template *</label>
                  <select className="select" value={formTemplateId}
                    onChange={(e) => setFormTemplateId(e.target.value)} required>
                    <option value="">Select template...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <select className="select" value={formPhoneId}
                    onChange={(e) => setFormPhoneId(e.target.value)} required>
                    <option value="">Select phone number...</option>
                    {phones.map(p => (
                      <option key={p.id} value={p.id}>{p.displayName || p.phoneNumber}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Recipients *</label>
                  <div style={{
                    maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)', padding: 8
                  }}>
                    {contacts.length === 0 ? (
                      <p className="text-sm text-secondary" style={{ padding: 8 }}>No contacts available</p>
                    ) : contacts.map(c => (
                      <label key={c.id} className="flex items-center gap-2" style={{
                        padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer', fontSize: '0.875rem'
                      }}>
                        <input type="checkbox" checked={formContactIds.includes(c.id)}
                          onChange={() => toggleContact(c.id)} />
                        <span>{c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : (c.name || c.phoneNumber)}</span>
                        <span className="text-xs text-tertiary" style={{ marginLeft: 'auto' }}>
                          {c.phoneNumber}
                        </span>
                      </label>
                    ))}
                  </div>
                  <span className="text-xs text-tertiary">{formContactIds.length} selected</span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <div className="spinner" /> : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
