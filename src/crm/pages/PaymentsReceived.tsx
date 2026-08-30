import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Landmark,
  Layers,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react'
import { amountInWordsINR, formatINRCompact, formatPaise, parseINRToPaise } from '~/lib/money'
import {
  CLIENT_PAYMENT_STATUS_BADGES,
  CLIENT_PAYMENT_STATUS_LABELS,
  CLIENT_PAYMENT_STATUSES,
  CLIENT_PAYMENT_TYPE_LABELS,
  CLIENT_PAYMENT_TYPES,
  computePaymentReceivedNet,
  computePaymentsReceivedStats,
  PAYMENT_MODE_LABELS,
  PAYMENT_MODES,
  type ClientPaymentStatus,
  type ClientPaymentType,
  type PaymentMode,
  type PaymentReceivedDetail,
  type PaymentReceivedFormOptions,
  type PaymentReceivedListItem,
  type PaymentsReceivedPagePayload,
} from '~/lib/payments-received'
import {
  createPaymentReceivedAction,
  deletePaymentReceivedAction,
  getPaymentReceivedDetailData,
  getPaymentsReceivedPageData,
  updatePaymentReceivedAction,
  updatePaymentReceivedStatusAction,
} from '~/lib/payments-received.functions'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Printable Payment Receipt Voucher ──────────────────────────────────────
function printPaymentReceipt(
  payment: PaymentReceivedDetail | PaymentReceivedListItem,
  showFeedback?: (t: 'success' | 'error', m: string) => void,
) {
  const w = window.open('', '_blank')
  if (!w) {
    showFeedback?.('error', 'Pop-up blocked — please allow pop-ups to print receipt voucher.')
    return
  }

  const words = payment.amountPaise ? amountInWordsINR(payment.amountPaise) : 'Rupees Zero Only'
  const netWords = payment.netAmountPaise ? amountInWordsINR(payment.netAmountPaise) : 'Rupees Zero Only'

  w.document.write(`<!DOCTYPE html><html><head><title>Payment Receipt - ${payment.receiptNumber}</title><style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: Inter, Arial, sans-serif; font-size: 11px; color: #111; line-height: 1.4; margin: 0; }
    .header-box { border: 2px solid #64126D; padding: 14px; border-radius: 6px; margin-bottom: 14px; }
    .title { font-size: 18px; font-weight: 800; color: #64126D; margin: 0 0 4px; }
    .subtitle { font-size: 11px; color: #555; margin: 0; }
    .badge { display: inline-block; padding: 3px 8px; font-size: 10px; font-weight: 700; border-radius: 4px; background: #e0e7ff; color: #3730a3; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f8f9fa; border: 1px solid #ddd; padding: 7px 10px; font-size: 10px; text-transform: uppercase; text-align: left; }
    td { border: 1px solid #ddd; padding: 8px 10px; font-size: 11px; }
    .summary-card { background: #fafafa; border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-top: 14px; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
    .sig-line { border-top: 1px solid #000; padding-top: 6px; font-size: 10px; color: #444; }
  </style></head><body onload="window.print();window.onafterprint=()=>window.close()">
    <div class="header-box">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="title">Accent Techno Solutions Private Limited</div>
          <div class="subtitle">Engineering & Advisory Consultancy Services · GSTIN: 27AAPCA3963L1Z2 · PAN: AAPCA3963L</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px;font-weight:800;color:#64126D;">OFFICIAL PAYMENT RECEIPT</div>
          <div style="font-size:11px;font-weight:700;">${payment.receiptNumber}</div>
          <div style="font-size:10px;color:#666;">Date: ${formatDate(payment.paymentDate)}</div>
        </div>
      </div>
    </div>

    <table>
      <tr>
        <td style="width:50%;vertical-align:top;">
          <div style="font-size:10px;text-transform:uppercase;color:#666;font-weight:700;margin-bottom:4px;">Received From (Client):</div>
          <div style="font-size:13px;font-weight:700;">${payment.companyName}</div>
          ${payment.projectName ? `<div style="font-size:10.5px;color:#444;margin-top:2px;"><b>Project:</b> ${payment.projectName}</div>` : ''}
          ${payment.invoiceNumber ? `<div style="font-size:10.5px;color:#444;"><b>Against Invoice:</b> ${payment.invoiceNumber}</div>` : ''}
          ${payment.clientPoNumber ? `<div style="font-size:10.5px;color:#444;"><b>Client PO:</b> ${payment.clientPoNumber}</div>` : ''}
        </td>
        <td style="width:50%;vertical-align:top;">
          <div style="font-size:10px;text-transform:uppercase;color:#666;font-weight:700;margin-bottom:4px;">Receipt Details:</div>
          <div><b>Receipt Type:</b> ${CLIENT_PAYMENT_TYPE_LABELS[payment.paymentType]}</div>
          <div><b>Payment Mode:</b> ${PAYMENT_MODE_LABELS[payment.paymentMode]}</div>
          <div><b>Ref / UTR / Cheque No:</b> ${payment.transactionReference || '—'}</div>
          ${payment.chequeBank ? `<div><b>Cheque Bank:</b> ${payment.chequeBank} (${formatDate(payment.chequeDate)})</div>` : ''}
          <div><b>Deposited Bank Account:</b> ${payment.bankName || 'Accent Primary Account'} ${payment.bankAccountNumber ? `(${payment.bankAccountNumber})` : ''}</div>
          <div><b>Status:</b> ${CLIENT_PAYMENT_STATUS_LABELS[payment.status]}</div>
        </td>
      </tr>
    </table>

    <table style="margin-top:14px;">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:right;width:140px;">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Gross Payment Received</td>
          <td style="text-align:right;font-weight:700;">${formatPaise(payment.amountPaise)}</td>
        </tr>
        <tr>
          <td>Less: Tax Deducted at Source (TDS under IT Act Sec 194C/194J)</td>
          <td style="text-align:right;color:#b91c1c;">-${formatPaise(payment.tdsDeductedPaise)}</td>
        </tr>
        <tr>
          <td>Less: Bank Charges / Payment Processing Fee</td>
          <td style="text-align:right;color:#6b7280;">-${formatPaise(payment.bankChargesPaise)}</td>
        </tr>
        <tr style="background:#f3f4f6;font-size:12px;">
          <td><b>Net Amount Credited to Bank Account</b></td>
          <td style="text-align:right;font-weight:800;color:#15803d;">${formatPaise(payment.netAmountPaise)}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary-card">
      <div style="font-size:10px;color:#555;"><b>Gross Amount in Words:</b> ${words}</div>
      <div style="font-size:10px;color:#555;margin-top:4px;"><b>Net Credited in Words:</b> ${netWords}</div>
      ${payment.notes ? `<div style="font-size:10px;color:#666;margin-top:6px;"><b>Notes:</b> ${payment.notes}</div>` : ''}
    </div>

    <div class="sig-grid">
      <div>
        <div class="sig-line">Prepared / Verified By (Accounts)</div>
      </div>
      <div style="text-align:right;">
        <div class="sig-line" style="display:inline-block;width:180px;text-align:center;">Authorized Signatory</div>
      </div>
    </div>
  </body></html>`)
  w.document.close()
}

export default function PaymentsReceivedPage({ initialData }: { initialData: PaymentsReceivedPagePayload }) {
  const [data, setData] = useState<PaymentsReceivedPagePayload>(initialData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClientPaymentStatus | 'all'>('all')
  const [modeFilter, setModeFilter] = useState<PaymentMode | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<ClientPaymentType | 'all'>('all')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Drawer preview state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<PaymentReceivedDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Modal create/edit state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<PaymentReceivedListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PaymentReceivedListItem | null>(null)

  const stats = useMemo(() => computePaymentsReceivedStats(data.payments), [data.payments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.payments.filter((p) => {
      const matchesSearch =
        !q ||
        p.receiptNumber.toLowerCase().includes(q) ||
        p.companyName.toLowerCase().includes(q) ||
        (p.projectName ?? '').toLowerCase().includes(q) ||
        (p.invoiceNumber ?? '').toLowerCase().includes(q) ||
        (p.transactionReference ?? '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      const matchesMode = modeFilter === 'all' || p.paymentMode === modeFilter
      const matchesType = typeFilter === 'all' || p.paymentType === typeFilter
      return matchesSearch && matchesStatus && matchesMode && matchesType
    })
  }, [data.payments, search, statusFilter, modeFilter, typeFilter])

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function reload() {
    try {
      const next = await getPaymentsReceivedPageData()
      setData(next)
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to reload payments data.')
    }
  }

  async function openDetail(id: string) {
    setSelectedId(id)
    setLoadingDetail(true)
    try {
      const res = await getPaymentReceivedDetailData({ data: { id } })
      setDetailData(res.payment)
    } catch (e) {
      showFeedback('error', 'Failed to load receipt details.')
      setSelectedId(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  function closeDetail() {
    setSelectedId(null)
    setDetailData(null)
  }

  async function handleStatusChange(id: string, status: ClientPaymentStatus) {
    try {
      const res = await updatePaymentReceivedStatusAction({ data: { id, status } })
      if (res.ok) {
        showFeedback('success', `Status updated to ${CLIENT_PAYMENT_STATUS_LABELS[status]}`)
        await reload()
        if (selectedId === id && detailData) {
          setDetailData({ ...detailData, status })
        }
      } else {
        showFeedback('error', res.message || 'Failed to update status')
      }
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to update status')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const res = await deletePaymentReceivedAction({ data: { id: deleteTarget.id } })
      if (res.ok) {
        showFeedback('success', `Receipt ${deleteTarget.receiptNumber} deleted`)
        setDeleteTarget(null)
        if (selectedId === deleteTarget.id) closeDetail()
        await reload()
      } else {
        showFeedback('error', res.message || 'Failed to delete payment')
      }
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to delete payment')
    }
  }

  function exportCSV() {
    const headers = ['Receipt No', 'Date', 'Client', 'Project', 'Invoice', 'Payment Type', 'Mode', 'Ref No', 'Gross (INR)', 'TDS (INR)', 'Bank Charges (INR)', 'Net Deposited (INR)', 'Status']
    const rows = filtered.map((r) => [
      r.receiptNumber,
      r.paymentDate,
      `"${r.companyName.replace(/"/g, '""')}"`,
      `"${(r.projectName ?? '').replace(/"/g, '""')}"`,
      r.invoiceNumber ?? '',
      CLIENT_PAYMENT_TYPE_LABELS[r.paymentType],
      PAYMENT_MODE_LABELS[r.paymentMode],
      r.transactionReference ?? '',
      (r.amountPaise / 100).toFixed(2),
      (r.tdsDeductedPaise / 100).toFixed(2),
      (r.bankChargesPaise / 100).toFixed(2),
      (r.netAmountPaise / 100).toFixed(2),
      CLIENT_PAYMENT_STATUS_LABELS[r.status],
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `payments_received_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
      {/* Page Header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Payments Received from Client</h2>
            <span className="badge badge-primary" style={{ fontSize: 10.5 }}>
              Inward Receipts
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Track client receipts, invoice settlements, advance collections, and TDS deductions
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn-secondary" onClick={exportCSV} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={13} />
            Export CSV
          </button>
          {data.canWrite && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditingPayment(null)
                setModalOpen(true)
              }}
              style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          style={{
            margin: '10px 24px 0',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 12.5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: feedback.type === 'success' ? 'var(--success-soft-bg, #ecfdf5)' : 'var(--danger-soft-bg, #fef2f2)',
            color: feedback.type === 'success' ? 'var(--success, #059669)' : 'var(--danger, #dc2626)',
            border: `1px solid ${feedback.type === 'success' ? 'var(--success, #059669)' : 'var(--danger, #dc2626)'}`,
            flexShrink: 0,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* KPI Metrics Ribbon */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="kpi-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Received
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-primary)', marginTop: 4 }}>
                  {formatINRCompact(stats.totalReceivedPaise)}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{stats.totalCount} receipts recorded</div>
              </div>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-primary)',
                }}
              >
                <ArrowDownLeft size={16} />
              </div>
            </div>
          </div>

          <div className="kpi-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cleared / Credited
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success, #16a34a)', marginTop: 4 }}>
                  {formatINRCompact(stats.clearedPaise)}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{stats.clearedCount} cleared in bank</div>
              </div>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--success, #16a34a) 12%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success, #16a34a)',
                }}
              >
                <CheckCircle2 size={16} />
              </div>
            </div>
          </div>

          <div className="kpi-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  In Clearance
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning, #d97706)', marginTop: 4 }}>
                  {formatINRCompact(stats.pendingPaise)}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{stats.pendingCount} cheques/transfers pending</div>
              </div>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--warning, #d97706) 12%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--warning, #d97706)',
                }}
              >
                <Clock size={16} />
              </div>
            </div>
          </div>

          <div className="kpi-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total TDS Deducted
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-steel, #0070BA)', marginTop: 4 }}>
                  {formatINRCompact(stats.totalTdsPaise)}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Sec 194C / 194J credits</div>
              </div>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--brand-steel, #0070BA) 12%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-steel, #0070BA)',
                }}
              >
                <FileText size={16} />
              </div>
            </div>
          </div>

          <div className="kpi-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Net Bank Inflow
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                  {formatINRCompact(stats.netDepositedPaise)}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Actual credited to bank</div>
              </div>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--text-primary) 10%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                }}
              >
                <Landmark size={16} />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="card" style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', flex: 1, minWidth: 260 }}>
            {/* Search */}
            <div style={{ position: 'relative', width: 240 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search receipt, client, invoice, UTR…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  fontSize: 12.5,
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                fontSize: 12,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Statuses</option>
              {CLIENT_PAYMENT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {CLIENT_PAYMENT_STATUS_LABELS[st]}
                </option>
              ))}
            </select>

            {/* Mode Filter */}
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as any)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                fontSize: 12,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Payment Modes</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABELS[m]}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                fontSize: 12,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Receipt Types</option>
              {CLIENT_PAYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CLIENT_PAYMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Showing <b>{filtered.length}</b> of <b>{data.payments.length}</b> receipts
          </div>
        </div>

        {/* Data Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Receipt No.</th>
                  <th>Date & Mode</th>
                  <th>Client / Customer</th>
                  <th>Invoice / Context</th>
                  <th>Deposited Bank</th>
                  <th style={{ textAlign: 'right' }}>Gross Amount</th>
                  <th style={{ textAlign: 'right' }}>TDS Deducted</th>
                  <th style={{ textAlign: 'right' }}>Net Deposited</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <Receipt size={28} style={{ opacity: 0.3 }} />
                        <div style={{ fontSize: 13, fontWeight: 600 }}>No payments found</div>
                        <div style={{ fontSize: 11.5 }}>
                          {search || statusFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Click "Record Payment" to log a client receipt.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => openDetail(p.id)}
                      style={{ cursor: 'pointer', background: selectedId === p.id ? 'var(--hover-bg, rgba(100,18,109,0.04))' : undefined }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12.5, color: 'var(--brand-primary)' }}>
                            {p.receiptNumber}
                          </span>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{CLIENT_PAYMENT_TYPE_LABELS[p.paymentType]}</div>
                      </td>

                      <td>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{formatDate(p.paymentDate)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <span className="badge badge-neutral" style={{ fontSize: 9.5, padding: '1px 5px' }}>
                            {PAYMENT_MODE_LABELS[p.paymentMode]}
                          </span>
                          {p.transactionReference && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {p.transactionReference.length > 14 ? p.transactionReference.slice(0, 12) + '…' : p.transactionReference}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.companyName}</div>
                        {p.projectName && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.projectName}</div>}
                      </td>

                      <td>
                        {p.invoiceNumber ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span className="badge badge-cyan" style={{ fontSize: 10 }}>
                              {p.invoiceNumber}
                            </span>
                          </div>
                        ) : p.clientPoNumber ? (
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>PO: {p.clientPoNumber}</span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>On Account</span>
                        )}
                      </td>

                      <td>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{p.bankName || 'Accent Bank'}</div>
                        {p.bankAccountNumber && (
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            •••• {p.bankAccountNumber.slice(-4)}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600 }}>
                        {formatPaise(p.amountPaise)}
                      </td>

                      <td style={{ textAlign: 'right', fontSize: 12, color: p.tdsDeductedPaise > 0 ? 'var(--brand-steel, #0070BA)' : 'var(--text-muted)' }}>
                        {p.tdsDeductedPaise > 0 ? `-${formatPaise(p.tdsDeductedPaise)}` : '—'}
                      </td>

                      <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: 'var(--success, #16a34a)' }}>
                        {formatPaise(p.netAmountPaise)}
                      </td>

                      <td>
                        <span className={`badge ${CLIENT_PAYMENT_STATUS_BADGES[p.status]}`} style={{ fontSize: 11 }}>
                          {CLIENT_PAYMENT_STATUS_LABELS[p.status]}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            title="Print Payment Receipt"
                            onClick={() => printPaymentReceipt(p, showFeedback)}
                            style={{ padding: 4 }}
                          >
                            <Printer size={14} />
                          </button>
                          {data.canWrite && (
                            <>
                              <button
                                type="button"
                                className="btn-ghost"
                                title="Edit Receipt"
                                onClick={() => {
                                  setEditingPayment(p)
                                  setModalOpen(true)
                                }}
                                style={{ padding: 4 }}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn-ghost"
                                title="Delete Receipt"
                                onClick={() => setDeleteTarget(p)}
                                style={{ padding: 4, color: 'var(--danger, #dc2626)' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-over Detail Drawer */}
      {selectedId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            maxWidth: 520,
            background: 'var(--surface)',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
            borderLeft: '1px solid var(--border)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--surface-elevated, var(--surface))',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                  {detailData?.receiptNumber || 'Receipt Details'}
                </h3>
                {detailData && (
                  <span className={`badge ${CLIENT_PAYMENT_STATUS_BADGES[detailData.status]}`} style={{ fontSize: 10.5 }}>
                    {CLIENT_PAYMENT_STATUS_LABELS[detailData.status]}
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
                {detailData ? `${detailData.companyName} · ${formatDate(detailData.paymentDate)}` : 'Loading…'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {detailData && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => printPaymentReceipt(detailData, showFeedback)}
                  style={{ fontSize: 11.5, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Printer size={13} />
                  Print
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={closeDetail} style={{ padding: 6 }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Drawer Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loadingDetail || !detailData ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Loading details…
              </div>
            ) : (
              <>
                {/* Financial Summary Card */}
                <div
                  className="card"
                  style={{
                    padding: 16,
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 6%, var(--surface)), var(--surface))',
                  }}
                >
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Financial Summary
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gross Receipt</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-primary)' }}>
                        {formatPaise(detailData.amountPaise)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net Credited</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success, #16a34a)' }}>
                        {formatPaise(detailData.netAmountPaise)}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed var(--border)', marginTop: 12, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>TDS Deducted (Sec 194C/J):</span>
                      <span style={{ fontWeight: 600, color: detailData.tdsDeductedPaise > 0 ? 'var(--brand-steel, #0070BA)' : 'var(--text-muted)' }}>
                        {detailData.tdsDeductedPaise > 0 ? `-${formatPaise(detailData.tdsDeductedPaise)}` : '₹0'}
                      </span>
                    </div>
                    {detailData.bankChargesPaise > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Bank / Gateway Charges:</span>
                        <span style={{ fontWeight: 600, color: 'var(--danger, #dc2626)' }}>
                          -{formatPaise(detailData.bankChargesPaise)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 10.5, color: 'var(--text-secondary)' }}>
                    <b>Amount in Words:</b> {amountInWordsINR(detailData.amountPaise)}
                  </div>
                </div>

                {/* Quick Status Bar */}
                {data.canWrite && (
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                      Update Status
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {CLIENT_PAYMENT_STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={detailData.status === st}
                          onClick={() => handleStatusChange(detailData.id, st)}
                          className={detailData.status === st ? 'btn-primary' : 'btn-secondary'}
                          style={{ fontSize: 11, padding: '4px 10px' }}
                        >
                          {CLIENT_PAYMENT_STATUS_LABELS[st]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Core Attributes Card */}
                <div className="card" style={{ padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>Payment Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Receipt Type</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{CLIENT_PAYMENT_TYPE_LABELS[detailData.paymentType]}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Payment Mode</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{PAYMENT_MODE_LABELS[detailData.paymentMode]}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>UTR / Ref Number</div>
                      <div style={{ fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>
                        {detailData.transactionReference || '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Payment Date</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{formatDate(detailData.paymentDate)}</div>
                    </div>
                    {detailData.chequeDate && (
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Cheque Date</div>
                        <div style={{ fontWeight: 600, marginTop: 2 }}>{formatDate(detailData.chequeDate)}</div>
                      </div>
                    )}
                    {detailData.chequeBank && (
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Drawer Cheque Bank</div>
                        <div style={{ fontWeight: 600, marginTop: 2 }}>{detailData.chequeBank}</div>
                      </div>
                    )}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Depositing Bank Account</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>
                        {detailData.bankName || 'Accent Primary Account'}
                        {detailData.bankAccountNumber ? ` (${detailData.bankAccountNumber})` : ''}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Commercial Linkage */}
                <div className="card" style={{ padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>Commercial Linkages</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Client:</span>
                      <span style={{ fontWeight: 600 }}>{detailData.companyName}</span>
                    </div>
                    {detailData.projectName && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Project:</span>
                        <span style={{ fontWeight: 600 }}>{detailData.projectName}</span>
                      </div>
                    )}
                    {detailData.invoiceNumber && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Sale Invoice:</span>
                        <span className="badge badge-cyan" style={{ fontSize: 11 }}>
                          {detailData.invoiceNumber}
                        </span>
                      </div>
                    )}
                    {detailData.clientPoNumber && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Client PO:</span>
                        <span style={{ fontWeight: 600 }}>{detailData.clientPoNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {detailData.notes && (
                  <div className="card" style={{ padding: 14 }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 700 }}>Notes / Remarks</h4>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                      {detailData.notes}
                    </p>
                  </div>
                )}

                {/* Audit Activities */}
                <div className="card" style={{ padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <History size={14} />
                    Audit & Timeline
                  </h4>
                  {detailData.activities.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>No audit events logged yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {detailData.activities.map((act) => (
                        <div key={act.id} style={{ fontSize: 11.5, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {act.actorName} · <span style={{ textTransform: 'capitalize' }}>{act.action}</span>
                          </div>
                          {act.newValue && <div style={{ color: 'var(--text-secondary)', marginTop: 1 }}>{act.newValue}</div>}
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            {formatDateTime(act.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Record / Edit Payment Modal */}
      {modalOpen && (
        <PaymentReceivedModal
          initial={editingPayment}
          options={data.options}
          onClose={() => {
            setModalOpen(false)
            setEditingPayment(null)
          }}
          onSaved={async () => {
            setModalOpen(false)
            setEditingPayment(null)
            showFeedback('success', editingPayment ? 'Payment receipt updated' : 'Payment receipt created successfully')
            await reload()
          }}
          showFeedback={showFeedback}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 400, width: '100%', padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--danger, #dc2626)' }}>
              Delete Payment Receipt?
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Are you sure you want to delete receipt <b>{deleteTarget.receiptNumber}</b> from <b>{deleteTarget.companyName}</b>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleDelete} style={{ background: 'var(--danger, #dc2626)' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Record / Edit Payment Modal Component ──────────────────────────────────
function PaymentReceivedModal({
  initial,
  options,
  onClose,
  onSaved,
  showFeedback,
}: {
  initial: PaymentReceivedListItem | null
  options: PaymentReceivedFormOptions
  onClose: () => void
  onSaved: () => void
  showFeedback: (t: 'success' | 'error', m: string) => void
}) {
  const isEdit = !!initial
  const [submitting, setSubmitting] = useState(false)

  const [companyId, setCompanyId] = useState(initial?.companyId ?? '')
  const [companyName, setCompanyName] = useState(initial?.companyName ?? '')
  const [projectId, setProjectId] = useState(initial?.projectId ?? '')
  const [invoiceId, setInvoiceId] = useState(initial?.invoiceId ?? '')
  const [bankId, setBankId] = useState(initial?.bankId ?? options.banks.find((b) => b.isPrimary)?.id ?? '')
  const [paymentDate, setPaymentDate] = useState(initial?.paymentDate ?? new Date().toISOString().slice(0, 10))
  const [paymentType, setPaymentType] = useState<ClientPaymentType>(initial?.paymentType ?? 'invoice_payment')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(initial?.paymentMode ?? 'neft')
  const [transactionReference, setTransactionReference] = useState(initial?.transactionReference ?? '')
  const [chequeDate, setChequeDate] = useState(initial?.chequeDate ?? '')
  const [chequeBank, setChequeBank] = useState(initial?.chequeBank ?? '')
  const [amountRupees, setAmountRupees] = useState(initial ? (initial.amountPaise / 100).toString() : '')
  const [tdsRupees, setTdsRupees] = useState(initial ? (initial.tdsDeductedPaise / 100).toString() : '0')
  const [bankChargesRupees, setBankChargesRupees] = useState(initial ? (initial.bankChargesPaise / 100).toString() : '0')
  const [status, setStatus] = useState<ClientPaymentStatus>(initial?.status ?? 'cleared')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  // Filter invoices for selected company
  const availableInvoices = useMemo(() => {
    if (!companyId) return options.saleInvoices
    return options.saleInvoices.filter((i) => i.companyId === companyId)
  }, [options.saleInvoices, companyId])

  // Filter projects for selected company
  const availableProjects = useMemo(() => {
    if (!companyId) return options.projects
    return options.projects.filter((p) => p.companyId === companyId)
  }, [options.projects, companyId])

  // Auto-fill company name when company selected
  function handleCompanySelect(id: string) {
    setCompanyId(id)
    const match = options.companies.find((c) => c.id === id)
    if (match) setCompanyName(match.name)
  }

  // When an invoice is selected, auto-fill company and suggest invoice balance
  function handleInvoiceSelect(id: string) {
    setInvoiceId(id)
    const match = options.saleInvoices.find((i) => i.id === id)
    if (match) {
      if (match.companyId) {
        setCompanyId(match.companyId)
        setCompanyName(match.clientName)
      }
      if (match.projectId) setProjectId(match.projectId)
      if (!amountRupees && match.balanceDuePaise > 0) {
        setAmountRupees((match.balanceDuePaise / 100).toString())
      }
    }
  }

  // Compute live net amount
  const grossPaise = Math.round((Number.parseFloat(amountRupees) || 0) * 100)
  const tdsPaise = Math.round((Number.parseFloat(tdsRupees) || 0) * 100)
  const chargesPaise = Math.round((Number.parseFloat(bankChargesRupees) || 0) * 100)
  const netPaise = computePaymentReceivedNet(grossPaise, tdsPaise, chargesPaise)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyName.trim()) {
      showFeedback('error', 'Client / Company name is required')
      return
    }
    if (grossPaise <= 0) {
      showFeedback('error', 'Gross amount must be greater than 0')
      return
    }

    setSubmitting(true)
    try {
      if (isEdit && initial) {
        const res = await updatePaymentReceivedAction({
          data: {
            id: initial.id,
            companyId: companyId || null,
            companyName,
            projectId: projectId || null,
            invoiceId: invoiceId || null,
            bankId: bankId || null,
            paymentDate,
            paymentType,
            paymentMode,
            transactionReference: transactionReference || null,
            chequeDate: chequeDate || null,
            chequeBank: chequeBank || null,
            amountPaise: grossPaise,
            tdsDeductedPaise: tdsPaise,
            bankChargesPaise: chargesPaise,
            status,
            notes: notes || null,
            allocations: [],
          },
        })
        if (res.ok) {
          onSaved()
        } else {
          showFeedback('error', res.message || 'Failed to update payment')
        }
      } else {
        const res = await createPaymentReceivedAction({
          data: {
            companyId: companyId || null,
            companyName,
            projectId: projectId || null,
            invoiceId: invoiceId || null,
            bankId: bankId || null,
            paymentDate,
            paymentType,
            paymentMode,
            transactionReference: transactionReference || null,
            chequeDate: chequeDate || null,
            chequeBank: chequeBank || null,
            amountPaise: grossPaise,
            tdsDeductedPaise: tdsPaise,
            bankChargesPaise: chargesPaise,
            status,
            notes: notes || null,
            allocations: [],
          },
        })
        if (res.ok) {
          onSaved()
        } else {
          showFeedback('error', res.message || 'Failed to record payment')
        }
      }
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Error saving payment')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: 12.5,
    background: 'var(--surface)',
    width: '100%',
    color: 'var(--text-primary)',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 620,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              {isEdit ? `Edit Receipt (${initial.receiptNumber})` : 'Record Payment Received'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
              Enter client remittance, invoice settlement, or milestone collection details
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Client & Commercial Context */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                Select Client Master
              </label>
              <select value={companyId} onChange={(e) => handleCompanySelect(e.target.value)} style={inputStyle}>
                <option value="">-- Choose Client Company --</option>
                {options.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                Client / Company Name *
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Reliance Industries Ltd"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                Against Sale Invoice (Optional)
              </label>
              <select value={invoiceId} onChange={(e) => handleInvoiceSelect(e.target.value)} style={inputStyle}>
                <option value="">-- Direct / Advance Payment --</option>
                {availableInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} ({inv.clientName}) · Due: {formatPaise(inv.balanceDuePaise)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                Linked Project (Optional)
              </label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inputStyle}>
                <option value="">-- Select Project --</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Method & Bank */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Payment Date *</label>
              <input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Receipt Type</label>
              <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as any)} style={inputStyle}>
                {CLIENT_PAYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CLIENT_PAYMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Payment Mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as any)} style={inputStyle}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: '1 / 3' }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                Deposited Bank Account
              </label>
              <select value={bankId} onChange={(e) => setBankId(e.target.value)} style={inputStyle}>
                {options.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountNumber} ({b.ifscCode}) {b.isPrimary ? '★ Primary' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                UTR / Reference No.
              </label>
              <input
                type="text"
                placeholder="e.g. UTR123456789"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Cheque details conditional */}
          {paymentMode === 'cheque' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 10, background: 'var(--hover-bg)', borderRadius: 6 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Cheque Date</label>
                <input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Drawer Cheque Bank</label>
                <input
                  type="text"
                  placeholder="e.g. State Bank of India, Fort Branch"
                  value={chequeBank}
                  onChange={(e) => setChequeBank(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {/* Amounts & Deductions Breakdown */}
          <div className="card" style={{ padding: 14, background: 'var(--surface-elevated, var(--surface))' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>
              Amount & TDS Calculation (INR)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  Gross Amount Received (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  style={{ ...inputStyle, fontWeight: 700, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  TDS Deducted (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={tdsRupees}
                  onChange={(e) => setTdsRupees(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  Bank Charges (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={bankChargesRupees}
                  onChange={(e) => setBankChargesRupees(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net Credited to Bank:</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success, #16a34a)' }}>
                  {formatPaise(netPaise)}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 280, textAlign: 'right' }}>
                {grossPaise > 0 ? amountInWordsINR(grossPaise) : '—'}
              </div>
            </div>
          </div>

          {/* Status & Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Receipt Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={inputStyle}>
                {CLIENT_PAYMENT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {CLIENT_PAYMENT_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Notes / Remarks</label>
              <input
                type="text"
                placeholder="e.g. Milestone 2 settlement via RTGS"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Record Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
