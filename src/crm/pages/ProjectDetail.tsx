import { useState } from 'react'
import { ChevronLeft, MapPin, Calendar, AlertTriangle, ExternalLink, Plus, Paperclip, MessageSquare } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { PROJECTS, EMPLOYEES } from '../data/mock'

const project = PROJECTS[0]

const BURN_DATA = [
  { month: 'Jan', planned: 350000, actual: 300000 },
  { month: 'Feb', planned: 700000, actual: 680000 },
  { month: 'Mar', planned: 1050000, actual: 1050000 },
  { month: 'Apr', planned: 1400000, actual: 1380000 },
  { month: 'May', planned: 1750000, actual: 1800000 },
  { month: 'Jun', planned: 2100000, actual: 2100000 },
]

const DELIVERABLES_DETAIL = [
  { id: 1, code: 'DOC-001', name: 'Process Flow Diagrams', discipline: 'Process', status: 'Approved', rev: 'C', date: '2026-03-15' },
  { id: 2, code: 'DOC-002', name: 'P&ID - Process Area', discipline: 'Process', status: 'In Review', rev: 'B', date: '2026-08-22' },
  { id: 3, code: 'DOC-003', name: 'Equipment List', discipline: 'Process', status: 'Approved', rev: 'A', date: '2026-04-10' },
  { id: 4, code: 'DOC-004', name: 'Instrumentation Index', discipline: 'Instrumentation', status: 'In Progress', rev: '-', date: '2026-09-01' },
  { id: 5, code: 'DOC-005', name: 'Electrical Load List', discipline: 'Electrical', status: 'Not Started', rev: '-', date: '2026-09-15' },
  { id: 6, code: 'DOC-006', name: 'Structural Layout', discipline: 'Civil', status: 'Approved', rev: 'A', date: '2026-05-20' },
]

const TEAM_ROLES = [
  { employeeId: 'E001', role: 'Lead Process Engineer', allocation: 80 },
  { employeeId: 'E003', role: 'Instrumentation Engineer', allocation: 60 },
  { employeeId: 'E005', role: 'Piping Engineer', allocation: 40 },
]

const INVOICES_P = [
  { id: 'INV-2026-001', milestone: 'Milestone 1 - PFD Approval', amount: 420000, status: 'Paid', date: '2026-07-01' },
  { id: 'INV-2026-007', milestone: 'Milestone 2 - P&ID Issue B', amount: 630000, status: 'Pending', date: '2026-08-30' },
  { id: 'INV-2026-009', milestone: 'Milestone 3 - HAZOP', amount: 840000, status: 'Not Issued', date: '2026-11-01' },
]

const RISKS = [
  { id: 1, description: 'Client approval delay on P&ID', severity: 'High', mitigation: 'Weekly review meetings scheduled' },
  { id: 2, description: 'Vendor long-lead items', severity: 'Medium', mitigation: 'Early procurement initiated' },
  { id: 3, description: 'Resource allocation conflict with PRJ-002', severity: 'Low', mitigation: 'Staggered delivery schedule' },
]

const ACTIVITY_TIMELINE = [
  { date: '2026-08-17', user: 'Sara Mohammed', action: 'Updated project progress to 68%', type: 'update' },
  { date: '2026-08-15', user: 'Ahmed Al-Rashidi', action: 'Uploaded P&ID Rev B for client review', type: 'document' },
  { date: '2026-08-12', user: 'System', action: 'Invoice INV-2026-001 marked as paid (AED 420K)', type: 'invoice' },
  { date: '2026-08-10', user: 'Khalid Al-Mansouri', action: 'Completed Instrumentation Index draft', type: 'deliverable' },
  { date: '2026-08-05', user: 'Sara Mohammed', action: 'Monthly progress meeting with ADNOC client team', type: 'meeting' },
]

const TABS = ['Overview', 'Deliverables', 'Team', 'Financials', 'Risks', 'Activity', 'Documents']

const STATUS_DOC: Record<string, string> = {
  'Approved': 'badge-success',
  'In Review': 'badge-warning',
  'In Progress': 'badge-purple',
  'Not Started': 'badge-neutral',
}

function fmt(n: number) {
  if (n >= 1000000) return `AED ${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `AED ${(n / 1000).toFixed(0)}K`
  return `AED ${n}`
}

const customTooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
}

export default function ProjectDetail({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [activeTab, setActiveTab] = useState('Overview')

  const team = TEAM_ROLES.map(r => ({
    ...r,
    employee: EMPLOYEES.find(e => e.id === r.employeeId),
  }))

  const spentPct = Math.round((project.spent / project.budget) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <button type="button" className="btn-ghost" style={{ marginBottom: 10, fontSize: 12.5 }} onClick={() => onNavigate('projects')}>
          <ChevronLeft size={14} /> Back to Projects
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{project.name}</h2>
              <span className="badge badge-cyan" style={{ fontSize: 11 }}>{project.status}</span>
              <span className="badge badge-danger" style={{ fontSize: 11 }}>{project.priority} priority</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{project.id}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} /> {project.location}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={12} /> {project.startDate} → {project.endDate}
              </span>
              <span>Contract: {project.contract}</span>
              <span>Client: <strong style={{ color: 'var(--text-primary)' }}>{project.client}</strong></span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" className="btn-secondary"><Paperclip size={14} /> Documents</button>
            <button type="button" className="btn-secondary"><MessageSquare size={14} /> Discuss</button>
            <button type="button" className="btn-primary"><Plus size={14} /> Add Deliverable</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 28px', flexShrink: 0 }}>
        <div className="tab-nav" style={{ borderBottom: 'none' }}>
          {TABS.map(tab => (
            <button type="button" key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Body: two-column layout */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', gap: 0 }}>
        {/* Main area */}
        <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
          {activeTab === 'Overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {[
                  { label: 'Budget', value: fmt(project.budget), sub: 'Total contract value' },
                  { label: 'Spent', value: fmt(project.spent), sub: `${spentPct}% of budget` },
                  { label: 'Progress', value: `${project.progress}%`, sub: 'Work completed' },
                  { label: 'Phase', value: project.phase, sub: 'Current phase' },
                ].map(s => (
                  <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 2px' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Burn chart */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Budget Burn</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Planned vs Actual expenditure</div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={BURN_DATA}>
                    <defs>
                      <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#64126D" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#64126D" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} width={48} />
                    <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [fmt(Number(v)), '']} />
                    <Area type="monotone" dataKey="planned" stroke="#06B6D4" strokeWidth={1.5} strokeDasharray="4 2" fill="transparent" name="Planned" />
                    <Area type="monotone" dataKey="actual" stroke="#64126D" strokeWidth={2} fill="url(#bg1)" name="Actual" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Scope summary */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Scope Summary</div>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Front-End Engineering Design (FEED) for the expansion of the existing gas processing plant at Abu Dhabi. Scope includes process engineering, instrumentation, electrical systems design, civil/structural works, and HSE documentation. The project aims to increase processing capacity by 35% from 420 MMSCFD to 567 MMSCFD.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'Deliverables' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Deliverables Register</span>
                <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}><Plus size={13} /> Add Deliverable</button>
              </div>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Doc Code</th>
                    <th>Name</th>
                    <th>Discipline</th>
                    <th>Rev</th>
                    <th>Status</th>
                    <th>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {DELIVERABLES_DETAIL.map(d => (
                    <tr key={d.id}>
                      <td><span style={{ fontFamily: 'monospace', fontSize: 12.5, color: 'var(--brand-primary)', fontWeight: 600 }}>{d.code}</span></td>
                      <td style={{ fontWeight: 500, fontSize: 13 }}>{d.name}</td>
                      <td><span className="badge badge-steel" style={{ fontSize: 11 }}>{d.discipline}</span></td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{d.rev}</span></td>
                      <td><span className={`badge ${STATUS_DOC[d.status] || 'badge-neutral'}`} style={{ fontSize: 11 }}>{d.status}</span></td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{d.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Financials' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {[
                  { label: 'Contract Value', value: fmt(project.budget), color: 'var(--brand-primary)' },
                  { label: 'Invoiced', value: fmt(1050000), color: '#16A34A' },
                  { label: 'Outstanding', value: fmt(630000), color: '#F59E0B' },
                ].map(s => (
                  <div key={s.label} className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Invoice Schedule</span>
                </div>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Invoice No.</th>
                      <th>Milestone</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INVOICES_P.map(inv => (
                      <tr key={inv.id}>
                        <td><span style={{ fontFamily: 'monospace', fontSize: 12.5, color: 'var(--brand-primary)', fontWeight: 600 }}>{inv.id}</span></td>
                        <td style={{ fontSize: 13 }}>{inv.milestone}</td>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{fmt(inv.amount)}</td>
                        <td>
                          <span className={`badge ${inv.status === 'Paid' ? 'badge-success' : inv.status === 'Pending' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 11 }}>
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{inv.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Risks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {RISKS.map(r => (
                <div key={r.id} className="card" style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} style={{ color: r.severity === 'High' ? 'var(--danger)' : r.severity === 'Medium' ? 'var(--warning)' : '#6B7280', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.description}</span>
                      <span className={`badge ${r.severity === 'High' ? 'badge-danger' : r.severity === 'Medium' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 10 }}>{r.severity}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Mitigation: {r.mitigation}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Activity' && (
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Activity Timeline</div>
              {ACTIVITY_TIMELINE.map((item, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-dot" style={{ background: 'var(--brand-primary)', marginTop: 5 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.action}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{item.user} · {item.date}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(activeTab === 'Team' || activeTab === 'Documents') && (
            <div className="card" style={{ padding: '24px' }}>
              {activeTab === 'Team' && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Project Team</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {team.map(t => t.employee && (
                      <div key={t.employeeId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--surface-secondary)', borderRadius: 10 }}>
                        <div className="avatar" style={{ background: t.employee.color, width: 40, height: 40, fontSize: 14 }}>{t.employee.avatar}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.employee.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.role}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Allocation</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-primary)' }}>{t.allocation}%</div>
                        </div>
                        <div style={{ width: 80 }}>
                          <div className="progress-bar">
                            <div className="progress-bar-fill" style={{ width: `${t.allocation}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'Documents' && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <Paperclip size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No documents uploaded</div>
                  <div style={{ fontSize: 13 }}>Upload drawings, reports, and correspondence here.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ width: 280, flexShrink: 0, padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {/* Health */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Project Health</div>
            {[
              { label: 'Schedule', score: 'On Track', color: '#16A34A' },
              { label: 'Budget', score: 'At Risk', color: '#F59E0B' },
              { label: 'Scope', score: 'On Track', color: '#16A34A' },
              { label: 'Quality', score: 'On Track', color: '#16A34A' },
            ].map(h => (
              <div key={h.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{h.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: h.color }}>{h.score}</span>
              </div>
            ))}
          </div>

          {/* Next milestone */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Next Milestone</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>P&ID Issue for Client Approval</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Due Aug 22, 2026</div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: '72%' }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>72% ready</div>
          </div>

          {/* Outstanding invoices */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Outstanding Invoice</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>AED 630,000</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>INV-2026-007 · Due Aug 30</div>
          </div>

          {/* Manager */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Project Manager</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="avatar" style={{ background: '#86288F', width: 34, height: 34, fontSize: 12 }}>SM</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Sara Mohammed</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Project Manager</div>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Quick Links</div>
            {['Aconex Document Portal', 'ADNOC Client Dashboard', 'SharePoint Folder'].map(link => (
              <a key={link} href="#" className="sidebar-link" style={{ fontSize: 12, borderRadius: 6 }}>
                <ExternalLink size={12} />{link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
