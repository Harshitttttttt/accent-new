import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  History,
  Landmark,
  Layers,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react'
import { amountInWordsINR, formatINRCompact, formatPaise, parseINRToPaise } from '~/lib/money'
import {
  computePaymentReleasedNet,
  computePaymentsReleasedStats,
  PAYMENT_MODE_LABELS,
  PAYMENT_MODES,
  PAYMENT_RELEASE_STATUS_BADGES,
  PAYMENT_RELEASE_STATUS_LABELS,
  PAYMENT_RELEASE_STATUSES,
  PAYMENT_RELEASE_TYPE_LABELS,
  PAYMENT_RELEASE_TYPES,
  type PaymentMode,
  type PaymentReleasedDetail,
  type PaymentReleasedFormOptions,
  type PaymentReleasedListItem,
  type PaymentReleaseStatus,
  type PaymentReleaseType,
  type PaymentsReleasedPagePayload,
} from '~/lib/payments-released'
import {
  approvePaymentReleasedAction,
  createPaymentReleasedAction,
  deletePaymentReleasedAction,
  getPaymentReleasedDetailData,
  getPaymentsReleasedPageData,
  updatePaymentReleasedAction,
  updatePaymentReleasedStatusAction,
} from '~/lib/payments-released.functions'

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

// ── Printable Payment Release / Refund Voucher ─────────────────────────────
function printPaymentReleaseVoucher(
  payment: PaymentReleasedDetail | PaymentReleasedListItem,
  showFeedback?: (t: 'success' | 'error', m: string) => void,
) {
  const w = window.open('', '_blank')
  if (!w) {
    showFeedback?.('error', 'Pop-up blocked — please allow pop-ups to print payment voucher.')
    return
  }

  const words = payment.amountPaise ? amountInWordsINR(payment.amountPaise) : 'Rupees Zero Only'
  const netWords = payment.netAmountPaise ? amountInWordsINR(payment.netAmountPaise) : 'Rupees Zero Only'

  w.document.write(`<!DOCTYPE html><html><head><title>Payment Disbursement Voucher - ${payment.paymentNumber}</title><style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: Inter, Arial, sans-serif; font-size: 11px; color: #111; line-height: 1.4; margin: 0; }
    .header-box { border: 2px solid #86288F; padding: 14px; border-radius: 6px; margin-bottom: 14px; }
    .title { font-size: 18px; font-weight: 800; color: #86288F; margin: 0 0 4px; }
    .subtitle { font-size: 11px; color: #555; margin: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f8f9fa; border: 1px solid #ddd; padding: 7px 10px; font-size: 10px; text-transform: uppercase; text-align: left; }
    td { border: 1px solid #ddd; padding: 8px 10px; font-size: 11px; }
    .summary-card { background: #fafafa; border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-top: 14px; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 50px; }
    .sig-line { border-top: 1px solid #000; padding-top: 6px; font-size: 10px; color: #444; }
  </style></head><body onload="window.print();window.onafterprint=()=>window.close()">
    <div class="header-box">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="title">Accent Techno Solutions Private Limited</div>
          <div class="subtitle">Engineering & Advisory Consultancy Services · GSTIN: 27AAPCA3963L1Z2 · PAN: AAPCA3963L</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px;font-weight:800;color:#86288F;">CLIENT PAYMENT DISBURSEMENT VOUCHER</div>
          <div style="font-size:11px;font-weight:700;">${payment.paymentNumber}</div>
          <div style="font-size:10px;color:#666;">Date: ${formatDate(payment.releaseDate)}</div>
        </div>
      </div>
    </div>

    <table>
      <tr>
        <td style="width:50%;vertical-align:top;">
          <div style="font-size:10px;text-transform:uppercase;color:#666;font-weight:700;margin-bottom:4px;">Disbursed / Released To (Client Beneficiary):</div>
          <div style="font-size:13px;font-weight:700;">${payment.companyName}</div>
          ${payment.clientBankName ? `<div><b>Beneficiary Bank:</b> ${payment.clientBankName}</div>` : ''}
          ${payment.clientAccountNumber ? `<div><b>Account Number:</b> ${payment.clientAccountNumber}</div>` : ''}
          ${payment.clientIfscCode ? `<div><b>IFSC Code:</b> ${payment.clientIfscCode}</div>` : ''}
          ${payment.projectName ? `<div style="font-size:10.5px;color:#444;margin-top:2px;"><b>Project:</b> ${payment.projectName}</div>` : ''}
          ${payment.invoiceNumber ? `<div style="font-size:10.5px;color:#444;"><b>Against Invoice:</b> ${payment.invoiceNumber}</div>` : ''}
        </td>
        <td style="width:50%;vertical-align:top;">
          <div style="font-size:10px;text-transform:uppercase;color:#666;font-weight:700;margin-bottom:4px;">Disbursement Details:</div>
          <div><b>Release Category:</b> ${PAYMENT_RELEASE_TYPE_LABELS[payment.releaseType]}</div>
          <div><b>Payment Mode:</b> ${PAYMENT_MODE_LABELS[payment.paymentMode]}</div>
          <div><b>Disbursing Bank Account:</b> ${payment.disbursingBankName || 'Accent Operating Bank Account'}</div>
          <div><b>UTR / Cheque Ref:</b> ${payment.transactionReference || '—'}</div>
          <div><b>Status:</b> ${PAYMENT_RELEASE_STATUS_LABELS[payment.status]}</div>
          ${payment.approvedAt ? `<div><b>Approved On:</b> ${formatDate(payment.approvedAt)}</div>` : ''}
        </td>
      </tr>
    </table>

    <table style="margin-top:14px;">
      <thead>
        <tr>
          <th>Description & Justification</th>
          <th style="text-align:right;width:140px;">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <b>${PAYMENT_RELEASE_TYPE_LABELS[payment.releaseType]}</b>
            ${payment.reason ? `<div style="font-size:10.5px;color:#555;margin-top:2px;">${payment.reason}</div>` : ''}
          </td>
          <td style="text-align:right;font-weight:700;">${formatPaise(payment.amountPaise)}</td>
        </tr>
        ${payment.deductionPaise > 0 ? `<tr>
          <td>Less: Administrative Adjustments / Processing Deductions</td>
          <td style="text-align:right;color:#b91c1c;">-${formatPaise(payment.deductionPaise)}</td>
        </tr>` : ''}
        <tr style="background:#f3f4f6;font-size:12px;">
          <td><b>Net Disbursed / Transferred Amount</b></td>
          <td style="text-align:right;font-weight:800;color:#15803d;">${formatPaise(payment.netAmountPaise)}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary-card">
      <div style="font-size:10px;color:#555;"><b>Gross Amount in Words:</b> ${words}</div>
      <div style="font-size:10px;color:#555;margin-top:4px;"><b>Net Transferred in Words:</b> ${netWords}</div>
      ${payment.notes ? `<div style="font-size:10px;color:#666;margin-top:6px;"><b>Notes:</b> ${payment.notes}</div>` : ''}
    </div>

    <div class="sig-grid">
      <div>
        <div class="sig-line">Prepared By (Finance)</div>
      </div>
      <div>
        <div class="sig-line">Checked & Verified (Accounts)</div>
      </div>
      <div>
        <div class="sig-line">Approved (Authorized Signatory)</div>
      </div>
    </div>
  </body></html>`)
  w.document.close()
}

export default function PaymentsReleasedPage({ initialData }: { initialData: PaymentsReleasedPagePayload }) {
  const [data, setData] = useState<PaymentsReleasedPagePayload>(initialData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PaymentReleaseStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<PaymentReleaseType | 'all'>('all')
  const [modeFilter, setModeFilter] = useState<PaymentMode | 'all'>('all')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Drawer preview state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<PaymentReleasedDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<PaymentReleasedListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PaymentReleasedListItem | null>(null)

  const stats = useMemo(() => computePaymentsReleasedStats(data.payments), [data.payments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.payments.filter((p) => {
      const matchesSearch =
        !q ||
        p.paymentNumber.toLowerCase().includes(q) ||
        p.companyName.toLowerCase().includes(q) ||
        (p.projectName ?? '').toLowerCase().includes(q) ||
        (p.reason ?? '').toLowerCase().includes(q) ||
        (p.transactionReference ?? '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      const matchesType = typeFilter === 'all' || p.releaseType === typeFilter
      const matchesMode = modeFilter === 'all' || p.paymentMode === modeFilter
      return matchesSearch && matchesStatus && matchesType && matchesMode
    })
  }, [data.payments, search, statusFilter, typeFilter, modeFilter])

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function reload() {
    try {
      const next = await getPaymentsReleasedPageData()
      setData(next)
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to reload payments data.')
    }
  }

  async function openDetail(id: string) {
    setSelectedId(id)
    setLoadingDetail(true)
    try {
      const res = await getPaymentReleasedDetailData({ data: { id } })
      setDetailData(res.payment)
    } catch (e) {
      showFeedback('error', 'Failed to load disbursement details.')
      setSelectedId(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  function closeDetail() {
    setSelectedId(null)
    setDetailData(null)
  }

  async function handleApprove(id: string) {
    try {
      const res = await approvePaymentReleasedAction({ data: { id } })
      if (res.ok) {
        showFeedback('success', 'Disbursement successfully approved')
        await reload()
        if (selectedId === id && detailData) {
          setDetailData({ ...detailData, status: 'approved' })
        }
      } else {
        showFeedback('error', res.message || 'Failed to approve disbursement')
      }
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Error approving disbursement')
    }
  }

  async function handleStatusChange(id: string, status: PaymentReleaseStatus) {
    try {
      const res = await updatePaymentReleasedStatusAction({ data: { id, status } })
      if (res.ok) {
        showFeedback('success', `Status updated to ${PAYMENT_RELEASE_STATUS_LABELS[status]}`)
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
      const res = await deletePaymentReleasedAction({ data: { id: deleteTarget.id } })
      if (res.ok) {
        showFeedback('success', `Payment release ${deleteTarget.paymentNumber} deleted`)
        setDeleteTarget(null)
        if (selectedId === deleteTarget.id) closeDetail()
        await reload()
      } else {
        showFeedback('error', res.message || 'Failed to delete payment release')
      }
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to delete payment release')
    }
  }

  function exportCSV() {
    const headers = ['Voucher No', 'Date', 'Client', 'Project', 'Release Category', 'Mode', 'Ref No', 'Gross (INR)', 'Deductions (INR)', 'Net Released (INR)', 'Status']
    const rows = filtered.map((r) => [
      r.paymentNumber,
      r.releaseDate,
      `"${r.companyName.replace(/"/g, '""')}"`,
      `"${(r.projectName ?? '').replace(/"/g, '""')}"`,
      PAYMENT_RELEASE_TYPE_LABELS[r.releaseType],
      PAYMENT_MODE_LABELS[r.paymentMode],
      r.transactionReference ?? '',
      (r.amountPaise / 100).toFixed(2),
      (r.deductionPaise / 100).toFixed(2),
      (r.netAmountPaise / 100).toFixed(2),
      PAYMENT_RELEASE_STATUS_LABELS[r.status],
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `payments_released_${new Date().toISOString().slice(0, 10)}.csv`)
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
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Payments Released to Client</h2>
            <span className="badge badge-warning" style={{ fontSize: 10.5 }}>
              Refunds & Disbursements
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Manage client advance refunds, security deposit / EMD returns, retention releases, and credit settlements
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
              New Disbursement / Refund
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
                  Total Released
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-primary)', marginTop: 4 }}>
                  {formatINRCompact(stats.totalReleasedPaise)}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{stats.totalCount} disbursements recorded</div>
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
                <ArrowUpRight size={16} />
              </div>
            </div>
          </div>

          <div className="kpi-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Cleared / Disbursed
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success, #16a34a)', marginTop: 4 }}>
                  {formatINRCompact(stats.clearedPaise)}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{stats.clearedCount} settled with clients</div>
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
                  Pending Approval
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning, #d97706)', marginTop: 4 }}>
                  {formatINRCompact(stats.pendingApprovalPaise)}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{stats.pendingCount} awaiting approval</div>
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
                  Approved for Transfer
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-steel, #0070BA)', marginTop: 4 }}>
                  {formatINRCompact(stats.approvedPaise)}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Ready for bank release</div>
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
                <ShieldCheck size={16} />
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
                placeholder="Search voucher, client, reason, UTR…"
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
              {PAYMENT_RELEASE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {PAYMENT_RELEASE_STATUS_LABELS[st]}
                </option>
              ))}
            </select>

            {/* Release Type Filter */}
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
              <option value="all">All Release Categories</option>
              {PAYMENT_RELEASE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PAYMENT_RELEASE_TYPE_LABELS[t]}
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
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Showing <b>{filtered.length}</b> of <b>{data.payments.length}</b> disbursements
          </div>
        </div>

        {/* Data Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Voucher No.</th>
                  <th>Date & Mode</th>
                  <th>Client / Customer</th>
                  <th>Release Category</th>
                  <th>Beneficiary Bank</th>
                  <th style={{ textAlign: 'right' }}>Gross Amount</th>
                  <th style={{ textAlign: 'right' }}>Deduction</th>
                  <th style={{ textAlign: 'right' }}>Net Transferred</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <Wallet size={28} style={{ opacity: 0.3 }} />
                        <div style={{ fontSize: 13, fontWeight: 600 }}>No payment releases found</div>
                        <div style={{ fontSize: 11.5 }}>
                          {search || statusFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Click "New Disbursement / Refund" to create a release.'}
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
                            {p.paymentNumber}
                          </span>
                        </div>
                        {p.reason && (
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                            {p.reason}
                          </div>
                        )}
                      </td>

                      <td>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{formatDate(p.releaseDate)}</div>
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
                        <span className="badge badge-cyan" style={{ fontSize: 10.5 }}>
                          {PAYMENT_RELEASE_TYPE_LABELS[p.releaseType]}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{p.clientBankName || 'Client Bank'}</div>
                        {p.clientAccountNumber && (
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            •••• {p.clientAccountNumber.slice(-4)}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600 }}>
                        {formatPaise(p.amountPaise)}
                      </td>

                      <td style={{ textAlign: 'right', fontSize: 12, color: p.deductionPaise > 0 ? 'var(--danger, #dc2626)' : 'var(--text-muted)' }}>
                        {p.deductionPaise > 0 ? `-${formatPaise(p.deductionPaise)}` : '—'}
                      </td>

                      <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: 'var(--success, #16a34a)' }}>
                        {formatPaise(p.netAmountPaise)}
                      </td>

                      <td>
                        <span className={`badge ${PAYMENT_RELEASE_STATUS_BADGES[p.status]}`} style={{ fontSize: 11 }}>
                          {PAYMENT_RELEASE_STATUS_LABELS[p.status]}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            title="Print Voucher"
                            onClick={() => printPaymentReleaseVoucher(p, showFeedback)}
                            style={{ padding: 4 }}
                          >
                            <Printer size={14} />
                          </button>
                          {data.canWrite && (
                            <>
                              <button
                                type="button"
                                className="btn-ghost"
                                title="Edit"
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
                                title="Delete"
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
                  {detailData?.paymentNumber || 'Disbursement Details'}
                </h3>
                {detailData && (
                  <span className={`badge ${PAYMENT_RELEASE_STATUS_BADGES[detailData.status]}`} style={{ fontSize: 10.5 }}>
                    {PAYMENT_RELEASE_STATUS_LABELS[detailData.status]}
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
                {detailData ? `${detailData.companyName} · ${formatDate(detailData.releaseDate)}` : 'Loading…'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {detailData && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => printPaymentReleaseVoucher(detailData, showFeedback)}
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
                    Disbursement Summary
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gross Release</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-primary)' }}>
                        {formatPaise(detailData.amountPaise)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net Transferred</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success, #16a34a)' }}>
                        {formatPaise(detailData.netAmountPaise)}
                      </div>
                    </div>
                  </div>

                  {detailData.deductionPaise > 0 && (
                    <div style={{ borderTop: '1px dashed var(--border)', marginTop: 12, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Administrative Deductions:</span>
                      <span style={{ fontWeight: 600, color: 'var(--danger, #dc2626)' }}>
                        -{formatPaise(detailData.deductionPaise)}
                      </span>
                    </div>
                  )}

                  <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 10.5, color: 'var(--text-secondary)' }}>
                    <b>Amount in Words:</b> {amountInWordsINR(detailData.netAmountPaise)}
                  </div>
                </div>

                {/* Maker-Checker Approval Action */}
                {detailData.status === 'pending_approval' && data.canWrite && (
                  <div className="card" style={{ padding: 14, background: 'var(--surface-elevated)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Approval Required</div>
                    <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Authorize this client refund or deposit release for bank transfer execution.
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleApprove(detailData.id)}
                      style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <ShieldCheck size={15} />
                      Approve Disbursement
                    </button>
                  </div>
                )}

                {/* Quick Status Bar */}
                {data.canWrite && (
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                      Update Status
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {PAYMENT_RELEASE_STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={detailData.status === st}
                          onClick={() => handleStatusChange(detailData.id, st)}
                          className={detailData.status === st ? 'btn-primary' : 'btn-secondary'}
                          style={{ fontSize: 11, padding: '4px 10px' }}
                        >
                          {PAYMENT_RELEASE_STATUS_LABELS[st]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Core Attributes */}
                <div className="card" style={{ padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>Disbursement Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Release Category</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{PAYMENT_RELEASE_TYPE_LABELS[detailData.releaseType]}</div>
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
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Release Date</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{formatDate(detailData.releaseDate)}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Disbursing Account (Accent)</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{detailData.disbursingBankName || 'Accent Operating Bank Account'}</div>
                    </div>
                  </div>
                </div>

                {/* Beneficiary Bank Account Card */}
                <div className="card" style={{ padding: 16 }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Landmark size={14} />
                    Client Beneficiary Bank Account
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Beneficiary Client</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{detailData.companyName}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Bank Name</div>
                      <div style={{ fontWeight: 600, marginTop: 2 }}>{detailData.clientBankName || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Account Number</div>
                      <div style={{ fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>
                        {detailData.clientAccountNumber || '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>IFSC Code</div>
                      <div style={{ fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>
                        {detailData.clientIfscCode || '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason & Remarks */}
                {detailData.reason && (
                  <div className="card" style={{ padding: 14 }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 700 }}>Release Reason / Justification</h4>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{detailData.reason}</p>
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
        <PaymentReleasedModal
          initial={editingPayment}
          options={data.options}
          onClose={() => {
            setModalOpen(false)
            setEditingPayment(null)
          }}
          onSaved={async () => {
            setModalOpen(false)
            setEditingPayment(null)
            showFeedback('success', editingPayment ? 'Payment release updated' : 'Payment release created successfully')
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
              Delete Payment Release?
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Are you sure you want to delete payment release <b>{deleteTarget.paymentNumber}</b> to <b>{deleteTarget.companyName}</b>?
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

// ── Record / Edit Payment Released Modal Component ─────────────────────────
function PaymentReleasedModal({
  initial,
  options,
  onClose,
  onSaved,
  showFeedback,
}: {
  initial: PaymentReleasedListItem | null
  options: PaymentReleasedFormOptions
  onClose: () => void
  onSaved: () => void
  showFeedback: (t: 'success' | 'error', m: string) => void
}) {
  const isEdit = !!initial
  const [submitting, setSubmitting] = useState(false)

  const [companyId, setCompanyId] = useState(initial?.companyId ?? '')
  const [companyName, setCompanyName] = useState(initial?.companyName ?? '')
  const [projectId, setProjectId] = useState(initial?.projectId ?? '')
  const [saleInvoiceId, setSaleInvoiceId] = useState(initial?.saleInvoiceId ?? '')
  const [disbursingBankId, setDisbursingBankId] = useState(initial?.disbursingBankId ?? options.banks.find((b) => b.isPrimary)?.id ?? '')
  const [clientBankName, setClientBankName] = useState(initial?.clientBankName ?? '')
  const [clientAccountNumber, setClientAccountNumber] = useState(initial?.clientAccountNumber ?? '')
  const [clientIfscCode, setClientIfscCode] = useState(initial?.clientIfscCode ?? '')
  const [releaseDate, setReleaseDate] = useState(initial?.releaseDate ?? new Date().toISOString().slice(0, 10))
  const [releaseType, setReleaseType] = useState<PaymentReleaseType>(initial?.releaseType ?? 'advance_refund')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(initial?.paymentMode ?? 'neft')
  const [transactionReference, setTransactionReference] = useState(initial?.transactionReference ?? '')
  const [amountRupees, setAmountRupees] = useState(initial ? (initial.amountPaise / 100).toString() : '')
  const [deductionRupees, setDeductionRupees] = useState(initial ? (initial.deductionPaise / 100).toString() : '0')
  const [status, setStatus] = useState<PaymentReleaseStatus>(initial?.status ?? 'pending_approval')
  const [reason, setReason] = useState(initial?.reason ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  function handleCompanySelect(id: string) {
    setCompanyId(id)
    const match = options.companies.find((c) => c.id === id)
    if (match) setCompanyName(match.name)
  }

  const grossPaise = Math.round((Number.parseFloat(amountRupees) || 0) * 100)
  const deductionPaise = Math.round((Number.parseFloat(deductionRupees) || 0) * 100)
  const netPaise = computePaymentReleasedNet(grossPaise, deductionPaise)

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
        const res = await updatePaymentReleasedAction({
          data: {
            id: initial.id,
            companyId: companyId || null,
            companyName,
            projectId: projectId || null,
            saleInvoiceId: saleInvoiceId || null,
            disbursingBankId: disbursingBankId || null,
            clientBankName: clientBankName || null,
            clientAccountNumber: clientAccountNumber || null,
            clientIfscCode: clientIfscCode || null,
            releaseDate,
            releaseType,
            paymentMode,
            transactionReference: transactionReference || null,
            amountPaise: grossPaise,
            deductionPaise,
            status,
            reason: reason || null,
            notes: notes || null,
          },
        })
        if (res.ok) onSaved()
        else showFeedback('error', res.message || 'Failed to update payment release')
      } else {
        const res = await createPaymentReleasedAction({
          data: {
            companyId: companyId || null,
            companyName,
            projectId: projectId || null,
            saleInvoiceId: saleInvoiceId || null,
            disbursingBankId: disbursingBankId || null,
            clientBankName: clientBankName || null,
            clientAccountNumber: clientAccountNumber || null,
            clientIfscCode: clientIfscCode || null,
            releaseDate,
            releaseType,
            paymentMode,
            transactionReference: transactionReference || null,
            amountPaise: grossPaise,
            deductionPaise,
            status,
            reason: reason || null,
            notes: notes || null,
          },
        })
        if (res.ok) onSaved()
        else showFeedback('error', res.message || 'Failed to create payment release')
      }
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Error saving payment release')
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
              {isEdit ? `Edit Disbursement (${initial.paymentNumber})` : 'New Client Disbursement / Refund'}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
              Release advance refunds, security deposit returns, or retention settlements
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
                placeholder="e.g. Larsen & Toubro"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                Release Category *
              </label>
              <select value={releaseType} onChange={(e) => setReleaseType(e.target.value as any)} style={inputStyle}>
                {PAYMENT_RELEASE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PAYMENT_RELEASE_TYPE_LABELS[t]}
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
                {options.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Beneficiary Bank Account */}
          <div className="card" style={{ padding: 12, background: 'var(--hover-bg)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
              Client Beneficiary Bank Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Beneficiary Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank"
                  value={clientBankName}
                  onChange={(e) => setClientBankName(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. 50100234567890"
                  value={clientAccountNumber}
                  onChange={(e) => setClientAccountNumber(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>IFSC Code</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC0001234"
                  value={clientIfscCode}
                  onChange={(e) => setClientIfscCode(e.target.value.toUpperCase())}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Payment Method & Disbursing Bank */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Release Date *</label>
              <input type="date" required value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} style={inputStyle} />
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

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                UTR / Reference No.
              </label>
              <input
                type="text"
                placeholder="e.g. UTR998877"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                Disbursing Bank Account (Accent)
              </label>
              <select value={disbursingBankId} onChange={(e) => setDisbursingBankId(e.target.value)} style={inputStyle}>
                {options.banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - {b.accountNumber} ({b.ifscCode}) {b.isPrimary ? '★ Primary' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amounts Breakdown */}
          <div className="card" style={{ padding: 14, background: 'var(--surface-elevated, var(--surface))' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>
              Disbursement Amounts (INR)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  Gross Release Amount (₹) *
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
                  Deductions / Admin Adjustments (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={deductionRupees}
                  onChange={(e) => setDeductionRupees(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net Transferred to Client:</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success, #16a34a)' }}>
                  {formatPaise(netPaise)}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 280, textAlign: 'right' }}>
                {grossPaise > 0 ? amountInWordsINR(grossPaise) : '—'}
              </div>
            </div>
          </div>

          {/* Reason & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Disbursement Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={inputStyle}>
                {PAYMENT_RELEASE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {PAYMENT_RELEASE_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Reason / Justification *</label>
              <input
                type="text"
                required
                placeholder="e.g. Return of Earnest Money Deposit on project completion"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Internal Remarks / Notes</label>
            <input
              type="text"
              placeholder="e.g. Approved by management memo ref #2026/08"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Disbursement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
