import { useMemo, useState } from 'react'
import {
  AlarmClock,
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  FileText,
  FolderKanban,
  Inbox,
  IndianRupee,
  Laptop,
  Loader2,
  MapPin,
  MessageSquare,
  PackageCheck,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
  Truck,
} from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'
import { RichTextEditor } from '~/components/crm/rich-text-editor'
import { calculateMargin, formatPaise, parseINRToPaise, paiseToRupeesNumber } from '~/lib/money'
import { timeAgo } from '~/lib/utils'
import {
  PROPOSAL_CONTRACT_TYPES,
  PROPOSAL_CONTRACT_TYPE_LABELS,
  PROPOSAL_DELIVERY_MODES,
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_BADGES,
  PROPOSAL_STATUS_LABELS,
  quotationLinesTotalPaise,
  type ProposalComment,
  type ProposalDetail,
  type ProposalDetailPayload,
  type ProposalFollowUp,
  type ProposalStatus,
  type ProposalTimelineItem,
} from '~/lib/proposals'
import {
  addProposalCommentAction,
  addProposalFollowUpAction,
  convertProposalToProjectAction,
  getProposalDetailData,
  toggleProposalFollowUpAction,
  updateProposalAction,
  updateProposalStatusAction,
} from '~/lib/proposals.functions'

// ── Form state mapping ───────────────────────────────────────────────────
type SoftwareFormLine = { softwareId: string; name: string; notes: string }
type QuotationFormLine = { description: string; quantity: string; unitPriceRupees: string }

type DetailFormState = {
  title: string
  description: string
  companyId: string
  companyName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  designation: string
  city: string
  siteLocation: string
  scopeOfWork: string
  priority: 'low' | 'medium' | 'high'
  contractType: (typeof PROPOSAL_CONTRACT_TYPES)[number]
  valueRupees: string
  plannedStartDate: string
  plannedEndDate: string
  dueDate: string
  modeOfDelivery: string
  revisionsIncluded: string
  siteVisits: string
  siteVisitNotes: string
  validityDays: string
  estimatedCostRupees: string
  commercialNotes: string
  paymentTerms: string
  otherTerms: string
  inputDocuments: string[]
  deliverables: string[]
  exclusions: string[]
  software: SoftwareFormLine[]
  quotationLines: QuotationFormLine[]
}

function detailToForm(detail: ProposalDetail): DetailFormState {
  return {
    title: detail.title,
    description: detail.description ?? '',
    companyId: detail.companyId ?? '',
    companyName: detail.companyName,
    contactName: detail.contactName ?? '',
    contactEmail: detail.contactEmail ?? '',
    contactPhone: detail.contactPhone ?? '',
    designation: detail.designation ?? '',
    city: detail.city ?? '',
    siteLocation: detail.siteLocation ?? '',
    scopeOfWork: detail.scopeOfWork ?? '',
    priority: detail.priority,
    contractType: detail.contractType,
    valueRupees: detail.valuePaise != null ? String(paiseToRupeesNumber(detail.valuePaise)) : '',
    plannedStartDate: detail.plannedStartDate ?? '',
    plannedEndDate: detail.plannedEndDate ?? '',
    dueDate: detail.dueDate ?? '',
    modeOfDelivery: detail.modeOfDelivery ?? '',
    revisionsIncluded: String(detail.revisionsIncluded),
    siteVisits: String(detail.siteVisits),
    siteVisitNotes: detail.siteVisitNotes ?? '',
    validityDays: detail.validityDays != null ? String(detail.validityDays) : '',
    estimatedCostRupees:
      detail.estimatedCostPaise != null ? String(paiseToRupeesNumber(detail.estimatedCostPaise)) : '',
    commercialNotes: detail.commercialNotes ?? '',
    paymentTerms: detail.paymentTerms ?? '',
    otherTerms: detail.otherTerms ?? '',
    inputDocuments: [...detail.inputDocuments],
    deliverables: [...detail.deliverables],
    exclusions: [...detail.exclusions],
    software: detail.software.map((s) => ({ softwareId: s.softwareId ?? '', name: s.name, notes: s.notes ?? '' })),
    quotationLines: detail.quotationLines.map((l) => ({
      description: l.description,
      quantity: String(l.quantity),
      unitPriceRupees: String(paiseToRupeesNumber(l.unitPricePaise)),
    })),
  }
}

function formToUpdatePayload(form: DetailFormState, id: string) {
  return {
    id,
    title: form.title.trim(),
    description: form.description.trim() || null,
    companyId: form.companyId || null,
    companyName: form.companyName.trim(),
    contactName: form.contactName.trim() || null,
    contactEmail: form.contactEmail.trim() || null,
    contactPhone: form.contactPhone.trim() || null,
    designation: form.designation.trim() || null,
    city: form.city.trim() || null,
    siteLocation: form.siteLocation.trim() || null,
    scopeOfWork: form.scopeOfWork.trim() || null,
    priority: form.priority,
    contractType: form.contractType,
    valuePaise: form.valueRupees.trim() === '' ? null : parseINRToPaise(form.valueRupees),
    plannedStartDate: form.plannedStartDate || null,
    plannedEndDate: form.plannedEndDate || null,
    dueDate: form.dueDate || null,
    modeOfDelivery: form.modeOfDelivery.trim() || null,
    revisionsIncluded: Number(form.revisionsIncluded) || 0,
    siteVisits: Number(form.siteVisits) || 0,
    siteVisitNotes: form.siteVisitNotes.trim() || null,
    validityDays: form.validityDays.trim() === '' ? null : Number(form.validityDays),
    estimatedCostPaise: form.estimatedCostRupees.trim() === '' ? null : parseINRToPaise(form.estimatedCostRupees),
    commercialNotes: form.commercialNotes.trim() || null,
    paymentTerms: form.paymentTerms.trim() || null,
    otherTerms: form.otherTerms.trim() || null,
    inputDocuments: form.inputDocuments.map((s) => s.trim()).filter(Boolean),
    deliverables: form.deliverables.map((s) => s.trim()).filter(Boolean),
    exclusions: form.exclusions.map((s) => s.trim()).filter(Boolean),
    software: form.software
      .map((s) => ({ softwareId: s.softwareId || null, name: s.name.trim(), notes: s.notes.trim() || null }))
      .filter((s) => s.name !== ''),
    quotationLines: form.quotationLines
      .filter((l) => l.description.trim() !== '')
      .map((l) => ({
        description: l.description.trim(),
        quantity: Math.max(1, Number(l.quantity) || 1),
        unitPricePaise: l.unitPriceRupees.trim() === '' ? 0 : parseINRToPaise(l.unitPriceRupees),
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
      <h2 style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
      {hint && <p style={{ margin: '0 0 12px', fontSize: 11.5, color: 'var(--text-muted)' }}>{hint}</p>}
      <div style={{ marginTop: hint ? 0 : 12 }}>{children}</div>
    </section>
  )
}

/** Editable list of single-line strings (input documents, deliverables, exclusions). */
function StringListEditor({
  items,
  onChange,
  placeholder,
  itemLabel = 'item',
}: {
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
  itemLabel?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 18, textAlign: 'right' }} aria-hidden="true">
            {i + 1}.
          </span>
          <TextInput
            value={item}
            placeholder={placeholder}
            maxLength={500}
            aria-label={`${itemLabel} ${i + 1}`}
            onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <button
            type="button"
            className="btn-ghost"
            style={{ color: 'var(--danger)', padding: 6 }}
            title={`Remove ${itemLabel} ${i + 1}`}
            aria-label={`Remove ${itemLabel} ${i + 1}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn-secondary"
        style={{ alignSelf: 'flex-start', fontSize: 12.5 }}
        onClick={() => onChange([...items, ''])}
      >
        <Plus size={13} aria-hidden="true" /> Add {itemLabel}
      </button>
    </div>
  )
}

// ── Consolidated Tabs ───────────────────────────────────────────────────
type TabId = 'overview' | 'technical' | 'commercial' | 'followups' | 'activity'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'technical', label: 'Scope & Technical', icon: SlidersHorizontal },
  { id: 'commercial', label: 'Commercial & Quotation', icon: Receipt },
  { id: 'followups', label: 'Follow-ups', icon: AlarmClock },
  { id: 'activity', label: 'Activity & Notes', icon: MessageSquare },
]

export default function ProposalDetailPage({ initialData }: { initialData: ProposalDetailPayload }) {
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ProposalDetail | null>(initialData.proposal)
  const options = initialData.options
  const [form, setForm] = useState<DetailFormState | null>(detail ? detailToForm(detail) : null)
  const [tab, setTab] = useState<TabId>('overview')
  const [isSaving, setIsSaving] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const proposalId = detail?.id ?? ''

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    if (type === 'success') {
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  async function refresh() {
    const next = await getProposalDetailData({ data: { id: proposalId } })
    if (next.proposal) {
      setDetail(next.proposal)
      setForm(detailToForm(next.proposal))
    }
  }

  function set<K extends keyof DetailFormState>(key: K, value: DetailFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!form || !detail) return
    if (form.title.trim().length < 2) {
      showFeedback('error', 'Title must be at least 2 characters.')
      setTab('overview')
      return
    }
    if (form.companyName.trim().length < 2) {
      showFeedback('error', 'Company name must be at least 2 characters.')
      setTab('overview')
      return
    }
    setIsSaving(true)
    try {
      const res = await updateProposalAction({ data: formToUpdatePayload(form, detail.id) })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `${detail.proposalNumber} saved successfully.`)
      await refresh()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleStatusChange(status: ProposalStatus) {
    if (!detail) return
    try {
      const res = await updateProposalStatusAction({ data: { id: detail.id, status, note: null } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Status updated to ${PROPOSAL_STATUS_LABELS[status]}.`)
      await refresh()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Status update failed.')
    }
  }

  async function handleConvertToProject() {
    if (!detail) return
    setIsConverting(true)
    try {
      const res = await convertProposalToProjectAction({ data: { id: detail.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `${detail.proposalNumber} converted to project ${res.data.projectNumber}.`)
      await navigate({ to: '/projects/$projectId', params: { projectId: res.data.id } })
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Conversion failed.')
      setIsConverting(false)
    }
  }

  // ── Unauthorized / not-found states ────────────────────────────────────
  if (!initialData.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <AlertCircle size={28} style={{ color: 'var(--warning)', margin: '0 auto 12px' }} aria-hidden="true" />
          <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            You need the <strong>proposals.read</strong> permission to view proposals.
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
            Proposal not found
          </p>
          <h1 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>That proposal is not in the workspace.</h1>
          <Link className="btn-secondary" to="/proposals">
            <ArrowLeft size={14} aria-hidden="true" /> Back to proposals
          </Link>
        </div>
      </div>
    )
  }

  const linesTotalPaise = quotationLinesTotalPaise(
    form.quotationLines.map((l) => ({
      quantity: Math.max(1, Number(l.quantity) || 1),
      unitPricePaise: l.unitPriceRupees.trim() === '' ? 0 : parseINRToPaise(l.unitPriceRupees),
    })),
  )
  const effectiveValuePaise = form.quotationLines.some((l) => l.description.trim() !== '')
    ? linesTotalPaise
    : form.valueRupees.trim() === ''
      ? null
      : parseINRToPaise(form.valueRupees)
  const costPaise = form.estimatedCostRupees.trim() === '' ? null : parseINRToPaise(form.estimatedCostRupees)
  const margin =
    effectiveValuePaise != null && costPaise != null && effectiveValuePaise > 0
      ? calculateMargin(effectiveValuePaise, costPaise)
      : null
  const validUntil =
    form.validityDays.trim() !== '' && detail.createdAt
      ? new Date(new Date(detail.createdAt).getTime() + Number(form.validityDays) * 86_400_000)
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: 6, marginTop: 2 }}
            title="Back to proposals"
            aria-label="Back to proposals"
            onClick={() => void navigate({ to: '/proposals' })}
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {detail.proposalNumber} — {form.title || 'Untitled proposal'}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              {form.companyName}
              {detail.leadNumber && (
                <>
                  {' · '}Converted from lead <strong>{detail.leadNumber}</strong>
                </>
              )}
              {effectiveValuePaise != null && (
                <>
                  {' · '}
                  <strong className="tabular-nums" style={{ color: 'var(--brand-primary)' }}>
                    {formatPaise(effectiveValuePaise, { decimals: 0 })}
                  </strong>
                </>
              )}
              {margin && (
                <>
                  {' · '}margin{' '}
                  <strong
                    className="tabular-nums"
                    style={{ color: margin.marginPercentage.gte(0) ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {margin.marginPercentage.toFixed(1)}%
                  </strong>
                </>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            variant="outline"
            onClick={() => void handleConvertToProject()}
            disabled={isConverting}
            className={
              detail.status === 'accepted'
                ? 'border-emerald-600/50 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/60'
                : ''
            }
            title={
              detail.status === 'accepted'
                ? 'Convert this accepted proposal into a project'
                : 'Convert to project (recommended once accepted)'
            }
          >
            {isConverting ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <FolderKanban size={14} aria-hidden="true" />
            )}
            Convert to project
          </Button>
          <Select
            aria-label="Proposal status"
            value={detail.status}
            onChange={(e) => void handleStatusChange(e.target.value as ProposalStatus)}
            style={{ width: 'auto', fontWeight: 600 }}
          >
            {PROPOSAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PROPOSAL_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={14} aria-hidden="true" />
            )}
            Save changes
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Proposal details sections"
        style={{
          display: 'flex',
          gap: 4,
          padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              id={`tab-${id}`}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`panel-${id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--brand-primary)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? 'var(--brand-primary)' : 'transparent'}`,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980 }}>
          {tab === 'overview' && (
            <>
              <FormCard title="Identity">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <Field label="Proposal title *">
                    <TextInput
                      value={form.title}
                      maxLength={255}
                      aria-label="Proposal title"
                      onChange={(e) => set('title', e.target.value)}
                    />
                  </Field>
                  <Field label="Contract type">
                    <Select
                      value={form.contractType}
                      aria-label="Contract type"
                      onChange={(e) => set('contractType', e.target.value as DetailFormState['contractType'])}
                    >
                      {PROPOSAL_CONTRACT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {PROPOSAL_CONTRACT_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Priority">
                    <Select
                      value={form.priority}
                      aria-label="Priority"
                      onChange={(e) => set('priority', e.target.value as DetailFormState['priority'])}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </Select>
                  </Field>
                  <Field label="Proposal value (₹)">
                    <TextInput
                      value={form.valueRupees}
                      inputMode="decimal"
                      aria-label="Proposal value in rupees"
                      placeholder={
                        form.quotationLines.some((l) => l.description.trim() !== '')
                          ? `Auto: ${formatPaise(linesTotalPaise, { decimals: 0 })}`
                          : 'e.g. 2500000'
                      }
                      disabled={form.quotationLines.some((l) => l.description.trim() !== '')}
                      onChange={(e) => set('valueRupees', e.target.value)}
                    />
                  </Field>
                </div>
                {form.quotationLines.some((l) => l.description.trim() !== '') && (
                  <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Value is derived from the quotation lines (currently {formatPaise(linesTotalPaise, { decimals: 0 })}).
                    Edit them under “Commercial & Quotation”.
                  </p>
                )}
              </FormCard>

              <FormCard title="Client">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <Field label="Link to company master">
                    <Select
                      value={form.companyId}
                      aria-label="Link to company master"
                      onChange={(e) => {
                        const company = options.companies.find((c) => c.id === e.target.value)
                        setForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                companyId: e.target.value,
                                companyName: company ? company.name : prev.companyName,
                              }
                            : prev,
                        )
                      }}
                    >
                      <option value="">— Select a company (or enter manually) —</option>
                      {options.companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Company name *">
                    <TextInput
                      value={form.companyName}
                      maxLength={255}
                      aria-label="Company name"
                      onChange={(e) => set('companyName', e.target.value)}
                    />
                  </Field>
                  <Field label="Contact name">
                    <TextInput
                      value={form.contactName}
                      maxLength={255}
                      aria-label="Contact name"
                      onChange={(e) => set('contactName', e.target.value)}
                    />
                  </Field>
                  <Field label="Designation">
                    <TextInput
                      value={form.designation}
                      maxLength={100}
                      aria-label="Contact designation"
                      onChange={(e) => set('designation', e.target.value)}
                    />
                  </Field>
                  <Field label="Contact email">
                    <TextInput
                      type="email"
                      value={form.contactEmail}
                      maxLength={255}
                      aria-label="Contact email"
                      onChange={(e) => set('contactEmail', e.target.value)}
                    />
                  </Field>
                  <Field label="Phone">
                    <TextInput
                      value={form.contactPhone}
                      maxLength={20}
                      aria-label="Contact phone number"
                      onChange={(e) => set('contactPhone', e.target.value)}
                    />
                  </Field>
                  <Field label="City">
                    <TextInput
                      value={form.city}
                      maxLength={100}
                      aria-label="City"
                      onChange={(e) => set('city', e.target.value)}
                    />
                  </Field>
                  <Field label="Client site location">
                    <TextInput
                      value={form.siteLocation}
                      maxLength={255}
                      aria-label="Client site location"
                      onChange={(e) => set('siteLocation', e.target.value)}
                    />
                  </Field>
                </div>
              </FormCard>

              <FormCard title="Description">
                <TextArea
                  rows={4}
                  value={form.description}
                  maxLength={10_000}
                  aria-label="Proposal description"
                  onChange={(e) => set('description', e.target.value)}
                />
              </FormCard>

              <FormCard title="Schedule">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <Field label="Planned start">
                    <TextInput
                      type="date"
                      value={form.plannedStartDate}
                      aria-label="Planned start date"
                      onChange={(e) => set('plannedStartDate', e.target.value)}
                    />
                  </Field>
                  <Field label="Planned end">
                    <TextInput
                      type="date"
                      value={form.plannedEndDate}
                      aria-label="Planned end date"
                      onChange={(e) => set('plannedEndDate', e.target.value)}
                    />
                  </Field>
                  <Field label="Submission due">
                    <TextInput
                      type="date"
                      value={form.dueDate}
                      aria-label="Submission due date"
                      onChange={(e) => set('dueDate', e.target.value)}
                    />
                  </Field>
                </div>
              </FormCard>
            </>
          )}

          {tab === 'technical' && (
            <>
              <FormCard
                title="Scope of work"
                hint="Client-facing document — headings, lists, and emphasis are supported. Carried into the project on conversion."
              >
                <RichTextEditor
                  value={form.scopeOfWork}
                  onChange={(html) => set('scopeOfWork', html)}
                  disabled={isSaving}
                  minHeight={300}
                />
              </FormCard>

              <FormCard title="Input documents" hint="Documents the client must provide for the engineering study.">
                <StringListEditor
                  items={form.inputDocuments}
                  onChange={(next) => set('inputDocuments', next)}
                  placeholder="e.g. P&ID, equipment layout, soil report"
                  itemLabel="input document"
                />
              </FormCard>

              <FormCard title="Deliverables" hint="Documents and outputs ATS will deliver.">
                <StringListEditor
                  items={form.deliverables}
                  onChange={(next) => set('deliverables', next)}
                  placeholder="e.g. Detailed engineering drawings, stress report"
                  itemLabel="deliverable"
                />
              </FormCard>

              <FormCard title="Exclusions" hint="Work explicitly NOT covered by this proposal.">
                <StringListEditor
                  items={form.exclusions}
                  onChange={(next) => set('exclusions', next)}
                  placeholder="e.g. Civil foundation design, statutory approvals"
                  itemLabel="exclusion"
                />
              </FormCard>

              <FormCard title="Software" hint="Engineering software licenses included in this proposal.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.software.map((line, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: 8, alignItems: 'center' }}>
                      <Select
                        value={line.softwareId}
                        aria-label={`Software selection for item ${i + 1}`}
                        onChange={(e) => {
                          const master = options.software.find((s) => s.id === e.target.value)
                          set(
                            'software',
                            form.software.map((v, j) =>
                              j === i ? { ...v, softwareId: e.target.value, name: master ? master.name : v.name } : v,
                            ),
                          )
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
                        aria-label={`Notes for software item ${i + 1}`}
                        onChange={(e) => set('software', form.software.map((v, j) => (j === i ? { ...v, notes: e.target.value } : v)))}
                      />
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ color: 'var(--danger)', padding: 6 }}
                        title={`Remove software item ${i + 1}`}
                        aria-label={`Remove software item ${i + 1}`}
                        onClick={() => set('software', form.software.filter((_, j) => j !== i))}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                      {line.softwareId === '' && (
                        <TextInput
                          value={line.name}
                          placeholder="Custom software name"
                          maxLength={255}
                          style={{ gridColumn: 'span 2' }}
                          aria-label={`Custom software name for item ${i + 1}`}
                          onChange={(e) => set('software', form.software.map((v, j) => (j === i ? { ...v, name: e.target.value } : v)))}
                        />
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ alignSelf: 'flex-start', fontSize: 12.5 }}
                    onClick={() => set('software', [...form.software, { softwareId: '', name: '', notes: '' }])}
                  >
                    <Plus size={13} aria-hidden="true" /> Add software
                  </button>
                </div>
              </FormCard>

              <FormCard title="Delivery & Revisions" hint="Execution location and revisions included.">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <Field label="Mode of delivery">
                    <Select
                      value={form.modeOfDelivery}
                      aria-label="Mode of delivery"
                      onChange={(e) => set('modeOfDelivery', e.target.value)}
                    >
                      <option value="">— Select mode —</option>
                      {PROPOSAL_DELIVERY_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Revisions included">
                    <TextInput
                      type="number"
                      min={0}
                      max={20}
                      value={form.revisionsIncluded}
                      aria-label="Revisions included count"
                      onChange={(e) => set('revisionsIncluded', e.target.value)}
                    />
                  </Field>
                </div>
              </FormCard>

              <FormCard title="Site visits" hint="Site visits included in the quoted price.">
                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12 }}>
                  <Field label="Visits included">
                    <TextInput
                      type="number"
                      min={0}
                      max={100}
                      value={form.siteVisits}
                      aria-label="Site visits count"
                      onChange={(e) => set('siteVisits', e.target.value)}
                    />
                  </Field>
                  <Field label="Visit scope / notes">
                    <TextArea
                      rows={3}
                      value={form.siteVisitNotes}
                      maxLength={5_000}
                      aria-label="Site visit scope and notes"
                      onChange={(e) => set('siteVisitNotes', e.target.value)}
                    />
                  </Field>
                </div>
              </FormCard>
            </>
          )}

          {tab === 'commercial' && (
            <>
              <FormCard title="Quotation details" hint="Line items drive the proposal value — totals recompute automatically.">
                <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                  <div style={{ minWidth: 600, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '3fr 80px 140px 140px auto', gap: 8, fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      <span>Description</span>
                      <span>Qty</span>
                      <span>Unit price (₹)</span>
                      <span style={{ textAlign: 'right' }}>Amount</span>
                      <span />
                    </div>
                    {form.quotationLines.map((line, i) => {
                      const qty = Math.max(1, Number(line.quantity) || 1)
                      const unitPaise = line.unitPriceRupees.trim() === '' ? 0 : parseINRToPaise(line.unitPriceRupees)
                      return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 80px 140px 140px auto', gap: 8, alignItems: 'center' }}>
                          <TextInput
                            value={line.description}
                            placeholder="e.g. Detailed structural analysis — main building"
                            maxLength={500}
                            aria-label={`Line ${i + 1} description`}
                            onChange={(e) => set('quotationLines', form.quotationLines.map((v, j) => (j === i ? { ...v, description: e.target.value } : v)))}
                          />
                          <TextInput
                            type="number"
                            min={1}
                            value={line.quantity}
                            aria-label={`Line ${i + 1} quantity`}
                            onChange={(e) => set('quotationLines', form.quotationLines.map((v, j) => (j === i ? { ...v, quantity: e.target.value } : v)))}
                          />
                          <TextInput
                            value={line.unitPriceRupees}
                            inputMode="decimal"
                            aria-label={`Line ${i + 1} unit price in rupees`}
                            onChange={(e) => set('quotationLines', form.quotationLines.map((v, j) => (j === i ? { ...v, unitPriceRupees: e.target.value } : v)))}
                          />
                          <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
                            {formatPaise(qty * unitPaise, { decimals: 0 })}
                          </span>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ color: 'var(--danger)', padding: 6 }}
                            title={`Remove quotation line ${i + 1}`}
                            aria-label={`Remove quotation line ${i + 1}`}
                            onClick={() => set('quotationLines', form.quotationLines.filter((_, j) => j !== i))}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ alignSelf: 'flex-start', fontSize: 12.5 }}
                      onClick={() => set('quotationLines', [...form.quotationLines, { description: '', quantity: '1', unitPriceRupees: '' }])}
                    >
                      <Plus size={13} aria-hidden="true" /> Add line item
                    </button>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 800 }}>
                        Total: {formatPaise(linesTotalPaise, { decimals: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              </FormCard>

              <FormCard title="Commercials & Costing" hint="Cost estimate feeds the margin shown in the header.">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <Field label="Estimated cost to company (₹)">
                    <TextInput
                      value={form.estimatedCostRupees}
                      inputMode="decimal"
                      placeholder="e.g. 1800000"
                      aria-label="Estimated cost to company in rupees"
                      onChange={(e) => set('estimatedCostRupees', e.target.value)}
                    />
                  </Field>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Margin estimate</span>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', padding: '8px 10px', background: 'var(--surface-secondary)', borderRadius: 8 }}>
                      {margin ? (
                        <>
                          <span className="tabular-nums" style={{ fontSize: 15, fontWeight: 800, color: margin.marginPercentage.gte(0) ? 'var(--success)' : 'var(--danger)' }}>
                            {margin.marginPercentage.toFixed(1)}%
                          </span>
                          <span className="tabular-nums" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                            gross profit {formatPaise(margin.grossProfitPaise, { decimals: 0 })}
                          </span>
                        </>
                      ) : (
                        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                          Enter value and cost to calculate margin.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, alignItems: 'center', marginTop: 14 }}>
                  <Field label="Valid for (days)">
                    <TextInput
                      type="number"
                      min={0}
                      max={365}
                      value={form.validityDays}
                      aria-label="Quotation validity in days"
                      onChange={(e) => set('validityDays', e.target.value)}
                    />
                  </Field>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {validUntil
                      ? `Prices valid until ${validUntil.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}.`
                      : 'Set validity days to calculate expiration.'}
                  </p>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Field label="Commercial notes">
                    <TextArea
                      rows={3}
                      value={form.commercialNotes}
                      maxLength={5_000}
                      aria-label="Commercial notes"
                      onChange={(e) => set('commercialNotes', e.target.value)}
                    />
                  </Field>
                </div>
              </FormCard>

              <FormCard title="Payment terms">
                <TextArea
                  rows={5}
                  value={form.paymentTerms}
                  maxLength={10_000}
                  aria-label="Payment terms"
                  onChange={(e) => set('paymentTerms', e.target.value)}
                />
              </FormCard>

              <FormCard title="Other terms & conditions">
                <TextArea
                  rows={6}
                  value={form.otherTerms}
                  maxLength={10_000}
                  aria-label="Other terms and conditions"
                  onChange={(e) => set('otherTerms', e.target.value)}
                />
              </FormCard>
            </>
          )}

          {tab === 'followups' && (
            <FollowUpsPanel
              proposalId={detail.id}
              followUps={detail.followUps}
              onChanged={() => void refresh()}
              onFeedback={showFeedback}
            />
          )}

          {tab === 'activity' && (
            <ActivityPanel
              proposalId={detail.id}
              timeline={detail.timeline}
              statusLabels={PROPOSAL_STATUS_LABELS}
              onChanged={() => void refresh()}
              onFeedback={showFeedback}
            />
          )}
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
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
            <CheckCircle2 size={15} style={{ color: 'var(--success)', flexShrink: 0 }} aria-hidden="true" />
          ) : (
            <AlertCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '2px 6px', fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}
            onClick={() => setFeedback(null)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

// ── Follow-ups (immediate-persist actions) ───────────────────────────────
function FollowUpsPanel({
  proposalId,
  followUps,
  onChanged,
  onFeedback,
}: {
  proposalId: string
  followUps: ProposalFollowUp[]
  onChanged: () => Promise<void> | void
  onFeedback: (type: 'success' | 'error', message: string) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [dueDate, setDueDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd() {
    if (note.trim() === '') return
    setBusy(true)
    try {
      const res = await addProposalFollowUpAction({ data: { proposalId, dueDate, note: note.trim() } })
      if (!res.ok) throw new Error(res.message)
      setNote('')
      onFeedback('success', 'Follow-up reminder scheduled.')
      await onChanged()
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to add follow-up.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(id: string, done: boolean) {
    try {
      const res = await toggleProposalFollowUpAction({ data: { id, done } })
      if (!res.ok) throw new Error(res.message)
      await onChanged()
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to update follow-up.')
    }
  }

  const openCount = followUps.filter((f) => f.doneAt === null).length

  return (
    <FormCard title={`Follow-ups${openCount > 0 ? ` — ${openCount} open` : ''}`} hint="Reminders to chase the client on this proposal.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {followUps.length === 0 && (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
            No follow-up reminders scheduled yet. Add a reminder below to follow up with the client.
          </p>
        )}
        {followUps.map((f) => {
          const done = f.doneAt !== null
          const overdue = !done && f.dueDate < today
          return (
            <div
              key={f.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${overdue ? 'var(--warning)' : 'var(--border-subtle)'}`,
                background: done ? 'var(--surface-secondary)' : 'var(--surface)',
              }}
            >
              <input
                type="checkbox"
                checked={done}
                onChange={(e) => void handleToggle(f.id, e.target.checked)}
                aria-label={`Mark follow-up from ${f.dueDate} as ${done ? 'open' : 'done'}`}
              />
              <span className="tabular-nums" style={{ fontSize: 11.5, color: overdue ? 'var(--warning)' : 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                {f.dueDate}
              </span>
              <span style={{ fontSize: 13, textDecoration: done ? 'line-through' : undefined, color: done ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                {f.note}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TextInput
          type="date"
          value={dueDate}
          aria-label="Follow-up due date"
          onChange={(e) => setDueDate(e.target.value)}
          style={{ width: 160 }}
        />
        <TextInput
          value={note}
          placeholder="e.g. Call Mr. Sharma for LOI"
          maxLength={2_000}
          aria-label="Follow-up reminder note"
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleAdd()
            }
          }}
        />
        <Button variant="outline" onClick={() => void handleAdd()} disabled={busy || note.trim() === ''}>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}{' '}
          Add follow-up
        </Button>
      </div>
    </FormCard>
  )
}

// ── Activity timeline (composer on top, unified feed) ──────
function ActivityPanel({
  proposalId,
  timeline,
  statusLabels,
  onChanged,
  onFeedback,
}: {
  proposalId: string
  timeline: ProposalTimelineItem[]
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
      const res = await addProposalCommentAction({ data: { proposalId, body: body.trim() } })
      if (!res.ok) throw new Error(res.message)
      setBody('')
      onFeedback('success', 'Note posted.')
      await onChanged()
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to add comment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormCard title="Activity" hint="Everything that happened on this proposal — status changes and discussion, newest first.">
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
        <TextArea
          rows={2}
          value={body}
          placeholder="Write a note…"
          maxLength={5_000}
          aria-label="Write a proposal activity note"
          onChange={(e) => setBody(e.target.value)}
        />
        <Button onClick={() => void handleAdd()} disabled={busy || body.trim() === ''}>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <MessageSquare size={14} aria-hidden="true" />}{' '}
          Add note
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {timeline.length === 0 && (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
            No activity recorded yet. Notes and status changes will appear here.
          </p>
        )}
        {timeline.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', gap: 12 }}>
            {/* Rail */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} aria-hidden="true">
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  marginTop: 5,
                  background: item.kind === 'status' ? 'var(--brand-primary)' : 'var(--info)',
                  flexShrink: 0,
                }}
              />
              {i < timeline.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border-subtle)' }} />}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: 16, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{item.authorName ?? 'System'}</span>
                <span className="tabular-nums" style={{ fontSize: 11, color: 'var(--text-muted)' }} title={new Date(item.at).toLocaleString('en-IN')}>
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
                      <span style={{ color: 'var(--text-muted)' }} aria-hidden="true">→</span>
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
