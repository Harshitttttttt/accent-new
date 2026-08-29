import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, Building2, FileText, Plus, Save, Trash2 } from 'lucide-react'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { amountInWordsINR, formatPaise } from '~/lib/money'
import {
  SALE_INVOICE_STATUS_LABELS,
  SALE_INVOICE_STATUSES,
  computeSaleTotals,
  type InvoiceFormOptions,
  type SaleInvoiceDetail,
} from '~/lib/invoices'
import {
  createSaleInvoiceAction,
  updateSaleInvoiceAction,
} from '~/lib/invoices.functions'

function paiseToRupeeString(p: number): string { return (p / 100).toString() }
function rupeeStringToPaise(s: string): number {
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}
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

export default function SaleInvoiceFormPage({
  initial,
  options,
}: {
  initial: SaleInvoiceDetail | null
  options: InvoiceFormOptions
}) {
  const navigate = useNavigate()
  const isEdit = !!initial

  const [clientName, setClientName] = useState(initial?.clientName ?? '')
  const [companyId, setCompanyId] = useState<string>(initial?.companyId ?? '')
  const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? '')
  const [clientPhone, setClientPhone] = useState(initial?.clientPhone ?? '')
  const [clientAddress, setClientAddress] = useState(initial?.clientAddress ?? '')
  const [clientGstin, setClientGstin] = useState(initial?.clientGstin ?? '')
  const [clientPan, setClientPan] = useState(initial?.clientPan ?? '')
  const [poNumber, setPoNumber] = useState(initial?.poNumber ?? '')
  const [poDate, setPoDate] = useState(initial?.poDate ?? '')
  const [originalPo, setOriginalPo] = useState(initial?.originalPoValuePaise != null ? paiseToRupeeString(initial.originalPoValuePaise) : '')
  const [projectId, setProjectId] = useState<string>(initial?.projectId ?? '')
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate ?? new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '')
  const [gstType, setGstType] = useState<'cgst_sgst' | 'igst'>((initial?.gstType as never) ?? 'cgst_sgst')
  const [cgst, setCgst] = useState(String((initial?.cgstRateBps ?? 900) / 100))
  const [sgst, setSgst] = useState(String((initial?.sgstRateBps ?? 900) / 100))
  const [igst, setIgst] = useState(String((initial?.igstRateBps ?? 1800) / 100))
  const [discount, setDiscount] = useState(initial?.discountPaise != null ? paiseToRupeeString(initial.discountPaise) : '')
  const [amountPaid, setAmountPaid] = useState(initial?.amountPaidPaise != null ? paiseToRupeeString(initial.amountPaidPaise) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [terms, setTerms] = useState(initial?.terms ?? '')
  const [status, setStatus] = useState<string>(initial?.status ?? 'draft')
  const [items, setItems] = useState<ItemDraft[]>(initial?.items?.length ? initial.items.map((it) => ({ description: it.description, quantity: String(it.quantity), unitPrice: paiseToRupeeString(it.unitPricePaise) })) : [{ ...EMPTY_ITEM }])
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [dirty, setDirty] = useState(false)

  // mark dirty on any change
  useEffect(() => setDirty(true), [clientName, companyId, clientEmail, clientPhone, clientAddress, clientGstin, clientPan, poNumber, poDate, originalPo, projectId, invoiceDate, dueDate, gstType, cgst, sgst, igst, discount, amountPaid, notes, terms, status, items])
  // reset dirty after init
  useEffect(() => { const t = setTimeout(() => setDirty(false), 0); return () => clearTimeout(t) }, [])
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty && !saving) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h)
  }, [dirty, saving])
  // Ctrl/Cmd+S
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void handleSubmit(e as unknown as FormEvent) } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  })

  function updateItem(idx: number, field: keyof ItemDraft, value: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function addItem() { setItems((prev) => [...prev, { ...EMPTY_ITEM }]) }
  function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)) }
  function onCompanyChange(id: string) { setCompanyId(id); const c = options.companies.find((x) => x.id === id); if (c) setClientName(c.name) }

  const totals = useMemo(() => {
    const parsed = items.map((it) => ({ quantity: Math.max(1, parseInt(it.quantity, 10) || 1), unitPricePaise: rupeeStringToPaise(it.unitPrice || '0') })).filter((_, i) => items[i].description.trim() !== '' || items[i].unitPrice.trim() !== '')
    const filtered = items.some((it) => it.description.trim() !== '') ? parsed.filter((_, i) => items[i].description.trim() !== '') : parsed
    const withDescriptions = items.filter((it) => it.description.trim()).length ? items.filter((it) => it.description.trim()).map((it) => ({ quantity: Math.max(1, parseInt(it.quantity, 10) || 1), unitPricePaise: rupeeStringToPaise(it.unitPrice || '0') })) : parsed
    // use items with description for total, fallback to all
    const effective = items.some((it) => it.description.trim()) ? withDescriptions : []
    return computeSaleTotals({
      items: effective,
      discountPaise: discount ? rupeeStringToPaise(discount) : 0,
      gstType: gstType as never,
      cgstRateBps: Math.round(Number(cgst) * 100) || 0,
      sgstRateBps: Math.round(Number(sgst) * 100) || 0,
      igstRateBps: Math.round(Number(igst) * 100) || 0,
      amountPaidPaise: amountPaid ? rupeeStringToPaise(amountPaid) : 0,
    })
  }, [items, discount, gstType, cgst, sgst, igst, amountPaid])

  const words = useMemo(() => {
    try { return totals.totalPaise ? amountInWordsINR(totals.totalPaise) : 'Rupees Zero Only' } catch { return '—' }
  }, [totals.totalPaise])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!clientName.trim()) { setFeedback({ type: 'error', message: 'Client name is required.' }); return }
    if (items.filter((it) => it.description.trim()).length === 0) { setFeedback({ type: 'error', message: 'Add at least one line item.' }); return }
    setSaving(true)
    try {
      const payload = {
        companyId: companyId || null, clientName, clientEmail: clientEmail || null, clientPhone: clientPhone || null, clientAddress: clientAddress || null, clientGstin: clientGstin || null, clientPan: clientPan || null, clientState: null, clientStateCode: null, kindAttn: null,
        projectId: projectId || null, poNumber: poNumber || null, poDate: poDate || null, originalPoValuePaise: originalPo ? rupeeStringToPaise(originalPo) : null, description: null,
        gstNumber: null, panNumber: null, tanNumber: null, serviceCategory: null, bankAddress: null,
        invoiceDate: invoiceDate || null, dueDate: dueDate || null,
        gstType: gstType as never, cgstRateBps: Math.round(Number(cgst) * 100) || 0, sgstRateBps: Math.round(Number(sgst) * 100) || 0, igstRateBps: Math.round(Number(igst) * 100) || 0,
        discountPaise: discount ? rupeeStringToPaise(discount) : 0, amountPaidPaise: amountPaid ? rupeeStringToPaise(amountPaid) : 0,
        notes: notes || null, terms: terms || null, status: status as never,
        items: items.filter((it) => it.description.trim()).map((it) => ({ description: it.description.trim(), quantity: Math.max(1, parseInt(it.quantity, 10) || 1), unitPricePaise: rupeeStringToPaise(it.unitPrice || '0') })),
      }
      if (isEdit) await updateSaleInvoiceAction({ data: { id: initial!.id, ...payload } })
      else {
        const res = await createSaleInvoiceAction({ data: payload })
        // optional: navigate to edit page for continuity
        void res
      }
      setDirty(false)
      await navigate({ to: '/finance' })
    } catch (err) { setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Save failed.' }) } finally { setSaving(false) }
  }

  function handleCancel() {
    if (dirty && !confirm('Discard unsaved changes?')) return
    void navigate({ to: '/finance' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header - matches ProposalDetail page-header */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          <button type="button" className="btn-ghost" style={{ padding: 6 }} onClick={handleCancel} title="Back to invoices"><ArrowLeft size={16} /></button>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
              <FileText size={16} style={{ color: 'var(--brand-primary)' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isEdit ? `Edit ${initial!.invoiceNumber}` : 'New Sale Invoice'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px', color: 'var(--text-muted)' }}>{isEdit ? SALE_INVOICE_STATUS_LABELS[initial!.status as never] : 'Draft'}</span>
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              {isEdit ? `${initial!.clientName} · ${formatPaise(initial!.totalPaise)}` : 'Sent to client · receivable · GST computed server-side'}
              {dirty && <span style={{ color: 'var(--warning)', fontWeight: 700 }}> · Unsaved changes</span>}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn-ghost" onClick={handleCancel} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" onClick={(e) => void handleSubmit(e as unknown as FormEvent)} disabled={saving} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Save size={14} /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'}
            <span style={{ fontSize: 10, opacity: 0.7, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, padding: '1px 4px' }}>⌘S</span>
          </button>
        </div>
      </div>

      {feedback && <div role="status" style={{ margin: '10px 24px 0', padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: feedback.type === 'success' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)', border: `1px solid ${feedback.type === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}` }}>{feedback.message}</div>}

      <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto', display: 'flex', gap: 20, padding: 24, alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ flex: 1, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Section title="Client" hint="Link to company master to auto-fill, or enter manually. GSTIN/PAN validated on save.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field>
                <FieldLabel>Company (master)</FieldLabel>
                <select value={companyId} onChange={(e) => onCompanyChange(e.target.value)} style={inputStyle}>
                  <option value="">— No master link —</option>
                  {options.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field><FieldLabel>Client Name *</FieldLabel><Input value={clientName} onChange={(e) => setClientName(e.target.value)} required placeholder="Acme Corp Pvt Ltd" /></Field>
              <Field><FieldLabel>Client Email</FieldLabel><Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="billing@acme.in" /></Field>
              <Field><FieldLabel>GSTIN</FieldLabel><Input value={clientGstin} onChange={(e) => setClientGstin(e.target.value)} placeholder="27AAPCA..." /></Field>
              <Field><FieldLabel>PAN</FieldLabel><Input value={clientPan} onChange={(e) => setClientPan(e.target.value)} placeholder="AAPCA..." /></Field>
              <Field><FieldLabel>Phone</FieldLabel><Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+91…" /></Field>
              <Field style={{ gridColumn: '1 / -1' }}><FieldLabel>Client Address</FieldLabel><textarea value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Billing address…" /></Field>
            </div>
          </Section>

          <Section title="Invoice & PO" hint="Dates drive overdue & aging. PO value shows utilization bar on the invoice drawer.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field><FieldLabel>Invoice Date</FieldLabel><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Field>
              <Field><FieldLabel>Due Date</FieldLabel><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
              <Field><FieldLabel>PO Number</FieldLabel><Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO-2026-..." /></Field>
              <Field><FieldLabel>PO Date</FieldLabel><Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} /></Field>
              <Field><FieldLabel>Original PO Value (₹)</FieldLabel><Input type="number" step="0.01" value={originalPo} onChange={(e) => setOriginalPo(e.target.value)} placeholder="For utilization bar" /></Field>
              <Field>
                <FieldLabel>Project</FieldLabel>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inputStyle}>
                  <option value="">— None —</option>{options.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Line Items" hint="Quantity × rate. Tax is computed server-side from GST settings below.">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{items.filter((it) => it.description.trim()).length} item(s) · subtotal {formatPaise(totals.subtotalPaise)}</span>
              <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }} onClick={addItem}><Plus size={12} /> Add line</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 140px 36px', gap: 8, alignItems: 'start' }}>
                  <Input placeholder="Description — e.g. Structural design consultancy" value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                  <Input type="number" min="1" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                  <Input type="number" step="0.01" placeholder="Rate (₹)" value={it.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} />
                  <button type="button" className="btn-ghost" style={{ padding: '8px', color: items.length === 1 ? 'var(--text-muted)' : 'var(--danger)' }} onClick={() => removeItem(idx)} disabled={items.length === 1 && !it.description && !it.unitPrice} title="Remove line"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            {items.filter((it) => it.description.trim()).length === 0 && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', display: 'flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={12} /> Add at least one line with description.</div>}
          </Section>

          <Section title="Tax, Discount & Payment">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field>
                <FieldLabel>GST Type</FieldLabel>
                <select value={gstType} onChange={(e) => setGstType(e.target.value as never)} style={inputStyle}>
                  <option value="cgst_sgst">CGST + SGST</option><option value="igst">IGST</option>
                </select>
              </Field>
              {gstType === 'cgst_sgst' ? (
                <><Field><FieldLabel>CGST %</FieldLabel><Input type="number" step="0.1" value={cgst} onChange={(e) => setCgst(e.target.value)} /></Field>
                <Field><FieldLabel>SGST %</FieldLabel><Input type="number" step="0.1" value={sgst} onChange={(e) => setSgst(e.target.value)} /></Field></>
              ) : (<Field><FieldLabel>IGST %</FieldLabel><Input type="number" step="0.1" value={igst} onChange={(e) => setIgst(e.target.value)} /></Field>)}
              <Field><FieldLabel>Discount (₹)</FieldLabel><Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" /></Field>
              <Field><FieldLabel>Amount Paid (₹)</FieldLabel><Input type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" /></Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                  {SALE_INVOICE_STATUSES.map((s) => <option key={s} value={s}>{SALE_INVOICE_STATUS_LABELS[s]}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Notes & Terms">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field><FieldLabel>Notes (internal / client-facing)</FieldLabel><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Notes visible on detail drawer…" /></Field>
              <Field><FieldLabel>Terms</FieldLabel><textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Payment due within 30 days…" /></Field>
            </div>
          </Section>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingBottom: 8 }}>
            <button type="button" className="btn-ghost" onClick={handleCancel} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'}</button>
          </div>
        </div>

        {/* Live preview - sticky totals - hidden on narrow */}
        <div style={{ width: 320, flexShrink: 0, position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 12 }} className="hidden lg:flex">
          <div className="card" style={{ padding: 16, background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}><Building2 size={12} /> Live Totals</div>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Subtotal</span><span>{formatPaise(totals.subtotalPaise)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Discount</span><span>-{formatPaise(totals.discountPaise)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 11 }}><span>{gstType === 'igst' ? `IGST ${Number(igst) || 0}%` : `CGST ${Number(cgst) || 0}% + SGST ${Number(sgst) || 0}%`}</span><span>{formatPaise(totals.taxPaise)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 8, fontSize: 14 }}><span>Total</span><span style={{ color: 'var(--brand-primary)' }}>{formatPaise(totals.totalPaise)}</span></div>
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--surface-secondary)', padding: '6px 8px', borderRadius: 6 }}>{words}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}><span>Paid {formatPaise(amountPaid ? rupeeStringToPaise(amountPaid) : 0)}</span><span style={{ fontWeight: 700, color: totals.balanceDuePaise === 0 ? 'var(--success)' : 'var(--text-primary)' }}>Due {formatPaise(totals.balanceDuePaise)}</span></div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-secondary)', overflow: 'hidden', marginTop: 2 }}>
                <div style={{ width: `${totals.totalPaise ? Math.min(100, Math.round((amountPaid ? rupeeStringToPaise(amountPaid) : 0) / totals.totalPaise * 100)) : 0}%`, height: '100%', background: 'var(--success)' }} />
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 14, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, fontSize: 11 }}>Tips</div>
            • Link <b>Company</b> to auto-fill client name.<br />• <b>⌘S</b> to save · <b>Esc</b> prompts discard.<br />• Tax & balance recompute live; server is source of truth on save.<br />• Print preview available after save via invoice drawer.
          </div>
        </div>
      </form>
    </div>
  )
}
