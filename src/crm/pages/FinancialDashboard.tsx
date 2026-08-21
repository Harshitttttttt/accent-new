import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react'
import { INVOICES, EXPENSES } from '../data/mock'

function fmt(n: number) {
  if (n >= 1000000) return `AED ${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `AED ${(n / 1000).toFixed(0)}K`
  return `AED ${n}`
}

const customTooltipStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5,
}

const AGING_DATA = [
  { bucket: '0-30 days', amount: 1890000 },
  { bucket: '31-60 days', amount: 875000 },
  { bucket: '61-90 days', amount: 420000 },
  { bucket: '>90 days', amount: 360000 },
]

const CASHFLOW_DATA = [
  { month: 'Apr', inflow: 2340000, outflow: 1200000 },
  { month: 'May', inflow: 1980000, outflow: 980000 },
  { month: 'Jun', inflow: 2750000, outflow: 1450000 },
  { month: 'Jul', inflow: 2100000, outflow: 1100000 },
  { month: 'Aug', inflow: 1650000, outflow: 890000 },
]

const STATUS_BADGE: Record<string, string> = {
  Paid: 'badge-success',
  Pending: 'badge-warning',
  Overdue: 'badge-danger',
}

export default function FinancialDashboard() {
  const totalInvoiced = INVOICES.reduce((s, i) => s + i.amount, 0)
  const totalPaid = INVOICES.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0)
  const totalPending = INVOICES.filter(i => i.status === 'Pending').reduce((s, i) => s + i.amount, 0)
  const totalOverdue = INVOICES.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0)
  const totalExpenses = EXPENSES.reduce((s, e) => s + e.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Financial Dashboard</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Invoices, payments, cashflow · August 2026</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-secondary">Export PDF</button>
          <button type="button" className="btn-secondary">Export Excel</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {[
            { label: 'Total Invoiced', value: fmt(totalInvoiced), icon: <TrendingUp size={18} />, color: 'var(--brand-primary)', badge: null },
            { label: 'Paid', value: fmt(totalPaid), icon: <CheckCircle size={18} />, color: 'var(--success)', badge: 'badge-success' },
            { label: 'Pending', value: fmt(totalPending), icon: <TrendingUp size={18} />, color: 'var(--warning)', badge: 'badge-warning' },
            { label: 'Overdue', value: fmt(totalOverdue), icon: <AlertCircle size={18} />, color: 'var(--danger)', badge: 'badge-danger' },
            { label: 'Expenses MTD', value: fmt(totalExpenses), icon: <TrendingDown size={18} />, color: 'var(--brand-steel)', badge: null },
          ].map(kpi => (
            <div key={kpi.label} className="kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kpi.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color, marginTop: 4 }}>{kpi.value}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `color-mix(in srgb, ${kpi.color} 14%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                  {kpi.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          {/* Cashflow */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Cash Flow</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Inflow vs Outflow · AED</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={CASHFLOW_DATA} barGap={4}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} width={44} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [fmt(Number(v)), '']} />
                <Bar dataKey="inflow" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} name="Inflow" />
                <Bar dataKey="outflow" fill="var(--border)" radius={[4, 4, 0, 0]} name="Outflow" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Aging */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>AR Aging Buckets</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Accounts receivable</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {AGING_DATA.map((b, i) => {
                const colors = ['var(--brand-primary)', 'var(--warning)', 'var(--danger)', 'var(--danger-soft-fg)']
                const pct = Math.round((b.amount / AGING_DATA.reduce((s, x) => s + x.amount, 0)) * 100)
                return (
                  <div key={b.bucket}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{b.bucket}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: colors[i] }}>{fmt(b.amount)}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}%</span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: colors[i] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Invoice List */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Sale Invoices</span>
            <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>+ New Invoice</button>
          </div>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Project</th>
                <th>Client</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Issued</th>
                <th>Due Date</th>
                <th>Aging (days)</th>
              </tr>
            </thead>
            <tbody>
              {INVOICES.map(inv => (
                <tr key={inv.id} style={{ cursor: 'pointer' }}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12.5, color: 'var(--brand-primary)', fontWeight: 600 }}>{inv.id}</span></td>
                  <td style={{ fontSize: 13 }}>{inv.project}</td>
                  <td style={{ fontSize: 13 }}>{inv.client}</td>
                  <td style={{ fontSize: 13.5, fontWeight: 700 }}>{fmt(inv.amount)}</td>
                  <td><span className={`badge ${STATUS_BADGE[inv.status]}`} style={{ fontSize: 11 }}>{inv.status}</span></td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{inv.issuedDate}</td>
                  <td style={{ fontSize: 12.5, color: inv.status === 'Overdue' ? 'var(--danger)' : 'var(--text-secondary)' }}>{inv.dueDate}</td>
                  <td>
                    {inv.aging > 0 ? (
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: inv.aging > 30 ? 'var(--danger)' : 'var(--warning)' }}>{inv.aging}d</span>
                    ) : (
                      <span style={{ fontSize: 12.5, color: 'var(--success)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expenses */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Recent Expenses</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="badge badge-warning">3 Pending Approval</span>
              <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }}>+ Submit Expense</button>
            </div>
          </div>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th>ID</th><th>Description</th><th>Category</th><th>Employee</th><th>Project</th><th>Amount</th><th>Date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {EXPENSES.map(e => (
                <tr key={e.id}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{e.id}</span></td>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>{e.description}</td>
                  <td><span className="badge badge-steel" style={{ fontSize: 11 }}>{e.category}</span></td>
                  <td style={{ fontSize: 13 }}>{e.employee}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{e.project}</td>
                  <td style={{ fontSize: 13.5, fontWeight: 700 }}>AED {e.amount.toLocaleString()}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{e.date}</td>
                  <td>
                    <span className={`badge ${e.status === 'Approved' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11 }}>{e.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
