import { useState } from 'react';
import { Search, Send, Plus, Hash } from 'lucide-react';

const THREADS = [
  { id: 1, name: 'ADNOC Gas Plant Expansion', lastMsg: 'P&ID Rev B is ready for client review', time: '10m', unread: 3, members: 4, color: '#64126D' },
  { id: 2, name: 'Ruwais Refinery Team', lastMsg: 'HAZOP study draft uploaded', time: '1h', unread: 1, members: 6, color: '#86288F' },
  { id: 3, name: 'Finance & Accounts', lastMsg: 'INV-2026-002 is overdue', time: '3h', unread: 0, members: 3, color: '#DC2626' },
  { id: 4, name: 'Engineering Leads', lastMsg: 'Resource allocation for Sept', time: 'Yesterday', unread: 0, members: 5, color: '#06B6D4' },
];

const MESSAGES = [
  { id: 1, sender: 'Ahmed Al-Rashidi', avatar: 'AA', color: '#64126D', text: 'P&ID Rev B is ready for client review. I have uploaded it to Aconex.', time: '10:32 AM' },
  { id: 2, sender: 'Sara Mohammed', avatar: 'SM', color: '#86288F', text: 'Great work. Let me schedule the client review meeting for Thursday.', time: '10:45 AM' },
  { id: 3, sender: 'Khalid Al-Mansouri', avatar: 'KM', color: '#475569', text: 'I have started the instrumentation index. Will need the P&ID to finalize tagging.', time: '11:02 AM' },
  { id: 4, sender: 'Sara Mohammed', avatar: 'SM', color: '#86288F', text: 'Ahmed, can you share the revision notes as well?', time: '11:15 AM' },
];

export default function Messages() {
  const [active, setActive] = useState(1);
  const [search, setSearch] = useState('');

  const filteredThreads = THREADS.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Threads sidebar */}
      <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Messages</h2>
            <button className="btn-primary" style={{ padding: '5px 10px', fontSize: 12 }}><Plus size={13} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%' }}
              placeholder="Search threads..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredThreads.map(t => (
            <button key={t.id} onClick={() => setActive(t.id)}
              className="sidebar-link" style={{
                flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '12px 16px',
                borderRadius: 0, background: active === t.id ? 'var(--surface-secondary)' : undefined,
                borderBottom: '1px solid var(--border-subtle)',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Hash size={13} style={{ color: t.color }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: active === t.id ? 'var(--brand-primary)' : 'var(--text-primary)' }}>{t.name}</span>
                </div>
                {t.unread > 0 && (
                  <span style={{ background: 'var(--brand-primary)', color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '0 6px', lineHeight: '16px' }}>{t.unread}</span>
                )}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'left' }}>{t.lastMsg}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{t.time} · {t.members} members</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Hash size={16} style={{ color: 'var(--brand-primary)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{THREADS.find(t => t.id === active)?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{THREADS.find(t => t.id === active)?.members} members</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {MESSAGES.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 12 }}>
              <div className="avatar" style={{ background: m.color, width: 34, height: 34, fontSize: 12, flexShrink: 0 }}>{m.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{m.sender}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.time}</span>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.5 }}>{m.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 10 }}>
          <input className="input-base" style={{ flex: 1 }} placeholder="Type a message..." />
          <button className="btn-primary"><Send size={14} /> Send</button>
        </div>
      </div>
    </div>
  );
}
