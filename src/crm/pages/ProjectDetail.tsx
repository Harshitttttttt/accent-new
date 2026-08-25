import { useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  IndianRupee,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'
import { RichTextEditor } from '~/components/crm/rich-text-editor'
import { calculateMargin, formatPaise, parseINRToPaise, paiseToRupeesNumber } from '~/lib/money'
import { timeAgo } from '~/lib/utils'
import {
  MILESTONE_STATUSES,
  MILESTONE_STATUS_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_BADGES,
  PROJECT_STATUS_LABELS,
  RISK_SEVERITIES,
  RISK_STATUSES,
  type ProjectDetail,
  type ProjectDetailPayload,
  type ProjectStatus,
  type ProjectTimelineItem,
} from '~/lib/projects'
import {
  addProjectCommentAction,
  getProjectDetailData,
  updateProjectAction,
  updateProjectStatusAction,
} from '~/lib/projects.functions'

// ── Form state mapping ───────────────────────────────────────────────────
type MemberFormLine = { employeeId: string; role: string }
type MilestoneFormLine = { name: string; dueDate: string; status: 'pending' | 'in_progress' | 'done' }
type RiskFormLine = { description: string; severity: 'low' | 'medium' | 'high'; mitigation: string; status: 'open' | 'mitigated' | 'closed' }
type SoftwareFormLine = { softwareId: string; name: string; notes: string }

type DetailFormState = {
  name: string
  description: string
  companyId: string
  companyName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  designation: string
  city: string
  siteLocation: string
  priority: 'low' | 'medium' | 'high'
  contractType: 'lumpsum' | 'manhours_basis' | 'line_wise'
  progress: string
  contractValueRupees: string
  estimatedCostRupees: string
  startDate: string
  endDate: string
  kickoffMeetingDate: string
  modeOfDelivery: string
  paymentTerms: string
  otherTerms: string
  notes: string
  projectManagerId: string
  scopeOfWork: string
  inputDocuments: string[]
  deliverables: string[]
  exclusions: string[]
  software: SoftwareFormLine[]
  members: MemberFormLine[]
  milestones: MilestoneFormLine[]
  risks: RiskFormLine[]
}

function detailToForm(detail: ProjectDetail): DetailFormState {
  return {
    name: detail.name,
    description: detail.description ?? '',
    companyId: detail.companyId ?? '',
    companyName: detail.companyName,
    contactName: detail.contactName ?? '',
    contactEmail: detail.contactEmail ?? '',
    contactPhone: detail.contactPhone ?? '',
    designation: detail.designation ?? '',
    city: detail.city ?? '',
    siteLocation: detail.siteLocation ?? '',
    priority: detail.priority,
    contractType: detail.contractType,
    progress: String(detail.progress),
    contractValueRupees:
      detail.contractValuePaise != null ? String(paiseToRupeesNumber(detail.contractValuePaise)) : '',
    estimatedCostRupees:
      detail.estimatedCostPaise != null ? String(paiseToRupeesNumber(detail.estimatedCostPaise)) : '',
    startDate: detail.startDate ?? '',
    endDate: detail.endDate ?? '',
    kickoffMeetingDate: detail.kickoffMeetingDate ?? '',
    modeOfDelivery: detail.modeOfDelivery ?? '',
    paymentTerms: detail.paymentTerms ?? '',
    otherTerms: detail.otherTerms ?? '',
    notes: detail.notes ?? '',
    projectManagerId: detail.projectManagerId ?? '',
    scopeOfWork: detail.scopeOfWork ?? '',
    inputDocuments: [...detail.inputDocuments],
    deliverables: [...detail.deliverables],
    exclusions: [...detail.exclusions],
    software: detail.software.map((s) => ({ softwareId: s.softwareId ?? '', name: s.name, notes: s.notes ?? '' })),
    members: detail.members.map((m) => ({ employeeId: m.employeeId, role: m.role })),
    milestones: detail.milestones.map((m) => ({
      name: m.name,
      dueDate: m.dueDate ?? '',
      status: m.status,
    })),
    risks: detail.risks.map((r) => ({
      description: r.description,
      severity: r.severity,
      mitigation: r.mitigation ?? '',
      status: r.status,
    })),
  }
}

function formToUpdatePayload(form: DetailFormState, id: string) {
  return {
    id,
    name: form.name.trim(),
    description: form.description.trim() || null,
    companyId: form.companyId || null,
    companyName: form.companyName.trim(),
    contactName: form.contactName.trim() || null,
    contactEmail: form.contactEmail.trim() || null,
    contactPhone: form.contactPhone.trim() || null,
    designation: form.designation.trim() || null,
    city: form.city.trim() || null,
    siteLocation: form.siteLocation.trim() || null,
    priority: form.priority,
    contractType: form.contractType,
    progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
    contractValuePaise: form.contractValueRupees.trim() === '' ? null : parseINRToPaise(form.contractValueRupees),
    estimatedCostPaise: form.estimatedCostRupees.trim() === '' ? null : parseINRToPaise(form.estimatedCostRupees),
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    kickoffMeetingDate: form.kickoffMeetingDate || null,
    modeOfDelivery: form.modeOfDelivery.trim() || null,
    paymentTerms: form.paymentTerms.trim() || null,
    otherTerms: form.otherTerms.trim() || null,
    notes: form.notes.trim() || null,
    projectManagerId: form.projectManagerId || null,
    scopeOfWork: form.scopeOfWork.trim() || null,
    inputDocuments: form.inputDocuments.map((s) => s.trim()).filter(Boolean),
    deliverables: form.deliverables.map((s) => s.trim()).filter(Boolean),
    exclusions: form.exclusions.map((s) => s.trim()).filter(Boolean),
    software: form.software
      .map((s) => ({ softwareId: s.softwareId || null, name: s.name.trim(), notes: s.notes.trim() || null }))
      .filter((s) => s.name !== ''),
    members: form.members.filter((m) => m.employeeId !== ''),
    milestones: form.milestones
      .filter((m) => m.name.trim() !== '')
      .map((m) => ({
        name: m.name.trim(),
        dueDate: m.dueDate || null,
        status: m.status,
      })),
    risks: form.risks
      .filter((r) => r.description.trim() !== '')
      .map((r) => ({
        description: r.description.trim(),
        severity: r.severity,
        mitigation: r.mitigation.trim() || null,
        status: r.status,
      })),
  }
}

// ── Small building blocks ────────────────────────────────────────────────
function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: span ? `span ${span}` : undefined }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  width: '100%',
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, resize: 'vertical', ...props.style }} />
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputStyle, ...props.style }} />
}

function FormCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 20 }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700 }}>{title}</h4>
      {hint && <p style={{ margin: '0 0 12px', fontSize: 11.5, color: 'var(--text-muted)' }}>{hint}</p>}
      <div style={{ marginTop: hint ? 0 : 12 }}>{children}</div>
    </section>
  )
}

function StringListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 18, textAlign: 'right' }}>{i + 1}.</span>
          <TextInput
            value={item}
            placeholder={placeholder}
            maxLength={500}
            onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <button
            type="button"
            className="btn-ghost"
            style={{ color: 'var(--danger)', padding: 6 }}
            title="Remove"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 12.5 }} onClick={() => onChange([...items, ''])}>
        <Plus size={13} /> Add item
      </button>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────
type TabId = 'overview' | 'scope' | 'team' | 'milestones' | 'risks' | 'commercials' | 'activity'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'scope', label: 'Scope' },
  { id: 'team', label: 'Team' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'risks', label: 'Risks' },
  { id: 'commercials', label: 'Commercials' },
  { id: 'activity', label: 'Activity' },
]

export default function ProjectDetailPage({ initialData }: { initialData: ProjectDetailPayload }) {
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ProjectDetail | null>(initialData.project)
  const options = initialData.options
  const [form, setForm] = useState<DetailFormState | null>(detail ? detailToForm(detail) : null)
  const [tab, setTab] = useState<TabId>('overview')
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const projectId = detail?.id ?? ''

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function refresh() {
    const next = await getProjectDetailData({ data: { id: projectId } })
    if (next.project) {
      setDetail(next.project)
      setForm(detailToForm(next.project))
    }
  }

  function set<K extends keyof DetailFormState>(key: K, value: DetailFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!form || !detail) return
    if (form.name.trim().length < 2) {
      showFeedback('error', 'Project name must be at least 2 characters.')
      setTab('overview')
      return
    }
    if (form.companyName.trim().length < 2) {
      showFeedback('error', 'Client name must be at least 2 characters.')
      setTab('overview')
      return
    }
    setIsSaving(true)
    try {
      const res = await updateProjectAction({ data: formToUpdatePayload(form, detail.id) })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `${detail.projectNumber} saved.`)
      await refresh()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleStatusChange(status: ProjectStatus) {
    if (!detail) return
    try {
      const res = await updateProjectStatusAction({ data: { id: detail.id, status, note: null } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Status set to ${PROJECT_STATUS_LABELS[status]}.`)
      await refresh()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Status update failed.')
    }
  }

  // ── Unauthorized / not-found states ────────────────────────────────────
  if (!initialData.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <AlertCircle size={28} style={{ color: 'var(--warning)', margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            You need the <strong>projects.read</strong> permission to view projects.
          </p>
        </div>
      </div>
    )
  }

  if (!detail || !form) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: 2 }}>
            Project not found
          </p>
          <h1 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>That project is not in the workspace.</h1>
          <Link className="btn-secondary" to="/projects">
            <ArrowLeft size={14} /> Back to projects
          </Link>
        </div>
      </div>
    )
  }

  const margin =
    detail.contractValuePaise != null && detail.estimatedCostPaise != null && detail.contractValuePaise > 0
      ? calculateMargin(detail.contractValuePaise, detail.estimatedCostPaise)
      : null
  const doneMilestones = detail.milestones.filter((m) => m.status === 'done').length
  const openRisks = detail.risks.filter((r) => r.status === 'open').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: 6, marginTop: 2 }}
            title="Back to projects"
            onClick={() => void navigate({ to: '/projects' })}
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {detail.projectNumber} — {form.name || 'Untitled project'}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{form.companyName}</span>
              <span className={`badge ${PROJECT_STATUS_BADGES[detail.status]}`} style={{ fontSize: 9 }}>
                {PROJECT_STATUS_LABELS[detail.status]}
              </span>
              {detail.proposalNumber && <span>from {detail.proposalNumber}</span>}
              {detail.contractValuePaise != null && (
                <strong style={{ color: 'var(--brand-primary)' }}>
                  {formatPaise(detail.contractValuePaise, { decimals: 0 })}
                </strong>
              )}
              {margin && (
                <span>
                  margin{' '}
                  <strong style={{ color: margin.marginPercentage.gte(0) ? 'var(--success)' : 'var(--danger)' }}>
                    {margin.marginPercentage.toFixed(1)}%
                  </strong>
                </span>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Select
            aria-label="Project status"
            value={detail.status}
            onChange={(e) => void handleStatusChange(e.target.value as ProjectStatus)}
            style={{ width: 'auto', fontWeight: 600 }}
          >
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PROJECT_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Changes
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {TABS.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                padding: '10px 12px',
                fontSize: 12.5,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--brand-primary)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? 'var(--brand-primary)' : 'transparent'}`,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {label}
              {id === 'risks' && openRisks > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--danger)' }}>{openRisks}</span>
              )}
              {id === 'milestones' && detail.milestones.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
                  {doneMilestones}/{detail.milestones.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980 }}>
          {tab === 'overview' && (
            <>
              <FormCard title="Identity">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Project name *">
                    <TextInput value={form.name} maxLength={255} onChange={(e) => set('name', e.target.value)} />
                  </Field>
                  <Field label="Project manager">
                    <Select value={form.projectManagerId} onChange={(e) => set('projectManagerId', e.target.value)}>
                      <option value="">— Unassigned —</option>
                      {options.employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {[emp.firstName, emp.lastName].filter(Boolean).join(' ')}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Priority">
                    <Select value={form.priority} onChange={(e) => set('priority', e.target.value as DetailFormState['priority'])}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </Select>
                  </Field>
                  <Field label="Contract type">
                    <Select value={form.contractType} onChange={(e) => set('contractType', e.target.value as DetailFormState['contractType'])}>
                      <option value="lumpsum">Lumpsum</option>
                      <option value="manhours_basis">Man-hours basis</option>
                      <option value="line_wise">Line-wise</option>
                    </Select>
                  </Field>
                  <Field label={`Progress — ${form.progress}%`} span={2}>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={Number(form.progress) || 0}
                      onChange={(e) => set('progress', e.target.value)}
                      style={{ width: '100%', accentColor: 'var(--brand-primary)' }}
                    />
                  </Field>
                </div>
              </FormCard>

              <FormCard title="Client">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Link to company master">
                    <Select
                      value={form.companyId}
                      onChange={(e) => {
                        const company = options.companies.find((c) => c.id === e.target.value)
                        setForm((prev) =>
                          prev
                            ? { ...prev, companyId: e.target.value, companyName: company ? company.name : prev.companyName }
                            : prev,
                        )
                      }}
                    >
                      <option value="">— Not linked (enter name below) —</option>
                      {options.companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Client name *">
                    <TextInput value={form.companyName} maxLength={255} onChange={(e) => set('companyName', e.target.value)} />
                  </Field>
                  <Field label="Contact name">
                    <TextInput value={form.contactName} maxLength={255} onChange={(e) => set('contactName', e.target.value)} />
                  </Field>
                  <Field label="Designation">
                    <TextInput value={form.designation} maxLength={100} onChange={(e) => set('designation', e.target.value)} />
                  </Field>
                  <Field label="Contact email">
                    <TextInput type="email" value={form.contactEmail} maxLength={255} onChange={(e) => set('contactEmail', e.target.value)} />
                  </Field>
                  <Field label="Phone">
                    <TextInput value={form.contactPhone} maxLength={20} onChange={(e) => set('contactPhone', e.target.value)} />
                  </Field>
                  <Field label="City">
                    <TextInput value={form.city} maxLength={100} onChange={(e) => set('city', e.target.value)} />
                  </Field>
                  <Field label="Client site location">
                    <TextInput value={form.siteLocation} maxLength={255} onChange={(e) => set('siteLocation', e.target.value)} />
                  </Field>
                </div>
              </FormCard>

              <FormCard title="Schedule">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Field label="Start date">
                    <TextInput type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
                  </Field>
                  <Field label="End date">
                    <TextInput type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
                  </Field>
                  <Field label="Kickoff meeting">
                    <TextInput type="date" value={form.kickoffMeetingDate} onChange={(e) => set('kickoffMeetingDate', e.target.value)} />
                  </Field>
                </div>
              </FormCard>

              <FormCard title="Description">
                <TextArea rows={4} value={form.description} maxLength={10_000} onChange={(e) => set('description', e.target.value)} />
              </FormCard>

              <FormCard title="Internal notes">
                <TextArea rows={3} value={form.notes} maxLength={5_000} onChange={(e) => set('notes', e.target.value)} />
              </FormCard>
            </>
          )}

          {tab === 'scope' && (
            <>
              <FormCard
                title="Scope of work"
                hint="Client-facing document carried from the proposal — refine as delivery reality sets in."
              >
                <RichTextEditor
                  value={form.scopeOfWork}
                  onChange={(html) => set('scopeOfWork', html)}
                  disabled={isSaving}
                  minHeight={320}
                />
              </FormCard>
              <FormCard title="Input documents" hint="Documents expected from the client.">
                <StringListEditor items={form.inputDocuments} onChange={(next) => set('inputDocuments', next)} placeholder="e.g. P&ID, equipment layout" />
              </FormCard>
              <FormCard title="Deliverables" hint="Documents and outputs ATS will hand over.">
                <StringListEditor items={form.deliverables} onChange={(next) => set('deliverables', next)} placeholder="e.g. Stress analysis report" />
              </FormCard>
              <FormCard title="Exclusions" hint="Work explicitly NOT covered by the contract.">
                <StringListEditor items={form.exclusions} onChange={(next) => set('exclusions', next)} placeholder="e.g. Statutory approvals" />
              </FormCard>
              <FormCard title="Software" hint="Software licenses used on this project.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.software.map((line, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: 8, alignItems: 'center' }}>
                      <Select
                        value={line.softwareId}
                        onChange={(e) => {
                          const master = options.software.find((s) => s.id === e.target.value)
                          set('software', form.software.map((v, j) => (j === i ? { ...v, softwareId: e.target.value, name: master ? master.name : v.name } : v)))
                        }}
                      >
                        <option value="">— Custom software —</option>
                        {options.software.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                            {s.version ? ` (${s.version})` : ''}
                          </option>
                        ))}
                      </Select>
                      <TextInput
                        value={line.notes}
                        placeholder="Notes (e.g. 2 licenses)"
                        maxLength={500}
                        onChange={(e) => set('software', form.software.map((v, j) => (j === i ? { ...v, notes: e.target.value } : v)))}
                      />
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ color: 'var(--danger)', padding: 6 }}
                        title="Remove"
                        onClick={() => set('software', form.software.filter((_, j) => j !== i))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ alignSelf: 'flex-start', fontSize: 12.5 }}
                    onClick={() => set('software', [...form.software, { softwareId: '', name: '', notes: '' }])}
                  >
                    <Plus size={13} /> Add software
                  </button>
                </div>
              </FormCard>
            </>
          )}

          {tab === 'team' && (
            <FormCard title="Project team" hint="Members and their role on this project.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: 8, fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <span>Member</span>
                  <span>Role</span>
                  <span />
                </div>
                {form.members.map((member, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: 8, alignItems: 'center' }}>
                    <Select
                      value={member.employeeId}
                      onChange={(e) => set('members', form.members.map((v, j) => (j === i ? { ...v, employeeId: e.target.value } : v)))}
                    >
                      <option value="">— Select —</option>
                      {options.employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {[emp.firstName, emp.lastName].filter(Boolean).join(' ')}
                        </option>
                      ))}
                    </Select>
                    <TextInput
                      value={member.role}
                      placeholder="e.g. Lead structural engineer"
                      maxLength={100}
                      onChange={(e) => set('members', form.members.map((v, j) => (j === i ? { ...v, role: e.target.value } : v)))}
                    />
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ color: 'var(--danger)', padding: 6 }}
                      title="Remove"
                      onClick={() => set('members', form.members.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ alignSelf: 'flex-start', fontSize: 12.5 }}
                  onClick={() => set('members', [...form.members, { employeeId: '', role: 'Engineer' }])}
                >
                  <Plus size={13} /> Add member
                </button>
              </div>
            </FormCard>
          )}

          {tab === 'milestones' && (
            <FormCard title="Milestones" hint="Key delivery checkpoints. Completed milestones stamp a completion date on save.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 160px 140px auto', gap: 8, fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <span>Milestone</span>
                  <span>Due</span>
                  <span>Status</span>
                  <span />
                </div>
                {form.milestones.map((milestone, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 160px 140px auto', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      value={milestone.name}
                      placeholder="e.g. Interim model review"
                      maxLength={255}
                      onChange={(e) => set('milestones', form.milestones.map((v, j) => (j === i ? { ...v, name: e.target.value } : v)))}
                    />
                    <TextInput
                      type="date"
                      value={milestone.dueDate}
                      onChange={(e) => set('milestones', form.milestones.map((v, j) => (j === i ? { ...v, dueDate: e.target.value } : v)))}
                    />
                    <Select
                      value={milestone.status}
                      onChange={(e) =>
                        set(
                          'milestones',
                          form.milestones.map((v, j) =>
                            j === i ? { ...v, status: e.target.value as MilestoneFormLine['status'] } : v,
                          ),
                        )
                      }
                    >
                      {MILESTONE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {MILESTONE_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ color: 'var(--danger)', padding: 6 }}
                      title="Remove"
                      onClick={() => set('milestones', form.milestones.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ alignSelf: 'flex-start', fontSize: 12.5 }}
                  onClick={() => set('milestones', [...form.milestones, { name: '', dueDate: '', status: 'pending' }])}
                >
                  <Plus size={13} /> Add milestone
                </button>
              </div>
            </FormCard>
          )}

          {tab === 'risks' && (
            <FormCard title="Risks" hint="Delivery risks, their severity and mitigation plan.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.risks.map((risk, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px auto', gap: 8, alignItems: 'center' }}>
                      <TextInput
                        value={risk.description}
                        placeholder="e.g. Client input drawings may arrive late"
                        maxLength={1_000}
                        onChange={(e) => set('risks', form.risks.map((v, j) => (j === i ? { ...v, description: e.target.value } : v)))}
                      />
                      <Select
                        value={risk.severity}
                        onChange={(e) => set('risks', form.risks.map((v, j) => (j === i ? { ...v, severity: e.target.value as RiskFormLine['severity'] } : v)))}
                      >
                        {RISK_SEVERITIES.map((s) => (
                          <option key={s} value={s}>
                            {s[0].toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={risk.status}
                        onChange={(e) => set('risks', form.risks.map((v, j) => (j === i ? { ...v, status: e.target.value as RiskFormLine['status'] } : v)))}
                      >
                        {RISK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s[0].toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ color: 'var(--danger)', padding: 6 }}
                        title="Remove"
                        onClick={() => set('risks', form.risks.filter((_, j) => j !== i))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <TextInput
                      value={risk.mitigation}
                      placeholder="Mitigation plan"
                      maxLength={2_000}
                      onChange={(e) => set('risks', form.risks.map((v, j) => (j === i ? { ...v, mitigation: e.target.value } : v)))}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ alignSelf: 'flex-start', fontSize: 12.5 }}
                  onClick={() => set('risks', [...form.risks, { description: '', severity: 'medium', mitigation: '', status: 'open' }])}
                >
                  <Plus size={13} /> Add risk
                </button>
              </div>
            </FormCard>
          )}

          {tab === 'commercials' && (
            <>
              <FormCard title="Commercials" hint="Contract value comes from the accepted proposal; cost feeds the margin.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Contract value (₹)">
                    <TextInput
                      value={form.contractValueRupees}
                      inputMode="decimal"
                      onChange={(e) => set('contractValueRupees', e.target.value)}
                    />
                  </Field>
                  <Field label="Estimated cost to company (₹)">
                    <TextInput
                      value={form.estimatedCostRupees}
                      inputMode="decimal"
                      onChange={(e) => set('estimatedCostRupees', e.target.value)}
                    />
                  </Field>
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 14, alignItems: 'baseline', padding: '8px 10px', background: 'var(--surface-secondary)', borderRadius: 8 }}>
                  {margin ? (
                    <>
                      <IndianRupee size={14} style={{ color: 'var(--brand-primary)' }} />
                      <span style={{ fontSize: 15, fontWeight: 800, color: margin.marginPercentage.gte(0) ? 'var(--success)' : 'var(--danger)' }}>
                        {margin.marginPercentage.toFixed(1)}%
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                        gross profit {formatPaise(margin.grossProfitPaise, { decimals: 0 })}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      Enter value and cost to see margin.
                    </span>
                  )}
                </div>
              </FormCard>
              <FormCard title="Payment terms">
                <TextArea rows={6} value={form.paymentTerms} maxLength={10_000} onChange={(e) => set('paymentTerms', e.target.value)} />
              </FormCard>
              <FormCard title="Other terms & conditions">
                <TextArea rows={8} value={form.otherTerms} maxLength={10_000} onChange={(e) => set('otherTerms', e.target.value)} />
              </FormCard>
            </>
          )}

          {tab === 'activity' && (
            <ActivityPanel
              projectId={detail.id}
              timeline={detail.timeline}
              statusLabels={PROJECT_STATUS_LABELS}
              onChanged={() => void refresh()}
              onFeedback={showFeedback}
            />
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

// ── Activity timeline (Twenty-style: composer on top, unified feed) ──────
function ActivityPanel({
  projectId,
  timeline,
  statusLabels,
  onChanged,
  onFeedback,
}: {
  projectId: string
  timeline: ProjectTimelineItem[]
  statusLabels: Record<string, string>
  onChanged: () => Promise<void> | void
  onFeedback: (type: 'success' | 'error', message: string) => void
}) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd() {
    if (body.trim() === '') return
    setBusy(true)
    try {
      const res = await addProjectCommentAction({ data: { projectId, body: body.trim() } })
      if (!res.ok) throw new Error(res.message)
      setBody('')
      await onChanged()
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to add comment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormCard title="Activity" hint="Everything that happened on this project — status changes and discussion, newest first.">
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
        <TextArea
          rows={2}
          value={body}
          placeholder="Write a note…"
          maxLength={5_000}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button onClick={() => void handleAdd()} disabled={busy || body.trim() === ''}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />} Note
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {timeline.length === 0 && (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>No activity yet.</p>
        )}
        {timeline.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', gap: 12 }}>
            {/* Rail */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  marginTop: 5,
                  background:
                    item.kind === 'status'
                      ? 'var(--brand-primary)'
                      : item.kind === 'comment'
                        ? 'var(--info)'
                        : 'var(--border)',
                  flexShrink: 0,
                }}
              />
              {i < timeline.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border-subtle)' }} />}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: 16, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{item.authorName ?? 'System'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }} title={new Date(item.at).toLocaleString('en-IN')}>
                  {timeAgo(item.at)}
                </span>
              </div>
              {item.kind === 'status' ? (
                <p style={{ margin: 0, fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {item.fromStatus && (
                    <>
                      <span className="badge badge-neutral" style={{ fontSize: 9.5 }}>
                        {statusLabels[item.fromStatus] ?? item.fromStatus}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>→</span>
                    </>
                  )}
                  {!item.fromStatus && <span style={{ color: 'var(--text-muted)' }}>created as</span>}
                  <span className="badge badge-purple" style={{ fontSize: 9.5 }}>
                    {statusLabels[item.toStatus ?? ''] ?? item.toStatus}
                  </span>
                  {item.note && <span style={{ color: 'var(--text-muted)' }}>— {item.note}</span>}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{item.body}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </FormCard>
  )
}
