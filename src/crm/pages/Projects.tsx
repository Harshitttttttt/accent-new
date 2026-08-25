import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Pencil, Plus, Search, X } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import {
  computeProjectStats,
  PROJECT_STATUSES,
  PROJECT_STATUS_BADGES,
  PROJECT_STATUS_LABELS,
  type ProjectListItem,
  type ProjectStatus,
  type ProjectsPagePayload,
} from '~/lib/projects'
import { createProjectAction } from '~/lib/projects.functions'
import { formatINRCompact, formatPaise } from '~/lib/money'

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: 'var(--info)',
  in_progress: 'var(--success)',
  on_hold: 'var(--warning)',
  completed: 'var(--brand-secondary)',
  cancelled: 'var(--border)',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ProjectsPage({ initialData }: { initialData: ProjectsPagePayload }) {
  const navigate = useNavigate()
  const [data] = useState<ProjectsPagePayload>(initialData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [isCreating, setIsCreating] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const stats = useMemo(() => computeProjectStats(data.projects), [data.projects])

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.projects.filter((p) => {
      const matchesSearch =
        !q ||
        p.projectNumber.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.companyName.toLowerCase().includes(q) ||
        (p.managerName ?? '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [data.projects, search, statusFilter])

  async function handleCreate() {
    setIsCreating(true)
    try {
      const res = await createProjectAction()
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Project ${res.data.projectNumber} created.`)
      await navigate({ to: '/projects/$projectId', params: { projectId: res.data.id } })
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to create project.')
      setIsCreating(false)
    }
  }

  // ── Unauthorized state ─────────────────────────────────────────────────
  if (!data.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <AlertCircle size={28} style={{ color: 'var(--warning)', margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            You need the <strong>projects.read</strong> permission to view the portfolio. Ask an
            administrator to grant access, or sign in with an authorized account.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Projects</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {stats.totalProjects} projects · {stats.activeCount} active ·{' '}
            {formatINRCompact(stats.activeValuePaise, { fromPaise: true })} in delivery ·{' '}
            {formatINRCompact(stats.completedValuePaise, { fromPaise: true })} completed
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '7px 12px',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 180 }}
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="btn-ghost" style={{ padding: 0 }} onClick={() => setSearch('')}>
                <X size={12} />
              </button>
            )}
          </div>
          <button type="button" className="btn-primary" onClick={() => void handleCreate()} disabled={isCreating}>
            {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} New Project
          </button>
        </div>
      </div>

      {/* Status KPI tiles — clickable filters */}
      <div
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          gap: 12,
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {PROJECT_STATUSES.map((status) => {
          const bucket = stats.byStatus[status]
          const active = statusFilter === status
          return (
            <button
              key={status}
              type="button"
              className="card"
              onClick={() => setStatusFilter((s) => (s === status ? 'all' : status))}
              style={{
                padding: '10px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                minWidth: 150,
                flexShrink: 0,
                outline: active ? '2px solid var(--brand-primary)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[status] }}>
                  {PROJECT_STATUS_LABELS[status]}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>{bucket.count}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {bucket.valuePaise === 0 ? '—' : formatINRCompact(bucket.valuePaise, { fromPaise: true })}
              </div>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700 }}>No projects found</p>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
                Convert an accepted proposal, or create one with “New Project”.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)' }}>
                  {['Project #', 'Name & Client', 'Status', 'Progress', 'Value', 'Timeline', 'Manager', 'Proposal', ''].map(
                    (heading, i) => (
                      <th
                        key={i}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                        }}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onOpen={() =>
                      void navigate({ to: '/projects/$projectId', params: { projectId: project.id } })
                    }
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
            borderRadius: 10,
            padding: '10px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
          ) : (
            <AlertCircle size={15} style={{ color: 'var(--danger)' }} />
          )}
          {feedback.message}
        </div>
      )}
    </div>
  )
}

function ProjectRow({ project, onOpen }: { project: ProjectListItem; onOpen: () => void }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }} onClick={onOpen}>
      <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{project.projectNumber}</td>
      <td style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{project.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{project.companyName}</div>
      </td>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        <span className={`badge ${PROJECT_STATUS_BADGES[project.status]}`} style={{ fontSize: 9.5 }}>
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
      </td>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 64, height: 5, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${project.progress}%`,
                height: '100%',
                background: project.progress >= 100 ? 'var(--success)' : 'var(--brand-primary)',
              }}
            />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>{project.progress}%</span>
        </div>
      </td>
      <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {project.contractValuePaise === null ? '—' : formatPaise(project.contractValuePaise, { decimals: 0 })}
      </td>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontSize: 11.5, color: 'var(--text-muted)' }}>
        {formatDate(project.startDate)} → {formatDate(project.endDate)}
      </td>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{project.managerName ?? 'Unassigned'}</td>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontSize: 11.5, color: 'var(--text-muted)' }}>
        {project.proposalNumber ?? '—'}
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: '5px 8px' }}
          title="Open project"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          <Pencil size={13} />
        </button>
      </td>
    </tr>
  )
}
