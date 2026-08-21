import { useState } from 'react';
import { Search, Download, BarChart2, Table as TableIcon, Plus } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { PROJECTS, WORKLOAD_DATA, REVENUE_DATA } from '../data/mock';

const customTooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5 };

const REPORT_CATALOG = [
  { id: 'emp', name: 'Employee Report', desc: 'Headcount, utilization, department breakdown', icon: '👥', category: 'HR' },
  { id: 'ts', name: 'Timesheet Report', desc: 'Hours logged, overtime, billable vs non-billable', icon: '⏰', category: 'HR' },
  { id: 'mh', name: 'Manhours Billing', desc: 'Project-wise manhour consumption vs budget', icon: '💰', category: 'Finance' },
  { id: 'bal', name: 'Outstanding Balances', desc: 'AR aging, client-wise outstanding analysis', icon: '📊', category: 'Finance' },
  { id: 'ps', name: 'Project Status', desc: 'Phase, progress, health across all projects', icon: '📁', category: 'Projects' },
  { id: 'att', name: 'Attendance Report', desc: 'Present/absent/leave patterns, OT hours', icon: '✅', category: 'HR' },
];

const SAVED_REPORTS = [
  { id: 1, name: 'Q2 2026 Revenue Summary', date: '2026-07-01', author: 'Sara Mohammed' },
  { id: 2, name: 'ADNOC Project Manhours', date: '2026-08-10', author: 'Ahmed Al-Rashidi' },
  { id: 3, name: 'Overdue Invoices Aug', date: '2026-08-15', author: 'Layla Ibrahim' },
];

const DEPT_DATA = [
  { name: 'Engineering', count: 5, color: '#64126D' },
  { name: 'PMO', count: 1, color: '#86288F' },
  { name: 'HSE', count: 1, color: '#DC2626' },
  { name: 'Admin', count: 1, color: '#475569' },
];

export default function Reports() {
  const [selected, setSelected] = useState('emp');
  const [mode, setMode] = useState<'chart' | 'table'>('chart');
  const [search, setSearch] = useState('');

  const filteredCatalog = REPORT_CATALOG.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) || r.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Reporting Center</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{REPORT_CATALOG.length} reports available · {SAVED_REPORTS.length} saved</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary"><Download size={14} /> Export</button>
          <button className="btn-primary"><Plus size={14} /> Save Report</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Report catalog */}
        <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
              <Search size={13} style={{ color: 'var(--text-muted)' }} />
              <input style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: '100%' }}
                placeholder="Search reports..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div style={{ padding: '8px 12px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Report Catalog</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
            {filteredCatalog.map(r => (
              <button key={r.id} onClick={() => setSelected(r.id)}
                className={`sidebar-link ${selected === r.id ? 'active' : ''}`}
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <span style={{ fontSize: 16 }}>{r.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{r.name}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'left' }}>{r.desc}</span>
                <span className="badge badge-steel" style={{ fontSize: 9, marginTop: 2 }}>{r.category}</span>
              </button>
            ))}
          </div>

          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Saved Reports</div>
          <div style={{ padding: '0 8px 12px', maxHeight: 160, overflowY: 'auto' }}>
            {SAVED_REPORTS.map(r => (
              <button key={r.id} className="sidebar-link" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '8px 12px' }}>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{r.name}</span>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{r.author} · {r.date}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Report viewer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart2 size={16} style={{ color: 'var(--brand-primary)' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>{REPORT_CATALOG.find(r => r.id === selected)?.name}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-ghost" style={{ fontSize: 12, background: mode === 'chart' ? 'var(--surface-secondary)' : undefined, padding: '5px 10px' }} onClick={() => setMode('chart')}>
                <BarChart2 size={13} /> Chart
              </button>
              <button className="btn-ghost" style={{ fontSize: 12, background: mode === 'table' ? 'var(--surface-secondary)' : undefined, padding: '5px 10px' }} onClick={() => setMode('table')}>
                <TableIcon size={13} /> Table
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { label: 'Total Employees', value: '8' },
                { label: 'Avg Utilization', value: '76%' },
                { label: 'Departments', value: '4' },
                { label: 'Active Engineers', value: '5' },
              ].map(k => (
                <div key={k.label} className="kpi-card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {mode === 'chart' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Utilization by Engineer</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={WORKLOAD_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} width={30} unit="%" />
                      <Tooltip contentStyle={customTooltipStyle} />
                      <Bar dataKey="utilization" fill="#64126D" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Department Distribution</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={DEPT_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="count">
                        {DEPT_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={customTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="card" style={{ padding: '18px 20px', gridColumn: '1 / -1' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Revenue Trend</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={REVENUE_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} width={44} />
                      <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [`AED ${(Number(v) / 1000000).toFixed(2)}M`, '']} />
                      <Line type="monotone" dataKey="revenue" stroke="#64126D" strokeWidth={2.5} dot={{ fill: '#64126D', r: 4 }} />
                      <Line type="monotone" dataKey="target" stroke="#06B6D4" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr><th>Employee</th><th>Role</th><th>Department</th><th>Location</th><th>Utilization</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {PROJECTS.slice(0, 4).map((p, i) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.manager}</td>
                        <td>{['PM', 'Engineer', 'Engineer', 'Engineer'][i]}</td>
                        <td><span className="badge badge-steel" style={{ fontSize: 11 }}>{p.discipline}</span></td>
                        <td>{p.location}</td>
                        <td>{[92, 87, 74, 81][i]}%</td>
                        <td><span className="badge badge-success" style={{ fontSize: 11 }}>Active</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
