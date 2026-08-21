import { useState } from 'react';
import { Plus, Search, FileText } from 'lucide-react';
import { PROPOSALS } from '../data/mock';

const STATUS_BADGE: Record<string, string> = {
  Draft: 'badge-neutral',
  Submitted: 'badge-info',
  Negotiation: 'badge-warning',
  Won: 'badge-success',
  Lost: 'badge-danger',
};

function fmt(n: number) {
  if (n >= 1000000) return `AED ${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `AED ${(n / 1000).toFixed(0)}K`;
  return `AED ${n}`;
}

export default function Proposals() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const statuses = ['All', 'Draft', 'Submitted', 'Negotiation', 'Won', 'Lost'];
  const filtered = PROPOSALS.filter(p =>
    (statusFilter === 'All' || p.status === statusFilter) &&
    (p.title.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase()))
  );

  const totalValue = PROPOSALS.reduce((s, p) => s + p.value, 0);
  const avgMargin = Math.round(PROPOSALS.reduce((s, p) => s + p.margin, 0) / PROPOSALS.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Proposals</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {PROPOSALS.length} proposals · {fmt(totalValue)} total value · {avgMargin}% avg margin
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13 }}
              placeholder="Search proposals..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary"><Plus size={14} /> New Proposal</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, flexShrink: 0 }}>
        {statuses.filter(s => s !== 'All').map(status => {
          const count = PROPOSALS.filter(p => p.status === status).length;
          const val = PROPOSALS.filter(p => p.status === status).reduce((s, p) => s + p.value, 0);
          return (
            <div key={status} className="card" style={{ padding: '12px 14px', cursor: 'pointer', border: statusFilter === status ? '1.5px solid var(--brand-primary)' : undefined }}
              onClick={() => setStatusFilter(s => s === status ? 'All' : status)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span className={`badge ${STATUS_BADGE[status]}`} style={{ fontSize: 10 }}>{status}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{count}</span>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{fmt(val)}</div>
            </div>
          );
        })}
      </div>

      {/* Status filter tabs */}
      <div style={{ padding: '0 28px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, flexShrink: 0 }}>
        <div className="tab-nav" style={{ borderBottom: 'none' }}>
          {statuses.map(s => (
            <button key={s} className={`tab-btn ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Proposal Title</th>
                <th>Client</th>
                <th>Value</th>
                <th>Margin</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Submitted</th>
                <th>Expected Close</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12.5, color: 'var(--brand-primary)', fontWeight: 600 }}>{p.id}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{p.client}</td>
                  <td style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--brand-primary)' }}>{fmt(p.value)}</td>
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 600, color: p.margin >= 40 ? 'var(--success)' : p.margin >= 25 ? 'var(--text-primary)' : 'var(--warning)' }}>
                      {p.margin}%
                    </span>
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[p.status]}`} style={{ fontSize: 11 }}>{p.status}</span></td>
                  <td style={{ fontSize: 13 }}>{p.assignee}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{p.submittedDate ?? '—'}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{p.expectedClose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
