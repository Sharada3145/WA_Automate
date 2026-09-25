import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Settings, AlertTriangle, CheckCircle, AlertCircle, Shield
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [waba, setWaba] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddWaba, setShowAddWaba] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // WABA form
  const [wabaName, setWabaName] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [wabaToken, setWabaToken] = useState('');
  const [creating, setCreating] = useState(false);

  // Emergency stop
  const [stopping, setStopping] = useState(false);

  useEffect(() => { loadWaba(); }, []);

  const loadWaba = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/business-accounts');
      setWaba(Array.isArray(data) ? data : (data.data || []));
    } catch { setWaba([]); }
    setLoading(false);
  };

  const handleAddWaba = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.post('/business-accounts', {
        name: wabaName,
        accountId: wabaId,
        accessToken: wabaToken,
      });
      setShowAddWaba(false);
      setWabaName(''); setWabaId(''); setWabaToken('');
      setSuccess('Business account added');
      loadWaba();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to add business account');
    }
    setCreating(false);
  };

  const handleEmergencyStop = async () => {
    if (!confirm('EMERGENCY STOP: This will stop ALL running campaigns immediately. Are you sure?')) return;
    setStopping(true);
    try {
      await api.post('/campaigns/emergency-stop');
      setSuccess('All campaigns stopped successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Emergency stop failed');
      setTimeout(() => setError(''), 3000);
    }
    setStopping(false);
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
          <h1 className="flex items-center gap-2"><Settings size={24} /> Settings</h1>
          <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
            Manage your account and business configuration
          </p>
        </div>
      </div>

      <div className="page-body flex flex-col gap-6">
        {success && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            background: 'var(--green-muted)', borderRadius: 'var(--radius-md)',
            color: 'var(--green)', fontSize: '0.8125rem'
          }}>
            <CheckCircle size={16} /> {success}
          </div>
        )}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            background: 'var(--red-muted)', borderRadius: 'var(--radius-md)',
            color: 'var(--red)', fontSize: '0.8125rem'
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Account Info */}
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Account</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary">Name</span>
              <span className="text-sm font-medium">{user?.name || 'User'}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border-primary)' }} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary">Email</span>
              <span className="text-sm font-medium">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Business Accounts */}
        <div className="card">
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <h3 className="flex items-center gap-2"><Shield size={20} /> Business Accounts</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddWaba(true)}>
              Add Account
            </button>
          </div>
          {waba.length > 0 ? (
            <div className="flex flex-col gap-3">
              {waba.map((w: any) => (
                <div key={w.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)'
                }}>
                  <div>
                    <div className="font-medium text-sm">{w.name}</div>
                    <div className="text-xs text-tertiary">WABA ID: {w.accountId || w.wabaId}</div>
                  </div>
                  <span className="badge badge-green">Active</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary" style={{ padding: 16, textAlign: 'center' }}>
              No business accounts configured
            </p>
          )}
        </div>

        {/* Emergency Stop */}
        <div className="card" style={{ borderColor: 'var(--red)', background: 'var(--red-muted)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2" style={{ color: 'var(--red)' }}>
                <AlertTriangle size={20} /> Emergency Stop
              </h3>
              <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
                Immediately stop all running campaigns. This action cannot be undone.
              </p>
            </div>
            <button className="btn btn-danger" onClick={handleEmergencyStop} disabled={stopping}>
              {stopping ? <div className="spinner" /> : 'STOP ALL'}
            </button>
          </div>
        </div>
      </div>

      {/* Add WABA Modal */}
      {showAddWaba && (
        <div className="modal-overlay" onClick={() => setShowAddWaba(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Business Account</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowAddWaba(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleAddWaba}>
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
                  <label className="form-label">Account Name *</label>
                  <input className="input" placeholder="My Business" value={wabaName}
                    onChange={(e) => setWabaName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">WABA ID *</label>
                  <input className="input" placeholder="123456789" value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Access Token *</label>
                  <input className="input" type="password" placeholder="EAAxxxxxxxx..." value={wabaToken}
                    onChange={(e) => setWabaToken(e.target.value)} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddWaba(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <div className="spinner" /> : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
