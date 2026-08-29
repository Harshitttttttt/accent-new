import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, FileText, LayoutGrid, List, Pencil, Plus, Search, Trash2, X, AlertTriangle, Wallet, Building2, Truck, Printer, Copy, Filter, SlidersHorizontal } from 'lucide-react'
import { formatPaise, formatINRCompact, amountInWordsINR } from '~/lib/money'
import {
  SALE_INVOICE_STATUSES,
  SALE_INVOICE_STATUS_LABELS,
  PURCHASE_INVOICE_STATUSES,
  PURCHASE_INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  computeSaleStats,
  computePurchaseStats,
  agingBucket,
  isOverdue,
  overdueDays,
  type SaleInvoiceListItem,
  type PurchaseInvoiceListItem,
  type InvoicesPagePayload,
  type SaleInvoiceDetail,
  type PurchaseInvoiceDetail,
} from '~/lib/invoices'
import {
  deleteSaleInvoiceAction,
  deletePurchaseInvoiceAction,
  getInvoicesPageData,
  updateSaleStatusAction,
  updatePurchaseStatusAction,
} from '~/lib/invoices.functions'

// ── helpers ──────────────────────────────────────────────────────────────
function formatDate(v: string | null): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
type Tab = 'sale' | 'purchase'
type ViewMode = 'table' | 'board'

// ── printable TAX INVOICE (restores old accent download HTML, paise-correct + amountInWords) ──
// Top-level so drawers and tables can call it without prop drilling.
function printSaleInvoice(inv: SaleInvoiceDetail, showFeedback?: (t: 'success' | 'error', m: string) => void) {
  const w = window.open('', '_blank')
  if (!w) { showFeedback?.('error', 'Pop-up blocked — allow pop-ups to print.'); return }
  const words = inv.totalPaise ? amountInWordsINR(inv.totalPaise) : 'Rupees Zero Only'
  const rows = inv.items.length ? inv.items.map((it, i) => `<tr><td style="border:1px solid #000;padding:6px;text-align:center;">${i+1}</td><td style="border:1px solid #000;padding:6px;">${it.description}</td><td style="border:1px solid #000;padding:6px;text-align:center;">${it.quantity}</td><td style="border:1px solid #000;padding:6px;text-align:right;">${formatPaise(it.unitPricePaise)}</td><td style="border:1px solid #000;padding:6px;text-align:right;">${formatPaise(it.amountPaise)}</td></tr>`).join('') : `<tr><td colspan="5" style="border:1px solid #000;padding:16px;text-align:center;color:#666;">No line items</td></tr>`
  w.document.write(`<html><head><title>${inv.invoiceNumber}</title><style>@page{size:A4;margin:14mm}body{font-family:Inter,Arial,sans-serif;font-size:11px;color:#000}table{width:100%;border-collapse:collapse}th{background:#f3f4f6;border:1px solid #000;padding:6px}</style></head><body onload="window.print();window.onafterprint=()=>window.close()">` +
    `<div style="text-align:center;border:1px solid #000;padding:12px;"><div style="font-size:16px;font-weight:800;">Accent Techno Solutions Private Limited</div><div style="font-size:10px;color:#555;">TAX INVOICE — ${inv.invoiceNumber} · ${formatDate(inv.invoiceDate)} · PO ${inv.poNumber ?? '—'}</div></div>` +
    `<table><tr><td style="width:50%;border:1px solid #000;padding:10px;vertical-align:top;"><b>Bill To:</b><br>${inv.clientName}<br>${(inv.clientAddress??'').replace(/\n/g,'<br>')}<br>${inv.clientGstin?`GSTIN ${inv.clientGstin}`:''} ${inv.clientPan?`· PAN ${inv.clientPan}`:''}<br><span style="font-size:10px;color:#555;">${inv.clientState ?? ''} ${inv.clientStateCode?`· Code ${inv.clientStateCode}`:''}</span></td><td style="width:50%;border:1px solid #000;padding:0;vertical-align:top;"><div style="padding:8px 12px;border-bottom:1px solid #000;">Invoice No. <b style="float:right;">${inv.invoiceNumber}</b></div><div style="padding:8px 12px;border-bottom:1px solid #000;">Due <span style="float:right;">${formatDate(inv.dueDate)}</span></div><div style="padding:8px 12px;">PO Value <span style="float:right;">${inv.originalPoValuePaise?formatPaise(inv.originalPoValuePaise):'—'} · Balance ${inv.balancePoValuePaise?formatPaise(inv.balancePoValuePaise):'—'}</span></div><div style="padding:8px 12px;border-top:1px solid #000;font-size:10px;">Kind Attn: ${inv.kindAttn ?? '—'}</div></td></tr></table>` +
    `<table><thead><tr><th style="width:36px;">Sr</th><th>Description</th><th style="width:60px;">Qty</th><th style="width:90px;">Rate</th><th style="width:100px;">Amount</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<table><tr><td style="width:50%;border:1px solid #000;padding:10px;vertical-align:top;font-size:10px;">GSTIN ${inv.gstNumber??'27AAPCA3963L1Z2'}<br>PAN ${inv.panNumber??'AAPCA3963L'} · TAN ${inv.tanNumber??'MUMA52321D'}<br>${inv.serviceCategory??'Consulting & Advisory Engineering Services (Service Code: 998331)'}<br><span style="color:#555;">${inv.bankAddress??''}</span></td><td style="width:50%;border:1px solid #000;padding:10px;"><div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${formatPaise(inv.subtotalPaise)}</span></div><div style="display:flex;justify-content:space-between;"><span>Discount</span><span>-${formatPaise(inv.discountPaise)}</span></div><div style="display:flex;justify-content:space-between;font-size:10px;color:#555;"><span>${inv.gstType==='igst'?`IGST ${inv.igstRateBps/100}%`:`CGST ${inv.cgstRateBps/100}% + SGST ${inv.sgstRateBps/100}%`}</span><span>${formatPaise(inv.taxAmountPaise)}</span></div><div style="display:flex;justify-content:space-between;font-weight:800;border-top:1px solid #000;margin-top:8px;padding-top:8px;"><span>Total</span><span>${formatPaise(inv.totalPaise)}</span></div><div style="margin-top:8px;font-size:10px;"><b>Amount in words:</b> ${words}</div><div style="margin-top:6px;font-size:10px;">Paid ${formatPaise(inv.amountPaidPaise)} · Balance <b>${formatPaise(inv.balanceDuePaise)}</b> ${isOverdue(inv.dueDate, inv.status)?`· <span style="color:#dc2626;">${overdueDays(inv.dueDate)}d overdue (${agingBucket(inv.dueDate)})</span>`:''}</div></td></tr></table>` +
    `<p style="margin-top:10px;font-size:9px;color:#666;">Terms: ${inv.terms??'Payment due within 30 days.'}<br>Notes: ${inv.notes??''}<br>This is a computer-generated invoice.</p>` +
    `</body></html>`)
  w.document.close()
}

// ── Main page ────────────────────────────────────────────────────────────
export default function InvoicesPage({ initialData }: { initialData: InvoicesPagePayload }) {
  const navigate = useNavigate()
  const [data, setData] = useState<InvoicesPagePayload>(initialData)
  const [tab, setTab] = useState<Tab>('sale')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'newest' | 'dueAsc' | 'totalDesc'>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [detailSale, setDetailSale] = useState<SaleInvoiceDetail | null>(null)
  const [detailPurchase, setDetailPurchase] = useState<PurchaseInvoiceDetail | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; number: string; kind: Tab } | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); void navigate({ to: tab === 'sale' ? '/finance/sale/new' : '/finance/purchase/new' }) } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [navigate, tab])

  const saleStats = useMemo(() => computeSaleStats(data.saleInvoices), [data.saleInvoices])
  const purchaseStats = useMemo(() => computePurchaseStats(data.purchaseInvoices), [data.purchaseInvoices])

  const filteredSale = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = data.saleInvoices.filter((r) => {
      const matchesSearch = !q || r.invoiceNumber.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter
      const matchesOverdue = !overdueOnly || isOverdue(r.dueDate, r.status)
      return matchesSearch && matchesStatus && matchesOverdue
    })
    if (sortBy === 'totalDesc') list = [...list].sort((a,b) => b.totalPaise - a.totalPaise)
    else if (sortBy === 'dueAsc') list = [...list].sort((a,b) => {
      if (!a.dueDate && !b.dueDate) return 0; if (!a.dueDate) return 1; if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    return list
  }, [data.saleInvoices, search, statusFilter, overdueOnly, sortBy])

  const filteredPurchase = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = data.purchaseInvoices.filter((r) => {
      const matchesSearch = !q || r.invoiceNumber.toLowerCase().includes(q) || r.vendorName.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter
      const matchesOverdue = !overdueOnly || isOverdue(r.dueDate, r.status)
      return matchesSearch && matchesStatus && matchesOverdue
    })
    if (sortBy === 'totalDesc') list = [...list].sort((a,b) => b.totalPaise - a.totalPaise)
    else if (sortBy === 'dueAsc') list = [...list].sort((a,b) => {
      if (!a.dueDate && !b.dueDate) return 0; if (!a.dueDate) return 1; if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    return list
  }, [data.purchaseInvoices, search, statusFilter, overdueOnly, sortBy])

  function showFeedback(type: 'success' | 'error', message: string) { setFeedback({ type, message }); setTimeout(() => setFeedback(null), 4000) }
  async function reload() { try { setData(await getInvoicesPageData()) } catch (e) { showFeedback('error', e instanceof Error ? e.message : 'Failed to reload.') } }
  function openCreate() { void navigate({ to: tab === 'sale' ? '/finance/sale/new' : '/finance/purchase/new' }) }
  function openEditSale(id: string) { void navigate({ to: '/finance/sale/$invoiceId', params: { invoiceId: id } }) }
  function openEditPurchase(id: string) { void navigate({ to: '/finance/purchase/$invoiceId', params: { invoiceId: id } }) }
  async function openDetailSale(id: string) { const { getSaleInvoiceDetailData } = await import('~/lib/invoices.functions'); const p = await getSaleInvoiceDetailData({ data: { id } }); if (p.invoice) setDetailSale(p.invoice) }
  async function openDetailPurchase(id: string) { const { getPurchaseInvoiceDetailData } = await import('~/lib/invoices.functions'); const p = await getPurchaseInvoiceDetailData({ data: { id } }); if (p.invoice) setDetailPurchase(p.invoice) }
  async function handleDelete() { if (!deleteTarget) return; const t = deleteTarget; setDeleteTarget(null); try { if (t.kind === 'sale') await deleteSaleInvoiceAction({ data: { id: t.id } }); else await deletePurchaseInvoiceAction({ data: { id: t.id } }); showFeedback('success', `${t.number} deleted.`); await reload() } catch (e) { showFeedback('error', e instanceof Error ? e.message : 'Delete failed.') } }
  async function handleStatusChangeSale(id: string, status: string) { try { await updateSaleStatusAction({ data: { id, status: status as never } }); await reload(); showFeedback('success', 'Status updated.') } catch (e) { showFeedback('error', e instanceof Error ? e.message : 'Status update failed.') } }
  async function handleStatusChangePurchase(id: string, status: string) { try { await updatePurchaseStatusAction({ data: { id, status: status as never } }); await reload(); showFeedback('success', 'Status updated.') } catch (e) { showFeedback('error', e instanceof Error ? e.message : 'Status update failed.') } }
  async function duplicateSale(id: string) {
    const { getSaleInvoiceDetailData, createSaleInvoiceAction } = await import('~/lib/invoices.functions')
    const payload = await getSaleInvoiceDetailData({ data: { id } })
    if (!payload.invoice) { showFeedback('error', 'Invoice not found.'); return }
    const inv = payload.invoice
    try {
      await createSaleInvoiceAction({ data: {
        companyId: inv.companyId, clientName: inv.clientName, clientEmail: inv.clientEmail, clientPhone: inv.clientPhone, clientAddress: inv.clientAddress, clientGstin: inv.clientGstin, clientPan: inv.clientPan, clientState: inv.clientState, clientStateCode: inv.clientStateCode, kindAttn: inv.kindAttn,
        projectId: inv.projectId, poNumber: inv.poNumber, poDate: inv.poDate, originalPoValuePaise: inv.originalPoValuePaise, description: inv.description,
        gstNumber: inv.gstNumber, panNumber: inv.panNumber, tanNumber: inv.tanNumber, serviceCategory: inv.serviceCategory, bankAddress: inv.bankAddress,
        invoiceDate: new Date().toISOString().slice(0,10), dueDate: inv.dueDate, gstType: inv.gstType, cgstRateBps: inv.cgstRateBps, sgstRateBps: inv.sgstRateBps, igstRateBps: inv.igstRateBps,
        discountPaise: inv.discountPaise, amountPaidPaise: 0, notes: inv.notes, terms: inv.terms, status: 'draft' as never,
        items: inv.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPricePaise: it.unitPricePaise })),
      } })
      showFeedback('success', 'Invoice duplicated as draft.'); await reload()
    } catch (e) { showFeedback('error', e instanceof Error ? e.message : 'Duplicate failed.') }
  }
  async function duplicatePurchase(id: string) {
    const { getPurchaseInvoiceDetailData, createPurchaseInvoiceAction } = await import('~/lib/invoices.functions')
    const payload = await getPurchaseInvoiceDetailData({ data: { id } })
    if (!payload.invoice) { showFeedback('error', 'Invoice not found.'); return }
    const inv = payload.invoice
    try {
      await createPurchaseInvoiceAction({ data: {
        vendorId: inv.vendorId, vendorName: inv.vendorName, vendorEmail: inv.vendorEmail, vendorPhone: inv.vendorPhone, vendorAddress: inv.vendorAddress, vendorGstin: inv.vendorGstin, vendorPan: inv.vendorPan,
        projectId: inv.projectId, poNumber: inv.poNumber, poDate: inv.poDate, description: inv.description,
        invoiceDate: new Date().toISOString().slice(0,10), dueDate: inv.dueDate, taxRateBps: inv.taxRateBps, discountPaise: inv.discountPaise, amountPaidPaise: 0,
        notes: inv.notes, terms: inv.terms, attachmentUrl: inv.attachmentUrl, status: 'draft' as never,
        items: inv.items.map((it) => ({ description: it.description, quantity: it.quantity, unitPricePaise: it.unitPricePaise })),
      } })
      showFeedback('success', 'Invoice duplicated as draft.'); await reload()
    } catch (e) { showFeedback('error', e instanceof Error ? e.message : 'Duplicate failed.') }
  }

  useEffect(() => { setStatusFilter('all'); setOverdueOnly(false) }, [tab])

  if (!data.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <FileText size={28} style={{ color: 'var(--warning)', margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>You need <strong>proposals.read</strong> to view invoices.</p>
        </div>
      </div>
    )
  }

  const isSale = tab === 'sale'
  const stats = isSale ? saleStats : purchaseStats
  const filtered = isSale ? filteredSale : filteredPurchase
  const statuses = isSale ? SALE_INVOICE_STATUSES : PURCHASE_INVOICE_STATUSES
  const statusLabels = isSale ? SALE_INVOICE_STATUS_LABELS : PURCHASE_INVOICE_STATUS_LABELS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="page-header" style={{ borderBottom: '1px solid var(--border)', margin: 0 }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet size={18} style={{ color: 'var(--brand-primary)' }} /> Invoices
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>Sent ⇄ Received</span>
            </h2>
            <div style={{ display: 'flex', background: 'var(--surface-secondary)', borderRadius: 8, padding: 3, gap: 2 }}>
              <button type="button" onClick={() => setTab('sale')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: isSale ? 'var(--surface)' : 'transparent', border: isSale ? '1px solid var(--border)' : '1px solid transparent', cursor: 'pointer' }}>
                <ArrowUpRight size={14} /> Sent <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({data.saleInvoices.length})</span>
              </button>
              <button type="button" onClick={() => setTab('purchase')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: !isSale ? 'var(--surface)' : 'transparent', border: !isSale ? '1px solid var(--border)' : '1px solid transparent', cursor: 'pointer' }}>
                <Truck size={14} /> Received <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({data.purchaseInvoices.length})</span>
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: 'var(--surface-secondary)', borderRadius: 4, padding: '2px 6px', fontWeight: 700, fontSize: 11 }}>⌘K</span> New invoice
            </span>
            {data.canWrite && <button type="button" className="btn-primary" onClick={openCreate}><Plus size={14} /> New {isSale ? 'Sale' : 'Purchase'} Invoice</button>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 200 }} placeholder={isSale ? 'Search client or number…' : 'Search vendor or number…'} value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button type="button" className="btn-ghost" style={{ padding: 0 }} onClick={() => setSearch('')}><X size={12} /></button>}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: 'var(--surface)' }}>
              <option value="all">All</option>
              {statuses.map((s) => <option key={s} value={s}>{(statusLabels as Record<string, string>)[s]}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue only
          </label>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}><SlidersHorizontal size={12} /> Sort
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as never)} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}>
                <option value="newest">Newest</option><option value="dueAsc">Due soon</option><option value="totalDesc">Total ↓</option>
              </select>
            </label>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: isSale ? 'var(--success)' : 'var(--warning)', display: 'inline-block' }} />
              {isSale ? `${formatINRCompact(saleStats.balanceDuePaise, { fromPaise: true })} receivable` : `${formatINRCompact(purchaseStats.balanceDuePaise, { fromPaise: true })} payable`}
            </span>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button type="button" onClick={() => setViewMode('table')} style={{ padding: '6px 10px', background: viewMode === 'table' ? 'var(--surface-secondary)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}><List size={14} /> Table</button>
              <button type="button" onClick={() => setViewMode('board')} style={{ padding: '6px 10px', background: viewMode === 'board' ? 'var(--surface-secondary)' : 'transparent', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}><LayoutGrid size={14} /> Board</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '10px 24px', overflowX: 'auto', background: 'var(--surface)' }}>
          <button type="button" className="card" onClick={() => setStatusFilter('all')} style={{ padding: '10px 14px', textAlign: 'left', minWidth: 160, flexShrink: 0, cursor: 'pointer', outline: statusFilter === 'all' ? '2px solid var(--brand-primary)' : undefined }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>All {isSale ? 'sent' : 'received'} · {stats.totalCount}</div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{stats.totalCount === 0 ? '—' : formatINRCompact((stats as any).totalValuePaise, { fromPaise: true })}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Balance {formatINRCompact(stats.balanceDuePaise, { fromPaise: true })}</div>
          </button>
          {isSale ? (
            <>
              <KpiTile label="Draft" count={saleStats.draftCount} value={null} active={statusFilter === 'draft'} onClick={() => setStatusFilter((s) => s === 'draft' ? 'all' : 'draft')} color="var(--text-muted)" />
              <KpiTile label="Sent" count={saleStats.sentCount} value={null} active={statusFilter === 'sent'} onClick={() => setStatusFilter((s) => s === 'sent' ? 'all' : 'sent')} color="var(--brand-steel)" />
              <KpiTile label="Paid" count={saleStats.paidCount} value={saleStats.paidValuePaise} active={statusFilter === 'paid'} onClick={() => setStatusFilter((s) => s === 'paid' ? 'all' : 'paid')} color="var(--success)" />
              <KpiTile label="Overdue" count={saleStats.overdueCount} value={saleStats.overdueValuePaise} active={statusFilter === 'overdue' || overdueOnly} onClick={() => { setStatusFilter((s) => s === 'overdue' ? 'all' : 'overdue'); setOverdueOnly((v) => !v) }} color="var(--danger)" badge={saleStats.overdueCount > 0 ? `${saleStats.overdueCount} overdue` : undefined} />
            </>
          ) : (
            <>
              <KpiTile label="Draft" count={purchaseStats.draftCount} value={null} active={statusFilter === 'draft'} onClick={() => setStatusFilter((s) => s === 'draft' ? 'all' : 'draft')} color="var(--text-muted)" />
              <KpiTile label="Pending" count={purchaseStats.pendingCount} value={null} active={statusFilter === 'pending'} onClick={() => setStatusFilter((s) => s === 'pending' ? 'all' : 'pending')} color="var(--warning)" />
              <KpiTile label="Approved" count={purchaseStats.approvedCount} value={null} active={statusFilter === 'approved'} onClick={() => setStatusFilter((s) => s === 'approved' ? 'all' : 'approved')} color="var(--brand-steel)" />
              <KpiTile label="Paid" count={purchaseStats.paidCount} value={purchaseStats.paidValuePaise} active={statusFilter === 'paid'} onClick={() => setStatusFilter((s) => s === 'paid' ? 'all' : 'paid')} color="var(--success)" />
              <KpiTile label="Overdue" count={purchaseStats.overdueCount} value={null} active={statusFilter === 'overdue' || overdueOnly} onClick={() => { setStatusFilter((s) => s === 'overdue' ? 'all' : 'overdue'); setOverdueOnly((v) => !v) }} color="var(--danger)" />
            </>
          )}
        </div>
      </div>

      {feedback && <div role="status" style={{ margin: '10px 24px 0', padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: feedback.type === 'success' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)', border: `1px solid ${feedback.type === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}` }}>{feedback.message}</div>}

      {(search || statusFilter !== 'all' || overdueOnly || sortBy !== 'newest') && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 24px', background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Filter size={12} /> Active filters:</span>
          {search && <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Search: &quot;{search}&quot; <button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={12} /></button></span>}
          {statusFilter !== 'all' && <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{isSale ? SALE_INVOICE_STATUS_LABELS[statusFilter as never] ?? statusFilter : PURCHASE_INVOICE_STATUS_LABELS[statusFilter as never] ?? statusFilter} <button type="button" onClick={() => setStatusFilter('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={12} /></button></span>}
          {overdueOnly && <span style={{ fontSize: 12, fontWeight: 600, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: 'var(--danger)', borderRadius: 999, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Overdue only <button type="button" onClick={() => setOverdueOnly(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={12} /></button></span>}
          {sortBy !== 'newest' && <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}><SlidersHorizontal size={12} /> Sort: {sortBy==='totalDesc'?'Total ↓':sortBy==='dueAsc'?'Due soon':'Newest'} <button type="button" onClick={() => setSortBy('newest')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={12} /></button></span>}
          <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', marginLeft: 8 }} onClick={() => { setSearch(''); setStatusFilter('all'); setOverdueOnly(false); setSortBy('newest') }}>Clear all</button>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} result{filtered.length!==1?'s':''}</span>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {filtered.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>No {isSale ? 'sale' : 'purchase'} invoices match your filters.</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Create your first invoice — ⌘K or click New.</div>
          </div>
        ) : viewMode === 'table' ? (
          isSale ? (
            <SaleTable rows={filtered as SaleInvoiceListItem[]} onEdit={openEditSale} onView={openDetailSale} onDelete={(r) => setDeleteTarget({ id: r.id, number: r.invoiceNumber, kind: 'sale' })} onStatusChange={handleStatusChangeSale} canWrite={data.canWrite} onDuplicate={duplicateSale} onPrint={(id) => openDetailSale(id)} />
          ) : (
            <PurchaseTable rows={filtered as PurchaseInvoiceListItem[]} onEdit={openEditPurchase} onView={openDetailPurchase} onDelete={(r) => setDeleteTarget({ id: r.id, number: r.invoiceNumber, kind: 'purchase' })} onStatusChange={handleStatusChangePurchase} canWrite={data.canWrite} onDuplicate={duplicatePurchase} />
          )
        ) : (
          isSale ? (
            <SaleBoard rows={filtered as SaleInvoiceListItem[]} onEdit={openEditSale} onView={openDetailSale} onStatusChange={handleStatusChangeSale} canWrite={data.canWrite} onDuplicate={duplicateSale} />
          ) : (
            <PurchaseBoard rows={filtered as PurchaseInvoiceListItem[]} onEdit={openEditPurchase} onView={openDetailPurchase} onStatusChange={handleStatusChangePurchase} canWrite={data.canWrite} onDuplicate={duplicatePurchase} />
          )
        )}
      </div>

      {detailSale && <SaleDetailDrawer invoice={detailSale} onClose={() => setDetailSale(null)} onEdit={() => { setDetailSale(null); openEditSale(detailSale.id) }} onDuplicate={() => { setDetailSale(null); duplicateSale(detailSale.id) }} onPrint={() => printSaleInvoice(detailSale, showFeedback)} />}
      {detailPurchase && <PurchaseDetailDrawer invoice={detailPurchase} onClose={() => setDetailPurchase(null)} onEdit={() => { setDetailPurchase(null); openEditPurchase(detailPurchase.id) }} onDuplicate={() => { setDetailPurchase(null); duplicatePurchase(detailPurchase.id) }} />}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setDeleteTarget(null)}>
          <div className="card" style={{ padding: 24, maxWidth: 420, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}><Trash2 size={16} style={{ color: 'var(--danger)' }} /> Delete {deleteTarget.number}?</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>This will soft-delete the invoice. The number becomes reusable.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiTile({ label, count, value, active, onClick, color, badge }: { label: string; count: number; value: number | null; active: boolean; onClick: () => void; color: string; badge?: string }) {
  return (
    <button type="button" className="card" onClick={onClick} style={{ padding: '10px 14px', textAlign: 'left', minWidth: 140, flexShrink: 0, cursor: 'pointer', outline: active ? '2px solid var(--brand-primary)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>{count}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{value != null && value !== 0 ? formatINRCompact(value, { fromPaise: true }) : count === 0 ? '—' : `${count} invoice${count !== 1 ? 's' : ''}`}</div>
      {badge && <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600, marginTop: 2 }}>{badge}</div>}
    </button>
  )
}

// ── Tables ───────────────────────────────────────────────────────────────
function SaleTable({ rows, onEdit, onView, onDelete, onStatusChange, canWrite, onDuplicate, onPrint }: { rows: SaleInvoiceListItem[]; onEdit: (id: string) => void; onView: (id: string) => void; onDelete: (r: SaleInvoiceListItem) => void; onStatusChange: (id: string, s: string) => void; canWrite: boolean; onDuplicate: (id: string) => void; onPrint: (id: string) => void }) {
  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-secondary)', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 * 11 }}>
              <th style={{ padding: '10px 12px' }}>Invoice #</th>
              <th style={{ padding: '10px 12px' }}>Client</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Paid</th>
              <th style={{ padding: '10px 12px' }}>Due</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
              <th style={{ padding: '10px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const overdue = isOverdue(r.dueDate, r.status)
              const days = overdueDays(r.dueDate)
              const pct = r.totalPaise > 0 ? Math.round((r.amountPaidPaise / r.totalPaise) * 100) : 0
              return (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)', background: overdue ? 'rgba(220,38,38,0.04)' : undefined }}>
                  <td style={{ padding: '10px 12px' }}>
                    <button type="button" onClick={() => onView(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--brand-primary)', fontSize: 13 }}>{r.invoiceNumber}</button>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(r.invoiceDate)} · {r.dueDate ? `due ${formatDate(r.dueDate)}` : 'no due date'}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={12} style={{ color: 'var(--text-muted)' }} />{r.clientName}</div>
                    {overdue && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={10} /> {days}d overdue · {agingBucket(r.dueDate)}</span>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{formatPaise(r.totalPaise)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <div style={{ width: 64, height: 6, borderRadius: 999, background: 'var(--surface-secondary)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? 'var(--success)' : pct > 0 ? 'var(--warning)' : 'var(--border)' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{pct}%</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatPaise(r.balanceDuePaise)} due</div>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{formatDate(r.dueDate)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <select value={r.status} onChange={(e) => onStatusChange(r.id, e.target.value)} disabled={!canWrite} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 600, background: 'var(--surface)', color: r.status === 'overdue' ? 'var(--danger)' : r.status === 'paid' ? 'var(--success)' : undefined }}>
                      {SALE_INVOICE_STATUSES.map((s) => <option key={s} value={s}>{SALE_INVOICE_STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-ghost" style={{ padding: '6px 8px' }} title="View" onClick={() => onView(r.id)}><FileText size={14} /></button>
                      {canWrite && <button type="button" className="btn-ghost" style={{ padding: '6px 8px' }} title="Duplicate" onClick={() => onDuplicate(r.id)}><Copy size={14} /></button>}
                      {canWrite && <><button type="button" className="btn-ghost" style={{ padding: '6px 8px' }} title="Edit" onClick={() => onEdit(r.id)}><Pencil size={14} /></button><button type="button" className="btn-ghost" style={{ padding: '6px 8px', color: 'var(--danger)' }} title="Delete" onClick={() => onDelete(r)}><Trash2 size={14} /></button></>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PurchaseTable({ rows, onEdit, onView, onDelete, onStatusChange, canWrite, onDuplicate }: { rows: PurchaseInvoiceListItem[]; onEdit: (id: string) => void; onView: (id: string) => void; onDelete: (r: PurchaseInvoiceListItem) => void; onStatusChange: (id: string, s: string) => void; canWrite: boolean; onDuplicate: (id: string) => void }) {
  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-secondary)', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 * 11 }}>
              <th style={{ padding: '10px 12px' }}>Invoice #</th>
              <th style={{ padding: '10px 12px' }}>Vendor</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>Payment</th>
              <th style={{ padding: '10px 12px' }}>Due</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
              <th style={{ padding: '10px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const overdue = isOverdue(r.dueDate, r.status)
              const days = overdueDays(r.dueDate)
              const pct = r.totalPaise > 0 ? Math.round((r.amountPaidPaise / r.totalPaise) * 100) : 0
              return (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)', background: overdue ? 'rgba(220,38,38,0.04)' : undefined }}>
                  <td style={{ padding: '10px 12px' }}>
                    <button type="button" onClick={() => onView(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--brand-primary)', fontSize: 13 }}>{r.invoiceNumber}</button>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(r.invoiceDate)}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Truck size={12} style={{ color: 'var(--text-muted)' }} />{r.vendorName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{PAYMENT_STATUS_LABELS[r.paymentStatus]} · {r.totalPaise > 0 ? `${pct}% paid` : '—'}</div>
                    {overdue && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)' }}>{days}d overdue</span>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{formatPaise(r.totalPaise)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: r.paymentStatus === 'paid' ? 'rgba(22,163,74,0.12)' : r.paymentStatus === 'partial' ? 'rgba(234,179,8,0.15)' : 'var(--surface-secondary)', color: r.paymentStatus === 'paid' ? 'var(--success)' : r.paymentStatus === 'partial' ? '#a16207' : 'var(--text-muted)' }}>{PAYMENT_STATUS_LABELS[r.paymentStatus]}</span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{formatPaise(r.balanceDuePaise)} due</div>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{formatDate(r.dueDate)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <select value={r.status} onChange={(e) => onStatusChange(r.id, e.target.value)} disabled={!canWrite} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 600, background: 'var(--surface)' }}>
                      {PURCHASE_INVOICE_STATUSES.map((s) => <option key={s} value={s}>{PURCHASE_INVOICE_STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn-ghost" style={{ padding: '6px 8px' }} title="View" onClick={() => onView(r.id)}><FileText size={14} /></button>
                      {canWrite && <button type="button" className="btn-ghost" style={{ padding: '6px 8px' }} title="Duplicate" onClick={() => onDuplicate(r.id)}><Copy size={14} /></button>}
                      {canWrite && <><button type="button" className="btn-ghost" style={{ padding: '6px 8px' }} title="Edit" onClick={() => onEdit(r.id)}><Pencil size={14} /></button><button type="button" className="btn-ghost" style={{ padding: '6px 8px', color: 'var(--danger)' }} title="Delete" onClick={() => onDelete(r)}><Trash2 size={14} /></button></>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Board views (Twenty record-board style) ──────────────────────────────
function SaleBoard({ rows, onEdit, onView, onStatusChange, canWrite, onDuplicate }: { rows: SaleInvoiceListItem[]; onEdit: (id: string) => void; onView: (id: string) => void; onStatusChange: (id: string, s: string) => void; canWrite: boolean; onDuplicate: (id: string) => void }) {
  const groups = SALE_INVOICE_STATUSES.map((status) => ({ status, label: SALE_INVOICE_STATUS_LABELS[status], rows: rows.filter((r) => r.status === status) }))
  return <BoardGrid groups={groups} onEdit={onEdit} onView={onView} onStatusChange={onStatusChange} canWrite={canWrite} nameKey="clientName" onDuplicate={onDuplicate} />
}
function PurchaseBoard({ rows, onEdit, onView, onStatusChange, canWrite, onDuplicate }: { rows: PurchaseInvoiceListItem[]; onEdit: (id: string) => void; onView: (id: string) => void; onStatusChange: (id: string, s: string) => void; canWrite: boolean; onDuplicate: (id: string) => void }) {
  const groups = PURCHASE_INVOICE_STATUSES.map((status) => ({ status, label: PURCHASE_INVOICE_STATUS_LABELS[status], rows: rows.filter((r) => (r as PurchaseInvoiceListItem).status === status) }))
  return <BoardGrid groups={groups} onEdit={onEdit} onView={onView} onStatusChange={onStatusChange} canWrite={canWrite} nameKey="vendorName" onDuplicate={onDuplicate} />
}
function BoardGrid({ groups, onEdit, onView, onStatusChange, canWrite, nameKey, onDuplicate }: { groups: { status: string; label: string; rows: any[] }[]; onEdit: (id: string) => void; onView: (id: string) => void; onStatusChange: (id: string, s: string) => void; canWrite: boolean; nameKey: string; onDuplicate: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12 }}>
      {groups.map((g) => (
        <div key={g.status} style={{ minWidth: 280, flexShrink: 0, background: 'var(--surface-secondary)', borderRadius: 12, padding: 10, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 4px' }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{g.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px' }}>{g.rows.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
            {g.rows.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No invoices</div> : g.rows.map((r: any) => (
              <div key={r.id} className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => onView(r.id)}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)' }}>{r.invoiceNumber}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{r[nameKey]}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(r.invoiceDate)} · {formatPaise(r.totalPaise)}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  {canWrite && <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); onDuplicate(r.id) }}><Copy size={12} /> Dup</button>}
                  {canWrite && <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); onEdit(r.id) }}><Pencil size={12} /> Edit</button>}
                  <select value={r.status} onChange={(e) => { e.stopPropagation(); onStatusChange(r.id, e.target.value) }} onClick={(e) => e.stopPropagation()} disabled={!canWrite} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', fontSize: 11, flex: 1 }}>
                    {(nameKey === 'clientName' ? SALE_INVOICE_STATUSES : PURCHASE_INVOICE_STATUSES).map((s) => <option key={s} value={s}>{(nameKey === 'clientName' ? SALE_INVOICE_STATUS_LABELS : PURCHASE_INVOICE_STATUS_LABELS)[s as never]}</option>)}
                  </select>
                </div>
                {isOverdue(r.dueDate, r.status) && <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={10} /> {overdueDays(r.dueDate)}d overdue</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Detail drawers ───────────────────────────────────────────────────────
function SaleDetailDrawer({ invoice, onClose, onEdit, onDuplicate, onPrint }: { invoice: SaleInvoiceDetail; onClose: () => void; onEdit: () => void; onDuplicate: () => void; onPrint: () => void }) {
  const pct = invoice.totalPaise > 0 ? Math.round((invoice.amountPaidPaise / invoice.totalPaise) * 100) : 0
  const poUtil = invoice.originalPoValuePaise ? Math.round((invoice.totalPaise / invoice.originalPoValuePaise) * 100) : null
  const words = invoice.totalPaise ? amountInWordsINR(invoice.totalPaise) : 'Rupees Zero Only'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: 560, maxWidth: '94vw', background: 'var(--surface)', borderLeft: '1px solid var(--border)', overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}><FileText size={16} /> {invoice.invoiceNumber}</h3>
          <button type="button" className="btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: 'var(--surface-secondary)', border: '1px solid var(--border)' }}>{SALE_INVOICE_STATUS_LABELS[invoice.status]}</span>
          {isOverdue(invoice.dueDate, invoice.status) && <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(220,38,38,0.12)', color: 'var(--danger)' }}>{overdueDays(invoice.dueDate)}d overdue · {agingBucket(invoice.dueDate)}</span>}
          <button type="button" className="btn-ghost" style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 }} onClick={onPrint}><Printer size={12} /> Print</button>
          <button type="button" className="btn-ghost" style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 }} onClick={onDuplicate}><Copy size={12} /> Duplicate</button>
          <button type="button" className="btn-primary" style={{ marginLeft: 'auto', padding: '6px 12px' }} onClick={onEdit}><Pencil size={12} /> Edit</button>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Client</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{invoice.clientName}</div>
          {invoice.clientAddress && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{invoice.clientAddress}</div>}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{[invoice.clientEmail, invoice.clientPhone].filter(Boolean).join(' · ') || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{[invoice.clientGstin && `GSTIN ${invoice.clientGstin}`, invoice.clientPan && `PAN ${invoice.clientPan}`].filter(Boolean).join(' · ')}</div>
          {invoice.kindAttn && <div style={{ fontSize: 12, marginTop: 6 }}><b>Kind Attn:</b> {invoice.kindAttn}</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Invoice Date</div><div style={{ fontSize: 13, fontWeight: 700 }}>{formatDate(invoice.invoiceDate)}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontWeight: 600 }}>Due Date</div><div style={{ fontSize: 13, fontWeight: 700 }}>{formatDate(invoice.dueDate)}</div></div>
          <div className="card" style={{ padding: 12 }}><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PO</div><div style={{ fontSize: 13, fontWeight: 600 }}>{invoice.poNumber ?? '—'}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontWeight: 600 }}>{invoice.projectName ? `Project: ${invoice.projectName}` : 'No project linked'}</div>{invoice.companyName && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Company: {invoice.companyName}</div>}</div>
        </div>
        {poUtil != null && (
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>PO Utilization — {poUtil}% of {formatPaise(invoice.originalPoValuePaise!)}</div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-secondary)', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, poUtil)}%`, height: '100%', background: poUtil > 90 ? 'var(--danger)' : poUtil > 70 ? 'var(--warning)' : 'var(--brand-primary)' }} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Balance PO {formatPaise(invoice.balancePoValuePaise ?? 0)}</div>
          </div>
        )}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)' }}>Line Items</div>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}><th style={{ padding: '8px 12px' }}>Description</th><th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th><th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th><th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{invoice.items.length === 0 ? <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No line items.</td></tr> : invoice.items.map((it) => <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '8px 12px' }}>{it.description}</td><td style={{ padding: '8px 12px', textAlign: 'center' }}>{it.quantity}</td><td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPaise(it.unitPricePaise)}</td><td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{formatPaise(it.amountPaise)}</td></tr>)}</tbody>
          </table>
          <div style={{ borderTop: '1px solid var(--border)', padding: 12, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{formatPaise(invoice.subtotalPaise)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>-{formatPaise(invoice.discountPaise)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 11 }}><span>{invoice.gstType === 'igst' ? `IGST ${invoice.igstRateBps / 100}%` : `CGST ${invoice.cgstRateBps / 100}% + SGST ${invoice.sgstRateBps / 100}%`}</span><span>{formatPaise(invoice.taxAmountPaise)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}><span>Total</span><span>{formatPaise(invoice.totalPaise)}</span></div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--surface-secondary)', padding: '6px 8px', borderRadius: 6 }}>{words}</div>
          </div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Payment Progress — {pct}%</div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-secondary)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--success)' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}><span>Paid {formatPaise(invoice.amountPaidPaise)}</span><span>Due {formatPaise(invoice.balanceDuePaise)}</span></div>
        </div>
        {(invoice.notes || invoice.terms) && <div className="card" style={{ padding: 12, fontSize: 12 }}><div style={{ fontWeight: 700, marginBottom: 6 }}>Notes & Terms</div>{invoice.notes && <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', marginBottom: 8 }}>{invoice.notes}</div>}{invoice.terms && <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{invoice.terms}</div>}</div>}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', gap: 8 }}><span>Created {formatDate(invoice.createdAt)}</span><span>·</span><span>Updated {formatDate(invoice.updatedAt)}</span></div>
      </div>
    </div>
  )
}

function PurchaseDetailDrawer({ invoice, onClose, onEdit, onDuplicate }: { invoice: PurchaseInvoiceDetail; onClose: () => void; onEdit: () => void; onDuplicate: () => void }) {
  const pct = invoice.totalPaise > 0 ? Math.round((invoice.amountPaidPaise / invoice.totalPaise) * 100) : 0
  const words = invoice.totalPaise ? amountInWordsINR(invoice.totalPaise) : 'Rupees Zero Only'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: 560, maxWidth: '94vw', background: 'var(--surface)', borderLeft: '1px solid var(--border)', overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}><Truck size={16} /> {invoice.invoiceNumber}</h3>
          <button type="button" className="btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: 'var(--surface-secondary)', border: '1px solid var(--border)' }}>{PURCHASE_INVOICE_STATUS_LABELS[invoice.status]} · {PAYMENT_STATUS_LABELS[invoice.paymentStatus]}</span>
          {isOverdue(invoice.dueDate, invoice.status) && <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(220,38,38,0.1)', color: 'var(--danger)' }}>{overdueDays(invoice.dueDate)}d overdue</span>}
          <button type="button" className="btn-ghost" style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6 }} onClick={onDuplicate}><Copy size={12} /> Duplicate</button>
          <button type="button" className="btn-primary" style={{ marginLeft: 'auto', padding: '6px 12px' }} onClick={onEdit}><Pencil size={12} /> Edit</button>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Vendor</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{invoice.vendorName}</div>
          {invoice.vendorAddress && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{invoice.vendorAddress}</div>}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{[invoice.vendorEmail, invoice.vendorPhone].filter(Boolean).join(' · ') || '—'}</div>
          {(invoice.vendorGstin || invoice.vendorPan) && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{[invoice.vendorGstin && `GSTIN ${invoice.vendorGstin}`, invoice.vendorPan && `PAN ${invoice.vendorPan}`].filter(Boolean).join(' · ')}</div>}
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)' }}>Line Items</div>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}><th style={{ padding: '8px 12px' }}>Description</th><th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th><th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate</th><th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{invoice.items.length === 0 ? <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No line items.</td></tr> : invoice.items.map((it) => <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '8px 12px' }}>{it.description}</td><td style={{ padding: '8px 12px', textAlign: 'center' }}>{it.quantity}</td><td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPaise(it.unitPricePaise)}</td><td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{formatPaise(it.amountPaise)}</td></tr>)}</tbody>
          </table>
          <div style={{ borderTop: '1px solid var(--border)', padding: 12, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{formatPaise(invoice.subtotalPaise)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>-{formatPaise(invoice.discountPaise)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 11 }}><span>Tax {invoice.taxRateBps / 100}%</span><span>{formatPaise(invoice.taxAmountPaise)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}><span>Total</span><span>{formatPaise(invoice.totalPaise)}</span></div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--surface-secondary)', padding: '6px 8px', borderRadius: 6 }}>{words}</div>
          </div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Payment — {PAYMENT_STATUS_LABELS[invoice.paymentStatus]}</div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-secondary)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: pct>=100?'var(--success)':pct>0?'var(--warning)':'var(--border)' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}><span>Paid {formatPaise(invoice.amountPaidPaise)}</span><span>Due {formatPaise(invoice.balanceDuePaise)}</span></div>
        </div>
        {invoice.attachmentUrl && <div style={{ fontSize: 12 }}><a href={invoice.attachmentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Open attachment →</a></div>}
        {(invoice.notes || invoice.terms) && <div className="card" style={{ padding: 12, fontSize: 12 }}><div style={{ fontWeight: 700, marginBottom: 6 }}>Notes & Terms</div>{invoice.notes && <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', marginBottom: 8 }}>{invoice.notes}</div>}{invoice.terms && <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{invoice.terms}</div>}</div>}
      </div>
    </div>
  )
}

