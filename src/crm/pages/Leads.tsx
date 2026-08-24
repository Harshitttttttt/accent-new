import { useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  IndianRupee,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useForm, type AnyFieldApi } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
import {
  createLeadAction,
  deleteLeadAction,
  getLeadsPageData,
  updateLeadAction,
  updateLeadStageAction,
} from '~/lib/leads.functions'
import {
  LEAD_ENQUIRY_TYPES,
  LEAD_PRIORITIES,
  LEAD_PRIORITY_LABELS,
  LEAD_SOURCE_CODES,
  LEAD_SOURCE_LABELS,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadListItem,
  type LeadStage,
  type LeadsPagePayload,
} from '~/lib/leads'
import { formatINRCompact, formatPaise, parseINRToPaise, paiseToRupeesNumber } from '~/lib/money'

// ── Constants ────────────────────────────────────────────────────────────
const STAGE_COLORS: Record<LeadStage, string> = {
  prospecting: 'var(--brand-steel)',
  qualified: 'var(--info)',
  proposal_sent: 'var(--warning)',
  negotiation: 'var(--brand-secondary)',
  closed_won: 'var(--success)',
  closed_lost: 'var(--danger)',
}

const PAGE_SIZE = 15

type ViewMode = 'kanban' | 'list'
type SortMode = 'newest' | 'oldest' | 'value' | 'company'

type LeadFormState = {
  lead: LeadListItem | null
  open: boolean
  stage?: LeadStage
}

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

/** Narrow a raw string to a literal union, falling back when out of range. */
function oneOf<T extends string>(values: readonly T[], raw: string, fallback: T): T {
  return values.includes(raw as T) ? (raw as T) : fallback
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Component ────────────────────────────────────────────────────────────
export default function Leads({ initialData }: { initialData: LeadsPagePayload }) {
  const [data, setData] = useState<LeadsPagePayload>(initialData)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<ViewMode>('kanban')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortMode>('newest')
  const [listPage, setListPage] = useState(1)
  const [dragging, setDragging] = useState<string | null>(null)
  const [form, setForm] = useState<LeadFormState>({ lead: null, open: false })
  const [deleteTarget, setDeleteTarget] = useState<LeadListItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // The lead form Sheet handles its own Escape/focus; this covers the delete confirm modal.
  useHotkey({ key: 'Escape' }, () => setDeleteTarget(null))
  useHotkey({ key: 'k', mod: true }, (e) => {
    e.preventDefault()
    searchRef.current?.focus()
  })

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function load() {
    setLoading(true)
    try {
      const next = await getLeadsPageData()
      setData(next)
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to load leads.')
    } finally {
      setLoading(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = data.leads.filter((lead) => {
      const matchesSearch =
        !q ||
        lead.companyName.toLowerCase().includes(q) ||
        lead.leadNumber.toLowerCase().includes(q) ||
        (lead.contactName ?? '').toLowerCase().includes(q) ||
        (lead.contactEmail ?? '').toLowerCase().includes(q) ||
        (lead.city ?? '').toLowerCase().includes(q) ||
        (lead.projectDescription ?? '').toLowerCase().includes(q)
      const matchesStage = stageFilter === 'all' || lead.stage === stageFilter
      const matchesAssignee = assigneeFilter === 'all' || lead.assignedTo === assigneeFilter
      return matchesSearch && matchesStage && matchesAssignee
    })

    switch (sort) {
      case 'oldest':
        return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      case 'value':
        return rows.sort((a, b) => (b.valuePaise ?? -1) - (a.valuePaise ?? -1))
      case 'company':
        return rows.sort((a, b) => a.companyName.localeCompare(b.companyName))
      default:
        return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
  }, [data.leads, search, stageFilter, assigneeFilter, sort])

  const byStage = useMemo(() => {
    const map = Object.fromEntries(LEAD_STAGES.map((stage) => [stage, [] as LeadListItem[]]))
    for (const lead of filtered) map[lead.stage].push(lead)
    return map
  }, [filtered])

  const listTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safeListPage = Math.min(listPage, listTotalPages)
  const listRows = filtered.slice((safeListPage - 1) * PAGE_SIZE, safeListPage * PAGE_SIZE)

  function resetFilters() {
    setSearch('')
    setStageFilter('all')
    setAssigneeFilter('all')
    setSort('newest')
    setListPage(1)
  }

  // ── Stage move (kanban drag & drop) ────────────────────────────────────
  async function handleDrop(stage: LeadStage) {
    const id = dragging
    setDragging(null)
    if (!id) return
    const lead = data.leads.find((l) => l.id === id)
    if (!lead || lead.stage === stage) return

    // Optimistic move; revert via reload when the mutation fails.
    setData((prev) => ({
      ...prev,
      leads: prev.leads.map((l) => (l.id === id ? { ...l, stage } : l)),
    }))
    const res = await updateLeadStageAction({ data: { id, stage } })
    if (!res.ok) {
      showFeedback('error', res.message)
      await load()
      return
    }
    showFeedback('success', `${lead.leadNumber} moved to ${LEAD_STAGE_LABELS[stage]}.`)
  }

  // ── Create / edit / delete ─────────────────────────────────────────────
  async function handleSaveLead(values: LeadFormValues) {
    setIsSaving(true)
    const payload = toLeadPayload(values, data.options.companies)

    try {
      const res = form.lead
        ? await updateLeadAction({ data: { id: form.lead.id, ...payload } })
        : await createLeadAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', form.lead ? `Lead ${form.lead.leadNumber} updated.` : 'Lead created.')
      setForm({ lead: null, open: false })
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteLead() {
    if (!deleteTarget) return
    setIsSaving(true)
    try {
      const res = await deleteLeadAction({ data: { id: deleteTarget.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Lead ${deleteTarget.leadNumber} deleted.`)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setIsSaving(false)
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
            You need the <strong>leads.read</strong> permission to view the pipeline. Ask an
            administrator to grant access, or sign in with an authorized account.
          </p>
        </div>
      </div>
    )
  }

  const { stats } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Leads Pipeline</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {stats.totalLeads} leads · {formatINRCompact(stats.openPipelinePaise, { fromPaise: true })} open pipeline ·{' '}
            {formatINRCompact(stats.wonValuePaise, { fromPaise: true })} won
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
              ref={searchRef}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 180 }}
              placeholder="Search leads... (⌘K)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setListPage(1)
              }}
            />
            {search && (
              <button type="button" className="btn-ghost" style={{ padding: 0 }} onClick={() => setSearch('')}>
                <X size={12} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '7px 10px', borderRadius: 0, background: view === 'kanban' ? 'var(--brand-primary)' : 'transparent', color: view === 'kanban' ? '#fff' : 'var(--text-muted)' }}
              onClick={() => setView('kanban')}
              title="Kanban view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '7px 10px', borderRadius: 0, background: view === 'list' ? 'var(--brand-primary)' : 'transparent', color: view === 'list' ? '#fff' : 'var(--text-muted)' }}
              onClick={() => setView('list')}
              title="List view"
            >
              <List size={14} />
            </button>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setForm({ lead: null, open: true })}
          >
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          padding: '10px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <select
          className="input-base"
          style={{ width: 'auto', fontSize: 13 }}
          value={stageFilter}
          onChange={(e) => {
            setStageFilter(e.target.value)
            setListPage(1)
          }}
        >
          <option value="all">All Stages</option>
          {LEAD_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {LEAD_STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
        <select
          className="input-base"
          style={{ width: 'auto', fontSize: 13 }}
          value={assigneeFilter}
          onChange={(e) => {
            setAssigneeFilter(e.target.value)
            setListPage(1)
          }}
        >
          <option value="all">All Assignees</option>
          {data.options.employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {[emp.firstName, emp.lastName].filter(Boolean).join(' ')}
            </option>
          ))}
        </select>
        {view === 'list' && (
          <select
            className="input-base"
            style={{ width: 'auto', fontSize: 13 }}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="value">Highest Value</option>
            <option value="company">Company A-Z</option>
          </select>
        )}
        {(search || stageFilter !== 'all' || assigneeFilter !== 'all' || sort !== 'newest') && (
          <button type="button" className="btn-ghost" style={{ fontSize: 12.5 }} onClick={resetFilters}>
            Clear filters
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? 'Refreshing…' : `${filtered.length} of ${stats.totalLeads} leads`}
        </span>
      </div>

      {view === 'kanban' ? (
        <>
          {/* Stage summary bar */}
          <div
            style={{
              padding: '10px 24px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              gap: 24,
              flexShrink: 0,
            }}
          >
            {LEAD_STAGES.map((stage) => (
              <div
                key={stage}
                style={{
                  display: 'flex',
                  flex: 1,
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'var(--surface-secondary)',
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLORS[stage] }} />
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{LEAD_STAGE_LABELS[stage]}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {formatINRCompact(stats.byStage[stage].valuePaise, { fromPaise: true })}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    {stats.byStage[stage].count} leads
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Kanban board */}
          <div
            style={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: '20px 24px',
              display: 'flex',
              gap: 14,
            }}
          >
            {LEAD_STAGES.map((stage) => {
              const stageLeads = byStage[stage]
              return (
                <div
                  key={stage}
                  className="kanban-col"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => void handleDrop(stage)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: STAGE_COLORS[stage] }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {LEAD_STAGE_LABELS[stage]}
                      </span>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          background: 'var(--border)',
                          borderRadius: 999,
                          padding: '0 6px',
                        }}
                      >
                        {stageLeads.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '2px 4px' }}
                      title={`Add lead in ${LEAD_STAGE_LABELS[stage]}`}
                      onClick={() => setForm({ lead: null, open: true, stage })}
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="kanban-card"
                        draggable
                        onDragStart={() => setDragging(lead.id)}
                        onDragEnd={() => setDragging(null)}
                        style={{ opacity: dragging === lead.id ? 0.5 : 1, cursor: 'grab' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                              {lead.companyName}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              {lead.contactName ?? 'No contact'}
                            </div>
                          </div>
                          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600 }}>{lead.leadNumber}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                          <IndianRupee size={12} style={{ color: 'var(--brand-primary)' }} />
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-primary)' }}>
                            {lead.valuePaise === null ? '—' : formatPaise(lead.valuePaise, { decimals: 0 })}
                          </span>
                        </div>

                        {(lead.score !== null || lead.probability !== null) && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            {lead.score !== null ? (
                              <div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Lead Score</div>
                                <ScoreBar score={lead.score} />
                              </div>
                            ) : <span />}
                            {lead.probability !== null && (
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Win Prob.</div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color:
                                      lead.probability >= 70
                                        ? 'var(--success)'
                                        : lead.probability >= 40
                                          ? 'var(--warning)'
                                          : 'var(--text-secondary)',
                                  }}
                                >
                                  {lead.probability}%
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingTop: 8,
                            borderTop: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div
                            className="avatar"
                            title={lead.assigneeName ?? 'Unassigned'}
                            style={{
                              background: lead.assigneeName ? 'var(--brand-primary)' : 'var(--border)',
                              width: 22,
                              height: 22,
                              fontSize: 9,
                            }}
                          >
                            {lead.assigneeName ? initials(lead.assigneeName) : '?'}
                          </div>
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                            {formatDate(lead.lastActivityAt)}
                          </span>
                          <span
                            className={`badge ${lead.sourceCode === 'referral' || lead.sourceCode === 'existing_client' ? 'badge-purple' : lead.sourceCode === 'tender_portal' ? 'badge-cyan' : 'badge-neutral'}`}
                            style={{ fontSize: 9 }}
                          >
                            {LEAD_SOURCE_LABELS[lead.sourceCode]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {stageLeads.length === 0 && (
                    <div
                      style={{
                        border: '1px dashed var(--border)',
                        borderRadius: 8,
                        padding: 14,
                        textAlign: 'center',
                        fontSize: 11.5,
                        color: 'var(--text-muted)',
                      }}
                    >
                      Drop leads here
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        /* ── List view ── */
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700 }}>No leads found</p>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Adjust the filters or add your first lead.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)' }}>
                    {['Lead #', 'Company & Contact', 'Project', 'Location', 'Stage', 'Priority', 'Value', 'Assignee', 'Enquiry', ''].map(
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
                  {listRows.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{lead.leadNumber}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{lead.companyName}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{lead.contactName ?? '—'}</div>
                        {lead.contactEmail && (
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Mail size={10} /> {lead.contactEmail}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: 220 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.projectDescription ?? ''}>
                          {lead.projectDescription ?? '—'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {lead.city ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={11} /> {lead.city}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11,
                            fontWeight: 700,
                            color: STAGE_COLORS[lead.stage],
                          }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: STAGE_COLORS[lead.stage] }} />
                          {LEAD_STAGE_LABELS[lead.stage]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span
                          className={`badge ${lead.priority === 'high' ? 'badge-danger' : lead.priority === 'medium' ? 'badge-warning' : 'badge-neutral'}`}
                          style={{ fontSize: 9.5 }}
                        >
                          {LEAD_PRIORITY_LABELS[lead.priority]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {lead.valuePaise === null ? '—' : formatPaise(lead.valuePaise, { decimals: 0 })}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{lead.assigneeName ?? 'Unassigned'}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {formatDate(lead.enquiryDate)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: '5px 8px' }}
                          title="Edit lead"
                          onClick={() => setForm({ lead, open: true })}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: '5px 8px', color: 'var(--danger)' }}
                          title="Delete lead"
                          onClick={() => setDeleteTarget(lead)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {filtered.length > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {(safeListPage - 1) * PAGE_SIZE + 1}–{Math.min(safeListPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 12 }}
                  disabled={safeListPage === 1}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span style={{ fontSize: 12, alignSelf: 'center', color: 'var(--text-muted)' }}>
                  Page {safeListPage} / {listTotalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 12 }}
                  disabled={safeListPage === listTotalPages}
                  onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SHEET: CREATE / EDIT LEAD */}
      <LeadFormSheet
        key={`${form.lead?.id ?? 'new'}:${form.stage ?? ''}`}
        open={form.open}
        lead={form.lead}
        defaultStage={form.stage}
        options={data.options}
        onCancel={() => setForm({ lead: null, open: false })}
        onSubmit={handleSaveLead}
      />

      {/* MODAL: DELETE CONFIRM */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, padding: '24px 28px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>Delete lead {deleteTarget.leadNumber}?</h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-muted)' }}>
              {deleteTarget.companyName} will be hidden from the pipeline. This is a soft delete — the
              record stays in the database.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <Button
                type="button"
                disabled={isSaving}
                className="bg-[var(--danger)] text-white hover:opacity-90"
                onClick={() => void handleDeleteLead()}
              >
                {isSaving ? 'Deleting…' : 'Delete Lead'}
              </Button>
            </div>
          </div>
        </div>
      )}

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

// ── Sub-components ───────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 54, height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color }}>{score}</span>
    </div>
  )
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h4 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{title}</h4>
      {children}
    </section>
  )
}

// ── Lead form schema & value mapping ─────────────────────────────────────
const optionalEmail = z
  .string()
  .max(255)
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address')

function isParseableAmount(value: string): boolean {
  if (value.trim() === '') return true
  try {
    return parseINRToPaise(value) >= 0
  } catch {
    return false
  }
}

const leadFormSchema = z.object({
  companyId: z.string(),
  companyName: z.string().trim().min(2, 'Company name is required').max(255),
  contactName: z.string().max(255),
  designation: z.string().max(100),
  contactEmail: optionalEmail,
  contactPhone: z.string().max(20),
  inquiryEmail: optionalEmail,
  ccEmails: z.string(),
  city: z.string().max(100),
  projectDescription: z.string().max(5000),
  enquiryType: z.enum(LEAD_ENQUIRY_TYPES),
  sourceCode: z.enum(LEAD_SOURCE_CODES),
  stage: z.enum(LEAD_STAGES),
  priority: z.enum(LEAD_PRIORITIES),
  valueRupees: z.string().refine(isParseableAmount, 'Enter a valid amount'),
  probability: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 100), '0–100 only'),
  score: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 100), '0–100 only'),
  enquiryDate: z.string(),
  expectedCloseDate: z.string(),
  lostReason: z.string().max(500),
  assignedTo: z.string(),
  notes: z.string().max(5000),
})

type LeadFormValues = z.infer<typeof leadFormSchema>

function leadFormDefaults(lead: LeadListItem | null, defaultStage?: LeadStage): LeadFormValues {
  const today = new Date().toISOString().slice(0, 10)
  return {
    companyId: lead?.companyId ?? '',
    companyName: lead?.companyName ?? '',
    contactName: lead?.contactName ?? '',
    designation: lead?.designation ?? '',
    contactEmail: lead?.contactEmail ?? '',
    contactPhone: lead?.contactPhone ?? '',
    inquiryEmail: lead?.inquiryEmail ?? '',
    ccEmails: lead?.ccEmails.join(', ') ?? '',
    city: lead?.city ?? '',
    projectDescription: lead?.projectDescription ?? '',
    enquiryType: oneOf(LEAD_ENQUIRY_TYPES, lead?.enquiryType ?? '', 'Email'),
    sourceCode: lead?.sourceCode ?? 'website',
    stage: lead?.stage ?? defaultStage ?? 'prospecting',
    priority: lead?.priority ?? 'medium',
    valueRupees: lead?.valuePaise != null ? String(paiseToRupeesNumber(lead.valuePaise)) : '',
    probability: lead?.probability != null ? String(lead.probability) : '',
    score: lead?.score != null ? String(lead.score) : '',
    enquiryDate: lead?.enquiryDate ?? today,
    expectedCloseDate: lead?.expectedCloseDate ?? '',
    lostReason: lead?.lostReason ?? '',
    assignedTo: lead?.assignedTo ?? '',
    notes: lead?.notes ?? '',
  }
}

/** Map validated form values to the server payload (`leadInputSchema` shape). */
function toLeadPayload(values: LeadFormValues, companies: LeadsPagePayload['options']['companies']) {
  const selectedCompany = values.companyId
    ? companies.find((c) => c.id === values.companyId)
    : undefined

  return {
    companyId: selectedCompany ? selectedCompany.id : null,
    companyName: selectedCompany ? selectedCompany.name : values.companyName.trim(),
    contactName: values.contactName.trim() || null,
    contactEmail: values.contactEmail.trim() || null,
    contactPhone: values.contactPhone.trim() || null,
    designation: values.designation.trim() || null,
    inquiryEmail: values.inquiryEmail.trim() || null,
    ccEmails: values.ccEmails.split(',').map((s) => s.trim()).filter(Boolean),
    city: values.city.trim() || null,
    projectDescription: values.projectDescription.trim() || null,
    enquiryType: values.enquiryType,
    sourceCode: values.sourceCode,
    stage: values.stage,
    priority: values.priority,
    valuePaise: values.valueRupees.trim() === '' ? null : parseINRToPaise(values.valueRupees),
    probability: values.probability.trim() === '' ? null : Number(values.probability),
    score: values.score.trim() === '' ? null : Number(values.score),
    assignedTo: values.assignedTo || null,
    enquiryDate: values.enquiryDate || null,
    expectedCloseDate: values.expectedCloseDate || null,
    lostReason: values.lostReason.trim() || null,
    notes: values.notes.trim() || null,
  }
}

function firstFieldError(errors: unknown[]): string | undefined {
  for (const error of errors) {
    if (typeof error === 'string') return error
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message
      if (typeof message === 'string' && message !== '') return message
    }
  }
  return undefined
}

/** Input bound to a TanStack field; shows inline errors and aria-invalid. */
function BoundInput({ field, ...props }: { field: AnyFieldApi } & ComponentProps<'input'>) {
  const invalid = firstFieldError(field.state.meta.errors) !== undefined
  return (
    <>
      <Input
        {...props}
        id={field.name}
        name={field.name}
        aria-invalid={invalid}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => void field.handleChange(e.target.value)}
      />
      <FieldErrorText field={field} />
    </>
  )
}

function BoundTextarea({ field, ...props }: { field: AnyFieldApi } & ComponentProps<'textarea'>) {
  const invalid = firstFieldError(field.state.meta.errors) !== undefined
  return (
    <>
      <Textarea
        {...props}
        id={field.name}
        name={field.name}
        aria-invalid={invalid}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => void field.handleChange(e.target.value)}
      />
      <FieldErrorText field={field} />
    </>
  )
}

function FieldErrorText({ field }: { field: AnyFieldApi }) {
  const message = firstFieldError(field.state.meta.errors)
  if (!message) return null
  return <p className="text-xs font-medium text-destructive">{message}</p>
}

function SelectField({
  field,
  options,
}: {
  field: AnyFieldApi
  options: readonly { value: string; label: string }[]
}) {
  return (
    <select
      id={field.name}
      name={field.name}
      className="input-base h-10"
      value={field.state.value}
      onBlur={field.handleBlur}
      onChange={(e) => void field.handleChange(e.target.value as never)}
      aria-invalid={firstFieldError(field.state.meta.errors) !== undefined}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function LeadFormSheet({
  open,
  lead,
  defaultStage,
  options,
  onCancel,
  onSubmit,
}: {
  open: boolean
  lead: LeadListItem | null
  defaultStage?: LeadStage
  options: LeadsPagePayload['options']
  onCancel: () => void
  onSubmit: (values: LeadFormValues) => Promise<void>
}) {
  const formApi = useForm({
    defaultValues: leadFormDefaults(lead, defaultStage),
    validators: {
      onSubmit: leadFormSchema,
      onChange: leadFormSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  const busy = formApi.state.isSubmitting || formApi.state.isValidating

  return (
    <Sheet open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-xl"
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-base">
            {lead ? `Edit Lead ${lead.leadNumber}` : 'New Lead'}
          </SheetTitle>
          <SheetDescription>
            {lead
              ? `Review or amend the details for ${lead.companyName}.`
              : 'Capture the enquiry, classify it, and route it to an owner.'}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void formApi.handleSubmit()
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* display:contents — fieldset[disabled] still disables all inputs, but the DIV does the scrolling (Chromium fieldset/flex bug) */}
          <fieldset disabled={busy} className="contents">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
            {/* Company */}
            <FormSection title="Company">
              <div className="grid gap-3 sm:grid-cols-2">
                <formApi.Field name="companyId">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Link to company master</FieldLabel>
                      <SelectField
                        field={field}
                        options={[
                          { value: '', label: '— Not linked (enter name below) —' },
                          ...options.companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
                        ]}
                      />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field
                  name="companyName"
                  validators={{ onChange: z.string().trim().min(2, 'Company name is required').max(255) }}
                >
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Company name <span aria-hidden="true">*</span>
                      </FieldLabel>
                      <BoundInput field={field} placeholder="e.g. NTPC Limited" maxLength={255} autoFocus />
                    </Field>
                  )}
                </formApi.Field>
              </div>
            </FormSection>

            {/* Contact */}
            <FormSection title="Contact">
              <div className="grid grid-cols-2 gap-3">
                <formApi.Field name="contactName" validators={{ onChange: leadFormSchema.shape.contactName }}>
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Contact name</FieldLabel>
                      <BoundInput field={field} maxLength={255} />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="designation" validators={{ onChange: leadFormSchema.shape.designation }}>
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Designation</FieldLabel>
                      <BoundInput field={field} maxLength={100} />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="contactEmail" validators={{ onChange: optionalEmail }}>
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Contact email</FieldLabel>
                      <BoundInput field={field} type="email" maxLength={255} />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="contactPhone" validators={{ onChange: leadFormSchema.shape.contactPhone }}>
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Phone</FieldLabel>
                      <BoundInput field={field} maxLength={20} />
                    </Field>
                  )}
                </formApi.Field>
              </div>
            </FormSection>

            {/* Inquiry capture */}
            <FormSection title="Inquiry">
              <div className="grid grid-cols-2 gap-3">
                <formApi.Field name="inquiryEmail" validators={{ onChange: optionalEmail }}>
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Inquiry email (who sent it)</FieldLabel>
                      <BoundInput field={field} type="email" maxLength={255} />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="city" validators={{ onChange: leadFormSchema.shape.city }}>
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>City</FieldLabel>
                      <BoundInput field={field} maxLength={100} />
                    </Field>
                  )}
                </formApi.Field>
              </div>
              <formApi.Field name="ccEmails">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>CC emails (comma-separated)</FieldLabel>
                    <BoundInput field={field} placeholder="a@x.com, b@y.com" />
                  </Field>
                )}
              </formApi.Field>
              <formApi.Field name="projectDescription" validators={{ onChange: leadFormSchema.shape.projectDescription }}>
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Project description</FieldLabel>
                    <BoundTextarea field={field} rows={2} maxLength={5000} className="resize-y" />
                  </Field>
                )}
              </formApi.Field>
            </FormSection>

            {/* Classification */}
            <FormSection title="Classification">
              <div className="grid grid-cols-2 gap-3">
                <formApi.Field name="enquiryType">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Enquiry type</FieldLabel>
                      <SelectField
                        field={field}
                        options={LEAD_ENQUIRY_TYPES.map((t) => ({ value: t, label: t }))}
                      />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="sourceCode">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Source</FieldLabel>
                      <SelectField
                        field={field}
                        options={LEAD_SOURCE_CODES.map((code) => ({ value: code, label: LEAD_SOURCE_LABELS[code] }))}
                      />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="stage">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Stage</FieldLabel>
                      <SelectField
                        field={field}
                        options={LEAD_STAGES.map((stage) => ({ value: stage, label: LEAD_STAGE_LABELS[stage] }))}
                      />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="priority">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Priority</FieldLabel>
                      <SelectField
                        field={field}
                        options={LEAD_PRIORITIES.map((p) => ({ value: p, label: LEAD_PRIORITY_LABELS[p] }))}
                      />
                    </Field>
                  )}
                </formApi.Field>
              </div>
            </FormSection>

            {/* Deal */}
            <FormSection title="Deal">
              <div className="grid grid-cols-2 gap-3">
                <formApi.Field name="valueRupees" validators={{ onChange: leadFormSchema.shape.valueRupees }}>
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Deal value (₹)</FieldLabel>
                      <BoundInput field={field} inputMode="decimal" placeholder="e.g. 2500000" />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="probability" validators={{ onChange: leadFormSchema.shape.probability }}>
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Win probability %</FieldLabel>
                      <BoundInput field={field} type="number" min={0} max={100} />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="score" validators={{ onChange: leadFormSchema.shape.score }}>
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Lead score</FieldLabel>
                      <BoundInput field={field} type="number" min={0} max={100} />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="enquiryDate">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Enquiry date</FieldLabel>
                      <BoundInput field={field} type="date" />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="expectedCloseDate">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Expected close</FieldLabel>
                      <BoundInput field={field} type="date" />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="lostReason" validators={{ onChange: leadFormSchema.shape.lostReason }}>
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Loss reason (if Closed Lost)</FieldLabel>
                      <BoundInput field={field} maxLength={500} placeholder="e.g. Budget frozen, chose competitor" />
                    </Field>
                  )}
                </formApi.Field>
              </div>
            </FormSection>

            {/* Ownership */}
            <FormSection title="Ownership">
              <div className="grid gap-3 sm:grid-cols-3">
                <formApi.Field name="assignedTo">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Assignee</FieldLabel>
                      <SelectField
                        field={field}
                        options={[
                          { value: '', label: 'Unassigned' },
                          ...options.employees.map((emp) => ({
                            value: emp.id,
                            label: [emp.firstName, emp.lastName].filter(Boolean).join(' '),
                          })),
                        ]}
                      />
                    </Field>
                  )}
                </formApi.Field>
                <formApi.Field name="notes" validators={{ onChange: leadFormSchema.shape.notes }}>
                  {(field) => (
                    <Field className="col-span-2">
                      <FieldLabel htmlFor={field.name}>Notes</FieldLabel>
                      <BoundInput field={field} maxLength={5000} />
                    </Field>
                  )}
                </formApi.Field>
              </div>
            </FormSection>
            </div>
            </div>
          </fieldset>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t bg-background px-6 py-3.5">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <formApi.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, submitting]) => (
                <Button type="submit" disabled={!canSubmit}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" /> Saving…
                    </>
                  ) : lead ? (
                    'Update Lead'
                  ) : (
                    'Create Lead'
                  )}
                </Button>
              )}
            </formApi.Subscribe>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
