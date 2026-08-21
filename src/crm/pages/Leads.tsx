import { useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  IndianRupee,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
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

/** Narrow a raw form string to a literal union, falling back when out of range. */
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

  useHotkey({ key: 'Escape' }, () => {
    setForm({ lead: null, open: false })
    setDeleteTarget(null)
  })
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
  async function handleSaveLead(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)

    const companyId = String(fd.get('companyId') ?? '')
    const companyName = String(fd.get('companyName') ?? '').trim()
    const selectedCompany = data.options.companies.find((c) => c.id === companyId)
    const finalCompanyName = selectedCompany ? selectedCompany.name : companyName

    const valueRupees = String(fd.get('valueRupees') ?? '').trim()
    const probabilityRaw = String(fd.get('probability') ?? '').trim()
    const scoreRaw = String(fd.get('score') ?? '').trim()
    const ccRaw = String(fd.get('ccEmails') ?? '')

    const payload = {
      companyId: companyId || null,
      companyName: finalCompanyName,
      contactName: String(fd.get('contactName') ?? '') || null,
      contactEmail: String(fd.get('contactEmail') ?? '') || null,
      contactPhone: String(fd.get('contactPhone') ?? '') || null,
      designation: String(fd.get('designation') ?? '') || null,
      inquiryEmail: String(fd.get('inquiryEmail') ?? '') || null,
      ccEmails: ccRaw.split(',').map((s) => s.trim()).filter(Boolean),
      city: String(fd.get('city') ?? '') || null,
      projectDescription: String(fd.get('projectDescription') ?? '') || null,
      enquiryType: oneOf(LEAD_ENQUIRY_TYPES, String(fd.get('enquiryType') ?? ''), 'Email'),
      sourceCode: oneOf(LEAD_SOURCE_CODES, String(fd.get('sourceCode') ?? ''), 'website'),
      stage: oneOf(LEAD_STAGES, String(fd.get('stage') ?? ''), 'prospecting'),
      priority: oneOf(LEAD_PRIORITIES, String(fd.get('priority') ?? ''), 'medium'),
      valuePaise: valueRupees === '' ? null : parseINRToPaise(valueRupees),
      probability: probabilityRaw === '' ? null : Number(probabilityRaw),
      score: scoreRaw === '' ? null : Number(scoreRaw),
      assignedTo: String(fd.get('assignedTo') ?? '') || null,
      enquiryDate: String(fd.get('enquiryDate') ?? '') || null,
      expectedCloseDate: String(fd.get('expectedCloseDate') ?? '') || null,
      lostReason: String(fd.get('lostReason') ?? '') || null,
      notes: String(fd.get('notes') ?? '') || null,
    }

    if (!finalCompanyName || finalCompanyName.length < 2) {
      showFeedback('error', 'Company name is required.')
      setIsSaving(false)
      return
    }

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

      {/* MODAL: CREATE / EDIT LEAD */}
      {form.open && (
        <LeadFormModal
          key={form.lead?.id ?? 'new'}
          lead={form.lead}
          defaultStage={form.stage}
          options={data.options}
          isSaving={isSaving}
          onCancel={() => setForm({ lead: null, open: false })}
          onSubmit={handleSaveLead}
        />
      )}

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

function LeadFormModal({
  lead,
  defaultStage,
  options,
  isSaving,
  onCancel,
  onSubmit,
}: {
  lead: LeadListItem | null
  defaultStage?: LeadStage
  options: LeadsPagePayload['options']
  isSaving: boolean
  onCancel: () => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 760, padding: '24px 28px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {lead ? `Edit Lead ${lead.leadNumber}` : 'New Lead'}
          </h3>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Company */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field>
              <FieldLabel>Link to company master</FieldLabel>
              <select name="companyId" defaultValue={lead?.companyId ?? ''} className="input-base" style={{ height: 40 }}>
                <option value="">— Not linked (enter name below) —</option>
                {options.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>Company name *</FieldLabel>
              <Input name="companyName" defaultValue={lead?.companyName ?? ''} placeholder="e.g. NTPC Limited" required minLength={2} maxLength={255} />
            </Field>
          </div>

          {/* Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Field>
              <FieldLabel>Contact name</FieldLabel>
              <Input name="contactName" defaultValue={lead?.contactName ?? ''} maxLength={255} />
            </Field>
            <Field>
              <FieldLabel>Designation</FieldLabel>
              <Input name="designation" defaultValue={lead?.designation ?? ''} maxLength={100} />
            </Field>
            <Field>
              <FieldLabel>Contact email</FieldLabel>
              <Input name="contactEmail" type="email" defaultValue={lead?.contactEmail ?? ''} maxLength={255} />
            </Field>
            <Field>
              <FieldLabel>Phone</FieldLabel>
              <Input name="contactPhone" defaultValue={lead?.contactPhone ?? ''} maxLength={20} />
            </Field>
          </div>

          {/* Inquiry capture */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field>
              <FieldLabel>Inquiry email (who sent it)</FieldLabel>
              <Input name="inquiryEmail" type="email" defaultValue={lead?.inquiryEmail ?? ''} maxLength={255} />
            </Field>
            <Field>
              <FieldLabel>CC emails (comma-separated)</FieldLabel>
              <Input name="ccEmails" defaultValue={lead?.ccEmails.join(', ') ?? ''} placeholder="a@x.com, b@y.com" />
            </Field>
            <Field>
              <FieldLabel>City</FieldLabel>
              <Input name="city" defaultValue={lead?.city ?? ''} maxLength={100} />
            </Field>
          </div>

          <Field>
            <FieldLabel>Project description</FieldLabel>
            <textarea
              name="projectDescription"
              defaultValue={lead?.projectDescription ?? ''}
              maxLength={5000}
              rows={2}
              className="input-base"
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, resize: 'vertical' }}
            />
          </Field>

          {/* Classification */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Field>
              <FieldLabel>Enquiry type</FieldLabel>
              <select name="enquiryType" defaultValue={lead?.enquiryType ?? 'Email'} className="input-base" style={{ height: 40 }}>
                {LEAD_ENQUIRY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>Source</FieldLabel>
              <select name="sourceCode" defaultValue={lead?.sourceCode ?? 'website'} className="input-base" style={{ height: 40 }}>
                {LEAD_SOURCE_CODES.map((code) => (
                  <option key={code} value={code}>{LEAD_SOURCE_LABELS[code]}</option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>Stage</FieldLabel>
              <select name="stage" defaultValue={lead?.stage ?? defaultStage ?? 'prospecting'} className="input-base" style={{ height: 40 }}>
                {LEAD_STAGES.map((stage) => (
                  <option key={stage} value={stage}>{LEAD_STAGE_LABELS[stage]}</option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>Priority</FieldLabel>
              <select name="priority" defaultValue={lead?.priority ?? 'medium'} className="input-base" style={{ height: 40 }}>
                {LEAD_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{LEAD_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Deal parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
            <Field>
              <FieldLabel>Deal value (₹)</FieldLabel>
              <Input
                name="valueRupees"
                inputMode="decimal"
                defaultValue={lead?.valuePaise != null ? String(paiseToRupeesNumber(lead.valuePaise)) : ''}
                placeholder="e.g. 2500000"
              />
            </Field>
            <Field>
              <FieldLabel>Win probability %</FieldLabel>
              <Input name="probability" type="number" min={0} max={100} defaultValue={lead?.probability ?? ''} />
            </Field>
            <Field>
              <FieldLabel>Lead score</FieldLabel>
              <Input name="score" type="number" min={0} max={100} defaultValue={lead?.score ?? ''} />
            </Field>
            <Field>
              <FieldLabel>Enquiry date</FieldLabel>
              <Input name="enquiryDate" type="date" defaultValue={lead?.enquiryDate ?? new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field>
              <FieldLabel>Expected close</FieldLabel>
              <Input name="expectedCloseDate" type="date" defaultValue={lead?.expectedCloseDate ?? ''} />
            </Field>
            <Field>
              <FieldLabel>Loss reason (if Closed Lost)</FieldLabel>
              <Input name="lostReason" defaultValue={lead?.lostReason ?? ''} maxLength={500} placeholder="e.g. Budget frozen, chose competitor" />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Field>
              <FieldLabel>Assignee</FieldLabel>
              <select name="assignedTo" defaultValue={lead?.assignedTo ?? ''} className="input-base" style={{ height: 40 }}>
                <option value="">Unassigned</option>
                {options.employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {[emp.firstName, emp.lastName].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>Notes</FieldLabel>
              <Input name="notes" defaultValue={lead?.notes ?? ''} maxLength={5000} />
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <Button type="submit" disabled={isSaving} className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]">
              {isSaving ? 'Saving…' : lead ? 'Update Lead' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
