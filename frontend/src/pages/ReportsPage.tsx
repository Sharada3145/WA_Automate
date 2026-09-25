import { useState, useEffect } from 'react';
import api from '../api/client';
import {
  BarChart3, Download, FileText, Search
} from 'lucide-react';

const STATUS_BADGES: Record<string, string> = {
  DRAFT: 'badge-default', SCHEDULED: 'badge-amber', IN_PROGRESS: 'badge-green',
  PAUSED: 'badge-amber', COMPLETED: 'badge-blue', STOPPED: 'badge-red', FAILED: 'badge-red',
};

export default function ReportsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/campaigns');
      setCampaigns(Array.isArray(data) ? data : []);
    } catch { setCampaigns([]); }
    setLoading(false);
  };

  const handleDownload = async (id: number, format: string) => {
    try {
      const response = await api.get(`/reports/campaigns/${id}/${format}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `campaign-${id}-report.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(`Failed to download report`);
      setTimeout(() => setError(''), 3000);
    }
  };

  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1 className="flex items-center gap-2"><BarChart3 size={24} /> Reports</h1>
          <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
            Download campaign performance reports
          </p>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 20,
            background: 'var(--red-muted)', borderRadius: 'var(--radius-md)',
            color: 'var(--red)', fontSize: '0.8125rem'
          }}>
            {error}
          </div>
        )}

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
                  <th>Export</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</td>
                    <td><span className={`badge ${STATUS_BADGES[c.status] || 'badge-default'}`}>{c.status}</span></td>
                    <td>{c.totalRecipients || 0}</td>
                    <td>{c.sentCount || 0}</td>
                    <td>{c.deliveredCount || 0}</td>
                    <td>{c.readCount || 0}</td>
                    <td>{c.failedCount || 0}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(c.id, 'csv')}
                          title="Download CSV">
                          <Download size={14} /> CSV
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(c.id, 'xlsx')}
                          title="Download XLSX">
                          <FileText size={14} /> XLSX
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(c.id, 'pdf')}
                          title="Download PDF">
                          <FileText size={14} /> PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><BarChart3 size={28} /></div>
            <h3 style={{ marginBottom: 4 }}>No campaigns</h3>
            <p className="text-sm text-secondary">Campaign reports will appear here.</p>
          </div>
        )}
      </div>
    </>
  );
}
