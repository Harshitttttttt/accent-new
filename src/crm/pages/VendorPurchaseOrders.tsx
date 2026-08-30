import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  History,
  Layers,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react'
import { formatINRCompact, formatPaise } from '~/lib/money'
import {
  computeVendorPurchaseOrderStats,
  type VendorPurchaseOrderDetail,
  type VendorPurchaseOrderListItem,
  type VendorPurchaseOrdersPagePayload,
  type VendorPurchaseOrderStatus,
  VENDOR_PURCHASE_ORDER_STATUS_BADGES,
  VENDOR_PURCHASE_ORDER_STATUS_LABELS,
  VENDOR_PURCHASE_ORDER_STATUSES,
} from '~/lib/vendor-purchase-orders'
import {
  deleteVendorPurchaseOrderAction,
  getVendorPurchaseOrderDetailData,
  getVendorPurchaseOrdersPageData,
  updateVendorPurchaseOrderStatusAction,
} from '~/lib/vendor-purchase-orders.functions'

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

export default function VendorPurchaseOrdersPage({ initialData }: { initialData: VendorPurchaseOrdersPagePayload }) {
  const navigate = useNavigate()
  const [data, setData] = useState<VendorPurchaseOrdersPagePayload>(initialData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VendorPurchaseOrderStatus | 'all'>('all')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VendorPurchaseOrderListItem | null>(null)

  // Drawer preview state
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<VendorPurchaseOrderDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const stats = useMemo(() => computeVendorPurchaseOrderStats(data.orders), [data.orders])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.orders.filter((po) => {
      const matchesSearch =
        !q ||
        po.poNumber.toLowerCase().includes(q) ||
        po.vendorName.toLowerCase().includes(q) ||
        (po.subject ?? '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || po.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [data.orders, search, statusFilter])

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  async function reload() {
    try {
      const next = await getVendorPurchaseOrdersPageData()
      setData(next)
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to reload vendor purchase orders.')
    }
  }

  async function openDetail(id: string) {
    setSelectedPoId(id)
    setLoadingDetail(true)
    try {
      const res = await getVendorPurchaseOrderDetailData({ data: { id } })
      setDetailData(res.order)
    } catch (e) {
      showFeedback('error', 'Failed to load vendor purchase order details.')
      setSelectedPoId(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  function closeDetail() {
    setSelectedPoId(null)
    setDetailData(null)
  }

  async function handleStatusChange(id: string, status: VendorPurchaseOrderStatus) {
    try {
      const res = await updateVendorPurchaseOrderStatusAction({ data: { id, status } })
      if (res.ok) {
        showFeedback('success', `Status updated to ${VENDOR_PURCHASE_ORDER_STATUS_LABELS[status]}`)
        await reload()
        if (selectedPoId === id && detailData) {
          setDetailData({ ...detailData, status })
        }
      } else {
        showFeedback('error', res.message)
      }
    } catch (e) {
      showFeedback('error', 'Failed to update status.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      const res = await deleteVendorPurchaseOrderAction({ data: { id: target.id } })
      if (res.ok) {
        showFeedback('success', `${target.poNumber} deleted.`)
        if (selectedPoId === target.id) closeDetail()
        await reload()
      } else {
        showFeedback('error', res.message)
      }
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to delete purchase order.')
    }
  }

  // ── Unauthorized State ───────────────────────────────────────────────────
  if (!data.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <Truck size={32} style={{ color: 'var(--warning)', margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Access Required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            You need <strong>proposals.read</strong> or <strong>finance.read</strong> permissions to view vendor purchase orders.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Vendor Purchase Orders (Outgoing)</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {stats.totalCount} vendor orders · {formatINRCompact(stats.totalValuePaise, { fromPaise: true })} total value ·{' '}
            {formatINRCompact(stats.billedValuePaise, { fromPaise: true })} billed ·{' '}
            {formatINRCompact(stats.balanceValuePaise, { fromPaise: true })} balance
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
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 200 }}
              placeholder="Search by PO #, vendor, subject..."
              aria-label="Search vendor purchase orders"
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
              onChange={(e) => setStatusFilter(e.target.value as VendorPurchaseOrderStatus | 'all')}
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
              {VENDOR_PURCHASE_ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {VENDOR_PURCHASE_ORDER_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </label>

          {data.canWrite && (
            <button
              type="button"
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => void navigate({ to: '/admin/vendor-purchase-orders/new' })}
            >
              <Plus size={14} />
              <span>New Vendor PO</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div
        style={{
          padding: '12px 24px',
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
          onClick={() => setStatusFilter('all')}
          className="card"
          style={{
            padding: '10px 16px',
            minWidth: 140,
            cursor: 'pointer',
            textAlign: 'left',
            border: statusFilter === 'all' ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>All Orders</div>
          <div style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0' }}>{stats.totalCount}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{formatINRCompact(stats.totalValuePaise, { fromPaise: true })}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('pending_approval')}
          className="card"
          style={{
            padding: '10px 16px',
            minWidth: 140,
            cursor: 'pointer',
            textAlign: 'left',
            border: statusFilter === 'pending_approval' ? '2px solid var(--warning, #D97706)' : '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--warning, #D97706)', fontWeight: 600, textTransform: 'uppercase' }}>Pending Approval</div>
          <div style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0' }}>{stats.pendingApprovalCount}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{formatINRCompact(stats.pendingApprovalValuePaise, { fromPaise: true })}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('issued')}
          className="card"
          style={{
            padding: '10px 16px',
            minWidth: 140,
            cursor: 'pointer',
            textAlign: 'left',
            border: statusFilter === 'issued' ? '2px solid var(--brand-primary, #64126D)' : '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--brand-primary, #64126D)', fontWeight: 600, textTransform: 'uppercase' }}>Issued to Vendor</div>
          <div style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0' }}>{stats.issuedCount}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{formatINRCompact(stats.issuedValuePaise, { fromPaise: true })}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('fulfilled')}
          className="card"
          style={{
            padding: '10px 16px',
            minWidth: 140,
            cursor: 'pointer',
            textAlign: 'left',
            border: statusFilter === 'fulfilled' ? '2px solid var(--success, #16A34A)' : '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--success, #16A34A)', fontWeight: 600, textTransform: 'uppercase' }}>Fulfilled</div>
          <div style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0' }}>{stats.fulfilledCount}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{formatINRCompact(stats.fulfilledValuePaise, { fromPaise: true })}</div>
        </button>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          style={{
            padding: '10px 24px',
            background: feedback.type === 'success' ? 'var(--success-surface, #ECFDF5)' : 'var(--danger-surface, #FEF2F2)',
            color: feedback.type === 'success' ? 'var(--success, #16A34A)' : 'var(--danger, #DC2626)',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {filtered.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <Truck size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>No Vendor Purchase Orders Found</h4>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
              {search || statusFilter !== 'all' ? 'Try adjusting your search or status filter.' : 'Create purchase orders to procure materials, software, and subcontractor services.'}
            </p>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>PO Number</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Vendor</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Subject</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>PO Date</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Delivery Date</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Total Value</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Billed</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((po) => (
                  <tr
                    key={po.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: selectedPoId === po.id ? 'var(--surface-secondary)' : 'transparent',
                    }}
                    onClick={() => void openDetail(po.id)}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--brand-primary)' }}>
                      {po.poNumber}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{po.vendorName}</div>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                      {po.subject || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{formatDate(po.poDate)}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{formatDate(po.expectedDeliveryDate)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>
                      {formatPaise(po.totalPaise)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: po.billedAmountPaise > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {formatPaise(po.billedAmountPaise)}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                        Bal: {formatPaise(po.balanceAmountPaise || Math.max(0, po.totalPaise - po.billedAmountPaise))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={po.status}
                        onChange={(e) => void handleStatusChange(po.id, e.target.value as VendorPurchaseOrderStatus)}
                        className={`badge ${VENDOR_PURCHASE_ORDER_STATUS_BADGES[po.status]}`}
                        style={{ border: 'none', outline: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {VENDOR_PURCHASE_ORDER_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {VENDOR_PURCHASE_ORDER_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {data.canWrite && (
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '4px 8px' }}
                            title="Edit purchase order"
                            onClick={() => void navigate({ to: '/admin/vendor-purchase-orders/$poId', params: { poId: po.id } })}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {data.canWrite && (
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '4px 8px', color: 'var(--danger)' }}
                            title="Delete purchase order"
                            onClick={() => setDeleteTarget(po)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Detail Drawer (Twenty CRM style) */}
      {selectedPoId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 540,
            maxWidth: '100vw',
            background: 'var(--surface)',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
            borderLeft: '1px solid var(--border)',
            zIndex: 1000,
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
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-secondary)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{detailData?.poNumber || 'Loading...'}</h3>
                {detailData && (
                  <span className={`badge ${VENDOR_PURCHASE_ORDER_STATUS_BADGES[detailData.status]}`}>
                    {VENDOR_PURCHASE_ORDER_STATUS_LABELS[detailData.status]}
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Vendor: <strong>{detailData?.vendorName}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {data.canWrite && detailData && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: '5px 10px', display: 'flex', gap: 4, alignItems: 'center' }}
                  onClick={() => void navigate({ to: '/admin/vendor-purchase-orders/$poId', params: { poId: detailData.id } })}
                >
                  <Pencil size={13} />
                  <span>Edit</span>
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={closeDetail}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {loadingDetail || !detailData ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading purchase order...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Financial Summary Card */}
                <div className="card" style={{ padding: 16, background: 'var(--surface-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total PO Value</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{formatPaise(detailData.totalPaise)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Billed Progress</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
                        {formatPaise(detailData.billedAmountPaise)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Balance: {formatPaise(detailData.balanceAmountPaise || Math.max(0, detailData.totalPaise - detailData.billedAmountPaise))}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div>Subtotal: <strong>{formatPaise(detailData.subtotalPaise)}</strong></div>
                    <div>Tax ({detailData.taxRateBps / 100}%): <strong>{formatPaise(detailData.taxAmountPaise)}</strong></div>
                    {detailData.discountPaise > 0 && <div>Discount: <strong>-{formatPaise(detailData.discountPaise)}</strong></div>}
                  </div>
                </div>

                {/* Vendor & Entity linkage */}
                <div className="card" style={{ padding: 16 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={14} style={{ color: 'var(--brand-primary)' }} />
                    Vendor Details & Context
                  </h4>
                  <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>Vendor Name: <strong>{detailData.vendorName}</strong></div>
                    {detailData.vendorEmail && <div>Email: {detailData.vendorEmail}</div>}
                    {detailData.vendorPhone && <div>Phone: {detailData.vendorPhone}</div>}
                    {detailData.vendorGstin && <div>GSTIN: {detailData.vendorGstin}</div>}
                    {detailData.vendorAddress && <div style={{ color: 'var(--text-secondary)' }}>Address: {detailData.vendorAddress}</div>}
                    {detailData.quotationNumber && (
                      <div style={{ marginTop: 4 }}>
                        Source Vendor Quotation: <span className="badge badge-neutral">{detailData.quotationNumber}</span>
                      </div>
                    )}
                    {detailData.projectName && (
                      <div>
                        Project: <span className="badge badge-cyan">{detailData.projectName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dates & Schedule */}
                <div className="card" style={{ padding: 16 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} style={{ color: 'var(--brand-primary)' }} />
                    Timeline & Delivery
                  </h4>
                  <div style={{ fontSize: 12.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>PO Date: <strong>{formatDate(detailData.poDate)}</strong></div>
                    <div>Expected Delivery: <strong>{formatDate(detailData.expectedDeliveryDate)}</strong></div>
                    {detailData.modeOfDelivery && <div>Delivery Mode: {detailData.modeOfDelivery}</div>}
                    {detailData.paymentTerms && <div style={{ gridColumn: '1 / -1' }}>Payment Terms: {detailData.paymentTerms}</div>}
                    {detailData.deliveryTerms && <div style={{ gridColumn: '1 / -1' }}>Delivery Terms: {detailData.deliveryTerms}</div>}
                    {detailData.shippingAddress && <div style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)' }}>Shipping Address: {detailData.shippingAddress}</div>}
                  </div>
                </div>

                {/* Line Items */}
                <div className="card" style={{ padding: 16 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={14} style={{ color: 'var(--brand-primary)' }} />
                    Items ({detailData.items.length})
                  </h4>
                  {detailData.items.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No line items recorded.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detailData.items.map((it, idx) => (
                        <div
                          key={it.id || idx}
                          style={{
                            padding: '8px 12px',
                            background: 'var(--surface-secondary)',
                            borderRadius: 6,
                            fontSize: 12,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{it.description}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {it.quantity} {it.unit} @ {formatPaise(it.unitPricePaise)}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700 }}>{formatPaise(it.amountPaise)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Activity History */}
                <div className="card" style={{ padding: 16 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <History size={14} style={{ color: 'var(--brand-primary)' }} />
                    Activity History
                  </h4>
                  {detailData.activities.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No activity logged.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detailData.activities.map((act) => (
                        <div key={act.id} style={{ fontSize: 11.5, borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                          <div style={{ fontWeight: 600 }}>{act.newValue || act.action}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>
                            {act.actorName} · {formatDateTime(act.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="card"
            style={{ padding: 24, maxWidth: 400, width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Delete Vendor Purchase Order?</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
              Are you sure you want to delete <strong>{deleteTarget.poNumber}</strong> ({deleteTarget.vendorName})?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={() => void handleDelete()}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
