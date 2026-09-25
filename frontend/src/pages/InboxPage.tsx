import { useState, useEffect } from 'react';
import api from '../api/client';
import { MessageSquare, RefreshCw } from 'lucide-react';

interface IncomingMsg {
  id: number;
  fromNumber?: string;
  from?: string;
  content?: string;
  bodyText?: string;
  body?: string;
  waMessageId?: string;
  receivedAt?: string;
  createdAt?: string;
  timestamp?: string;
  contact?: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  };
}

export default function InboxPage() {
  const [messages, setMessages] = useState<IncomingMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IncomingMsg | null>(null);

  useEffect(() => { loadMessages(); }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/inbox');
      setMessages(Array.isArray(data) ? data : (data.data || []));
    } catch {
      setMessages([]);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  const getSenderName = (msg: IncomingMsg) => {
    if (msg.contact?.firstName) {
      return `${msg.contact.firstName} ${msg.contact.lastName || ''}`.trim();
    }
    return msg.fromNumber || msg.from || msg.contact?.phoneNumber || 'Unknown Sender';
  };

  const getMsgBody = (msg: IncomingMsg) => {
    return msg.content || msg.bodyText || msg.body || 'No message content';
  };

  const getMsgTime = (msg: IncomingMsg) => {
    return msg.receivedAt || msg.createdAt || msg.timestamp || '';
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="flex items-center gap-2"><MessageSquare size={24} /> Inbox</h1>
          <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
            {messages.length} incoming messages
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadMessages}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, minHeight: 400 }}>
          {/* Message List */}
          <div style={{
            border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              padding: '12px 16px', background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border-primary)',
              fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              Messages
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {messages.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <div className="empty-state-icon"><MessageSquare size={28} /></div>
                  <p className="text-sm text-secondary">No incoming messages yet</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    onClick={() => setSelected(msg)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-primary)',
                      cursor: 'pointer',
                      background: selected?.id === msg.id ? 'var(--accent-muted)' : 'transparent',
                      transition: 'var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      if (selected?.id !== msg.id) e.currentTarget.style.background = 'var(--bg-card-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (selected?.id !== msg.id) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {getSenderName(msg)}
                      </span>
                      <span className="text-xs text-tertiary">
                        {getMsgTime(msg) ? new Date(getMsgTime(msg)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-sm text-secondary truncate">{getMsgBody(msg)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Message Detail */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            {selected ? (
              <>
                <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                  <h3>{getSenderName(selected)}</h3>
                  <span className="text-xs text-tertiary">
                    {getMsgTime(selected) ? new Date(getMsgTime(selected)).toLocaleString() : ''}
                  </span>
                </div>
                <div style={{
                  background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                  padding: 16, flex: 1, lineHeight: 1.6, fontSize: '0.9375rem',
                  color: 'var(--text-primary)'
                }}>
                  {getMsgBody(selected)}
                </div>
                {selected.waMessageId && (
                  <div className="flex gap-2" style={{ marginTop: 12 }}>
                    <span className="text-xs text-tertiary">WhatsApp ID: {selected.waMessageId}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center" style={{ flex: 1 }}>
                <p className="text-sm text-tertiary">Select a message to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
