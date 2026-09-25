import { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Users, Megaphone, Send, Inbox,
  Clock, BarChart3, AlertCircle
} from 'lucide-react';

interface DashboardStats {
  totalContacts: number;
  totalCampaigns: number;
  messagesSent: number;
  incomingMessages: number;
  recentCampaigns: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dashboard');
      setStats({
        totalContacts: data.totalContacts || 0,
        totalCampaigns: data.totalCampaigns || 0,
        messagesSent: data.messagesSent || 0,
        incomingMessages: data.incomingMessages || 0,
        recentCampaigns: Array.isArray(data.recentCampaigns) ? data.recentCampaigns : [],
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Contacts', value: stats?.totalContacts || 0, icon: Users, color: 'var(--blue)', bg: 'var(--blue-muted)' },
    { label: 'Total Campaigns', value: stats?.totalCampaigns || 0, icon: Megaphone, color: 'var(--accent)', bg: 'var(--accent-muted)' },
    { label: 'Messages Sent', value: stats?.messagesSent || 0, icon: Send, color: 'var(--teal)', bg: 'var(--teal-muted)' },
    { label: 'Incoming Messages', value: stats?.incomingMessages || 0, icon: Inbox, color: 'var(--green)', bg: 'var(--green-muted)' },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: 'badge-default',
      SCHEDULED: 'badge-amber',
      IN_PROGRESS: 'badge-green',
      PAUSED: 'badge-amber',
      COMPLETED: 'badge-blue',
      STOPPED: 'badge-red',
      FAILED: 'badge-red',
    };
    return map[status] || 'badge-default';
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-sm text-secondary" style={{ marginTop: 4 }}>Overview of your WhatsApp automation system</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={loadDashboard}>
            <Clock size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            marginBottom: 20, background: 'var(--red-muted)', borderRadius: 'var(--radius-md)',
            color: 'var(--red)', fontSize: '0.8125rem'
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: 32 }}>
          {statCards.map((card) => (
            <div className="stat-card" key={card.label}>
              <div className="stat-icon" style={{ background: card.bg, color: card.color }}>
                <card.icon size={20} />
              </div>
              <div className="stat-value">{card.value.toLocaleString()}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Campaigns */}
        <div className="card">
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <h3 className="flex items-center gap-2">
              <BarChart3 size={20} /> Recent Campaigns
            </h3>
          </div>

          {stats?.recentCampaigns && stats.recentCampaigns.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Status</th>
                    <th>Recipients</th>
                    <th>Sent</th>
                    <th>Delivered</th>
                    <th>Failed</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentCampaigns.map((c: any) => (
                    <tr key={c.id}>
                      <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</td>
                      <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                      <td>{c.totalRecipients || 0}</td>
                      <td>{c.sentCount || 0}</td>
                      <td>{c.deliveredCount || 0}</td>
                      <td>{c.failedCount || 0}</td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-icon">
                <Megaphone size={28} />
              </div>
              <p className="text-secondary text-sm">No campaigns yet. Create your first campaign to get started.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
