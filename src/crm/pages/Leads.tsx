import { useState } from 'react'
import { Plus, Search, MoreHorizontal, DollarSign } from 'lucide-react'
import { LEADS } from '../data/mock'

const STAGES = ['Prospecting', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won']

const STAGE_COLORS: Record<string, string> = {
  Prospecting: '#475569',
  Qualified: '#2563EB',
  'Proposal Sent': '#F59E0B',
  Negotiation: '#86288F',
  'Closed Won': '#16A34A',
}

function fmt(n: number) {
  if (n >= 1000000) return `AED ${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `AED ${(n / 1000).toFixed(0)}K`
  return `AED ${n}`
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#16A34A' : score >= 60 ? '#F59E0B' : '#DC2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div className="progress-bar" style={{ width: 40, height: 4 }}>
        <div className="progress-bar-fill" style={{ width: `${score}%`, background: color, height: 4 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{score}</span>
    </div>
  )
}

export default function Leads() {
  const [search, setSearch] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [leads, setLeads] = useState(LEADS)

  const filtered = leads.filter(l => l.company.toLowerCase().includes(search.toLowerCase()) || l.contact.toLowerCase().includes(search.toLowerCase()))

  function getStageLeads(stage: string) {
    return filtered.filter(l => l.stage === stage)
  }

  function getStageValue(stage: string) {
    return getStageLeads(stage).reduce((s, l) => s + l.value, 0)
  }

  function handleDragStart(id: string) {
    setDragging(id)
  }

  function handleDrop(stage: string) {
    if (!dragging) return
    setLeads(prev => prev.map(l => l.id === dragging ? { ...l, stage } : l))
    setDragging(null)
  }

  const totalPipeline = leads.reduce((s, l) => s + l.value, 0)
  const wonValue = leads.filter(l => l.stage === 'Closed Won').reduce((s, l) => s + l.value, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Leads Pipeline</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {leads.length} leads · {fmt(totalPipeline)} pipeline · {fmt(wonValue)} won
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13 }}
              placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button type="button" className="btn-primary"><Plus size={14} /> Add Lead</button>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 24, flexShrink: 0 }}>
        {STAGES.map(stage => (
          <div key={stage} style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: 'var(--surface-secondary)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLORS[stage] }} />
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{stage}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(getStageValue(stage))}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{getStageLeads(stage).length} leads</div>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban board */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '20px 24px', display: 'flex', gap: 14 }}>
        {STAGES.map(stage => {
          const stageLeads = getStageLeads(stage)
          return (
            <div key={stage} className="kanban-col"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage)}>
              {/* Stage header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: STAGE_COLORS[stage] }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{stage}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--border)', borderRadius: 999, padding: '0 6px' }}>
                    {stageLeads.length}
                  </span>
                </div>
                <button type="button" className="btn-ghost" style={{ padding: '2px 4px' }}><Plus size={14} /></button>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stageLeads.map(lead => (
                  <div key={lead.id}
                    className="kanban-card"
                    draggable
                    onDragStart={() => handleDragStart(lead.id)}
                    style={{ opacity: dragging === lead.id ? 0.5 : 1 }}>
                    {/* Top row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{lead.company}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{lead.contact}</div>
                      </div>
                      <button type="button" className="btn-ghost" style={{ padding: '2px 4px' }}><MoreHorizontal size={14} /></button>
                    </div>

                    {/* Value */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                      <DollarSign size={12} style={{ color: 'var(--brand-primary)' }} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-primary)' }}>{fmt(lead.value)}</span>
                    </div>

                    {/* Score + probability */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Lead Score</div>
                        <ScoreBar score={lead.score} />
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Win Prob.</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: lead.probability >= 70 ? 'var(--success)' : lead.probability >= 40 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                          {lead.probability}%
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="avatar" style={{ background: 'var(--brand-primary)', width: 22, height: 22, fontSize: 9 }}>
                        {lead.assignee.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{lead.lastActivity}</span>
                      <span className={`badge ${lead.source === 'Referral' ? 'badge-purple' : lead.source === 'Tender' ? 'badge-cyan' : 'badge-neutral'}`} style={{ fontSize: 9 }}>
                        {lead.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add card */}
              <button type="button" className="btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 4, fontSize: 12.5, padding: '8px' }}>
                <Plus size={13} /> Add lead
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
