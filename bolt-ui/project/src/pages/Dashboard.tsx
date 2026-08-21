import { TrendingUp, TrendingDown, FolderKanban, Users, DollarSign, AlertCircle, FileText, Zap } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { REVENUE_DATA, PROJECT_STATUS_DATA, WORKLOAD_DATA, ACTIVITIES, DELIVERABLES, INVOICES, PROJECTS } from '../data/mock';

function KPICard({ title, value, sub, trend, trendLabel, icon, iconColor, accent }: {
  title: string; value: string; sub?: string; trend?: 'up' | 'down'; trendLabel?: string;
  icon: React.ReactNode; iconColor: string; accent?: string;
}) {
  return (
    <div className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginTop: 4 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: accent || iconColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor }}>
          {icon}
        </div>
      </div>
      {trendLabel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend === 'up' ? <TrendingUp size={13} className="stat-trend-up" /> : <TrendingDown size={13} className="stat-trend-down" />}
          <span style={{ fontSize: 12, fontWeight: 500, color: trend === 'up' ? 'var(--success)' : 'var(--danger)' }}>{trendLabel}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>vs last month</span>
        </div>
      )}
    </div>
  );
}

const customTooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12.5,
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
};

function fmt(n: number) {
  if (n >= 1000000) return `AED ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `AED ${(n / 1000).toFixed(0)}K`;
  return `AED ${n}`;
}

export default function Dashboard({ onNavigate }: { onNavigate: (p: string) => void }) {
  const overdue = INVOICES.filter(i => i.status === 'Overdue');
  const overdueTotal = overdue.reduce((s, i) => s + i.amount, 0);

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard title="Active Projects" value="4" sub="7 total projects" trend="up" trendLabel="+2" icon={<FolderKanban size={20} />} iconColor="#64126D" />
        <KPICard title="Open Leads" value="8" sub="AED 22.1M pipeline" trend="up" trendLabel="+3" icon={<Users size={20} />} iconColor="#06B6D4" />
        <KPICard title="Revenue MTD" value="AED 1.65M" sub="vs AED 2.0M target" trend="down" trendLabel="-17.5%" icon={<DollarSign size={20} />} iconColor="#16A34A" />
        <KPICard title="Outstanding" value={`AED ${(overdueTotal / 1000).toFixed(0)}K`} sub={`${overdue.length} overdue invoices`} trend="down" trendLabel="Overdue" icon={<AlertCircle size={20} />} iconColor="#DC2626" />
        <KPICard title="Utilization" value="76%" sub="Avg across 7 engineers" trend="up" trendLabel="+4%" icon={<Zap size={20} />} iconColor="#F59E0B" />
        <KPICard title="Proposals" value="4" sub="2 submitted, 1 negotiation" icon={<FileText size={20} />} iconColor="#86288F" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Revenue Trend */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Revenue Trend</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 6 months · AED</div>
            </div>
            <span className="badge badge-purple">MTD</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={REVENUE_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64126D" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#64126D" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tgtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} width={42} />
              <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [`AED ${(Number(v) / 1000000).toFixed(2)}M`, '']} />
              <Area type="monotone" dataKey="revenue" stroke="#64126D" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
              <Area type="monotone" dataKey="target" stroke="#06B6D4" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#tgtGrad)" name="Target" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Project Status */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Project Status</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Distribution</div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={PROJECT_STATUS_DATA} cx="50%" cy="50%" innerRadius={42} outerRadius={60} paddingAngle={3} dataKey="value">
                {PROJECT_STATUS_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={customTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {PROJECT_STATUS_DATA.map(item => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                </div>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workload */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Engineer Workload</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Utilization %</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={WORKLOAD_DATA} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [`${v}%`, 'Utilization']} />
              <Bar dataKey="utilization" radius={[0, 4, 4, 0]}>
                {WORKLOAD_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.utilization >= 90 ? '#DC2626' : entry.utilization >= 80 ? '#64126D' : entry.utilization >= 70 ? '#86288F' : '#06B6D4'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row: Activity + Upcoming + Projects */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr', gap: 16 }}>
        {/* Activity Feed */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div className="section-header">
            <span style={{ fontWeight: 700, fontSize: 14 }}>Activity Feed</span>
            <button className="btn-ghost" style={{ fontSize: 12 }}>View all</button>
          </div>
          {ACTIVITIES.map(a => (
            <div key={a.id} className="timeline-item">
              <div className="avatar" style={{ background: a.color, width: 28, height: 28, fontSize: 10, flexShrink: 0 }}>{a.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>{a.message}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.user} · {a.time}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Upcoming */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div className="section-header">
            <span style={{ fontWeight: 700, fontSize: 14 }}>Upcoming Deadlines</span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Deliverables</div>
            {DELIVERABLES.map(d => (
              <div key={d.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{d.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{d.project}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Due {d.dueDate}</span>
                  <span className={`badge ${d.status === 'In Progress' ? 'badge-purple' : d.status === 'Pending Review' ? 'badge-warning' : 'badge-neutral'}`}
                    style={{ fontSize: 10 }}>{d.status}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Overdue Invoices</div>
            {INVOICES.filter(i => i.status === 'Overdue').map(inv => (
              <div key={inv.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{inv.id}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.client} · {inv.aging}d overdue</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)' }}>{fmt(inv.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Projects */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div className="section-header">
            <span style={{ fontWeight: 700, fontSize: 14 }}>Active Projects</span>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => onNavigate('projects')}>View all</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PROJECTS.filter(p => p.status === 'active').map(p => (
              <div key={p.id} className="card" style={{ padding: '12px 14px', cursor: 'pointer', border: '1px solid var(--border-subtle)' }}
                onClick={() => onNavigate('project-detail')}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{p.client} · {p.phase}</div>
                  </div>
                  <span className={`badge ${p.priority === 'high' ? 'badge-danger' : p.priority === 'medium' ? 'badge-warning' : 'badge-neutral'}`}
                    style={{ fontSize: 10 }}>{p.priority}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div className="progress-bar-fill" style={{ width: `${p.progress}%`, background: p.progress > 80 ? '#16A34A' : 'var(--brand-primary)' }} />
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 32 }}>{p.progress}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{fmt(p.budget)} budget</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Due {p.endDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
