import { useMemo } from 'react'
import { ArrowLeft, Printer, SquarePen } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  computeQuotationTotals,
  htmlToPlainText,
  QUOTATION_GST_RATE_PCT,
  QUOTATION_STATUS_BADGES,
  QUOTATION_STATUS_LABELS,
  type QuotationDocumentPayload,
} from '~/lib/quotations'
import { amountInWordsINR, formatPaise } from '~/lib/money'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function QuotationDocumentPage({ initialData }: { initialData: QuotationDocumentPayload }) {
  const navigate = useNavigate()
  const quotation = initialData.quotation

  const totals = useMemo(() => {
    if (!quotation) return null
    return computeQuotationTotals({ lines: quotation.quotationLines, valuePaise: quotation.valuePaise })
  }, [quotation])

  // ── Unauthorized state ─────────────────────────────────────────────────
  if (!initialData.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            You need the <strong>proposals.read</strong> permission to view quotation documents.
          </p>
        </div>
      </div>
    )
  }

  // ── Not found state ────────────────────────────────────────────────────
  if (!quotation || !totals) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Quotation not found</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            It may have been deleted or the link is out of date.
          </p>
          <Link to="/admin/quotations" className="btn-primary" style={{ textDecoration: 'none' }}>
            Back to quotations
          </Link>
        </div>
      </div>
    )
  }

  const validUntil = quotation.validityDays
    ? formatDate(new Date(new Date(quotation.createdAt).getTime() + quotation.validityDays * 86_400_000).toISOString())
    : null

  const hasLines = quotation.quotationLines.length > 0

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--surface-secondary)' }}>
      {/* Toolbar — screen only */}
      <div
        className="no-print"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '12px 24px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Link
          to="/admin/quotations"
          className="btn-secondary"
          aria-label="Back to the quotations list"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back
        </Link>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              void navigate({ to: '/proposals/$proposalId', params: { proposalId: quotation.id } })
            }
          >
            <SquarePen size={14} aria-hidden="true" /> Edit in proposals
          </button>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* The document */}
      <article
        aria-label={`Quotation ${quotation.proposalNumber}`}
        style={{
          maxWidth: 860,
          margin: '24px auto 48px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '40px 48px',
        }}
      >
        {/* Letterhead */}
        <header style={{ borderBottom: '2px solid var(--brand-primary)', paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--brand-primary)' }}>
                Accent Techno Solutions Pvt Ltd
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Engineering Consultants
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 1 }}>QUOTATION</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {quotation.proposalNumber}
              </div>
            </div>
          </div>
        </header>

        {/* Meta + client block */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 24 }}>
          <section aria-label="Quotation details">
            <h2 style={sectionTitleStyle}>Quotation details</h2>
            <dl style={metaListStyle}>
              <div style={metaRowStyle}>
                <dt style={metaLabelStyle}>Date</dt>
                <dd style={metaValueStyle}>{formatDate(quotation.createdAt)}</dd>
              </div>
              <div style={metaRowStyle}>
                <dt style={metaLabelStyle}>Valid until</dt>
                <dd style={metaValueStyle}>{validUntil ?? '—'}</dd>
              </div>
              <div style={metaRowStyle}>
                <dt style={metaLabelStyle}>Status</dt>
                <dd style={metaValueStyle}>
                  <span className={`badge ${QUOTATION_STATUS_BADGES[quotation.status]}`} style={{ fontSize: 9.5 }}>
                    {QUOTATION_STATUS_LABELS[quotation.status]}
                  </span>
                </dd>
              </div>
            </dl>
          </section>
          <section aria-label="Client details">
            <h2 style={sectionTitleStyle}>Prepared for</h2>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{quotation.companyName}</p>
            {quotation.contactName && (
              <p style={{ margin: '2px 0 0', fontSize: 12.5 }}>
                Kind attn: {quotation.contactName}
                {quotation.designation ? `, ${quotation.designation}` : ''}
              </p>
            )}
            {(quotation.city || quotation.siteLocation) && (
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {[quotation.siteLocation, quotation.city].filter(Boolean).join(', ')}
              </p>
            )}
            {quotation.contactEmail && (
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {quotation.contactEmail}
              </p>
            )}
          </section>
        </div>

        {/* Subject & scope */}
        <section style={{ marginBottom: 24 }} aria-label="Subject and scope of work">
          <h2 style={sectionTitleStyle}>Subject</h2>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>{quotation.title}</p>
          {quotation.scopeOfWork && (
            <>
              <h2 style={sectionTitleStyle}>Scope of work</h2>
              <p style={{ margin: 0, fontSize: 12.5, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                {htmlToPlainText(quotation.scopeOfWork)}
              </p>
            </>
          )}
        </section>

        {/* Line items */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12.5,
            marginBottom: 16,
          }}
        >
          <caption className="sr-only">Itemized amounts for {quotation.proposalNumber}</caption>
          <thead>
            <tr style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
              {['Sr', 'Description', 'Qty', 'Unit price', 'Amount'].map((heading, i) => (
                <th
                  key={heading}
                  scope="col"
                  style={{
                    textAlign: i >= 2 ? 'right' : 'left',
                    padding: '8px 10px',
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
            {hasLines ? (
              quotation.quotationLines.map((line, index) => (
                <tr key={line.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={lineCellStyle(index >= 2)}>{index + 1}</td>
                  <td style={lineCellStyle(false)}>{line.description}</td>
                  <td style={lineCellStyle(true)}>{line.quantity}</td>
                  <td style={lineCellStyle(true)}>{formatPaise(line.unitPricePaise)}</td>
                  <td style={{ ...lineCellStyle(true), fontWeight: 700 }}>{formatPaise(line.amountPaise)}</td>
                </tr>
              ))
            ) : (
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={lineCellStyle(false)}>—</td>
                <td style={lineCellStyle(false)}>
                  Quoted as a lump sum — itemized lines are being prepared.
                </td>
                <td style={lineCellStyle(true)}>1</td>
                <td style={lineCellStyle(true)}>{formatPaise(quotation.valuePaise ?? 0)}</td>
                <td style={{ ...lineCellStyle(true), fontWeight: 700 }}>{formatPaise(quotation.valuePaise ?? 0)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <dl style={{ minWidth: 280, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <dt style={{ color: 'var(--text-secondary)' }}>Subtotal</dt>
              <dd style={{ ...totalValueStyle, fontVariantNumeric: 'tabular-nums' }}>
                {formatPaise(totals.subtotalPaise)}
              </dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <dt style={{ color: 'var(--text-secondary)' }}>GST @ {QUOTATION_GST_RATE_PCT}%</dt>
              <dd style={{ ...totalValueStyle, fontVariantNumeric: 'tabular-nums' }}>
                {formatPaise(totals.gstPaise)}
              </dd>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0 4px',
                borderTop: '1px solid var(--border)',
                fontSize: 14.5,
              }}
            >
              <dt style={{ fontWeight: 800 }}>Total</dt>
              <dd style={{ ...totalValueStyle, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {formatPaise(totals.totalPaise)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Amount in words */}
        <p style={{ margin: '0 0 28px', fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
          {amountInWordsINR(totals.totalPaise)}
        </p>

        {/* Terms */}
        {quotation.paymentTerms && (
          <section style={{ marginBottom: 20 }} aria-label="Payment terms">
            <h2 style={sectionTitleStyle}>Payment terms</h2>
            <p style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
              {quotation.paymentTerms}
            </p>
          </section>
        )}
        {quotation.otherTerms && (
          <section aria-label="Other terms and conditions">
            <h2 style={sectionTitleStyle}>Other terms &amp; conditions</h2>
            <p style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
              {quotation.otherTerms}
            </p>
          </section>
        )}
      </article>
    </div>
  )
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 6px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: 'var(--text-muted)',
}

const metaListStyle: React.CSSProperties = { margin: 0 }
const metaRowStyle: React.CSSProperties = { display: 'flex', gap: 8, padding: '2px 0' }
const metaLabelStyle: React.CSSProperties = { minWidth: 84, fontSize: 12.5, color: 'var(--text-muted)' }
const metaValueStyle: React.CSSProperties = { margin: 0, fontSize: 12.5, fontWeight: 600 }
const totalValueStyle: React.CSSProperties = { margin: 0 }

function lineCellStyle(alignRight: boolean): React.CSSProperties {
  return {
    padding: '8px 10px',
    verticalAlign: 'top',
    textAlign: alignRight ? 'right' : 'left',
    fontVariantNumeric: 'tabular-nums',
  }
}
