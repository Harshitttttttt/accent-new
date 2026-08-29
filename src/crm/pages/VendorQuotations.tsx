import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { formatINRCompact, formatPaise } from '~/lib/money'
import {
  computeVendorQuotationStats,
  VENDOR_QUOTATION_STATUSES,
  VENDOR_QUOTATION_STATUS_BADGES,
  VENDOR_QUOTATION_STATUS_LABELS,
  type VendorQuotationListItem,
  type VendorQuotationsPagePayload,
  type VendorQuotationStatus,
} from '~/lib/vendor-quotations'
import {
  deleteVendorQuotationAction,
  getVendorQuotationsPageData,
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

export default function VendorQuotationsPage({ initialData }: { initialData: VendorQuotationsPagePayload }) {
  const navigate = useNavigate()
  const [data, setData] = useState<VendorQuotationsPagePayload>(initialData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VendorQuotationStatus | 'all'>('all')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VendorQuotationListItem | null>(null)

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
    void navigate({ to: '/admin/vendor-quotations/new' })
  }

  function openEdit(id: string) {
    void navigate({ to: '/admin/vendor-quotations/$quotationId', params: { quotationId: id } })
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
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Vendor Quotations</h2>
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

