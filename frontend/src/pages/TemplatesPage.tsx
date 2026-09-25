import { useState, useEffect } from 'react';
import api from '../api/client';
import {
  FileText, Plus, Search, Trash2, X, AlertCircle,
  CheckCircle
} from 'lucide-react';

interface Template {
  id: number;
  name: string;
  language: string;
  category: string;
  bodyText?: string;
  body?: string;
  footerText: string | null;
  status?: string;
  createdAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form
  const [formName, setFormName] = useState('');
  const [formLang, setFormLang] = useState('en');
  const [formCategory, setFormCategory] = useState('MARKETING');
  const [formBody, setFormBody] = useState('');
  const [formFooter, setFormFooter] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/templates');
      setTemplates(Array.isArray(data) ? data : (data.data || []));
    } catch { setTemplates([]); }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.post('/templates', {
        name: formName,
        language: formLang,
        category: formCategory,
        bodyText: formBody,
        variables: '[]',
        footerText: formFooter || undefined,
      });
      setShowCreate(false);
      setFormName(''); setFormBody(''); setFormFooter('');
      setSuccess('Template created');
      loadTemplates();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create template');
    }
    setCreating(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/templates/${id}`);
      setSuccess('Template deleted');
      loadTemplates();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete template');
      setTimeout(() => setError(''), 3000);
    }
  };

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.category && t.category.toLowerCase().includes(search.toLowerCase()))
  );

  const categoryBadge = (cat?: string) => {
    const map: Record<string, string> = {
      MARKETING: 'badge-blue', UTILITY: 'badge-teal', AUTHENTICATION: 'badge-amber',
    };
    return map[cat || ''] || 'badge-default';
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
          <h1 className="flex items-center gap-2"><FileText size={24} /> Templates</h1>
          <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
            {templates.length} message templates
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Template
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

        {/* Search */}
        <div className="relative" style={{ marginBottom: 20 }}>
          <Search size={18} style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
          <input type="text" className="input" placeholder="Search templates..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 42 }} />
        </div>

        {/* Templates Grid */}
        {filtered.length > 0 ? (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16
          }}>
            {filtered.map(t => (
              <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="flex items-center justify-between">
                  <h4 className="truncate" style={{ flex: 1 }}>{t.name}</h4>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm btn-icon" title="Delete"
                      onClick={() => handleDelete(t.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`badge ${categoryBadge(t.category)}`}>{t.category || 'MARKETING'}</span>
                  <span className="badge badge-default">{t.language}</span>
                  {t.status && (
                    <span className={`badge ${t.status === 'APPROVED' ? 'badge-green' : 'badge-default'}`}>
                      {t.status}
                    </span>
                  )}
                </div>
                <div style={{
                  background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                  padding: 12, fontSize: '0.8125rem', color: 'var(--text-secondary)',
                  lineHeight: 1.5, maxHeight: 100, overflow: 'hidden'
                }}>
                  {t.bodyText || t.body || 'No text content'}
                </div>
                {t.footerText && (
                  <p className="text-xs text-tertiary">Footer: {t.footerText}</p>
                )}
                <p className="text-xs text-tertiary">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><FileText size={28} /></div>
            <h3 style={{ marginBottom: 4 }}>No templates</h3>
            <p className="text-sm text-secondary">Create a message template to use in campaigns.</p>
          </div>
        )}
      </div>

      {/* Create Template Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Create Template</h3>
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
                  <label className="form-label">Template Name *</label>
                  <input className="input" placeholder="welcome_message" value={formName}
                    onChange={(e) => setFormName(e.target.value)} required />
                </div>
                <div className="flex gap-4">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Language</label>
                    <select className="select" value={formLang} onChange={(e) => setFormLang(e.target.value)}>
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="pt">Portuguese</option>
                      <option value="hi">Hindi</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Category</label>
                    <select className="select" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                      <option value="MARKETING">Marketing</option>
                      <option value="UTILITY">Utility</option>
                      <option value="AUTHENTICATION">Authentication</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Message Body *</label>
                  <textarea className="textarea" placeholder="Hello {{1}}! Welcome to our service."
                    value={formBody} onChange={(e) => setFormBody(e.target.value)} required
                    style={{ minHeight: 120 }} />
                  <span className="text-xs text-tertiary">Use {'{{1}}'}, {'{{2}}'} etc. for variables</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Footer Text</label>
                  <input className="input" placeholder="Reply STOP to unsubscribe" value={formFooter}
                    onChange={(e) => setFormFooter(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <div className="spinner" /> : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
