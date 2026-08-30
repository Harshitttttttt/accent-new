import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Layers,
  Plus,
  Receipt,
  Save,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import { formatPaise, parseINRToPaise } from '~/lib/money'
import {
  CLIENT_PURCHASE_ORDER_DEFAULT_TAX_BPS,
  CLIENT_PURCHASE_ORDER_STATUS_LABELS,
  CLIENT_PURCHASE_ORDER_STATUSES,
  computeClientPurchaseOrderTotals,
  type ClientPurchaseOrderDetail,
  type ClientPurchaseOrderFormOptions,
  type ClientPurchaseOrderStatus,
} from '~/lib/client-purchase-orders'
import {
  createClientPurchaseOrderAction,
  updateClientPurchaseOrderAction,
} from '~/lib/client-purchase-orders.functions'

function paiseToRupeeString(paise: number): string {
  return (paise / 100).toString()
}

type ItemDraft = {
  itemCode: string
  description: string
  quantity: string
  unit: string
  unitPrice: string
}

const EMPTY_ITEM: ItemDraft = {
  itemCode: '',
  description: '',
  quantity: '1',
  unit: 'nos',
  unitPrice: '',
}

function Section({ title, hint, icon, children }: { title: string; hint?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {icon}
        <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{title}</h4>
      </div>
      {hint && <p style={{ margin: '0 0 14px', fontSize: 11.5, color: 'var(--text-muted)' }}>{hint}</p>}
      <div style={{ marginTop: hint ? 0 : 12 }}>{children}</div>
    </section>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  background: 'var(--surface)',
  width: '100%',
  color: 'var(--text-primary)',
}

export default function ClientPurchaseOrderFormPage({
  initial,
  options,
}: {
  initial: ClientPurchaseOrderDetail | null
  options: ClientPurchaseOrderFormOptions
}) {
  const navigate = useNavigate()
  const isEdit = !!initial

  const [clientPoNumber, setClientPoNumber] = useState(initial?.clientPoNumber ?? '')
  const [companyId, setCompanyId] = useState(initial?.companyId ?? '')
  const [companyName, setCompanyName] = useState(initial?.companyName ?? '')
  const [clientContactName, setClientContactName] = useState(initial?.clientContactName ?? '')
  const [clientContactEmail, setClientContactEmail] = useState(initial?.clientContactEmail ?? '')
  const [clientContactPhone, setClientContactPhone] = useState(initial?.clientContactPhone ?? '')
  const [billingAddress, setBillingAddress] = useState(initial?.billingAddress ?? '')
  const [shippingAddress, setShippingAddress] = useState(initial?.shippingAddress ?? '')
  const [clientGstin, setClientGstin] = useState(initial?.clientGstin ?? '')
  const [clientPan, setClientPan] = useState(initial?.clientPan ?? '')

  const [proposalId, setProposalId] = useState(initial?.proposalId ?? '')
  const [projectId, setProjectId] = useState(initial?.projectId ?? '')
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [poDate, setPoDate] = useState(initial?.poDate ?? new Date().toISOString().slice(0, 10))
  const [receivedDate, setReceivedDate] = useState(initial?.receivedDate ?? new Date().toISOString().slice(0, 10))
  const [deliveryDueDate, setDeliveryDueDate] = useState(initial?.deliveryDueDate ?? '')

  const [status, setStatus] = useState<ClientPurchaseOrderStatus>(initial?.status ?? 'draft')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(initial?.priority ?? 'medium')

  const [taxRatePct, setTaxRatePct] = useState(
    String((initial?.taxRateBps ?? CLIENT_PURCHASE_ORDER_DEFAULT_TAX_BPS) / 100),
  )
  const [discount, setDiscount] = useState(initial?.discountPaise ? paiseToRupeeString(initial.discountPaise) : '')

  const [paymentTerms, setPaymentTerms] = useState(initial?.paymentTerms ?? '')
  const [deliveryTerms, setDeliveryTerms] = useState(initial?.deliveryTerms ?? '')
  const [scopeOfWork, setScopeOfWork] = useState(initial?.scopeOfWork ?? '')
  const [specialInstructions, setSpecialInstructions] = useState(initial?.specialInstructions ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const [items, setItems] = useState<ItemDraft[]>(
    initial && initial.items.length > 0
      ? initial.items.map((it) => ({
          itemCode: it.itemCode ?? '',
          description: it.description,
          quantity: String(it.quantity),
          unit: it.unit,
          unitPrice: paiseToRupeeString(it.unitPricePaise),
        }))
      : [{ ...EMPTY_ITEM }],
  )

  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDirty(true)
  }, [
    clientPoNumber,
    companyId,
    companyName,
    clientContactName,
    clientContactEmail,
    clientContactPhone,
    billingAddress,
    shippingAddress,
    clientGstin,
    clientPan,
    proposalId,
    projectId,
    subject,
    poDate,
    receivedDate,
    deliveryDueDate,
    status,
    priority,
    taxRatePct,
    discount,
    paymentTerms,
    deliveryTerms,
    scopeOfWork,
    specialInstructions,
    notes,
    items,
  ])

  useEffect(() => {
    const t = setTimeout(() => setDirty(false), 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty && !saving) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty, saving])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSubmit(e as unknown as FormEvent)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }])
  }

  function removeItem(idx: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : [{ ...EMPTY_ITEM }]))
  }

  function onCompanySelect(id: string) {
    setCompanyId(id)
    const c = options.companies.find((x) => x.id === id)
    if (c) {
      if (!companyName.trim()) setCompanyName(c.name)
      if (c.email && !clientContactEmail) setClientContactEmail(c.email)
      if (c.phone && !clientContactPhone) setClientContactPhone(c.phone)
      if (c.address && !billingAddress) setBillingAddress(c.address)
      if (c.gstin && !clientGstin) setClientGstin(c.gstin)
    }
  }

  // Real-time commercial math
  const totals = useMemo(() => {
    const taxBps = Math.round(Number(taxRatePct || '0') * 100)
    const discountPaise = parseINRToPaise(discount) || 0
    const parsedItems = items
      .filter((it) => it.description.trim() !== '')
      .map((it) => ({
        quantity: Math.max(1, Number.parseInt(it.quantity, 10) || 1),
        unitPricePaise: parseINRToPaise(it.unitPrice) || 0,
      }))
    return computeClientPurchaseOrderTotals(parsedItems, discountPaise, taxBps)
  }, [items, taxRatePct, discount])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFeedback(null)

    if (!clientPoNumber.trim()) {
      setFeedback('Client PO reference number is required.')
      return
    }

    if (!companyName.trim()) {
      setFeedback('Client / Company name is required.')
      return
    }

    const validItems = items
      .filter((it) => it.description.trim() !== '')
      .map((it) => ({
        itemCode: it.itemCode.trim() || null,
        description: it.description.trim(),
        quantity: Math.max(1, Number.parseInt(it.quantity, 10) || 1),
        unit: it.unit.trim() || 'nos',
        unitPricePaise: parseINRToPaise(it.unitPrice) || 0,
        taxRateBps: Math.round(Number(taxRatePct || '0') * 100),
      }))

    const taxRateBps = Math.round(Number(taxRatePct || '0') * 100)
    const discountPaise = parseINRToPaise(discount) || 0

    const payload = {
      clientPoNumber: clientPoNumber.trim(),
      companyId: companyId || null,
      companyName: companyName.trim(),
      clientContactName: clientContactName.trim() || null,
      clientContactEmail: clientContactEmail.trim() || null,
      clientContactPhone: clientContactPhone.trim() || null,
      billingAddress: billingAddress.trim() || null,
      shippingAddress: shippingAddress.trim() || null,
      clientGstin: clientGstin.trim() || null,
      clientPan: clientPan.trim() || null,
      proposalId: proposalId || null,
      projectId: projectId || null,
      subject: subject.trim() || null,
      poDate: poDate || null,
      receivedDate: receivedDate || null,
      deliveryDueDate: deliveryDueDate || null,
      status,
      priority,
      taxRateBps,
      discountPaise,
      paymentTerms: paymentTerms.trim() || null,
      deliveryTerms: deliveryTerms.trim() || null,
      scopeOfWork: scopeOfWork.trim() || null,
      specialInstructions: specialInstructions.trim() || null,
      notes: notes.trim() || null,
      items: validItems,
    }

    setSaving(true)
    try {
      if (isEdit && initial) {
        const res = await updateClientPurchaseOrderAction({
          data: { ...payload, id: initial.id },
        })
        if (res.ok) {
          setDirty(false)
          void navigate({ to: '/admin/client-purchase-orders' })
        } else {
          setFeedback(res.message)
        }
      } else {
        const res = await createClientPurchaseOrderAction({ data: payload })
        if (res.ok) {
          setDirty(false)
          void navigate({ to: '/admin/client-purchase-orders' })
        } else {
          setFeedback(res.message)
        }
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to save purchase order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top action header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '6px 8px' }}
            onClick={() => void navigate({ to: '/admin/client-purchase-orders' })}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {isEdit ? `Edit Client PO: ${initial.orderNumber}` : 'New Client Purchase Order'}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              {isEdit ? `Client Ref: ${initial.clientPoNumber}` : 'Record received customer purchase order'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
            Status:
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ClientPurchaseOrderStatus)}
              style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}
            >
              {CLIENT_PURCHASE_ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {CLIENT_PURCHASE_ORDER_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => void navigate({ to: '/admin/client-purchase-orders' })}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save PO (Ctrl+S)'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            padding: '10px 24px',
            background: 'var(--danger-surface, #FEF2F2)',
            color: 'var(--danger, #DC2626)',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertTriangle size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Form Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Section 1: Client & PO Identification */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
          <Section title="Order Identification" hint="Customer reference numbers and project link" icon={<ShoppingCart size={16} style={{ color: 'var(--brand-primary)' }} />}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Client PO Number *
                </label>
                <input
                  style={inputStyle}
                  required
                  placeholder="e.g. PO/2026/089"
                  value={clientPoNumber}
                  onChange={(e) => setClientPoNumber(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Priority
                </label>
                <select
                  style={inputStyle}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Subject / Work Title
                </label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Detailed engineering consultancy for pipeline expansion"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Linked Proposal (Quotation)
                </label>
                <select
                  style={inputStyle}
                  value={proposalId}
                  onChange={(e) => {
                    setProposalId(e.target.value)
                    const p = options.proposals.find((x) => x.id === e.target.value)
                    if (p && p.companyId && !companyId) onCompanySelect(p.companyId)
                  }}
                >
                  <option value="">None / Standalone</option>
                  {options.proposals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.proposalNumber} — {p.title} ({p.companyName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Executing Project
                </label>
                <select
                  style={inputStyle}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">None / Pending Setup</option>
                  {options.projects.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.projectNumber} — {pr.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section title="Timeline & Dates" hint="Effective dates and delivery schedule" icon={<Calendar size={16} style={{ color: 'var(--brand-primary)' }} />}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  PO Date (Client Issued)
                </label>
                <input
                  type="date"
                  style={inputStyle}
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Received Date
                </label>
                <input
                  type="date"
                  style={inputStyle}
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Promised Delivery / Milestone Due Date
                </label>
                <input
                  type="date"
                  style={inputStyle}
                  value={deliveryDueDate}
                  onChange={(e) => setDeliveryDueDate(e.target.value)}
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Section 2: Client & Entity linkage */}
        <Section title="Client & Billing Address" hint="Company master association and address snapshots" icon={<Building2 size={16} style={{ color: 'var(--brand-primary)' }} />}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Company Master Link
              </label>
              <select
                style={inputStyle}
                value={companyId}
                onChange={(e) => onCompanySelect(e.target.value)}
              >
                <option value="">Custom / Direct Entry</option>
                {options.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Client / Company Name *
              </label>
              <input
                style={inputStyle}
                required
                placeholder="Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Contact Person Name
              </label>
              <input
                style={inputStyle}
                placeholder="e.g. Rajesh Sharma"
                value={clientContactName}
                onChange={(e) => setClientContactName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Contact Email
              </label>
              <input
                type="email"
                style={inputStyle}
                placeholder="contact@client.com"
                value={clientContactEmail}
                onChange={(e) => setClientContactEmail(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Contact Phone
              </label>
              <input
                style={inputStyle}
                placeholder="+91 98765 43210"
                value={clientContactPhone}
                onChange={(e) => setClientContactPhone(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Client GSTIN
              </label>
              <input
                style={inputStyle}
                placeholder="27AAAAA0000A1Z5"
                value={clientGstin}
                onChange={(e) => setClientGstin(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: '1 / 2' }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Billing Address
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: 60 }}
                placeholder="Registered billing address..."
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: '2 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Shipping / Site Location Address
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: 60 }}
                placeholder="Project site delivery address..."
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
              />
            </div>
          </div>
        </Section>

        {/* Section 3: Line Items */}
        <Section title="Purchase Order Line Items" hint="Itemized deliverables, quantities, and rates" icon={<Layers size={16} style={{ color: 'var(--brand-primary)' }} />}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', width: 120 }}>Code</th>
                  <th style={{ padding: '8px 10px' }}>Description *</th>
                  <th style={{ padding: '8px 10px', width: 90 }}>Qty</th>
                  <th style={{ padding: '8px 10px', width: 90 }}>Unit</th>
                  <th style={{ padding: '8px 10px', width: 140 }}>Rate (₹)</th>
                  <th style={{ padding: '8px 10px', width: 140, textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ padding: '8px 10px', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const qty = Number.parseInt(it.quantity, 10) || 0
                  const rate = parseINRToPaise(it.unitPrice) || 0
                  const amount = Math.round(qty * rate)

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          style={inputStyle}
                          placeholder="ITEM-01"
                          value={it.itemCode}
                          onChange={(e) => updateItem(idx, { itemCode: e.target.value })}
                        />
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          style={inputStyle}
                          placeholder="Deliverable / Service description"
                          required
                          value={it.description}
                          onChange={(e) => updateItem(idx, { description: e.target.value })}
                        />
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          type="number"
                          min="1"
                          style={inputStyle}
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                        />
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          style={inputStyle}
                          placeholder="nos"
                          value={it.unit}
                          onChange={(e) => updateItem(idx, { unit: e.target.value })}
                        />
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          style={inputStyle}
                          placeholder="0.00"
                          value={it.unitPrice}
                          onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                        {formatPaise(amount)}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: '4px 6px', color: 'var(--danger)' }}
                          onClick={() => removeItem(idx)}
                          title="Remove item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={addItem}
              >
                <Plus size={13} />
                <span>Add Item Line</span>
              </button>
            </div>
          </div>
        </Section>

        {/* Section 4: Commercial Summary & Taxes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
          <Section title="Commercial Terms & Notes" hint="Payment conditions and deliverable clauses" icon={<FileText size={16} style={{ color: 'var(--brand-primary)' }} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Payment Terms
                </label>
                <input
                  style={inputStyle}
                  placeholder="e.g. 30% Advance, 40% on milestone 1, 30% on completion"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Delivery Terms
                </label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Electronic delivery via ATS secure portal"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Scope of Work / Special Instructions
                </label>
                <textarea
                  style={{ ...inputStyle, minHeight: 70 }}
                  placeholder="Specific client instructions or project milestones..."
                  value={scopeOfWork}
                  onChange={(e) => setScopeOfWork(e.target.value)}
                />
              </div>
            </div>
          </Section>

          <Section title="Financial Totals" hint="Automatic GST and net calculation" icon={<Receipt size={16} style={{ color: 'var(--brand-primary)' }} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Subtotal:</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{formatPaise(totals.subtotalPaise)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Discount (₹):</label>
                <input
                  style={{ ...inputStyle, width: 120, textAlign: 'right', padding: '5px 8px' }}
                  placeholder="0.00"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>GST Rate (%):</label>
                <select
                  style={{ ...inputStyle, width: 120, padding: '5px 8px' }}
                  value={taxRatePct}
                  onChange={(e) => setTaxRatePct(e.target.value)}
                >
                  <option value="0">0% (Nil / Exempt)</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST (Standard)</option>
                  <option value="28">28% GST</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                <span>Tax Breakdown (CGST + SGST):</span>
                <span>{formatPaise(totals.cgstAmountPaise)} + {formatPaise(totals.sgstAmountPaise)}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 12,
                  marginTop: 4,
                  borderTop: '2px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700 }}>Grand Total:</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-primary)' }}>
                  {formatPaise(totals.totalPaise)}
                </span>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </form>
  )
}
