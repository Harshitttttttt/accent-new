import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, FileText, Plus, Save, Trash2, Truck } from 'lucide-react'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { amountInWordsINR, formatPaise } from '~/lib/money'
import {
  PURCHASE_INVOICE_STATUS_LABELS,
  PURCHASE_INVOICE_STATUSES,
  computePurchaseTotals,
  type InvoiceFormOptions,
  type PurchaseInvoiceDetail,
} from '~/lib/invoices'
import {
  createPurchaseInvoiceAction,
  updatePurchaseInvoiceAction,
} from '~/lib/invoices.functions'

function paiseToRupeeString(p: number): string { return (p / 100).toString() }
function rupeeStringToPaise(s: string): number { const n = Number(s); if (!Number.isFinite(n) || n < 0) return 0; return Math.round(n * 100) }
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
const inputStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: 'var(--surface)', width: '100%' }

export default function PurchaseInvoiceFormPage({ initial, options }: { initial: PurchaseInvoiceDetail | null; options: InvoiceFormOptions }) {
  const navigate = useNavigate()
  const isEdit = !!initial
  const [vendorName, setVendorName] = useState(initial?.vendorName ?? '')
  const [vendorId, setVendorId] = useState<string>(initial?.vendorId ?? '')
  const [vendorEmail, setVendorEmail] = useState(initial?.vendorEmail ?? '')
  const [vendorGstin, setVendorGstin] = useState(initial?.vendorGstin ?? '')
  const [vendorPan, setVendorPan] = useState(initial?.vendorPan ?? '')
  const [vendorAddress, setVendorAddress] = useState(initial?.vendorAddress ?? '')
  const [projectId, setProjectId] = useState<string>(initial?.projectId ?? '')
  const [poNumber, setPoNumber] = useState(initial?.poNumber ?? '')
  const [poDate, setPoDate] = useState(initial?.poDate ?? '')
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate ?? new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '')
  const [taxRate, setTaxRate] = useState(String((initial?.taxRateBps ?? 1800) / 100))
  const [discount, setDiscount] = useState(initial?.discountPaise != null ? paiseToRupeeString(initial.discountPaise) : '')
  const [amountPaid, setAmountPaid] = useState(initial?.amountPaidPaise != null ? paiseToRupeeString(initial.amountPaidPaise) : '')
  const [attachmentUrl, setAttachmentUrl] = useState(initial?.attachmentUrl ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [terms, setTerms] = useState(initial?.terms ?? '')
  const [status, setStatus] = useState<string>(initial?.status ?? 'draft')
  const [items, setItems] = useState<ItemDraft[]>(initial?.items?.length ? initial.items.map((it) => ({ description: it.description, quantity: String(it.quantity), unitPrice: paiseToRupeeString(it.unitPricePaise) })) : [{ ...EMPTY_ITEM }])
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => setDirty(true), [vendorName, vendorId, vendorEmail, vendorGstin, vendorPan, vendorAddress, projectId, poNumber, poDate, invoiceDate, dueDate, taxRate, discount, amountPaid, attachmentUrl, notes, terms, status, items])
  useEffect(() => { const t = setTimeout(() => setDirty(false), 0); return () => clearTimeout(t) }, [])
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty && !saving) { e.preventDefault(); e.returnValue = '' } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h) }, [dirty, saving])
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void handleSubmit(e as unknown as FormEvent) } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) })

  function updateItem(idx: number, field: keyof ItemDraft, value: string) { setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))) }
  function addItem() { setItems((prev) => [...prev, { ...EMPTY_ITEM }]) }
  function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)) }
  function onVendorChange(id: string) { setVendorId(id); const v = options.vendors.find((x) => x.id === id); if (v) setVendorName(v.name) }

  const totals = useMemo(() => {
    const effective = items.filter((it) => it.description.trim()).map((it) => ({ quantity: Math.max(1, parseInt(it.quantity, 10) || 1), unitPricePaise: rupeeStringToPaise(it.unitPrice || '0') }))
    const base = effective.length ? effective : items.some((it) => it.description.trim()) ? effective : []
    // if no described items yet, compute from all with values to show live preview as user types description
    const fallback = items.map((it) => ({ quantity: Math.max(1, parseInt(it.quantity, 10) || 1), unitPricePaise: rupeeStringToPaise(it.unitPrice || '0') })).filter((_, i) => items[i].description.trim() !== '' || items[i].unitPrice.trim() !== '')
    const use = effective.length ? effective : fallback
    return computePurchaseTotals({ items: use, discountPaise: discount ? rupeeStringToPaise(discount) : 0, taxRateBps: Math.round(Number(taxRate) * 100) || 0, amountPaidPaise: amountPaid ? rupeeStringToPaise(amountPaid) : 0 })
  }, [items, discount, taxRate, amountPaid])

  const words = useMemo(() => { try { return totals.totalPaise ? amountInWordsINR(totals.totalPaise) : 'Rupees Zero Only' } catch { return '—' } }, [totals.totalPaise])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!vendorName.trim()) { setFeedback({ type: 'error', message: 'Vendor name is required.' }); return }
    if (items.filter((it) => it.description.trim()).length === 0) { setFeedback({ type: 'error', message: 'Add at least one line item.' }); return }
    setSaving(true)
    try {
      const payload = {
        vendorId: vendorId || null, vendorName, vendorEmail: vendorEmail || null, vendorPhone: null, vendorAddress: vendorAddress || null, vendorGstin: vendorGstin || null, vendorPan: vendorPan || null,
        projectId: projectId || null, poNumber: poNumber || null, poDate: poDate || null, description: null,
        invoiceDate: invoiceDate || null, dueDate: dueDate || null,
        taxRateBps: Math.round(Number(taxRate) * 100) || 0, discountPaise: discount ? rupeeStringToPaise(discount) : 0, amountPaidPaise: amountPaid ? rupeeStringToPaise(amountPaid) : 0,
        notes: notes || null, terms: terms || null, attachmentUrl: attachmentUrl || null, status: status as never,
        items: items.filter((it) => it.description.trim()).map((it) => ({ description: it.description.trim(), quantity: Math.max(1, parseInt(it.quantity, 10) || 1), unitPricePaise: rupeeStringToPaise(it.unitPrice || '0') })),
      }
      if (isEdit) await updatePurchaseInvoiceAction({ data: { id: initial!.id, ...payload } })
      else await createPurchaseInvoiceAction({ data: payload })
      setDirty(false)
      await navigate({ to: '/finance' })
    } catch (err) { setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Save failed.' }) } finally { setSaving(false) }
  }
  function handleCancel() { if (dirty && !confirm('Discard unsaved changes?')) return; void navigate({ to: '/finance' }) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div className="page-header" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          <button type="button" className="btn-ghost" style={{ padding: 6 }} onClick={handleCancel}><ArrowLeft size={16} /></button>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Truck size={16} style={{ color: 'var(--warning)' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isEdit ? `Edit ${initial!.invoiceNumber}` : 'New Purchase Invoice'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px', color: 'var(--text-muted)' }}>{isEdit ? PURCHASE_INVOICE_STATUS_LABELS[initial!.status as never] : 'Draft'}</span>
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{isEdit ? `${initial!.vendorName} · ${formatPaise(initial!.totalPaise)}` : 'Received from vendor · payable'}{dirty && <span style={{ color: 'var(--warning)', fontWeight: 700 }}> · Unsaved</span>}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn-ghost" onClick={handleCancel} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" onClick={(e) => void handleSubmit(e as unknown as FormEvent)} disabled={saving} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Save size={14} /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'} <span style={{ fontSize: 10, opacity: 0.7, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, padding: '1px 4px' }}>⌘S</span></button>
        </div>
      </div>

      {feedback && <div role="status" style={{ margin: '10px 24px 0', padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: 'rgba(220,38,38,0.1)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.3)' }}>{feedback.message}</div>}

      <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto', display: 'flex', gap: 20, padding: 24, alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ flex: 1, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Section title="Vendor" hint="Link to vendor master or enter manually.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field>
                <FieldLabel>Vendor (master)</FieldLabel>
                <select value={vendorId} onChange={(e) => onVendorChange(e.target.value)} style={inputStyle}>
                  <option value="">— No master link —</option>{options.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </Field>
              <Field><FieldLabel>Vendor Name *</FieldLabel><Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} required /></Field>
              <Field><FieldLabel>Vendor Email</FieldLabel><Input type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} /></Field>
              <Field><FieldLabel>GSTIN</FieldLabel><Input value={vendorGstin} onChange={(e) => setVendorGstin(e.target.value)} /></Field>
              <Field><FieldLabel>PAN</FieldLabel><Input value={vendorPan} onChange={(e) => setVendorPan(e.target.value)} /></Field>
              <Field><FieldLabel>Attachment URL</FieldLabel><Input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://…" /></Field>
              <Field style={{ gridColumn: '1 / -1' }}><FieldLabel>Vendor Address</FieldLabel><textarea value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
            </div>
          </Section>

          <Section title="Invoice & PO">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field><FieldLabel>Invoice Date</FieldLabel><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Field>
              <Field><FieldLabel>Due Date</FieldLabel><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
              <Field><FieldLabel>PO Number</FieldLabel><Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} /></Field>
              <Field><FieldLabel>PO Date</FieldLabel><Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} /></Field>
              <Field>
                <FieldLabel>Project</FieldLabel>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inputStyle}><option value="">— None —</option>{options.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>{PURCHASE_INVOICE_STATUSES.map((s) => <option key={s} value={s}>{PURCHASE_INVOICE_STATUS_LABELS[s]}</option>)}</select>
              </Field>
            </div>
          </Section>

          <Section title="Line Items" hint="Quantity × rate.">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{items.filter((it) => it.description.trim()).length} item(s) · subtotal {formatPaise(totals.subtotalPaise)}</span>
              <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }} onClick={addItem}><Plus size={12} /> Add line</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 140px 36px', gap: 8 }}>
                  <Input placeholder="Description" value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                  <Input type="number" min="1" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                  <Input type="number" step="0.01" placeholder="Rate (₹)" value={it.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} />
                  <button type="button" className="btn-ghost" style={{ padding: '8px', color: 'var(--danger)' }} onClick={() => removeItem(idx)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            {items.filter((it) => it.description.trim()).length === 0 && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', display: 'flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={12} /> Add at least one line.</div>}
          </Section>

          <Section title="Tax, Discount & Payment">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field><FieldLabel>Tax Rate %</FieldLabel><Input type="number" step="0.1" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></Field>
              <Field><FieldLabel>Discount (₹)</FieldLabel><Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
              <Field><FieldLabel>Amount Paid (₹)</FieldLabel><Input type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="Notes & Terms">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field><FieldLabel>Notes</FieldLabel><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
              <Field><FieldLabel>Terms</FieldLabel><textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
            </div>
          </Section>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingBottom: 8 }}>
            <button type="button" className="btn-ghost" onClick={handleCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'}</button>
          </div>
        </div>

        <div style={{ width: 320, flexShrink: 0, position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 12 }} className="hidden lg:flex">
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}><FileText size={12} /> Live Totals</div>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Subtotal</span><span>{formatPaise(totals.subtotalPaise)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Discount</span><span>-{formatPaise(totals.discountPaise)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 11 }}><span>Tax {Number(taxRate) || 0}%</span><span>{formatPaise(totals.taxPaise)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 8, fontSize: 14 }}><span>Total</span><span style={{ color: 'var(--brand-primary)' }}>{formatPaise(totals.totalPaise)}</span></div>
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--surface-secondary)', padding: '6px 8px', borderRadius: 6 }}>{words}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}><span>Paid {formatPaise(amountPaid ? rupeeStringToPaise(amountPaid) : 0)}</span><span style={{ fontWeight: 700 }}>Due {formatPaise(totals.balanceDuePaise)}</span></div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-secondary)', overflow: 'hidden', marginTop: 2 }}>
                <div style={{ width: `${totals.totalPaise ? Math.min(100, Math.round((amountPaid ? rupeeStringToPaise(amountPaid) : 0) / totals.totalPaise * 100)) : 0}%`, height: '100%', background: totals.paymentStatus === 'paid' ? 'var(--success)' : totals.paymentStatus === 'partial' ? 'var(--warning)' : 'var(--border)' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, textAlign: 'center', color: totals.paymentStatus === 'paid' ? 'var(--success)' : totals.paymentStatus === 'partial' ? '#a16207' : 'var(--text-muted)' }}>{totals.paymentStatus.toUpperCase()}</div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
