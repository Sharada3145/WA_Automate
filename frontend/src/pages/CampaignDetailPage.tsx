import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import {
  ArrowLeft, Play, Pause, Square, Download, FileText,
  CheckCircle, AlertCircle, Users, Send, CheckCheck, XCircle,
  Plus, X, UserPlus
} from 'lucide-react';

const STATUS_BADGES: Record<string, string> = {
  DRAFT: 'badge-default', draft: 'badge-default',
  SCHEDULED: 'badge-amber', scheduled: 'badge-amber',
  IN_PROGRESS: 'badge-green', in_progress: 'badge-green', running: 'badge-green',
  PAUSED: 'badge-amber', paused: 'badge-amber',
  COMPLETED: 'badge-blue', completed: 'badge-blue',
  STOPPED: 'badge-red', stopped: 'badge-red',
  FAILED: 'badge-red', failed: 'badge-red',
};

interface Contact {
  id: number;
  phoneNumber: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  consentGiven?: boolean;
  optOut?: boolean;
  suppressed?: boolean;
  suppression?: any;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add Recipients Modal State
  const [showAddRecipients, setShowAddRecipients] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [addingRecipients, setAddingRecipients] = useState(false);

  const loadCampaign = useCallback(async () => {
    try {
      const { data } = await api.get(`/campaigns/${id}`);
      setCampaign(data);
      if (Array.isArray(data.campaignContacts)) {
        setRecipients(data.campaignContacts);
      } else {
        setRecipients([]);
      }
    } catch {
      setError('Failed to load campaign');
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    loadCampaign().finally(() => {
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, [loadCampaign]);

  // Lightweight polling while campaign is running (every 3s, stopped when terminal or unmounted)
  useEffect(() => {
    let timerId: any = null;
    const rawStatus = (campaign?.status || '').toLowerCase();
    const isRunning = rawStatus === 'running' || rawStatus === 'in_progress';

    if (isRunning) {
      timerId = setInterval(() => {
        loadCampaign();
      }, 3000);
    }

    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [campaign?.status, loadCampaign]);


  const handleStart = async () => {
    setError('');
    setActionLoading(true);
    try {
      await api.post(`/campaigns/${id}/start`);
      setSuccess('Campaign started successfully');
      await loadCampaign();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to start campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setError('');
    setActionLoading(true);
    try {
      await api.post(`/campaigns/${id}/pause`);
      setSuccess('Campaign paused successfully');
      await loadCampaign();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to pause campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setError('');
    setActionLoading(true);
    try {
      await api.post(`/campaigns/${id}/resume`);
      setSuccess('Campaign resumed successfully');
      await loadCampaign();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to resume campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!window.confirm('Are you sure you want to stop this campaign? This action cannot be undone.')) {
      return;
    }
    setError('');
    setActionLoading(true);
    try {
      await api.post(`/campaigns/${id}/stop`);
      setSuccess('Campaign stopped successfully');
      await loadCampaign();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to stop campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const openAddRecipientsModal = async () => {
    setShowAddRecipients(true);
    setContactsLoading(true);
    setError('');
    try {
      const { data } = await api.get('/contacts');
      const contactsList: Contact[] = Array.isArray(data?.data)
        ? data.data
        : (Array.isArray(data) ? data : []);
      setAvailableContacts(contactsList);
    } catch {
      setAvailableContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const isContactEligible = (c: Contact) => {
    const hasConsent = c.consentGiven !== false;
    const isOptedOut = Boolean(c.optOut);
    const isSuppressed = Boolean(c.suppression || c.suppressed);
    return hasConsent && !isOptedOut && !isSuppressed;
  };

  const toggleSelectContact = (contactId: number) => {
    setSelectedContactIds(prev =>
      prev.includes(contactId) ? prev.filter(x => x !== contactId) : [...prev, contactId]
    );
  };

  const toggleSelectAllEligible = () => {
    const eligibleIds = availableContacts.filter(isContactEligible).map(c => c.id);
    const allSelected = eligibleIds.every(id => selectedContactIds.includes(id));
    if (allSelected) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(eligibleIds);
    }
  };

  const handleAddRecipientsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedContactIds.length === 0) return;
    setAddingRecipients(true);
    setError('');
    try {
      await api.post(`/campaigns/${id}/contacts`, { contactIds: selectedContactIds });
      setSuccess('Recipients added successfully');
      setShowAddRecipients(false);
      setSelectedContactIds([]);
      await loadCampaign();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to add recipients');
    } finally {
      setAddingRecipients(false);
    }
  };

  const handleDownload = async (format: string) => {
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
      setError(`Failed to download ${format.toUpperCase()} report`);
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

  if (!campaign) {
    return (
      <div className="page-body">
        <p className="text-secondary">Campaign not found.</p>
      </div>
    );
  }

  const rawStatus = (campaign.status || '').toLowerCase();
  const isDraft = rawStatus === 'draft' || rawStatus === 'scheduled';
  const isRunning = rawStatus === 'running' || rawStatus === 'in_progress';
  const isPaused = rawStatus === 'paused';

  const recipientCount = campaign.totalRecipients || recipients.length || 0;

  const stats = [
    { label: 'Recipients', value: recipientCount, icon: Users, color: 'var(--blue)', bg: 'var(--blue-muted)' },
    { label: 'Sent', value: campaign.sentCount || 0, icon: Send, color: 'var(--teal)', bg: 'var(--teal-muted)' },
    { label: 'Delivered', value: campaign.deliveredCount || 0, icon: CheckCheck, color: 'var(--green)', bg: 'var(--green-muted)' },
    { label: 'Read', value: campaign.readCount || 0, icon: CheckCheck, color: 'var(--blue)', bg: 'var(--blue-muted)' },
    { label: 'Failed', value: campaign.failedCount || 0, icon: XCircle, color: 'var(--red)', bg: 'var(--red-muted)' },
  ];

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate('/campaigns')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>{campaign.name}</h1>
            <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
              <span className={`badge ${STATUS_BADGES[campaign.status] || 'badge-default'}`}>
                {campaign.status}
              </span>
              <span className="text-sm text-tertiary">
                Created {new Date(campaign.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls Header */}
        <div className="flex gap-2 items-center">
          {/* Draft controls */}
          {isDraft && (
            <>
              <button
                className="btn btn-secondary btn-sm flex items-center gap-1"
                onClick={openAddRecipientsModal}
              >
                <UserPlus size={16} /> Add Recipients
              </button>
              <button
                className="btn btn-primary btn-sm flex items-center gap-1"
                disabled={recipientCount === 0 || actionLoading}
                onClick={handleStart}
                title={
                  recipientCount === 0
                    ? 'At least one eligible recipient is required to start the campaign'
                    : 'Start Campaign'
                }
              >
                {actionLoading ? <div className="spinner" /> : <><Play size={16} /> Start Campaign</>}
              </button>
            </>
          )}

          {/* Running controls */}
          {isRunning && (
            <>
              <button
                className="btn btn-secondary btn-sm flex items-center gap-1"
                disabled={actionLoading}
                onClick={handlePause}
              >
                {actionLoading ? <div className="spinner" /> : <><Pause size={16} /> Pause</>}
              </button>
              <button
                className="btn btn-danger btn-sm flex items-center gap-1"
                disabled={actionLoading}
                onClick={handleStop}
              >
                {actionLoading ? <div className="spinner" /> : <><Square size={16} /> Stop</>}
              </button>
            </>
          )}

          {/* Paused controls */}
          {isPaused && (
            <>
              <button
                className="btn btn-primary btn-sm flex items-center gap-1"
                disabled={actionLoading}
                onClick={handleResume}
              >
                {actionLoading ? <div className="spinner" /> : <><Play size={16} /> Resume</>}
              </button>
              <button
                className="btn btn-danger btn-sm flex items-center gap-1"
                disabled={actionLoading}
                onClick={handleStop}
              >
                {actionLoading ? <div className="spinner" /> : <><Square size={16} /> Stop</>}
              </button>
            </>
          )}

          {/* Report Exports */}
          <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('csv')} title="Export CSV">
            <Download size={16} /> CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('xlsx')} title="Export XLSX">
            <FileText size={16} /> XLSX
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('pdf')} title="Export PDF">
            <FileText size={16} /> PDF
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

        {/* Notice for Draft campaigns with 0 recipients */}
        {isDraft && recipientCount === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '12px 16px', marginBottom: 24,
            background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-md)',
            color: '#f59e0b', fontSize: '0.875rem', border: '1px solid rgba(245, 158, 11, 0.25)'
          }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span>This campaign is currently in draft and has 0 recipients. At least one eligible recipient is required to start the campaign.</span>
            </div>
            <button className="btn btn-secondary btn-sm flex items-center gap-1" onClick={openAddRecipientsModal}>
              <Plus size={14} /> Add Recipients
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: 32 }}>
          {stats.map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}>
                <s.icon size={20} />
              </div>
              <div className="stat-value">{s.value.toLocaleString()}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recipients Table */}
        <div className="card">
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <h3>Recipients</h3>
            {isDraft && (
              <button className="btn btn-secondary btn-sm flex items-center gap-1" onClick={openAddRecipientsModal}>
                <Plus size={14} /> Add Recipients
              </button>
            )}
          </div>

          {recipients.length > 0 ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Contact</th>
                    <th>Phone</th>
                    <th>Eligibility</th>
                    <th>Status</th>
                    <th>Sent At</th>
                    <th>Delivered At</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r: any) => {
                    const displayName = r.snapshotFirstName
                      ? `${r.snapshotFirstName} ${r.snapshotLastName || ''}`.trim()
                      : (r.contact?.firstName
                        ? `${r.contact.firstName} ${r.contact.lastName || ''}`.trim()
                        : (r.contact?.name || `Contact #${r.contactId}`));
                    const phone = r.snapshotPhone || r.contact?.phoneNumber || '—';

                    return (
                      <tr key={r.id}>
                        <td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {displayName}
                        </td>
                        <td>{phone}</td>
                        <td>
                          {r.eligible !== false ? (
                            <span className="badge badge-green">Eligible</span>
                          ) : (
                            <span className="badge badge-amber" title={r.ineligibleReason || 'Ineligible'}>
                              Ineligible ({r.ineligibleReason || 'Opted out'})
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${
                            r.status === 'DELIVERED' || r.status === 'delivered' || r.status === 'READ' || r.status === 'read' ? 'badge-green' :
                            r.status === 'FAILED' || r.status === 'failed' ? 'badge-red' :
                            r.status === 'SENT' || r.status === 'sent' ? 'badge-blue' : 'badge-default'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td>{r.sentAt ? new Date(r.sentAt).toLocaleString() : '—'}</td>
                        <td>{r.deliveredAt ? new Date(r.deliveredAt).toLocaleString() : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 30 }}>
              <div className="empty-state-icon"><Users size={28} /></div>
              <h4 style={{ marginBottom: 4 }}>No recipients added yet</h4>
              <p className="text-sm text-secondary" style={{ marginBottom: 12 }}>
                Add contacts to this campaign before starting.
              </p>
              {isDraft && (
                <button className="btn btn-secondary btn-sm flex items-center gap-1" onClick={openAddRecipientsModal}>
                  <Plus size={14} /> Add Recipients
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Recipients Modal */}
      {showAddRecipients && (
        <div className="modal-overlay" onClick={() => setShowAddRecipients(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Add Campaign Recipients</h3>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowAddRecipients(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddRecipientsSubmit}>
              <div className="modal-body flex flex-col gap-4">
                <p className="text-sm text-secondary">
                  Select eligible contacts to receive this campaign message. Suppressed or opted-out contacts cannot be selected.
                </p>

                {contactsLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="spinner" />
                  </div>
                ) : availableContacts.length === 0 ? (
                  <p className="text-sm text-tertiary p-4 text-center">No contacts found in your account.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between" style={{ paddingBottom: 4 }}>
                      <span className="text-xs text-tertiary">
                        {availableContacts.filter(isContactEligible).length} eligible contacts available
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-xs"
                        onClick={toggleSelectAllEligible}
                      >
                        Toggle Select All Eligible
                      </button>
                    </div>

                    <div style={{
                      maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)', padding: 8, display: 'flex', flexDirection: 'column', gap: 4
                    }}>
                      {availableContacts.map(c => {
                        const eligible = isContactEligible(c);
                        const name = c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : (c.name || 'Unnamed Contact');
                        const isAlreadyRecipient = recipients.some(r => r.contactId === c.id);

                        return (
                          <label
                            key={c.id}
                            className="flex items-center justify-between gap-2"
                            style={{
                              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                              background: !eligible ? 'var(--bg-elevated)' : (selectedContactIds.includes(c.id) ? 'var(--accent-muted)' : 'transparent'),
                              opacity: !eligible ? 0.6 : 1,
                              cursor: eligible ? 'pointer' : 'not-allowed',
                              fontSize: '0.875rem'
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={!eligible}
                                checked={selectedContactIds.includes(c.id)}
                                onChange={() => eligible && toggleSelectContact(c.id)}
                              />
                              <div>
                                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{name}</div>
                                <div className="text-xs text-tertiary">{c.phoneNumber}</div>
                              </div>
                            </div>
                            <div>
                              {!eligible ? (
                                <span className="badge badge-amber text-xs">
                                  {c.optOut ? 'Opted Out' : (c.suppressed || c.suppression ? 'Suppressed' : 'No Consent')}
                                </span>
                              ) : isAlreadyRecipient ? (
                                <span className="badge badge-default text-xs">Already Added</span>
                              ) : (
                                <span className="badge badge-green text-xs">Eligible</span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddRecipients(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={selectedContactIds.length === 0 || addingRecipients}
                >
                  {addingRecipients ? <div className="spinner" /> : `Add ${selectedContactIds.length} Selected`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
