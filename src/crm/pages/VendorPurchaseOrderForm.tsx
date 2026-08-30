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
  Trash2,
  Truck,
} from 'lucide-react'
import { formatPaise, parseINRToPaise } from '~/lib/money'
import {
  computeVendorPurchaseOrderTotals,
  type VendorPurchaseOrderDetail,
  type VendorPurchaseOrderFormOptions,
  type VendorPurchaseOrderStatus,
  VENDOR_PURCHASE_ORDER_DEFAULT_TAX_BPS,
  VENDOR_PURCHASE_ORDER_STATUS_LABELS,
  VENDOR_PURCHASE_ORDER_STATUSES,
} from '~/lib/vendor-purchase-orders'
import {
  createVendorPurchaseOrderAction,
  updateVendorPurchaseOrderAction,
} from '~/lib/vendor-purchase-orders.functions'

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

export default function VendorPurchaseOrderFormPage({
  initial,
  options,
}: {
  initial: VendorPurchaseOrderDetail | null
  options: VendorPurchaseOrderFormOptions
}) {
  const navigate = useNavigate()
  const isEdit = !!initial

  const [vendorId, setVendorId] = useState(initial?.vendorId ?? '')
  const [vendorName, setVendorName] = useState(initial?.vendorName ?? '')
  const [vendorEmail, setVendorEmail] = useState(initial?.vendorEmail ?? '')
  const [vendorPhone, setVendorPhone] = useState(initial?.vendorPhone ?? '')
  const [vendorAddress, setVendorAddress] = useState(initial?.vendorAddress ?? '')
  const [vendorGstin, setVendorGstin] = useState(initial?.vendorGstin ?? '')
  const [vendorPan, setVendorPan] = useState(initial?.vendorPan ?? '')

  const [vendorQuotationId, setVendorQuotationId] = useState(initial?.vendorQuotationId ?? '')
  const [projectId, setProjectId] = useState(initial?.projectId ?? '')
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [poDate, setPoDate] = useState(initial?.poDate ?? new Date().toISOString().slice(0, 10))
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(initial?.expectedDeliveryDate ?? '')

  const [status, setStatus] = useState<VendorPurchaseOrderStatus>(initial?.status ?? 'draft')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(initial?.priority ?? 'medium')

  const [taxRatePct, setTaxRatePct] = useState(
    String((initial?.taxRateBps ?? VENDOR_PURCHASE_ORDER_DEFAULT_TAX_BPS) / 100),
  )
  const [discount, setDiscount] = useState(initial?.discountPaise ? paiseToRupeeString(initial.discountPaise) : '')

  const [deliveryTerms, setDeliveryTerms] = useState(initial?.deliveryTerms ?? '')
  const [paymentTerms, setPaymentTerms] = useState(initial?.paymentTerms ?? '')
  const [shippingAddress, setShippingAddress] = useState(initial?.shippingAddress ?? '')
  const [modeOfDelivery, setModeOfDelivery] = useState(initial?.modeOfDelivery ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [terms, setTerms] = useState(initial?.terms ?? '')

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
    vendorId,
    vendorName,
    vendorEmail,
    vendorPhone,
    vendorAddress,
    vendorGstin,
    vendorPan,
    vendorQuotationId,
    projectId,
    subject,
    poDate,
    expectedDeliveryDate,
    status,
    priority,
    taxRatePct,
    discount,
    deliveryTerms,
    paymentTerms,
    shippingAddress,
    modeOfDelivery,
    notes,
    terms,
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

  function onVendorSelect(id: string) {
    setVendorId(id)
    const v = options.vendors.find((x) => x.id === id)
    if (v) {
      if (!vendorName.trim()) setVendorName(v.name)
      if (v.email && !vendorEmail) setVendorEmail(v.email)
      if (v.phone && !vendorPhone) setVendorPhone(v.phone)
      if (v.address && !vendorAddress) setVendorAddress(v.address)
      if (v.gstin && !vendorGstin) setVendorGstin(v.gstin)
      if (v.pan && !vendorPan) setVendorPan(v.pan)
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
    return computeVendorPurchaseOrderTotals(parsedItems, discountPaise, taxBps)
  }, [items, taxRatePct, discount])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFeedback(null)

    if (!vendorName.trim()) {
      setFeedback('Vendor name is required.')
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
      vendorId: vendorId || null,
      vendorName: vendorName.trim(),
      vendorEmail: vendorEmail.trim() || null,
      vendorPhone: vendorPhone.trim() || null,
      vendorAddress: vendorAddress.trim() || null,
      vendorGstin: vendorGstin.trim() || null,
      vendorPan: vendorPan.trim() || null,
      vendorQuotationId: vendorQuotationId || null,
      projectId: projectId || null,
      subject: subject.trim() || null,
      poDate: poDate || null,
      expectedDeliveryDate: expectedDeliveryDate || null,
      status,
      priority,
      taxRateBps,
      discountPaise,
      deliveryTerms: deliveryTerms.trim() || null,
      paymentTerms: paymentTerms.trim() || null,
      shippingAddress: shippingAddress.trim() || null,
      modeOfDelivery: modeOfDelivery.trim() || null,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
      items: validItems,
    }

    setSaving(true)
    try {
      if (isEdit && initial) {
        const res = await updateVendorPurchaseOrderAction({
          data: { ...payload, id: initial.id },
        })
        if (res.ok) {
          setDirty(false)
          void navigate({ to: '/admin/vendor-purchase-orders' })
        } else {
          setFeedback(res.message)
        }
      } else {
        const res = await createVendorPurchaseOrderAction({ data: payload })
        if (res.ok) {
          setDirty(false)
          void navigate({ to: '/admin/vendor-purchase-orders' })
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
            onClick={() => void navigate({ to: '/admin/vendor-purchase-orders' })}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {isEdit ? `Edit Vendor PO: ${initial.poNumber}` : 'New Vendor Purchase Order'}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              {isEdit ? `Vendor: ${initial.vendorName}` : 'Issue purchase order to vendor or supplier'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
            Status:
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as VendorPurchaseOrderStatus)}
              style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}
            >
              {VENDOR_PURCHASE_ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {VENDOR_PURCHASE_ORDER_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => void navigate({ to: '/admin/vendor-purchase-orders' })}
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
        {/* Section 1: Vendor & PO Identification */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
          <Section title="Vendor & Procurement Info" hint="Vendor linkage and procurement context" icon={<Truck size={16} style={{ color: 'var(--brand-primary)' }} />}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Vendor Master Link
                </label>
                <select
                  style={inputStyle}
                  value={vendorId}
                  onChange={(e) => onVendorSelect(e.target.value)}
                >
                  <option value="">Custom / Direct Entry</option>
                  {options.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Vendor Name *
                </label>
                <input
                  style={inputStyle}
                  required
                  placeholder="Vendor / Supplier Name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
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

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Source Vendor Quotation
                </label>
                <select
                  style={inputStyle}
                  value={vendorQuotationId}
                  onChange={(e) => {
                    setVendorQuotationId(e.target.value)
                    const q = options.vendorQuotations.find((x) => x.id === e.target.value)
                    if (q && q.vendorId && !vendorId) onVendorSelect(q.vendorId)
                  }}
                >
                  <option value="">None / Direct Procurement</option>
                  {options.vendorQuotations.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.quotationNumber} — {q.vendorName} {q.subject ? `(${q.subject})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Subject / Procurement Description
                </label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Supply and fabrication of structural steel plates"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Allocated Project
                </label>
                <select
                  style={inputStyle}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">General Overhead / Unallocated</option>
                  {options.projects.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.projectNumber} — {pr.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section title="Timeline & Delivery" hint="Issue date and expected delivery schedule" icon={<Calendar size={16} style={{ color: 'var(--brand-primary)' }} />}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  PO Date (Issued)
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
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  style={inputStyle}
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Mode of Delivery
                </label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Road Freight / Courier / On-site handover"
                  value={modeOfDelivery}
                  onChange={(e) => setModeOfDelivery(e.target.value)}
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Section 2: Vendor Contact & Tax ID */}
        <Section title="Vendor Contact & Tax ID" hint="Contact email, phone, GSTIN, PAN, and addresses" icon={<Building2 size={16} style={{ color: 'var(--brand-primary)' }} />}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Vendor Email
              </label>
              <input
                type="email"
                style={inputStyle}
                placeholder="sales@vendor.com"
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Vendor Phone
              </label>
              <input
                style={inputStyle}
                placeholder="+91 98765 43210"
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Vendor GSTIN
              </label>
              <input
                style={inputStyle}
                placeholder="27AAAAA0000A1Z5"
                value={vendorGstin}
                onChange={(e) => setVendorGstin(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Vendor PAN
              </label>
              <input
                style={inputStyle}
                placeholder="ABCDE1234F"
                value={vendorPan}
                onChange={(e) => setVendorPan(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: '1 / 3' }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Vendor Registered Address
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: 60 }}
                placeholder="Vendor office / billing address..."
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: '3 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Destination / Delivery Shipping Address
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: 60 }}
                placeholder="Accent Techno warehouse or project site..."
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
              />
            </div>
          </div>
        </Section>

        {/* Section 3: Line Items */}
        <Section title="Procurement Line Items" hint="Itemized goods, materials, or outsourced services" icon={<Layers size={16} style={{ color: 'var(--brand-primary)' }} />}>
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
                          placeholder="Item or service specification"
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
          <Section title="Payment & Delivery Terms" hint="Vendor contractual terms and clauses" icon={<FileText size={16} style={{ color: 'var(--brand-primary)' }} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Payment Terms
                </label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Net 30 days upon inspection and delivery"
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
                  placeholder="e.g. FOB Destination, supplier responsible for transit insurance"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Standard Terms & Conditions / Special Notes
                </label>
                <textarea
                  style={{ ...inputStyle, minHeight: 70 }}
                  placeholder="Specific warranty or inspection criteria..."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
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
