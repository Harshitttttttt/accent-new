import { amountInWordsINR, formatPaise } from '~/lib/money'
import {
  computeQuotationTotals,
  htmlToPlainText,
  QUOTATION_GST_RATE_PCT,
  QUOTATION_STATUS_BADGES,
  QUOTATION_STATUS_LABELS,
  type QuotationDocumentPayload,
} from '~/lib/quotations'
import type { ProposalDetail } from '~/lib/proposals'

export type QuotationPDFProps = {
  quotation: ProposalDetail
  /** Override validity text (e.g. formatted `validUntil`); falls back to `quotation.validityDays` math. */
  validUntil?: string | null
  /** Optional company header override — e.g. loaded from `companiesTable` — falls back to the static Accent letterhead. */
  displayCompany?: { name: string; address?: string | null; gstin?: string | null }
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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

/**
 * Professional quotation print surface — extracted from `src/crm/pages/QuotationDocument.tsx`
 * into a standalone presentational component so that:
 * - the print route composes it (no visual regression)
 * - a future `@react-pdf/renderer` or `jspdf` wrapper can reuse the same sections
 * - it is unit-testable against paise money helpers in isolation.
 *
 * All INR strings go through `formatPaise` / `amountInWordsINR` (paise-integer canonical).
 * GST is not recomputed here — callers pass `totals` from `computeQuotationTotals`.
 *
 * Visual template: Anvil HTML Invoice (brand rule + meta grid + tabular lines + totals rail)
 * — see `.hermes/plans/quotation-redesign.md` for the stolen references.
 */
export function QuotationPDF({ quotation, validUntil: validUntilProp, displayCompany }: QuotationPDFProps) {
  const totals = computeQuotationTotals({ lines: quotation.quotationLines, valuePaise: quotation.valuePaise })
  const computedValidUntil =
    validUntilProp !== undefined
      ? validUntilProp
      : quotation.validityDays
        ? formatDate(
            new Date(new Date(quotation.createdAt).getTime() + quotation.validityDays * 86_400_000).toISOString(),
          )
        : null
  const hasLines = quotation.quotationLines.length > 0

  const letterheadName = displayCompany?.name ?? 'Accent Techno Solutions Pvt Ltd'
  const letterheadAddress = displayCompany?.address ?? null
  const letterheadGstin = displayCompany?.gstin ?? null

  return (
    <>
      {/* Print-only resets — colocated so the component is self-contained on any route. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 12mm 16mm 12mm; }
          .quotation-pdf-shell { max-width: none !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { break-inside: avoid; }
        }
      `}</style>

      <article
        aria-label={`Quotation ${quotation.proposalNumber}`}
        className="quotation-pdf-shell"
        style={{
          maxWidth: 860,
          margin: '24px auto 48px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '40px 48px',
        }}
      >
        {/* ── Letterhead ── */}
        <header style={{ borderBottom: '2px solid var(--brand-primary)', paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--brand-primary)' }}>
                {letterheadName}
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Engineering Consultants</p>
              {letterheadAddress ? (
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-secondary)', maxWidth: 360 }}>
                  {letterheadAddress}
                </p>
              ) : null}
              {letterheadGstin ? (
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>GSTIN: {letterheadGstin}</p>
              ) : null}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 1 }}>QUOTATION</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {quotation.proposalNumber}
              </div>
            </div>
          </div>
        </header>

        {/* ── Meta + client ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
            marginBottom: 24,
          }}
        >
          <section aria-label="Quotation details">
            <h2 style={sectionTitleStyle}>Quotation details</h2>
            <dl style={metaListStyle}>
              <div style={metaRowStyle}>
                <dt style={metaLabelStyle}>Date</dt>
                <dd style={metaValueStyle}>{formatDate(quotation.createdAt)}</dd>
              </div>
              <div style={metaRowStyle}>
                <dt style={metaLabelStyle}>Valid until</dt>
                <dd style={metaValueStyle}>{computedValidUntil ?? '—'}</dd>
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
            {quotation.contactName ? (
              <p style={{ margin: '2px 0 0', fontSize: 12.5 }}>
                Kind attn: {quotation.contactName}
                {quotation.designation ? `, ${quotation.designation}` : ''}
              </p>
            ) : null}
            {(quotation.city || quotation.siteLocation) && (
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {[quotation.siteLocation, quotation.city].filter(Boolean).join(', ')}
              </p>
            )}
            {quotation.contactEmail ? (
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>{quotation.contactEmail}</p>
            ) : null}
          </section>
        </div>

        {/* ── Subject & scope ── */}
        <section style={{ marginBottom: 24 }} aria-label="Subject and scope of work">
          <h2 style={sectionTitleStyle}>Subject</h2>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>{quotation.title}</p>
          {quotation.scopeOfWork ? (
            <>
              <h2 style={sectionTitleStyle}>Scope of work</h2>
              <p style={{ margin: 0, fontSize: 12.5, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                {htmlToPlainText(quotation.scopeOfWork)}
              </p>
            </>
          ) : null}
        </section>

        {/* ── Line items ── */}
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
                <td style={lineCellStyle(false)}>Quoted as a lump sum — itemized lines are being prepared.</td>
                <td style={lineCellStyle(true)}>1</td>
                <td style={lineCellStyle(true)}>{formatPaise(quotation.valuePaise ?? 0)}</td>
                <td style={{ ...lineCellStyle(true), fontWeight: 700 }}>{formatPaise(quotation.valuePaise ?? 0)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ── Totals rail ── */}
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
              <dd style={{ ...totalValueStyle, fontVariantNumeric: 'tabular-nums' }}>{formatPaise(totals.gstPaise)}</dd>
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

        {/* ── Amount in words ── */}
        <p style={{ margin: '0 0 28px', fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
          {amountInWordsINR(totals.totalPaise)}
        </p>

        {/* ── Terms ── */}
        {quotation.paymentTerms ? (
          <section style={{ marginBottom: 20 }} aria-label="Payment terms">
            <h2 style={sectionTitleStyle}>Payment terms</h2>
            <p style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
              {quotation.paymentTerms}
            </p>
          </section>
        ) : null}
        {quotation.otherTerms ? (
          <section aria-label="Other terms and conditions">
            <h2 style={sectionTitleStyle}>Other terms &amp; conditions</h2>
            <p style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
              {quotation.otherTerms}
            </p>
          </section>
        ) : null}

        {/* ── Footer — print and screen ── */}
        <footer
          style={{
            marginTop: 28,
            paddingTop: 12,
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 10.5,
            color: 'var(--text-muted)',
          }}
        >
          <p style={{ margin: 0 }}>
            Quoted prices are valid until {computedValidUntil ?? 'the date shown above'} · GST {QUOTATION_GST_RATE_PCT}%
            extra as applicable · This is a computer-generated document.
          </p>
          <p style={{ margin: '4px 0 0' }}>Accent Techno Solutions Pvt Ltd · Engineering Consultants</p>
        </footer>
      </article>
    </>
  )
}

/**
 * Page-level wrapper kept for backwards-compat with `src/crm/pages/QuotationDocument.tsx`'s
 * previous inline rendering — now delegates to `QuotationPDF`. Exported so tests can
 * import the isolated presentational component without the page's auth/empty branching.
 */
export function QuotationDocumentPageLegacyBridge({ initialData }: { initialData: QuotationDocumentPayload }) {
  // This bridge is intentionally not used at runtime; it documents the old render path.
  void initialData
  return null
}
