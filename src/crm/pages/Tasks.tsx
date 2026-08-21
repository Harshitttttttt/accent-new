import { useState } from 'react'
import { Search, Plus, CheckCircle, Clock, AlertCircle, ListChecks } from 'lucide-react'
import { TASKS } from '../data/mock'

const PRIORITY_BADGE: Record<string, string> = {
  high: 'badge-danger',
  medium: 'badge-warning',
  low: 'badge-neutral',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-neutral',
  in_progress: 'badge-purple',
  overdue: 'badge-danger',
  completed: 'badge-success',
}

export default function Tasks() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filters = [
    { id: 'all', label: 'All Tasks', count: TASKS.length },
    { id: 'pending', label: 'Assigned', count: TASKS.filter(t => t.status === 'pending').length },
    { id: 'in_progress', label: 'In Progress', count: TASKS.filter(t => t.status === 'in_progress').length },
    { id: 'overdue', label: 'Overdue', count: TASKS.filter(t => t.status === 'overdue').length },
    { id: 'completed', label: 'Completed', count: 0 },
  ]

  const filtered = TASKS.filter(t =>
    (filter === 'all' || t.status === filter) &&
    (t.title.toLowerCase().includes(search.toLowerCase()) || t.project.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tasks</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{TASKS.length} tasks · {TASKS.filter(t => t.status === 'overdue').length} overdue</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 180 }}
              placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button type="button" className="btn-primary"><Plus size={14} /> New Task</button>
        </div>
      </div>

      <div style={{ padding: '0 28px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, flexShrink: 0 }}>
        <div className="tab-nav" style={{ borderBottom: 'none' }}>
          {filters.map(f => (
            <button type="button" key={f.id} className={`tab-btn ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label} <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(t => (
          <div key={t.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
            <div style={{
              width: 20, height: 20, borderRadius: 6, border: '2px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {t.status === 'completed' && <CheckCircle size={14} style={{ color: 'var(--success)' }} />}
              {t.status === 'in_progress' && <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--brand-primary)' }} />}
              {t.status === 'overdue' && <AlertCircle size={14} style={{ color: 'var(--danger)' }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{t.title}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--text-muted)' }}>
                <span>{t.project}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />Due {t.dueDate}</span>
              </div>
            </div>
            <span className={`badge ${PRIORITY_BADGE[t.priority]}`} style={{ fontSize: 11 }}>{t.priority}</span>
            <span className={`badge ${STATUS_BADGE[t.status]}`} style={{ fontSize: 11 }}>{t.status.replace('_', ' ')}</span>
            <div className="avatar" style={{ background: 'var(--brand-primary)', width: 28, height: 28, fontSize: 10 }}>
              {t.assignee.split(' ').map(n => n[0]).join('')}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <ListChecks size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No tasks in this view</div>
          </div>
        )}
      </div>
    </div>
  )
}
