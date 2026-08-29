import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, FileText, Plus, Save, Trash2 } from 'lucide-react'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { formatPaise, parseINRToPaise } from '~/lib/money'
import {
  VENDOR_QUOTATION_DEFAULT_TAX_BPS,
  VENDOR_QUOTATION_STATUSES,
  VENDOR_QUOTATION_STATUS_LABELS,
  computeVendorQuotationTotals,
  type VendorQuotationDetail,
  type VendorQuotationFormOptions,
} from '~/lib/vendor-quotations'
import {
  createVendorQuotationAction,
  updateVendorQuotationAction,
} from '~/lib/vendor-quotations.functions'

function paiseToRupeeString(paise: number): string { return (paise / 100).toString() }
type ItemDraft = { description: string; quantity: string; unitPrice: string }
const EMPTY_ITEM: ItemDraft = { description: '', quantity: '1', unitPrice: '' }

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 20 }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700 }}>{title}</h4>
      {hint && <p style={{ margin: '0 0 12px', fontSize: 11.5, color: 'var(--text-muted)' }}>{hint}</p>}
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
}

export default function VendorQuotationFormPage({
  initial,
  options,
}: {
  initial: VendorQuotationDetail | null
  options: VendorQuotationFormOptions
}) {
  const navigate = useNavigate()
  const isEdit = !!initial

  const [vendorId, setVendorId] = useState(initial?.vendorId ?? '')
  const [vendorName, setVendorName] = useState(initial?.vendorName ?? '')
  const [vendorEmail, setVendorEmail] = useState(initial?.vendorEmail ?? '')
  const [vendorPhone, setVendorPhone] = useState(initial?.vendorPhone ?? '')
  const [vendorAddress, setVendorAddress] = useState(initial?.vendorAddress ?? '')
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [projectId, setProjectId] = useState(initial?.projectId ?? '')
  const [quotationDate, setQuotationDate] = useState(initial?.quotationDate ?? new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState(initial?.validUntil ?? '')
  const [taxRatePct, setTaxRatePct] = useState(String((initial?.taxRateBps ?? VENDOR_QUOTATION_DEFAULT_TAX_BPS) / 100))
  const [manualSubtotal, setManualSubtotal] = useState(initial?.manualSubtotalPaise != null ? paiseToRupeeString(initial.manualSubtotalPaise) : '')
  const [discount, setDiscount] = useState(initial?.discountPaise ? paiseToRupeeString(initial.discountPaise) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [terms, setTerms] = useState(initial?.terms ?? '')
  const [status, setStatus] = useState<string>(initial?.status ?? 'draft')
  const [items, setItems] = useState<ItemDraft[]>(
    initial && initial.items.length > 0
      ? initial.items.map((it) => ({
          description: it.description,
          quantity: String(it.quantity),
          unitPrice: paiseToRupeeString(it.unitPricePaise),
        }))
      : [{ ...EMPTY_ITEM }],
  )
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => setDirty(true), [vendorId, vendorName, vendorEmail, vendorPhone, vendorAddress, subject, projectId, quotationDate, validUntil, taxRatePct, manualSubtotal, discount, notes, terms, status, items])
  useEffect(() => { const t = setTimeout(() => setDirty(false), 0); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty && !saving) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h)
  }, [dirty, saving])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void handleSubmit(e as unknown as FormEvent) } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  })

  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function addItem() { setItems((prev) => [...prev.filter((it) => it.description.trim() !== '' || prev.length === 1), { ...EMPTY_ITEM }]) }
  function removeItem(idx: number) { setItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : [{ ...EMPTY_ITEM }]) }
  function onVendorSelect(id: string) {
    setVendorId(id)
    const v = options.vendors.find((x) => x.id === id)
    if (v && !vendorName.trim()) setVendorName(v.name)
  }

  const hasLines = useMemo(() => items.some((it) => it.description.trim() !== ''), [items])

  const totals = useMemo(() => {
    const parsed = items.filter((it) => it.description.trim() !== '').map((it) => ({
      quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
      unitPricePaise: it.unitPrice.trim() === '' ? 0 : parseINRToPaise(it.unitPrice),
    }))
    return computeVendorQuotationTotals({
      items: parsed,
      manualSubtotalPaise: hasLines || manualSubtotal.trim() === '' ? null : parseINRToPaise(manualSubtotal),
      taxRateBps: Math.round(Number(taxRatePct) * 100) || 0,
      discountPaise: discount.trim() === '' ? 0 : parseINRToPaise(discount),
    })
  }, [items, hasLines, manualSubtotal, taxRatePct, discount])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!vendorName.trim()) { setFeedback('Vendor name is required.'); return }
    if (!hasLines && manualSubtotal.trim() === '') {
      // allow manualSubtotal empty? then subtotal 0 — but prevent totally empty quote
      // keep friendly: require at least items or manual subtotal for non-zero? but schema allows 0.
    }
    const taxRateBps = Math.round(Number(taxRatePct) * 100)
    if (!Number.isFinite(taxRateBps) || taxRateBps < 0 || taxRateBps > 10000) { setFeedback('Tax rate must be 0–100%.'); return }
    setSaving(true)
    try {
      const payload = {
        vendorId: vendorId || null,
        vendorName: vendorName.trim(),
        vendorEmail: vendorEmail.trim() || null,
        vendorPhone: vendorPhone.trim() || null,
        vendorAddress: vendorAddress.trim() || null,
        subject: subject.trim() || null,
        projectId: projectId || null,
        quotationDate: quotationDate || null,
        taxRateBps,
        manualSubtotalPaise: hasLines || manualSubtotal.trim() === '' ? null : parseINRToPaise(manualSubtotal),
        discountPaise: discount.trim() === '' ? 0 : parseINRToPaise(discount),
        validUntil: validUntil || null,
        notes: notes.trim() || null,
        terms: terms.trim() || null,
        status: status as never,
        items: items.filter((it) => it.description.trim() !== '').map((it) => ({
          description: it.description.trim(),
          quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
          unitPricePaise: it.unitPrice.trim() === '' ? 0 : parseINRToPaise(it.unitPrice),
        })),
      }
      const res = isEdit
        ? await updateVendorQuotationAction({ data: { ...payload, id: initial!.id } })
        : await createVendorQuotationAction({ data: payload })
      if (!res.ok) { setFeedback(res.message); return }
      setDirty(false)
      await navigate({ to: '/admin/vendor-quotations' })
    } catch (err) { setFeedback(err instanceof Error ? err.message : 'Save failed.') } finally { setSaving(false) }
  }

  function handleCancel() {
    if (dirty && !confirm('Discard unsaved changes?')) return
    void navigate({ to: '/admin/vendor-quotations' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div className="page-header" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          <button type="button" className="btn-ghost" style={{ padding: 6 }} onClick={handleCancel}><ArrowLeft size={16} /></button>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
              <FileText size={16} style={{ color: 'var(--brand-primary)' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isEdit ? `Edit ${initial!.quotationNumber}` : 'New Vendor Quotation'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px', color: 'var(--text-muted)' }}>{isEdit ? VENDOR_QUOTATION_STATUS_LABELS[initial!.status as never] : 'Draft'}</span>
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              {isEdit ? `${initial!.vendorName} · ${formatPaise(initial!.totalPaise)}` : 'Quotation received from vendor · stock the market price'}
              {dirty && <span style={{ color: 'var(--warning)', fontWeight: 700 }}> · Unsaved</span>}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn-ghost" onClick={handleCancel} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" onClick={(e) => void handleSubmit(e as unknown as FormEvent)} disabled={saving} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Save size={14} /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Quotation'} <span style={{ fontSize: 10, opacity: 0.7, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, padding: '1px 4px' }}>⌘S</span>
          </button>
        </div>
      </div>

      {feedback && <div role="status" style={{ margin: '10px 24px 0', padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: 'rgba(220,38,38,0.1)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.3)' }}>{feedback}</div>}

      <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto', display: 'flex', gap: 20, padding: 24, alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ flex: 1, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Section title="Vendor" hint="Link to vendor master to auto-fill, or enter manually.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field>
                <FieldLabel>Vendor (master)</FieldLabel>
                <select value={vendorId} onChange={(e) => onVendorSelect(e.target.value)} style={inputStyle}>
                  <option value="">— Not linked —</option>
                  {options.vendors.map((v) => <option key={v.id} value={v.id}>{v.code} · {v.name}</option>)}
                </select>
              </Field>
              <Field><FieldLabel>Vendor Name *</FieldLabel><Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} required placeholder="Acme Steels" /></Field>
              <Field><FieldLabel>Vendor Email</FieldLabel><Input type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} placeholder="sales@vendor.com" /></Field>
              <Field><FieldLabel>Vendor Phone</FieldLabel><Input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} placeholder="+91 98765 43210" /></Field>
              <Field style={{ gridColumn: '1 / -1' }}><FieldLabel>Vendor Address</FieldLabel><Input value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} placeholder="Street, City, State" /></Field>
              <Field style={{ gridColumn: '1 / -1' }}><FieldLabel>Subject</FieldLabel><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Supply of structural steel for Project X" /></Field>
            </div>
          </Section>

          <Section title="Project & Dates">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field>
                <FieldLabel>Project</FieldLabel>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inputStyle}>
                  <option value="">— None —</option>{options.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field><FieldLabel>Quotation Date</FieldLabel><Input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} /></Field>
              <Field><FieldLabel>Valid Until</FieldLabel><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="Line Items" hint="Leave empty to use a manual subtotal. Quantity × rate.">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{items.filter((it) => it.description.trim()).length} line(s) · subtotal {formatPaise(totals.subtotalPaise)}</span>
              <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }} onClick={addItem}><Plus size={12} /> Add line</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 110px 32px', gap: 8, alignItems: 'center' }}>
                  <Input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder={`Item ${idx + 1} description`} />
                  <Input value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} placeholder="Qty" inputMode="numeric" />
                  <Input value={it.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: e.target.value })} placeholder="Rate (₹)" inputMode="decimal" />
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {(() => {
                      const q = Number(it.quantity)
                      if (!it.description.trim() || !Number.isFinite(q) || q <= 0) return '—'
                      const up = it.unitPrice.trim() === '' ? 0 : parseINRToPaise(it.unitPrice)
                      return formatPaise(Math.round(q) * up, { decimals: 0 })
                    })()}
                  </div>
                  <button type="button" className="btn-ghost" style={{ padding: 6, color: 'var(--danger)' }} onClick={() => removeItem(idx)}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Commercials">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <Field>
                <FieldLabel>Manual Subtotal (₹)</FieldLabel>
                <Input value={manualSubtotal} onChange={(e) => setManualSubtotal(e.target.value)} placeholder={hasLines ? 'Ignored — lines present' : '0.00'} inputMode="decimal" disabled={hasLines} />
              </Field>
              <Field><FieldLabel>Discount (₹)</FieldLabel><Input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" inputMode="decimal" /></Field>
              <Field><FieldLabel>Tax Rate (%)</FieldLabel><Input value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)} placeholder="18" inputMode="decimal" /></Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                  {VENDOR_QUOTATION_STATUSES.map((s) => <option key={s} value={s}>{VENDOR_QUOTATION_STATUS_LABELS[s]}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Notes & Terms">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field><FieldLabel>Notes</FieldLabel><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery lead time, packing terms..." /></Field>
              <Field><FieldLabel>Terms</FieldLabel><Input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms, warranty..." /></Field>
            </div>
          </Section>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingBottom: 8 }}>
            <button type="button" className="btn-ghost" onClick={handleCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Quotation'}</button>
          </div>
        </div>

        <div style={{ width: 320, flexShrink: 0, position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 12 }} className="hidden lg:flex">
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}><FileText size={12} /> Live Totals</div>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Subtotal</span><span>{formatPaise(totals.subtotalPaise)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Discount</span><span>-{formatPaise(discount.trim() === '' ? 0 : parseINRToPaise(discount))}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 11 }}><span>Tax {Number(taxRatePct) || 0}%</span><span>{formatPaise(totals.taxPaise)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 8, fontSize: 14 }}><span>Total</span><span style={{ color: 'var(--brand-primary)' }}>{formatPaise(totals.totalPaise)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}><span>{hasLines ? `${items.filter((it) => it.description.trim()).length} lines` : 'Manual subtotal'}</span><span>{VENDOR_QUOTATION_STATUS_LABELS[status as never]}</span></div>
            </div>
          </div>
          <div className="card" style={{ padding: 14, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, fontSize: 11 }}>Tips</div>
            • Link <b>Vendor</b> to auto-fill name.<br />• <b>⌘S</b> to save · <b>Esc</b> to cancel.<br />• Leave items empty to use <b>Manual Subtotal</b>.<br />• Tax rounds HALF_UP server-side.
          </div>
        </div>
      </form>
    </div>
  )
}
