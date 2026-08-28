import { amountInWordsINR, formatPaise } from '~/lib/money'
import {
  computeClientQuotationTotals,
  htmlToPlainText,
  CLIENT_QUOTATION_GST_RATE_PCT,
  CLIENT_QUOTATION_STATUS_BADGES,
  CLIENT_QUOTATION_STATUS_LABELS,
  type ClientQuotationDocumentPayload,
} from '~/lib/client-quotations'
import type { ProposalDetail } from '~/lib/proposals'

export type QuotationPDFProps = {
  quotation: ProposalDetail
  validUntil?: string | null
  displayCompany?: { name: string; address?: string | null; gstin?: string | null }
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Old app reference: src/app/admin/quotation/[id]/view/page.jsx — bordered tables with gray-50 headers, 14 annexure rows
// Monochrome print: only #111827 (black), #d1d5db/#e5e7eb/#f9fafb/#6b7280 (greys), #fff (white). Inter font.
export function QuotationPDF({ quotation, validUntil: validUntilProp, displayCompany }: QuotationPDFProps) {
  const totals = computeClientQuotationTotals({ lines: quotation.quotationLines, valuePaise: quotation.valuePaise })
  const computedValidUntil =
    validUntilProp !== undefined
      ? validUntilProp
      : quotation.validityDays
        ? formatDate(new Date(new Date(quotation.createdAt).getTime() + quotation.validityDays * 86_400_000).toISOString())
        : null
  const hasLines = quotation.quotationLines.length > 0
  const letterheadName = displayCompany?.name ?? 'Accent Techno Solutions Pvt Ltd'
  const letterheadAddress = displayCompany?.address ?? null
  const letterheadGstin = displayCompany?.gstin ?? null

  const annexureRows: { no: string; title: string; content: string | string[] }[] = [
    { no: '1', title: 'Scope of Work', content: htmlToPlainText(quotation.scopeOfWork ?? '') || 'As per enquiry and discussion.' },
    { no: '2', title: 'Input Documents', content: quotation.inputDocuments.length ? quotation.inputDocuments : 'As provided by client.' },
    { no: '3', title: 'Deliverables', content: quotation.deliverables.length ? quotation.deliverables : 'Detailed engineering drawings and documents as per scope.' },
    { no: '4', title: 'Software', content: quotation.software.length ? quotation.software.map((s) => s.notes ? `${s.name} — ${s.notes}` : s.name) : 'As per project requirement.' },
    { no: '5', title: 'Duration', content: quotation.plannedStartDate || quotation.plannedEndDate ? `From ${formatDate(quotation.plannedStartDate)} to ${formatDate(quotation.plannedEndDate)}` : 'As mutually agreed.' },
    { no: '6', title: 'Site Visit', content: quotation.siteVisits > 0 ? `${quotation.siteVisits} visit(s)${quotation.siteVisitNotes ? ` — ${quotation.siteVisitNotes}` : ''}` : 'No site visit included.' },
    { no: '7', title: 'Quotation Validity', content: computedValidUntil ? `Valid until ${computedValidUntil}` : `Valid for ${quotation.validityDays ?? 30} days from date of quotation.` },
    { no: '8', title: 'Mode of Delivery', content: quotation.modeOfDelivery ?? 'Offshore at ATS office / as agreed.' },
    { no: '9', title: 'Revisions', content: `${quotation.revisionsIncluded} revision(s) included.` },
    { no: '10', title: 'Exclusions', content: quotation.exclusions.length ? quotation.exclusions : 'Anything not expressly mentioned in scope.' },
    { no: '11', title: 'Billing & Payment Terms', content: quotation.paymentTerms ?? 'As per standard terms.' },
    { no: '12', title: 'Confidentiality & Other Terms', content: quotation.otherTerms ?? 'As per standard other terms.' },
  ]

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm 10mm 14mm 10mm; }
          .quotation-pdf-shell { max-width: none !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
          .no-print, .skip-link { display: none !important; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          /* collapse drops the outer border on page fragments in Chromium print;
             separate + spacing 0 draws it on every fragment (verified in PDF output) */
          table { break-inside: auto; border-collapse: separate !important; border-spacing: 0 !important; }
          table, thead, tbody, tfoot, tr, th, td { box-decoration-break: clone; -webkit-box-decoration-break: clone; }
          tr { break-inside: auto; page-break-inside: auto; }
          .quotation-pdf-shell table { border: 1px solid #d1d5db !important; }
        }
      `}</style>

      <article
        aria-label={`Quotation ${quotation.proposalNumber}`}
        className="quotation-pdf-shell"
        style={{
          maxWidth: 860,
          margin: '24px auto 40px',
          background: '#fff',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          overflow: 'hidden',
          fontFamily: 'Inter, Arial, sans-serif',
          color: '#111827',
        }}
      >
        {/* Monochrome letterhead: white bg, 1px #111827 bottom border, black bold centered */}
        <div
          style={{
            background: '#fff',
            color: '#111827',
            padding: '16px 24px 14px',
            textAlign: 'center',
            borderBottom: '1px solid #111827',
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', letterSpacing: 0.4, lineHeight: 1.3 }}>{letterheadName}</div>
          <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 3, fontWeight: 600 }}>Engineering & Consultancy Services</div>
          {letterheadAddress ? <div style={{ fontSize: 10, color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>{letterheadAddress}</div> : null}
          {letterheadGstin ? <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>GSTIN: {letterheadGstin}</div> : null}
        </div>

        <div style={{ padding: 18 }}>
          {/* Top table: To + Quotation Details — bordered side-by-side */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', marginBottom: 12, fontSize: 12 }}>
            <tbody>
              <tr>
                <td style={{ width: '60%', borderRight: '1px solid #d1d5db', verticalAlign: 'top', padding: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td
                          style={{
                            padding: '7px 10px',
                            borderBottom: '1px solid #e5e7eb',
                            background: '#f9fafb',
                            fontWeight: 700,
                            fontSize: 11,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            color: '#111827',
                          }}
                        >
                          To
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 10px 4px', fontWeight: 700, color: '#111827', fontSize: 12 }}>{quotation.companyName}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0 10px 8px', color: '#6b7280', whiteSpace: 'pre-line', fontSize: 11, lineHeight: 1.5 }}>
                          {[quotation.siteLocation, quotation.city].filter(Boolean).join(', ') || '—'}
                        </td>
                      </tr>
                      {quotation.contactName ? (
                        <tr>
                          <td style={{ padding: '0 10px 2px', fontSize: 11, color: '#111827' }}>
                            Kind Attn: <span style={{ fontWeight: 700, color: '#111827' }}>{quotation.contactName}</span>
                            {quotation.designation ? `, ${quotation.designation}` : ''}
                          </td>
                        </tr>
                      ) : null}
                      {quotation.contactEmail ? (
                        <tr>
                          <td style={{ padding: '0 10px 8px', fontSize: 11, color: '#6b7280' }}>{quotation.contactEmail}</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </td>
                <td style={{ width: '40%', verticalAlign: 'top' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <tbody>
                      <tr>
                        <td
                          style={{
                            padding: '7px 8px',
                            borderBottom: '1px solid #e5e7eb',
                            borderRight: '1px solid #d1d5db',
                            background: '#f9fafb',
                            fontWeight: 700,
                            width: '50%',
                            color: '#111827',
                            letterSpacing: 0.3,
                          }}
                        >
                          Quotation No.
                        </td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#111827' }}>{quotation.proposalNumber}</td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '7px 8px',
                            borderBottom: '1px solid #e5e7eb',
                            borderRight: '1px solid #d1d5db',
                            background: '#f9fafb',
                            fontWeight: 700,
                            color: '#111827',
                            letterSpacing: 0.3,
                          }}
                        >
                          Date
                        </td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{formatDate(quotation.createdAt)}</td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '7px 8px',
                            borderBottom: '1px solid #e5e7eb',
                            borderRight: '1px solid #d1d5db',
                            background: '#f9fafb',
                            fontWeight: 700,
                            color: '#111827',
                            letterSpacing: 0.3,
                          }}
                        >
                          Valid until
                        </td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{computedValidUntil ?? '—'}</td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '7px 8px',
                            borderRight: '1px solid #d1d5db',
                            background: '#f9fafb',
                            fontWeight: 700,
                            color: '#111827',
                            letterSpacing: 0.3,
                          }}
                        >
                          Status
                        </td>
                        <td style={{ padding: '7px 8px', color: '#111827' }}>
                          <span className={`badge ${CLIENT_QUOTATION_STATUS_BADGES[quotation.status]}`} style={{ fontSize: 10 }}>
                            {CLIENT_QUOTATION_STATUS_LABELS[quotation.status]}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Subject */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', marginBottom: 12 }}>
            <tbody>
              <tr>
                <td
                  style={{
                    padding: '7px 10px',
                    background: '#f9fafb',
                    fontWeight: 700,
                    fontSize: 11,
                    borderBottom: '1px solid #d1d5db',
                    color: '#111827',
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                  }}
                >
                  Subject: {quotation.title}
                </td>
              </tr>
              {quotation.scopeOfWork ? (
                <tr>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {htmlToPlainText(quotation.scopeOfWork)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {/* Scope items — bordered table */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #d1d5db',
              marginBottom: 12,
              fontSize: 11,
              color: '#111827',
            }}
          >
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th
                  style={{
                    padding: '7px 8px',
                    borderBottom: '1px solid #d1d5db',
                    borderRight: '1px solid #d1d5db',
                    width: 40,
                    textAlign: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: '#111827',
                  }}
                >
                  Sr.
                </th>
                <th
                  style={{
                    padding: '7px 8px',
                    borderBottom: '1px solid #d1d5db',
                    borderRight: '1px solid #d1d5db',
                    textAlign: 'left',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: '#111827',
                  }}
                >
                  Scope of Work
                </th>
                <th
                  style={{
                    padding: '7px 8px',
                    borderBottom: '1px solid #d1d5db',
                    borderRight: '1px solid #d1d5db',
                    width: 60,
                    textAlign: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: '#111827',
                  }}
                >
                  Qty.
                </th>
                <th
                  style={{
                    padding: '7px 8px',
                    borderBottom: '1px solid #d1d5db',
                    borderRight: '1px solid #d1d5db',
                    width: 90,
                    textAlign: 'right',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: '#111827',
                  }}
                >
                  Rate
                </th>
                <th
                  style={{
                    padding: '7px 8px',
                    borderBottom: '1px solid #d1d5db',
                    width: 100,
                    textAlign: 'right',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: '#111827',
                  }}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {hasLines ? (
                quotation.quotationLines.map((l, i) => (
                  <tr key={l.id}>
                    <td style={{ padding: '7px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', textAlign: 'center', color: '#111827' }}>{i + 1}</td>
                    <td style={{ padding: '7px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', whiteSpace: 'pre-wrap', color: '#111827' }}>
                      {l.description}
                    </td>
                    <td
                      style={{
                        padding: '7px 8px',
                        borderBottom: '1px solid #e5e7eb',
                        borderRight: '1px solid #d1d5db',
                        textAlign: 'center',
                        color: '#111827',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {l.quantity}
                    </td>
                    <td
                      style={{
                        padding: '7px 8px',
                        borderBottom: '1px solid #e5e7eb',
                        borderRight: '1px solid #d1d5db',
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: '#111827',
                      }}
                    >
                      {formatPaise(l.unitPricePaise)}
                    </td>
                    <td
                      style={{
                        padding: '7px 8px',
                        borderBottom: '1px solid #e5e7eb',
                        textAlign: 'right',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: '#111827',
                      }}
                    >
                      {formatPaise(l.amountPaise)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', textAlign: 'center', color: '#111827' }}>1</td>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', color: '#111827' }}>
                    Quoted as a lump sum — itemized lines are being prepared.
                  </td>
                  <td
                    style={{
                      padding: '7px 8px',
                      borderBottom: '1px solid #e5e7eb',
                      borderRight: '1px solid #d1d5db',
                      textAlign: 'center',
                      color: '#111827',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    1
                  </td>
                  <td
                    style={{
                      padding: '7px 8px',
                      borderBottom: '1px solid #e5e7eb',
                      borderRight: '1px solid #d1d5db',
                      textAlign: 'right',
                      color: '#111827',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatPaise(quotation.valuePaise ?? 0)}
                  </td>
                  <td
                    style={{
                      padding: '7px 8px',
                      borderBottom: '1px solid #e5e7eb',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#111827',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatPaise(quotation.valuePaise ?? 0)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals + Amount in words */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #d1d5db',
              marginBottom: 12,
              fontSize: 11,
              color: '#111827',
            }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    padding: '7px 10px',
                    borderBottom: '1px solid #e5e7eb',
                    borderRight: '1px solid #d1d5db',
                    background: '#fff',
                    textAlign: 'right',
                    fontWeight: 600,
                    width: '70%',
                    color: '#111827',
                  }}
                >
                  Subtotal
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                  {formatPaise(totals.subtotalPaise)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: '7px 10px',
                    borderBottom: '1px solid #e5e7eb',
                    borderRight: '1px solid #d1d5db',
                    background: '#fff',
                    textAlign: 'right',
                    fontWeight: 600,
                    color: '#111827',
                  }}
                >
                  GST @ {CLIENT_QUOTATION_GST_RATE_PCT}%
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                  {formatPaise(totals.gstPaise)}
                </td>
              </tr>
              <tr style={{ background: '#fff' }}>
                <td
                  style={{
                    padding: '8px 10px',
                    borderRight: '1px solid #d1d5db',
                    textAlign: 'right',
                    fontWeight: 800,
                    color: '#111827',
                    letterSpacing: 0.3,
                  }}
                >
                  Total
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    fontWeight: 800,
                    color: '#111827',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: 0.3,
                  }}
                >
                  {formatPaise(totals.totalPaise)}
                </td>
              </tr>
              <tr>
                <td
                  colSpan={2}
                  style={{
                    padding: '7px 10px',
                    borderTop: '1px solid #d1d5db',
                    fontStyle: 'italic',
                    color: '#6b7280',
                    fontSize: 10,
                    lineHeight: 1.5,
                  }}
                >
                  {amountInWordsINR(totals.totalPaise)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Annexure - I — 12 rows, bordered, monochrome */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #d1d5db',
              fontSize: 11,
              color: '#111827',
              breakInside: 'auto' as const,
            }}
          >
            <thead>
              <tr>
                <th
                  colSpan={3}
                  style={{
                    padding: '8px 10px',
                    background: '#f9fafb',
                    borderBottom: '1px solid #d1d5db',
                    textAlign: 'center',
                    fontWeight: 800,
                    color: '#111827',
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    fontSize: 11,
                  }}
                >
                  Annexure - I
                </th>
              </tr>
              <tr style={{ background: '#f9fafb' }}>
                <th
                  style={{
                    padding: '7px 8px',
                    borderBottom: '1px solid #d1d5db',
                    borderRight: '1px solid #d1d5db',
                    width: 36,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: '#111827',
                    textAlign: 'center',
                  }}
                >
                  No.
                </th>
                <th
                  style={{
                    padding: '7px 8px',
                    borderBottom: '1px solid #d1d5db',
                    borderRight: '1px solid #d1d5db',
                    width: 140,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: '#111827',
                    textAlign: 'left',
                  }}
                >
                  Particulars
                </th>
                <th
                  style={{
                    padding: '7px 8px',
                    borderBottom: '1px solid #d1d5db',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: '#111827',
                    textAlign: 'left',
                  }}
                >
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {annexureRows.map((r) => (
                <tr key={r.no}>
                  <td
                    style={{
                      padding: '7px 8px',
                      borderBottom: '1px solid #e5e7eb',
                      borderRight: '1px solid #d1d5db',
                      textAlign: 'center',
                      fontWeight: 600,
                      color: '#111827',
                      verticalAlign: 'top',
                    }}
                  >
                    {r.no})
                  </td>
                  <td
                    style={{
                      padding: '7px 8px',
                      borderBottom: '1px solid #e5e7eb',
                      borderRight: '1px solid #d1d5db',
                      fontWeight: 700,
                      color: '#111827',
                      verticalAlign: 'top',
                    }}
                  >
                    {r.title}
                  </td>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'pre-wrap', color: '#111827', lineHeight: 1.6, verticalAlign: 'top' }}>
                    {Array.isArray(r.content) ? (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {r.content.map((c, i) => (
                          <li key={i} style={{ marginBottom: 2 }}>
                            {c}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      r.content
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              marginTop: 10,
              fontSize: 9,
              color: '#6b7280',
              textAlign: 'center',
              borderTop: '1px solid #e5e7eb',
              paddingTop: 8,
              letterSpacing: 0.3,
            }}
          >
            This is a computer-generated quotation — valid until {computedValidUntil ?? 'as above'} · Accent Techno Solutions Pvt Ltd
          </div>
        </div>
      </article>
    </>
  )
}

export function QuotationDocumentPageLegacyBridge({ initialData }: { initialData: ClientQuotationDocumentPayload }) { void initialData; return null }
