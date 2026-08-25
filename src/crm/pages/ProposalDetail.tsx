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

/** Editable list of single-line strings (input documents, deliverables, exclusions). */
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
type TabId =
  | 'basic'
  | 'scope'
  | 'input_documents'
  | 'deliverables'
  | 'software'
  | 'mode_of_delivery'
  | 'revision'
  | 'site_visit'
  | 'quotation_validity'
  | 'exclusions'
  | 'commercials'
  | 'quotation'
  | 'followups'
  | 'activity'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'basic', label: 'Basic info', icon: FileText },
  { id: 'scope', label: 'Scope of work', icon: SlidersHorizontal },
  { id: 'input_documents', label: 'Input documents', icon: Inbox },
  { id: 'deliverables', label: 'Deliverables', icon: PackageCheck },
  { id: 'software', label: 'Software', icon: Laptop },
  { id: 'mode_of_delivery', label: 'Mode of Delivery', icon: Truck },
  { id: 'revision', label: 'Revision', icon: RefreshCw },
  { id: 'site_visit', label: 'Site Visit', icon: MapPin },
  { id: 'quotation_validity', label: 'Quotation Validity', icon: CalendarClock },
  { id: 'exclusions', label: 'Exclusions', icon: Ban },
  { id: 'commercials', label: 'Commercials', icon: IndianRupee },
  { id: 'quotation', label: 'Quotation details', icon: Receipt },
  { id: 'followups', label: 'Follow-ups', icon: AlarmClock },
  { id: 'activity', label: 'Activity', icon: MessageSquare },
]

export default function ProposalDetailPage({ initialData }: { initialData: ProposalDetailPayload }) {
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ProposalDetail | null>(initialData.proposal)
  const options = initialData.options
  const [form, setForm] = useState<DetailFormState | null>(detail ? detailToForm(detail) : null)
  const [tab, setTab] = useState<TabId>('basic')
  const [isSaving, setIsSaving] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const proposalId = detail?.id ?? ''

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
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
      setTab('basic')
      return
    }
    if (form.companyName.trim().length < 2) {
      showFeedback('error', 'Company name must be at least 2 characters.')
      setTab('basic')
      return
    }
    setIsSaving(true)
    try {
      const res = await updateProposalAction({ data: formToUpdatePayload(form, detail.id) })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `${detail.proposalNumber} saved.`)
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
      showFeedback('success', `Status set to ${PROPOSAL_STATUS_LABELS[status]}.`)
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
          <AlertCircle size={28} style={{ color: 'var(--warning)', margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h3>
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
            <ArrowLeft size={14} /> Back to proposals
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
            onClick={() => void navigate({ to: '/proposals' })}
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {detail.proposalNumber} — {form.title || 'Untitled proposal'}
            </h2>
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
                  <strong style={{ color: 'var(--brand-primary)' }}>
                    {formatPaise(effectiveValuePaise, { decimals: 0 })}
                  </strong>
                </>
              )}
              {margin && (
                <>
                  {' · '}margin{' '}
                  <strong style={{ color: margin.marginPercentage.gte(0) ? 'var(--success)' : 'var(--danger)' }}>
                    {margin.marginPercentage.toFixed(1)}%
                  </strong>
                </>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button
            variant="outline"
            onClick={() => void handleConvertToProject()}
            disabled={isConverting}
            className={detail.status === 'accepted' ? 'border-[var(--success)] text-[var(--success)]' : ''}
            title={detail.status === 'accepted' ? 'Convert this accepted proposal into a project' : 'Convert to project (recommended once accepted)'}
          >
            {isConverting ? <Loader2 size={14} className="animate-spin" /> : <FolderKanban size={14} />} Convert to Project
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
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
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
              <Icon size={14} /> {label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980 }}>
          {tab === 'basic' && (
            <>
              <FormCard title="Identity">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Proposal title *">
                    <TextInput value={form.title} maxLength={255} onChange={(e) => set('title', e.target.value)} />
                  </Field>
                  <Field label="Contract type">
                    <Select value={form.contractType} onChange={(e) => set('contractType', e.target.value as DetailFormState['contractType'])}>
                      {PROPOSAL_CONTRACT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {PROPOSAL_CONTRACT_TYPE_LABELS[t]}
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
                  <Field label="Proposal value (₹)">
                    <TextInput
                      value={form.valueRupees}
                      inputMode="decimal"
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
                    Edit them under “Quotation details”.
                  </p>
                )}
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
                            ? {
                                ...prev,
                                companyId: e.target.value,
                                companyName: company ? company.name : prev.companyName,
                              }
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
                  <Field label="Company name *">
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

              <FormCard title="Description">
                <TextArea rows={4} value={form.description} maxLength={10_000} onChange={(e) => set('description', e.target.value)} />
              </FormCard>

              <FormCard title="Schedule">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Field label="Planned start">
                    <TextInput type="date" value={form.plannedStartDate} onChange={(e) => set('plannedStartDate', e.target.value)} />
                  </Field>
                  <Field label="Planned end">
                    <TextInput type="date" value={form.plannedEndDate} onChange={(e) => set('plannedEndDate', e.target.value)} />
                  </Field>
                  <Field label="Submission due">
                    <TextInput type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
                  </Field>
                </div>
              </FormCard>
            </>
          )}

          {tab === 'scope' && (
            <FormCard
              title="Scope of work"
              hint="Client-facing document — headings, lists, and emphasis are supported. Carried into the project on conversion."
            >
              <RichTextEditor
                value={form.scopeOfWork}
                onChange={(html) => set('scopeOfWork', html)}
                disabled={isSaving}
                minHeight={320}
              />
            </FormCard>
          )}

          {tab === 'input_documents' && (
            <FormCard title="Input documents" hint="Documents the client must provide for the study.">
              <StringListEditor items={form.inputDocuments} onChange={(next) => set('inputDocuments', next)} placeholder="e.g. P&ID, equipment layout, soil report" />
            </FormCard>
          )}

          {tab === 'deliverables' && (
            <FormCard title="Deliverables" hint="Documents and outputs ATS will hand over.">
              <StringListEditor items={form.deliverables} onChange={(next) => set('deliverables', next)} placeholder="e.g. Detailed engineering drawings, stress report" />
            </FormCard>
          )}

          {tab === 'software' && (
            <FormCard title="Software" hint="Software licenses included in this proposal.">
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
                    {line.softwareId === '' && (
                      <TextInput
                        value={line.name}
                        placeholder="Custom software name"
                        maxLength={255}
                        style={{ gridColumn: 'span 2' }}
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
                  <Plus size={13} /> Add software
                </button>
              </div>
            </FormCard>
          )}

          {tab === 'mode_of_delivery' && (
            <FormCard title="Mode of delivery" hint="Where the work will be executed.">
              <Select value={form.modeOfDelivery} onChange={(e) => set('modeOfDelivery', e.target.value)}>
                <option value="">— Select mode —</option>
                {PROPOSAL_DELIVERY_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </Select>
            </FormCard>
          )}

          {tab === 'revision' && (
            <FormCard title="Revision" hint="Number of design revisions included at no extra cost.">
              <Field label="Revisions included">
                <TextInput
                  type="number"
                  min={0}
                  max={20}
                  value={form.revisionsIncluded}
                  onChange={(e) => set('revisionsIncluded', e.target.value)}
                />
              </Field>
            </FormCard>
          )}

          {tab === 'site_visit' && (
            <FormCard title="Site visit" hint="Site visits included in the quoted price.">
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12 }}>
                <Field label="Visits included">
                  <TextInput type="number" min={0} max={100} value={form.siteVisits} onChange={(e) => set('siteVisits', e.target.value)} />
                </Field>
                <Field label="Visit scope / notes">
                  <TextArea rows={4} value={form.siteVisitNotes} maxLength={5_000} onChange={(e) => set('siteVisitNotes', e.target.value)} />
                </Field>
              </div>
            </FormCard>
          )}

          {tab === 'quotation_validity' && (
            <FormCard title="Quotation validity" hint="How long the quoted prices hold from the proposal date.">
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, alignItems: 'center' }}>
                <Field label="Valid for (days)">
                  <TextInput type="number" min={0} max={365} value={form.validityDays} onChange={(e) => set('validityDays', e.target.value)} />
                </Field>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {validUntil
                    ? `Prices valid until ${validUntil.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}.`
                    : 'Set a number of days to compute the validity window.'}
                </p>
              </div>
            </FormCard>
          )}

          {tab === 'exclusions' && (
            <FormCard title="Exclusions" hint="Work explicitly NOT covered by this proposal.">
              <StringListEditor items={form.exclusions} onChange={(next) => set('exclusions', next)} placeholder="e.g. Civil foundation design, statutory approvals" />
            </FormCard>
          )}

          {tab === 'commercials' && (
            <FormCard title="Commercials" hint="Cost estimate feeds the margin shown in the header.">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Estimated cost to company (₹)">
                  <TextInput
                    value={form.estimatedCostRupees}
                    inputMode="decimal"
                    placeholder="e.g. 1800000"
                    onChange={(e) => set('estimatedCostRupees', e.target.value)}
                  />
                </Field>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Margin estimate</span>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', padding: '8px 10px', background: 'var(--surface-secondary)', borderRadius: 8 }}>
                    {margin ? (
                      <>
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
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <Field label="Commercial notes">
                  <TextArea rows={3} value={form.commercialNotes} maxLength={5_000} onChange={(e) => set('commercialNotes', e.target.value)} />
                </Field>
              </div>
            </FormCard>
          )}

          {tab === 'quotation' && (
            <>
              <FormCard title="Quotation details" hint="Line items drive the proposal value — totals recompute on save.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 80px 140px 140px auto', gap: 8, fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    <span>Description</span>
                    <span>Qty</span>
                    <span>Unit price (₹)</span>
                    <span>Amount</span>
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
                          onChange={(e) => set('quotationLines', form.quotationLines.map((v, j) => (j === i ? { ...v, description: e.target.value } : v)))}
                        />
                        <TextInput
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => set('quotationLines', form.quotationLines.map((v, j) => (j === i ? { ...v, quantity: e.target.value } : v)))}
                        />
                        <TextInput
                          value={line.unitPriceRupees}
                          inputMode="decimal"
                          onChange={(e) => set('quotationLines', form.quotationLines.map((v, j) => (j === i ? { ...v, unitPriceRupees: e.target.value } : v)))}
                        />
                        <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
                          {formatPaise(qty * unitPaise, { decimals: 0 })}
                        </span>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ color: 'var(--danger)', padding: 6 }}
                          title="Remove line"
                          onClick={() => set('quotationLines', form.quotationLines.filter((_, j) => j !== i))}
                        >
                          <Trash2 size={14} />
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
                    <Plus size={13} /> Add line
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>
                      Total: {formatPaise(linesTotalPaise, { decimals: 0 })}
                    </span>
                  </div>
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
      onFeedback('success', 'Follow-up added.')
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
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>No follow-ups yet.</p>
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
              <span style={{ fontSize: 11.5, color: overdue ? 'var(--warning)' : 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 600 }}>
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
        <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: 160 }} />
        <TextInput
          value={note}
          placeholder="e.g. Call Mr. Sharma for LOI"
          maxLength={2_000}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleAdd()
            }
          }}
        />
        <Button variant="outline" onClick={() => void handleAdd()} disabled={busy || note.trim() === ''}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
        </Button>
      </div>
    </FormCard>
  )
}

// ── Activity timeline (Twenty-style: composer on top, unified feed) ──────
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
          onChange={(e) => setBody(e.target.value)}
        />
        <Button onClick={() => void handleAdd()} disabled={busy || body.trim() === ''}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />} Note
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
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
