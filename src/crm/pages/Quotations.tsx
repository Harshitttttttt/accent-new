import { useMemo, useState } from 'react'
import { Eye, FileText, Pencil, Search, X } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import {
  computeQuotationStats,
  QUOTATION_STATUS_BADGES,
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUSES,
  type QuotationListItem,
  type QuotationStatus,
  type QuotationsPagePayload,
} from '~/lib/quotations'
import { formatINRCompact, formatPaise } from '~/lib/money'

const STATUS_TILE_COLORS: Record<QuotationStatus, string> = {
  draft: 'var(--text-muted)',
  internal_review: 'var(--info)',
  sent: 'var(--brand-steel)',
  negotiation: 'var(--warning)',
  accepted: 'var(--success)',
  rejected: 'var(--danger)',
  cancelled: 'var(--border)',
}

/** Tiles mirror the old Quotation page's Total/Draft/Sent/Approved/Rejected strip. */
const TILE_STATUSES = ['draft', 'sent', 'accepted', 'rejected'] as const

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function QuotationsPage({ initialData }: { initialData: QuotationsPagePayload }) {
  const navigate = useNavigate()
  const [data] = useState<QuotationsPagePayload>(initialData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | 'all'>('all')

  const stats = useMemo(() => computeQuotationStats(data.quotations), [data.quotations])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.quotations.filter((quote) => {
      const matchesSearch =
        !q ||
        quote.proposalNumber.toLowerCase().includes(q) ||
        quote.title.toLowerCase().includes(q) ||
        quote.companyName.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || quote.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [data.quotations, search, statusFilter])

  // ── Unauthorized state ─────────────────────────────────────────────────
  if (!data.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <FileText size={28} style={{ color: 'var(--warning)', margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            You need the <strong>proposals.read</strong> permission to view quotations. Ask an
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
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Quotations</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {stats.totalCount} quotations · {formatINRCompact(stats.openValuePaise, { fromPaise: true })} open ·{' '}
            {formatINRCompact(stats.acceptedValuePaise, { fromPaise: true })} accepted
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
              placeholder="Search quotations..."
              aria-label="Search quotations by number, title, or client"
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
              onChange={(e) => setStatusFilter(e.target.value as QuotationStatus | 'all')}
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
              {QUOTATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {QUOTATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

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
            {stats.totalCount === 0 ? '—' : formatINRCompact(stats.openValuePaise + stats.acceptedValuePaise, { fromPaise: true })}
          </div>
        </button>
        {TILE_STATUSES.map((status) => {
          const count =
            status === 'draft'
              ? stats.draftCount
              : status === 'sent'
                ? stats.sentCount
                : status === 'accepted'
                  ? stats.acceptedCount
                  : stats.rejectedCount
          // Per-status value is only tracked for accepted; other tiles show counts.
          const value = status === 'accepted' ? stats.acceptedValuePaise : 0
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
                  {QUOTATION_STATUS_LABELS[status]}
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
              <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700 }}>No quotations found</p>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>
                Every proposal doubles as a quotation — create one from the Proposals pipeline or clear the
                filters above.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)' }}>
                  {['Quote #', 'Client & subject', 'Status', 'Amount', 'Created', 'Actions'].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      style={{
                        textAlign: heading === 'Amount' ? 'right' : 'left',
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
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((quotation) => (
                  <QuotationRow key={quotation.id} quotation={quotation} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function QuotationRow({ quotation }: { quotation: QuotationListItem }) {
  const navigate = useNavigate()

  function goToDocument() {
    void navigate({ to: '/admin/quotations/$quotationId', params: { quotationId: quotation.id } })
  }
  function goToProposal() {
    void navigate({ to: '/proposals/$proposalId', params: { proposalId: quotation.id } })
  }

  return (
    <tr
      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
      onClick={goToDocument}
    >
      <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{quotation.proposalNumber}</td>
      <td style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{quotation.title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{quotation.companyName}</div>
      </td>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        <span className={`badge ${QUOTATION_STATUS_BADGES[quotation.status]}`} style={{ fontSize: 9.5 }}>
          {QUOTATION_STATUS_LABELS[quotation.status]}
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
        {quotation.valuePaise === null ? '—' : formatPaise(quotation.valuePaise, { decimals: 0 })}
      </td>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
        {formatDate(quotation.createdAt)}
      </td>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn-ghost"
            aria-label={`View document for ${quotation.proposalNumber}`}
            title="View document"
            style={{ padding: 6 }}
            onClick={goToDocument}
          >
            <Eye size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn-ghost"
            aria-label={`Edit ${quotation.proposalNumber} in proposals`}
            title="Edit in proposals"
            style={{ padding: 6 }}
            onClick={goToProposal}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  )
}
