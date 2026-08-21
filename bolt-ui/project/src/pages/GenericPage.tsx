import { Search, Plus, Download, Filter } from 'lucide-react';
import { useState } from 'react';

interface Props {
  title: string;
  description?: string;
  columns?: string[];
  rows?: { id: string; cells: string[] }[];
  kpis?: { label: string; value: string; color?: string }[];
}

const DEFAULT_COLUMNS = ['ID', 'Reference', 'Description', 'Amount', 'Status', 'Date'];

const SAMPLE_ROWS = [
  { id: '1', cells: ['REF-001', 'QTN-2026-001', 'Process Engineering Study', 'AED 120,000', 'Active', '2026-08-12'] },
  { id: '2', cells: ['REF-002', 'QTN-2026-002', 'Pipeline Assessment', 'AED 380,000', 'Pending', '2026-08-10'] },
  { id: '3', cells: ['REF-003', 'QTN-2026-003', 'Structural Review', 'AED 85,000', 'Closed', '2026-08-05'] },
  { id: '4', cells: ['REF-004', 'QTN-2026-004', 'Electrical Audit', 'AED 210,000', 'Active', '2026-08-08'] },
  { id: '5', cells: ['REF-005', 'QTN-2026-005', 'HSE Compliance Audit', 'AED 95,000', 'Pending', '2026-08-14'] },
];

export default function GenericPage({ title, description, columns, rows, kpis }: Props) {
  const [search, setSearch] = useState('');
  const cols = columns ?? DEFAULT_COLUMNS;
  const data = rows ?? SAMPLE_ROWS;

  const filtered = data.filter(r =>
    r.cells.some(c => c.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {description ?? `${filtered.length} records`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 180 }}
              placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-secondary"><Filter size={14} /> Filter</button>
          <button className="btn-secondary"><Download size={14} /> Export</button>
          <button className="btn-primary"><Plus size={14} /> New</button>
        </div>
      </div>

      {kpis && (
        <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)', display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 12, flexShrink: 0 }}>
          {kpis.map(k => (
            <div key={k.label} className="kpi-card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color ?? 'var(--text-primary)', marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {cols.map(col => <th key={col}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} style={{ cursor: 'pointer' }}>
                  {row.cells.map((cell, i) => (
                    <td key={i} style={{ fontSize: 13 }}>
                      {cell === 'Active' ? <span className="badge badge-cyan" style={{ fontSize: 11 }}>{cell}</span> :
                       cell === 'Pending' ? <span className="badge badge-warning" style={{ fontSize: 11 }}>{cell}</span> :
                       cell === 'Closed' || cell === 'Completed' ? <span className="badge badge-success" style={{ fontSize: 11 }}>{cell}</span> :
                       cell === 'Overdue' ? <span className="badge badge-danger" style={{ fontSize: 11 }}>{cell}</span> :
                       cell.startsWith('AED ') ? <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{cell}</span> :
                       cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
