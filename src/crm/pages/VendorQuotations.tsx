import { useMemo, useState, type FormEvent } from 'react'
import { FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Field, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { formatINRCompact, formatPaise, parseINRToPaise } from '~/lib/money'
import {
  computeVendorQuotationStats,
  VENDOR_QUOTATION_DEFAULT_TAX_BPS,
  VENDOR_QUOTATION_STATUSES,
  VENDOR_QUOTATION_STATUS_BADGES,
  VENDOR_QUOTATION_STATUS_LABELS,
  type VendorQuotationDetail,
  type VendorQuotationListItem,
  type VendorQuotationsPagePayload,
  type VendorQuotationStatus,
} from '~/lib/vendor-quotations'
import {
  createVendorQuotationAction,
  deleteVendorQuotationAction,
  getVendorQuotationsPageData,
  updateVendorQuotationAction,
} from '~/lib/vendor-quotations.functions'

const STATUS_TILE_COLORS: Record<VendorQuotationStatus, string> = {
  draft: 'var(--text-muted)',
  sent: 'var(--brand-steel)',
  approved: 'var(--success)',
  rejected: 'var(--danger)',
  expired: 'var(--warning)',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Item line draft held in the editor before submission. */
type ItemDraft = { description: string; quantity: string; unitPrice: string }

const EMPTY_ITEM: ItemDraft = { description: '', quantity: '1', unitPrice: '' }

function paiseToRupeeString(paise: number): string {
  return (paise / 100).toString()
}

export default function VendorQuotationsPage({ initialData }: { initialData: VendorQuotationsPagePayload }) {
  const [data, setData] = useState<VendorQuotationsPagePayload>(initialData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VendorQuotationStatus | 'all'>('all')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<VendorQuotationDetail | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VendorQuotationListItem | null>(null)
  const [saving, setSaving] = useState(false)

  const stats = useMemo(() => computeVendorQuotationStats(data.quotations), [data.quotations])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.quotations.filter((quote) => {
      const matchesSearch =
        !q ||
        quote.quotationNumber.toLowerCase().includes(q) ||
        quote.vendorName.toLowerCase().includes(q) ||
        (quote.subject ?? '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || quote.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [data.quotations, search, statusFilter])

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function load() {
    try {
      const next = await getVendorQuotationsPageData()
      setData(next)
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to load vendor quotations.')
    }
  }

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  async function openEdit(id: string) {
    // The list payload is enough for the form except item lines — fetch detail.
    const { getVendorQuotationDetailData } = await import('~/lib/vendor-quotations.functions')
    try {
      const payload = await getVendorQuotationDetailData({ data: { id } })
      if (!payload.quotation) {
        showFeedback('error', 'Quotation not found.')
        return
      }
      setEditing(payload.quotation)
      setModalOpen(true)
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to load quotation.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      const result = await deleteVendorQuotationAction({ data: { id: target.id } })
      if (result.ok) {
        showFeedback('success', `${target.quotationNumber} deleted.`)
        await load()
      } else {
        showFeedback('error', result.message)
      }
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to delete quotation.')
    }
  }

  // ── Unauthorized state ─────────────────────────────────────────────────
  if (!data.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <FileText size={28} style={{ color: 'var(--warning)', margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            You need the <strong>proposals.read</strong> permission to view vendor quotations. Ask an
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
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Quotation (Incoming)</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {stats.totalCount} vendor quotations · {formatINRCompact(stats.openValuePaise, { fromPaise: true })} open ·{' '}
            {formatINRCompact(stats.approvedValuePaise, { fromPaise: true })} approved
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
            <Search size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <input
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 180 }}
              placeholder="Search vendor quotations..."
              aria-label="Search vendor quotations by number, vendor, or subject"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="btn-ghost" style={{ padding: 0 }} onClick={() => setSearch('')}>
                <X size={12} aria-hidden="true" />
                <span className="sr-only">Clear search</span>
              </button>
            )}
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VendorQuotationStatus | 'all')}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '7px 10px',
                fontSize: 13,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All statuses</option>
              {VENDOR_QUOTATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {VENDOR_QUOTATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          {data.canWrite && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={14} aria-hidden="true" /> New Quotation
            </button>
          )}
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div
          role="status"
          style={{
            margin: '10px 24px 0',
            padding: '9px 14px',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 600,
            background: feedback.type === 'success' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
            color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
          }}
        >
          {feedback.message}
        </div>
      )}

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
        <button
          type="button"
          className="card"
          onClick={() => setStatusFilter('all')}
          style={{
            padding: '10px 14px',
            textAlign: 'left',
            cursor: 'pointer',
            minWidth: 150,
            flexShrink: 0,
            outline: statusFilter === 'all' ? '2px solid var(--brand-primary)' : undefined,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>All quotations</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>{stats.totalCount}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            {stats.totalCount === 0 ? '—' : formatINRCompact(stats.totalValuePaise, { fromPaise: true })}
          </div>
        </button>
        {VENDOR_QUOTATION_STATUSES.map((status) => {
          const count =
            status === 'draft'
              ? stats.draftCount
              : status === 'sent'
                ? stats.sentCount
                : status === 'approved'
                  ? stats.approvedCount
                  : status === 'rejected'
                    ? stats.rejectedCount
                    : stats.expiredCount
          const value = status === 'approved' ? stats.approvedValuePaise : 0
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
                outline: statusFilter === status ? '2px solid var(--brand-primary)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_TILE_COLORS[status] }}>
                  {VENDOR_QUOTATION_STATUS_LABELS[status]}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>{count}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {value === 0 ? '—' : formatINRCompact(value, { fromPaise: true })}
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
              <FileText size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
              <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700 }}>No vendor quotations found</p>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
                Record quotations received from vendors, or clear the filters above.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)' }}>
                  {['Quote #', 'Vendor & subject', 'Status', 'Total', 'Valid until', 'Created', 'Actions'].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        style={{
                          textAlign: heading === 'Total' ? 'right' : 'left',
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
                {filtered.map((quotation) => (
                  <tr
                    key={quotation.id}
                    style={{ borderBottom: '1px solid var(--border-subtle)', cursor: data.canWrite ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (data.canWrite) void openEdit(quotation.id)
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {quotation.quotationNumber}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{quotation.vendorName}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{quotation.subject ?? '—'}</div>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span className={`badge ${VENDOR_QUOTATION_STATUS_BADGES[quotation.status]}`} style={{ fontSize: 9.5 }}>
                        {VENDOR_QUOTATION_STATUS_LABELS[quotation.status]}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatPaise(quotation.totalPaise, { decimals: 0 })}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {formatDate(quotation.validUntil)}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {formatDate(quotation.createdAt)}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {data.canWrite && (
                        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn-ghost"
                            aria-label={`Edit ${quotation.quotationNumber}`}
                            title="Edit"
                            style={{ padding: 6 }}
                            onClick={() => void openEdit(quotation.id)}
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            aria-label={`Delete ${quotation.quotationNumber}`}
                            title="Delete"
                            style={{ padding: 6, color: 'var(--danger)' }}
                            onClick={() => setDeleteTarget(quotation)}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create/Edit modal */}
      {modalOpen && (
        <VendorQuotationModal
          key={editing?.id ?? 'new'}
          editing={editing}
          payload={data}
          saving={saving}
          onClose={() => {
            setModalOpen(false)
            setEditing(null)
          }}
          onSubmit={async (values) => {
            setSaving(true)
            try {
              if (editing) {
                const result = await updateVendorQuotationAction({ data: { ...values, id: editing.id } })
                if (result.ok) {
                  showFeedback('success', 'Quotation saved.')
                  setModalOpen(false)
                  setEditing(null)
                  await load()
                } else {
                  showFeedback('error', result.message)
                }
              } else {
                const result = await createVendorQuotationAction({ data: values })
                if (result.ok) {
                  showFeedback('success', `Quotation ${result.data.quotationNumber} created.`)
                  setModalOpen(false)
                  setEditing(null)
                  await load()
                } else {
                  showFeedback('error', result.message)
                }
              }
            } catch (e) {
              showFeedback('error', e instanceof Error ? e.message : 'Failed to save quotation.')
            } finally {
              setSaving(false)
            }
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 400, padding: '22px 24px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>Delete quotation?</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
              {deleteTarget.quotationNumber} from {deleteTarget.vendorName} will be removed. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: 'var(--danger)' }}
                onClick={() => void handleDelete()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal form ───────────────────────────────────────────────────────────
type ModalProps = {
  editing: VendorQuotationDetail | null
  payload: VendorQuotationsPagePayload
  saving: boolean
  onClose: () => void
  onSubmit: (values: import('~/lib/vendor-quotations').VendorQuotationInput) => Promise<void>
}

function VendorQuotationModal({ editing, payload, saving, onClose, onSubmit }: ModalProps) {
  const [items, setItems] = useState<ItemDraft[]>(
    editing && editing.items.length > 0
      ? editing.items.map((item) => ({
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: paiseToRupeeString(item.unitPricePaise),
        }))
      : [{ ...EMPTY_ITEM }],
  )

  const itemTotals = useMemo(() => {
    let subtotalPaise = 0
    for (const item of items) {
      const quantity = Number(item.quantity)
      if (!item.description.trim() || !Number.isFinite(quantity) || quantity <= 0) continue
      const unitPricePaise = item.unitPrice.trim() === '' ? 0 : parseINRToPaise(item.unitPrice)
      subtotalPaise += Math.round(quantity) * unitPricePaise
    }
    return { subtotalPaise, hasLines: items.some((i) => i.description.trim() !== '') }
  }, [items])

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function handleVendorSelect(form: HTMLFormElement, vendorId: string) {
    const vendor = payload.options.vendors.find((v) => v.id === vendorId)
    if (!vendor) return
    const nameInput = form.elements.namedItem('vendorName') as HTMLInputElement | null
    if (nameInput && !nameInput.value.trim()) nameInput.value = vendor.name
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const str = (key: string) => String(fd.get(key) ?? '').trim()

    const taxRatePct = Number(str('taxRatePct') || '18')
    if (!Number.isFinite(taxRatePct) || taxRatePct < 0 || taxRatePct > 100) return

    const parsedItems = items
      .filter((item) => item.description.trim() !== '')
      .map((item) => ({
        description: item.description.trim(),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        unitPricePaise: item.unitPrice.trim() === '' ? 0 : parseINRToPaise(item.unitPrice),
      }))

    const manualSubtotalRaw = str('manualSubtotal')
    const discountRaw = str('discount')

    await onSubmit({
      vendorId: str('vendorId') || null,
      vendorName: str('vendorName'),
      vendorEmail: str('vendorEmail') || null,
      vendorPhone: str('vendorPhone') || null,
      vendorAddress: str('vendorAddress') || null,
      subject: str('subject') || null,
      projectId: str('projectId') || null,
      quotationDate: str('quotationDate') || null,
      taxRateBps: Math.round(taxRatePct * 100),
      manualSubtotalPaise: parsedItems.length > 0 || manualSubtotalRaw === '' ? null : parseINRToPaise(manualSubtotalRaw),
      discountPaise: discountRaw === '' ? 0 : parseINRToPaise(discountRaw),
      validUntil: str('validUntil') || null,
      notes: str('notes') || null,
      terms: str('terms') || null,
      status: (str('status') || 'draft') as VendorQuotationStatus,
      items: parsedItems,
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 760,
          padding: '24px 28px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {editing ? `Edit ${editing.quotationNumber}` : 'New Vendor Quotation'}
            </h3>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field>
              <FieldLabel>Vendor (master)</FieldLabel>
              <select
                name="vendorId"
                defaultValue={editing?.vendorId ?? ''}
                className="input-base"
                style={{ height: 40 }}
                onChange={(e) => handleVendorSelect(e.currentTarget.form as HTMLFormElement, e.currentTarget.value)}
              >
                <option value="">— Not linked —</option>
                {payload.options.vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.code} · {vendor.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>Vendor Name *</FieldLabel>
              <Input name="vendorName" defaultValue={editing?.vendorName ?? ''} placeholder="Acme Steels" required />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field>
              <FieldLabel>Vendor Email</FieldLabel>
              <Input name="vendorEmail" type="email" defaultValue={editing?.vendorEmail ?? ''} placeholder="sales@vendor.com" />
            </Field>
            <Field>
              <FieldLabel>Vendor Phone</FieldLabel>
              <Input name="vendorPhone" defaultValue={editing?.vendorPhone ?? ''} placeholder="+91 98765 43210" />
            </Field>
          </div>

          <Field>
            <FieldLabel>Vendor Address</FieldLabel>
            <Input name="vendorAddress" defaultValue={editing?.vendorAddress ?? ''} placeholder="Street, City, State" />
          </Field>

          <Field>
            <FieldLabel>Subject</FieldLabel>
            <Input name="subject" defaultValue={editing?.subject ?? ''} placeholder="Supply of structural steel for Project X" />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field>
              <FieldLabel>Project</FieldLabel>
              <select name="projectId" defaultValue={editing?.projectId ?? ''} className="input-base" style={{ height: 40 }}>
                <option value="">— None —</option>
                {payload.options.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel>Quotation Date</FieldLabel>
              <Input name="quotationDate" type="date" defaultValue={editing?.quotationDate ?? ''} />
            </Field>
            <Field>
              <FieldLabel>Valid Until</FieldLabel>
              <Input name="validUntil" type="date" defaultValue={editing?.validUntil ?? ''} />
            </Field>
          </div>

          {/* Item lines */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 8,
              }}
            >
              Item lines — leave empty to use a manual subtotal
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 110px 32px', gap: 8, alignItems: 'center' }}>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder={`Item ${index + 1} description`}
                    aria-label={`Item ${index + 1} description`}
                  />
                  <Input
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    placeholder="Qty"
                    inputMode="numeric"
                    aria-label={`Item ${index + 1} quantity`}
                  />
                  <Input
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                    placeholder="Rate (₹)"
                    inputMode="decimal"
                    aria-label={`Item ${index + 1} rate in rupees`}
                  />
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {(() => {
                      const quantity = Number(item.quantity)
                      if (!item.description.trim() || !Number.isFinite(quantity) || quantity <= 0) return '—'
                      const unitPricePaise = item.unitPrice.trim() === '' ? 0 : parseINRToPaise(item.unitPrice)
                      return formatPaise(Math.round(quantity) * unitPricePaise, { decimals: 0 })
                    })()}
                  </div>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: 6, color: 'var(--danger)' }}
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [{ ...EMPTY_ITEM }]))}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-ghost"
              style={{ marginTop: 8, fontSize: 12 }}
              onClick={() => setItems((prev) => [...prev.filter((i) => i.description.trim() !== '' || prev.length === 1), { ...EMPTY_ITEM }])}
            >
              <Plus size={13} aria-hidden="true" /> Add line
            </button>
          </div>

          {/* Commercials */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <Field>
              <FieldLabel>Manual Subtotal (₹)</FieldLabel>
              <Input
                name="manualSubtotal"
                defaultValue={editing && editing.manualSubtotalPaise !== null ? paiseToRupeeString(editing.manualSubtotalPaise) : ''}
                placeholder={itemTotals.hasLines ? 'Ignored — lines present' : '0.00'}
                inputMode="decimal"
                disabled={itemTotals.hasLines}
              />
            </Field>
            <Field>
              <FieldLabel>Discount (₹)</FieldLabel>
              <Input
                name="discount"
                defaultValue={editing && editing.discountPaise > 0 ? paiseToRupeeString(editing.discountPaise) : ''}
                placeholder="0.00"
                inputMode="decimal"
              />
            </Field>
            <Field>
              <FieldLabel>Tax Rate (%)</FieldLabel>
              <Input
                name="taxRatePct"
                defaultValue={editing ? String(editing.taxRateBps / 100) : String(VENDOR_QUOTATION_DEFAULT_TAX_BPS / 100)}
                placeholder="18"
                inputMode="decimal"
              />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <select name="status" defaultValue={editing?.status ?? 'draft'} className="input-base" style={{ height: 40 }}>
                {VENDOR_QUOTATION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {VENDOR_QUOTATION_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field>
            <FieldLabel>Notes</FieldLabel>
            <Input name="notes" defaultValue={editing?.notes ?? ''} placeholder="Delivery lead time, packing terms..." />
          </Field>
          <Field>
            <FieldLabel>Terms</FieldLabel>
            <Input name="terms" defaultValue={editing?.terms ?? ''} placeholder="Payment terms, warranty..." />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Create quotation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
