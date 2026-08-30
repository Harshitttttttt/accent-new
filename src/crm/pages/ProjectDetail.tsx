import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  ASSIGNMENT_PRIORITIES,
  ASSIGNMENT_PRIORITY_LABELS,
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_STATUS_BADGES,
  ASSIGNMENT_STATUS_LABELS,
  formatMinutes,
  type AssignmentListItem,
  type AssignmentPriority,
  type AssignmentStatus,
  type WorkLogEntry,
} from '~/lib/project-activities'
import {
  createAssignmentAction,
  createAssignmentLogAction,
  deleteAssignmentAction,
  deleteAssignmentLogAction,
  getActivityMasterTreeData,
  getProjectAssignments,
  getProjectWorkLogs,
  updateAssignmentAction,
} from '~/lib/project-activities.functions'
import type { ActivityTreeDiscipline } from '~/lib/project-activities'

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
  padding: '0 10px',
  height: 36,
  fontSize: 13,
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  width: '100%',
  boxSizing: 'border-box',
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', ...props.style }} />
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputStyle, cursor: 'pointer', ...props.style }} />
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
type TabId = 'overview' | 'scope' | 'team' | 'milestones' | 'activities' | 'risks' | 'commercials' | 'activity'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'scope', label: 'Scope' },
  { id: 'team', label: 'Team' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'activities', label: 'Activities' },
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
            {isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}{' '}
            Save changes
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

          {tab === 'activities' && (
            <ActivitiesPanel projectId={detail.id} options={options} onFeedback={showFeedback} />
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

// ── Activities: assignments + work logs (old CRM's ProjectActivityTab, rebuilt) ──
type AddFormState = {
  disciplineId: string
  activityId: string
  subActivityId: string
  assigneeId: string
  plannedHours: string
  quantity: string
  dueDate: string
  priority: AssignmentPriority
}

function minutesToHoursInput(minutes: number): string {
  if (minutes <= 0) return ''
  return String(minutes / 60)
}

function ActivitiesPanel({
  projectId,
  options,
  onFeedback,
}: {
  projectId: string
  options: ProjectDetailPayload['options']
  onFeedback: (type: 'success' | 'error', message: string) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  const [view, setView] = useState<'assignments' | 'daywise'>('assignments')
  const [tree, setTree] = useState<ActivityTreeDiscipline[]>([])
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [addForm, setAddForm] = useState<AddFormState>({
    disciplineId: '',
    activityId: '',
    subActivityId: '',
    assigneeId: '',
    plannedHours: '',
    quantity: '',
    dueDate: '',
    priority: 'medium',
  })
  const [adding, setAdding] = useState(false)

  const [logFormFor, setLogFormFor] = useState<string | null>(null)
  const [logForm, setLogForm] = useState({ logDate: today, hours: '', note: '' })
  const [logging, setLogging] = useState(false)

  const [localRemarks, setLocalRemarks] = useState<Record<string, string>>({})
  const [remarkState, setRemarkState] = useState<Record<string, 'saving' | 'saved' | 'error'>>({})
  const remarkTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Day-wise state
  const [logs, setLogs] = useState<WorkLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [range, setRange] = useState({ start: thirtyAgo, end: today })
  const [assigneeFilter, setAssigneeFilter] = useState('all')

  async function loadAssignments() {
    const rows = await getProjectAssignments({ data: { projectId } })
    setAssignments(rows)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [rows, masterTree] = await Promise.all([
          getProjectAssignments({ data: { projectId } }),
          getActivityMasterTreeData(),
        ])
        if (!cancelled) {
          setAssignments(rows)
          setTree(masterTree)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  useEffect(() => {
    if (view !== 'daywise') return
    let cancelled = false
    setLogsLoading(true)
    void getProjectWorkLogs({ data: { projectId, startDate: range.start, endDate: range.end, assigneeId: assigneeFilter === 'all' ? null : assigneeFilter } })
      .then((rows) => {
        if (!cancelled) setLogs(rows)
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [view, projectId, range, assigneeFilter])

  // Cleanup pending remark timers on unmount
  useEffect(() => {
    const timers = remarkTimers.current
    return () => {
      for (const t of Object.values(timers)) clearTimeout(t)
    }
  }, [])

  const selectedDiscipline = tree.find((d) => d.id === addForm.disciplineId)
  const selectedActivity = selectedDiscipline?.activities.find((a) => a.id === addForm.activityId)
  const selectedSub = selectedActivity?.subActivities.find((s) => s.id === addForm.subActivityId)

  async function handleAdd() {
    const discipline = tree.find((d) => d.id === addForm.disciplineId)
    const activity = discipline?.activities.find((a) => a.id === addForm.activityId)
    if (!discipline || !activity) {
      onFeedback('error', 'Select a discipline and an activity.')
      return
    }
    const sub = activity.subActivities.find((s) => s.id === addForm.subActivityId)
    const plannedMinutes = addForm.plannedHours.trim() === '' ? 0 : Math.round(parseFloat(addForm.plannedHours) * 60)
    if (Number.isNaN(plannedMinutes) || plannedMinutes < 0) {
      onFeedback('error', 'Planned hours must be a number.')
      return
    }
    setAdding(true)
    try {
      const res = await createAssignmentAction({
        data: {
          projectId,
          disciplineId: discipline.id,
          activityId: activity.id,
          subActivityId: sub?.id ?? null,
          disciplineName: discipline.name,
          activityName: activity.name,
          subActivityName: sub?.name ?? null,
          assigneeId: addForm.assigneeId || null,
          plannedMinutes,
          quantity: addForm.quantity.trim() === '' ? null : Number(addForm.quantity),
          dueDate: addForm.dueDate || null,
          priority: addForm.priority,
          remark: null,
        },
      })
      if (!res.ok) throw new Error(res.message)
      onFeedback('success', 'Activity assigned.')
      setAddForm({ disciplineId: '', activityId: '', subActivityId: '', assigneeId: '', plannedHours: '', quantity: '', dueDate: '', priority: 'medium' })
      await loadAssignments()
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to assign activity.')
    } finally {
      setAdding(false)
    }
  }

  async function patch(id: string, fields: Record<string, unknown>): Promise<boolean> {
    const res = await updateAssignmentAction({ data: { id, ...fields } })
    if (!res.ok) {
      onFeedback('error', res.message)
      return false
    }
    return true
  }

  function handleRemarkChange(assignment: AssignmentListItem, text: string) {
    setLocalRemarks((prev) => ({ ...prev, [assignment.id]: text }))
    setRemarkState((prev) => ({ ...prev, [assignment.id]: 'saving' }))
    clearTimeout(remarkTimers.current[assignment.id])
    remarkTimers.current[assignment.id] = setTimeout(async () => {
      const ok = await patch(assignment.id, { remark: text })
      setRemarkState((prev) => ({ ...prev, [assignment.id]: ok ? 'saved' : 'error' }))
      if (ok) setTimeout(() => setRemarkState((p) => ({ ...p, [assignment.id]: 'idle' as never })), 2000)
    }, 800)
  }

  async function handleLogWork(assignmentId: string) {
    const minutes = logForm.hours.trim() === '' ? 0 : Math.round(parseFloat(logForm.hours) * 60)
    if (!minutes || minutes <= 0) {
      onFeedback('error', 'Enter the hours you worked.')
      return
    }
    setLogging(true)
    try {
      const res = await createAssignmentLogAction({
        data: { assignmentId, logDate: logForm.logDate, minutes, note: logForm.note.trim() || null },
      })
      if (!res.ok) throw new Error(res.message)
      onFeedback('success', `Logged ${formatMinutes(minutes)}.`)
      setLogFormFor(null)
      setLogForm({ logDate: today, hours: '', note: '' })
      await loadAssignments()
      if (view === 'daywise') setLogsLoading(true)
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to log work.')
    } finally {
      setLogging(false)
    }
  }

  async function handleDelete(assignment: AssignmentListItem) {
    if (confirmDelete !== assignment.id) {
      setConfirmDelete(assignment.id)
      setTimeout(() => setConfirmDelete((c) => (c === assignment.id ? null : c)), 3000)
      return
    }
    setConfirmDelete(null)
    const res = await deleteAssignmentAction({ data: { id: assignment.id } })
    if (!res.ok) {
      onFeedback('error', res.message)
      return
    }
    onFeedback('success', 'Assignment removed.')
    await loadAssignments()
  }

  // Day-wise grouping: employee → date → entries, with totals.
  const dayGroups = useMemo(() => {
    const byUser = new Map<string, { name: string; dates: Map<string, WorkLogEntry[]>; total: number }>()
    for (const entry of logs) {
      const key = entry.assigneeId ?? 'unassigned'
      if (!byUser.has(key)) byUser.set(key, { name: entry.assigneeName ?? 'Unassigned', dates: new Map(), total: 0 })
      const user = byUser.get(key)!
      if (!user.dates.has(entry.logDate)) user.dates.set(entry.logDate, [])
      user.dates.get(entry.logDate)!.push(entry)
      user.total += entry.minutes
    }
    return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [logs])
  const grandTotal = logs.reduce((sum, e) => sum + e.minutes, 0)

  const tabular = { fontVariantNumeric: 'tabular-nums' as const }
  const compactSelect = { padding: '4px 8px', fontSize: 12, width: '100%' }

  return (
    <>
      {/* View toggle */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {(['assignments', 'daywise'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className="btn-ghost"
              style={{
                padding: '7px 14px',
                borderRadius: 0,
                fontSize: 12.5,
                fontWeight: view === v ? 700 : 500,
                background: view === v ? 'var(--brand-primary)' : 'transparent',
                color: view === v ? '#fff' : 'var(--text-muted)',
              }}
              onClick={() => setView(v)}
            >
              {v === 'assignments' ? 'By activity' : 'Day-wise log'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {assignments.length} assignment{assignments.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <FormCard title="Activities">
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>Loading…</p>
        </FormCard>
      ) : view === 'assignments' ? (
        <>
          {/* Assign form */}
          <FormCard title="Assign activity" hint="Pick from the Discipline → Activity → Sub-activity masters; effort is planned in hours.">
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.2fr 1.2fr 90px 80px 130px 110px auto', gap: 8, alignItems: 'end' }}>
              <Select
                aria-label="Discipline"
                value={addForm.disciplineId}
                onChange={(e) => setAddForm({ ...addForm, disciplineId: e.target.value, activityId: '', subActivityId: '' })}
                style={compactSelect}
              >
                <option value="">Discipline…</option>
                {tree.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
              <Select
                aria-label="Activity"
                value={addForm.activityId}
                onChange={(e) => setAddForm({ ...addForm, activityId: e.target.value, subActivityId: '' })}
                style={compactSelect}
                disabled={!addForm.disciplineId}
              >
                <option value="">Activity…</option>
                {selectedDiscipline?.activities.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
              <Select
                aria-label="Sub-activity"
                value={addForm.subActivityId}
                onChange={(e) => setAddForm({ ...addForm, subActivityId: e.target.value })}
                style={compactSelect}
                disabled={!addForm.activityId}
              >
                <option value="">Sub-activity…</option>
                {selectedActivity?.subActivities.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <Select
                aria-label="Assignee"
                value={addForm.assigneeId}
                onChange={(e) => setAddForm({ ...addForm, assigneeId: e.target.value })}
                style={compactSelect}
              >
                <option value="">Assignee…</option>
                {options.employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {[emp.firstName, emp.lastName].filter(Boolean).join(' ')}
                  </option>
                ))}
              </Select>
              <TextInput
                aria-label="Planned hours"
                placeholder="Hrs"
                inputMode="decimal"
                value={addForm.plannedHours}
                onChange={(e) => setAddForm({ ...addForm, plannedHours: e.target.value })}
                style={compactSelect}
              />
              <TextInput
                aria-label="Quantity"
                placeholder="Qty"
                inputMode="numeric"
                value={addForm.quantity}
                onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
                style={compactSelect}
              />
              <TextInput
                aria-label="Due date"
                type="date"
                value={addForm.dueDate}
                onChange={(e) => setAddForm({ ...addForm, dueDate: e.target.value })}
                style={compactSelect}
              />
              <Select
                aria-label="Priority"
                value={addForm.priority}
                onChange={(e) => setAddForm({ ...addForm, priority: e.target.value as AssignmentPriority })}
                style={compactSelect}
              >
                {ASSIGNMENT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{ASSIGNMENT_PRIORITY_LABELS[p]}</option>
                ))}
              </Select>
              <Button onClick={() => void handleAdd()} disabled={adding} className="whitespace-nowrap">
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Assign
              </Button>
            </div>
          </FormCard>

          {/* Assignment table */}
          <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
            {assignments.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700 }}>No activities assigned</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  Assign the first activity above — team members then log their work against it.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)' }}>
                    {['Activity', 'Assignee', 'Planned', 'Logged', 'Due', 'Priority', 'Status', 'Remark', ''].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => {
                    const progress = a.plannedMinutes > 0 ? Math.min(100, Math.round((a.loggedMinutes / a.plannedMinutes) * 100)) : null
                    const remark = localRemarks[a.id] ?? a.remark ?? ''
                    return (
                      <AssignmentRow
                        key={a.id}
                        assignment={a}
                        progress={progress}
                        remark={remark}
                        remarkState={remarkState[a.id] ?? null}
                        employees={options.employees}
                        compactSelect={compactSelect}
                        tabular={tabular}
                        logFormFor={logFormFor}
                        logForm={logForm}
                        logging={logging}
                        confirmDelete={confirmDelete === a.id}
                        onPatch={patch}
                        onRemarkChange={handleRemarkChange}
                        onOpenLog={() => {
                          setLogFormFor(logFormFor === a.id ? null : a.id)
                          setLogForm({ logDate: today, hours: '', note: '' })
                        }}
                        onLogFormChange={setLogForm}
                        onLogSubmit={() => void handleLogWork(a.id)}
                        onDelete={() => void handleDelete(a)}
                      />
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* Day-wise work log */
        <FormCard
          title="Day-wise work log"
          hint={logsLoading ? 'Loading…' : `${logs.length} entries · ${formatMinutes(grandTotal)} total`}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <TextInput type="date" aria-label="From" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} style={{ ...compactSelect, width: 150 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
            <TextInput type="date" aria-label="To" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} style={{ ...compactSelect, width: 150 }} />
            <Select aria-label="Assignee filter" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} style={{ ...compactSelect, width: 180 }}>
              <option value="all">All assignees</option>
              {options.employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {[emp.firstName, emp.lastName].filter(Boolean).join(' ')}
                </option>
              ))}
            </Select>
          </div>

          {dayGroups.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
              No work logged in this period.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {dayGroups.map((user) => (
                <div key={user.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{user.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)', ...tabular }}>
                      {formatMinutes(user.total)}
                    </span>
                  </div>
                  {[...user.dates.entries()].map(([date, entries]) => (
                    <div key={date} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, ...tabular }}>
                        {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                        {' · '}
                        {formatMinutes(entries.reduce((s, e) => s + e.minutes, 0))}
                      </div>
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'baseline',
                            padding: '6px 10px',
                            borderRadius: 6,
                            background: 'var(--surface-secondary)',
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontSize: 12.5, fontWeight: 600, minWidth: 170 }}>
                            {entry.activityName}
                            {entry.subActivityName ? ` — ${entry.subActivityName}` : ''}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{entry.disciplineName}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, minWidth: 0 }}>
                            {entry.note ?? ''}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, ...tabular }}>{formatMinutes(entry.minutes)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </FormCard>
      )}
    </>
  )
}

function AssignmentRow({
  assignment: a,
  progress,
  remark,
  remarkState,
  employees,
  compactSelect,
  tabular,
  logFormFor,
  logForm,
  logging,
  confirmDelete,
  onPatch,
  onRemarkChange,
  onOpenLog,
  onLogFormChange,
  onLogSubmit,
  onDelete,
}: {
  assignment: AssignmentListItem
  progress: number | null
  remark: string
  remarkState: 'saving' | 'saved' | 'error' | null
  employees: { id: string; firstName: string; lastName: string | null }[]
  compactSelect: React.CSSProperties
  tabular: React.CSSProperties
  logFormFor: string | null
  logForm: { logDate: string; hours: string; note: string }
  logging: boolean
  confirmDelete: boolean
  onPatch: (id: string, fields: Record<string, unknown>) => Promise<boolean>
  onRemarkChange: (assignment: AssignmentListItem, text: string) => void
  onOpenLog: () => void
  onLogFormChange: (next: { logDate: string; hours: string; note: string }) => void
  onLogSubmit: () => void
  onDelete: () => void
}) {
  const overdue = a.dueDate !== null && a.status !== 'completed' && a.status !== 'cancelled' && a.dueDate < new Date().toISOString().slice(0, 10)

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <td style={{ padding: '8px 10px', minWidth: 200 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {a.activityName}
            {a.subActivityName ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> — {a.subActivityName}</span> : null}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.disciplineName}</div>
        </td>
        <td style={{ padding: '8px 10px', minWidth: 130 }}>
          <Select
            aria-label="Assignee"
            value={a.assigneeId ?? ''}
            onChange={(e) => void onPatch(a.id, { assigneeId: e.target.value || null })}
            style={compactSelect}
          >
            <option value="">Unassigned</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {[emp.firstName, emp.lastName].filter(Boolean).join(' ')}
              </option>
            ))}
          </Select>
        </td>
        <td style={{ padding: '8px 10px', ...tabular }}>
          <TextInput
            aria-label="Planned hours"
            defaultValue={minutesToHoursInput(a.plannedMinutes)}
            inputMode="decimal"
            style={{ ...compactSelect, width: 64, textAlign: 'right' }}
            onBlur={(e) => {
              const minutes = e.target.value.trim() === '' ? 0 : Math.round(parseFloat(e.target.value) * 60)
              if (!Number.isNaN(minutes) && minutes >= 0 && minutes !== a.plannedMinutes) {
                void onPatch(a.id, { plannedMinutes: minutes })
              }
            }}
          />
        </td>
        <td style={{ padding: '8px 10px', minWidth: 110, ...tabular }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 46, height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progress ?? 0}%`,
                  height: '100%',
                  background: progress != null && progress >= 100 ? 'var(--success)' : 'var(--brand-primary)',
                }}
              />
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>
              {formatMinutes(a.loggedMinutes)}
              {a.plannedMinutes > 0 ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {formatMinutes(a.plannedMinutes)}</span> : null}
            </span>
          </div>
        </td>
        <td style={{ padding: '8px 10px', ...tabular }}>
          <TextInput
            aria-label="Due date"
            type="date"
            defaultValue={a.dueDate ?? ''}
            style={{ ...compactSelect, width: 130, ...(overdue ? { borderColor: 'var(--warning)' } : null) }}
            onChange={(e) => void onPatch(a.id, { dueDate: e.target.value || null })}
          />
        </td>
        <td style={{ padding: '8px 10px' }}>
          <Select
            aria-label="Priority"
            value={a.priority}
            onChange={(e) => void onPatch(a.id, { priority: e.target.value })}
            style={compactSelect}
          >
            {ASSIGNMENT_PRIORITIES.map((p) => (
              <option key={p} value={p}>{ASSIGNMENT_PRIORITY_LABELS[p]}</option>
            ))}
          </Select>
        </td>
        <td style={{ padding: '8px 10px' }}>
          <Select
            aria-label="Status"
            value={a.status}
            onChange={(e) => void onPatch(a.id, { status: e.target.value })}
            style={{ ...compactSelect, fontWeight: 600 }}
          >
            {ASSIGNMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{ASSIGNMENT_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </td>
        <td style={{ padding: '8px 10px', minWidth: 160 }}>
          <div style={{ position: 'relative' }}>
            <TextInput
              aria-label="Remark"
              value={remark}
              placeholder="Add a remark…"
              maxLength={2_000}
              onChange={(e) => onRemarkChange(a, e.target.value)}
              style={compactSelect}
            />
            {remarkState === 'saving' && (
              <Loader2 size={12} className="animate-spin" style={{ position: 'absolute', right: 8, top: 9, color: 'var(--text-muted)' }} />
            )}
            {remarkState === 'saved' && (
              <CheckCircle2 size={13} style={{ position: 'absolute', right: 8, top: 9, color: 'var(--success)' }} />
            )}
            {remarkState === 'error' && (
              <AlertCircle size={13} style={{ position: 'absolute', right: 8, top: 9, color: 'var(--danger)' }} />
            )}
          </div>
        </td>
        <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '4px 6px', color: logFormFor === a.id ? 'var(--brand-primary)' : undefined }}
            title="Log work"
            onClick={onOpenLog}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '4px 6px', color: confirmDelete ? '#fff' : 'var(--danger)', background: confirmDelete ? 'var(--danger)' : undefined }}
            title={confirmDelete ? 'Click again to remove' : 'Remove assignment'}
            onClick={onDelete}
          >
            {confirmDelete ? 'Sure?' : <Trash2 size={13} />}
          </button>
        </td>
      </tr>
      {logFormFor === a.id && (
        <tr style={{ background: 'var(--surface-secondary)' }}>
          <td colSpan={9} style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Log work — {a.activityName}</span>
              <TextInput
                aria-label="Work date"
                type="date"
                value={logForm.logDate}
                onChange={(e) => onLogFormChange({ ...logForm, logDate: e.target.value })}
                style={{ ...compactSelect, width: 150 }}
              />
              <TextInput
                aria-label="Hours"
                placeholder="Hours (e.g. 2.5)"
                inputMode="decimal"
                value={logForm.hours}
                onChange={(e) => onLogFormChange({ ...logForm, hours: e.target.value })}
                style={{ ...compactSelect, width: 130 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onLogSubmit()
                }}
              />
              <TextInput
                aria-label="What did you do"
                placeholder="What did you do? (optional)"
                value={logForm.note}
                maxLength={2_000}
                onChange={(e) => onLogFormChange({ ...logForm, note: e.target.value })}
                style={{ ...compactSelect, flex: 1, minWidth: 200 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onLogSubmit()
                }}
              />
              <Button onClick={onLogSubmit} disabled={logging} className="whitespace-nowrap">
                {logging ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Log
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
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
