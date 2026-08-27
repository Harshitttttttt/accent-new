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
  validUntil?: string | null
  displayCompany?: { name: string; address?: string | null; gstin?: string | null }
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Old app reference: src/app/admin/quotation/[id]/view/page.jsx — bordered tables with gray-50 headers, 14 annexure rows
export function QuotationPDF({ quotation, validUntil: validUntilProp, displayCompany }: QuotationPDFProps) {
  const totals = computeQuotationTotals({ lines: quotation.quotationLines, valuePaise: quotation.valuePaise })
  const computedValidUntil =
    validUntilProp !== undefined
      ? validUntilProp
      : quotation.validityDays
        ? formatDate(new Date(new Date(quotation.createdAt).getTime() + quotation.validityDays * 86_400_000).toISOString())
        : null
  const hasLines = quotation.quotationLines.length > 0
  const letterheadName = displayCompany?.name ?? 'Accent Techno Solutions Private Limited'
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
          .quotation-pdf-shell { max-width: none !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { break-inside: avoid; }
        }
      `}</style>

      <article className="quotation-pdf-shell" style={{ maxWidth: 860, margin: '24px auto 40px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
        {/* Purple letterhead like old: bg-[#64126D] */}
        <div style={{ background: '#64126D', color: '#fff', padding: '14px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{letterheadName}</div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>Engineering & Consultancy Services</div>
          {letterheadAddress ? <div style={{ fontSize: 10, opacity: 0.85, marginTop: 4 }}>{letterheadAddress}</div> : null}
          {letterheadGstin ? <div style={{ fontSize: 10, opacity: 0.85 }}>GSTIN: {letterheadGstin}</div> : null}
        </div>

        <div style={{ padding: 18 }}>
          {/* Top table: To + Quotation Details — old app flex as table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', marginBottom: 12, fontSize: 12 }}>
            <tbody>
              <tr>
                <td style={{ width: '60%', borderRight: '1px solid #d1d5db', verticalAlign: 'top', padding: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr><td style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>To</td></tr>
                      <tr><td style={{ padding: '10px', fontWeight: 700 }}>{quotation.companyName}</td></tr>
                      <tr><td style={{ padding: '0 10px 10px', color: '#4b5563', whiteSpace: 'pre-line' }}>{[quotation.siteLocation, quotation.city].filter(Boolean).join(', ')}</td></tr>
                      {quotation.contactName ? <tr><td style={{ padding: '0 10px 2px', fontSize: 11 }}>Kind Attn: <b>{quotation.contactName}</b>{quotation.designation ? `, ${quotation.designation}` : ''}</td></tr> : null}
                      {quotation.contactEmail ? <tr><td style={{ padding: '0 10px 8px', fontSize: 11, color: '#6b7280' }}>{quotation.contactEmail}</td></tr> : null}
                    </tbody>
                  </table>
                </td>
                <td style={{ width: '40%', verticalAlign: 'top' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <tbody>
                      <tr><td style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', background: '#f9fafb', fontWeight: 700, width: '50%' }}>Quotation No.</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db', fontWeight: 600 }}>{quotation.proposalNumber}</td></tr>
                      <tr><td style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', background: '#f9fafb', fontWeight: 700 }}>Date</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>{formatDate(quotation.createdAt)}</td></tr>
                      <tr><td style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', background: '#f9fafb', fontWeight: 700 }}>Valid until</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db' }}>{computedValidUntil ?? '—'}</td></tr>
                      <tr><td style={{ padding: '6px 8px', borderRight: '1px solid #d1d5db', background: '#f9fafb', fontWeight: 700 }}>Status</td><td style={{ padding: '6px 8px' }}><span className={`badge ${QUOTATION_STATUS_BADGES[quotation.status]}`} style={{ fontSize: 10 }}>{QUOTATION_STATUS_LABELS[quotation.status]}</span></td></tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Subject */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', marginBottom: 12 }}>
            <tbody>
              <tr><td style={{ padding: '6px 10px', background: '#f9fafb', fontWeight: 700, fontSize: 11, borderBottom: '1px solid #d1d5db' }}>SUBJECT: {quotation.title}</td></tr>
              {quotation.scopeOfWork ? <tr><td style={{ padding: '8px 10px', fontSize: 11, color: '#374151', whiteSpace: 'pre-wrap' }}>{htmlToPlainText(quotation.scopeOfWork)}</td></tr> : null}
            </tbody>
          </table>

          {/* Scope items — bordered table like old */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', marginBottom: 12, fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '7px 8px', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', width: 40, textAlign: 'center', fontSize: 10 }}>Sr.</th>
                <th style={{ padding: '7px 8px', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', textAlign: 'left', fontSize: 10 }}>Scope of Work</th>
                <th style={{ padding: '7px 8px', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', width: 60, textAlign: 'center', fontSize: 10 }}>Qty.</th>
                <th style={{ padding: '7px 8px', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', width: 90, textAlign: 'right', fontSize: 10 }}>Rate</th>
                <th style={{ padding: '7px 8px', borderBottom: '1px solid #d1d5db', width: 100, textAlign: 'right', fontSize: 10 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {hasLines ? quotation.quotationLines.map((l, i) => (
                <tr key={l.id}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', whiteSpace: 'pre-wrap' }}>{l.description}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', textAlign: 'center' }}>{l.quantity}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatPaise(l.unitPricePaise)}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatPaise(l.amountPaise)}</td>
                </tr>
              )) : (
                <tr><td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', textAlign: 'center' }}>1</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db' }}>Quoted as a lump sum — itemized lines are being prepared.</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', textAlign: 'center' }}>1</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', textAlign: 'right' }}>{formatPaise(quotation.valuePaise ?? 0)}</td><td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 700 }}>{formatPaise(quotation.valuePaise ?? 0)}</td></tr>
              )}
            </tbody>
          </table>

          {/* Totals + Amount in words — old app totals table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', marginBottom: 12, fontSize: 11 }}>
            <tbody>
              <tr><td style={{ padding: '6px 10px', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', background: '#f9fafb', textAlign: 'right', fontWeight: 600, width: '70%' }}>Subtotal</td><td style={{ padding: '6px 10px', borderBottom: '1px solid #d1d5db', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatPaise(totals.subtotalPaise)}</td></tr>
              <tr><td style={{ padding: '6px 10px', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', background: '#f9fafb', textAlign: 'right', fontWeight: 600 }}>GST @ {QUOTATION_GST_RATE_PCT}%</td><td style={{ padding: '6px 10px', borderBottom: '1px solid #d1d5db', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatPaise(totals.gstPaise)}</td></tr>
              <tr style={{ background: '#faf5ff' }}><td style={{ padding: '7px 10px', borderRight: '1px solid #d1d5db', textAlign: 'right', fontWeight: 800 }}>Total</td><td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#64126D', fontVariantNumeric: 'tabular-nums' }}>{formatPaise(totals.totalPaise)}</td></tr>
              <tr><td colSpan={2} style={{ padding: '6px 10px', borderTop: '1px solid #d1d5db', fontStyle: 'italic', color: '#6b7280', fontSize: 10 }}>{amountInWordsINR(totals.totalPaise)}</td></tr>
            </tbody>
          </table>

          {/* Annexure - I — full table like old app */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', fontSize: 11 }}>
            <thead>
              <tr><th colSpan={3} style={{ padding: '7px 10px', background: '#faf5ff', borderBottom: '1px solid #d1d5db', textAlign: 'center', fontWeight: 800, color: '#64126D' }}>ANNEXURE - I</th></tr>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', width: 36, fontSize: 10 }}>No.</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', width: 140, fontSize: 10, textAlign: 'left' }}>Particulars</th>
                <th style={{ padding: '6px 8px', borderBottom: '1px solid #d1d5db', fontSize: 10, textAlign: 'left' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {annexureRows.map((r) => (
                <tr key={r.no}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', textAlign: 'center', fontWeight: 600 }}>{r.no})</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #d1d5db', fontWeight: 700 }}>{r.title}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'pre-wrap' }}>
                    {Array.isArray(r.content) ? (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>{r.content.map((c, i) => <li key={i} style={{ marginBottom: 2 }}>{c}</li>)}</ul>
                    ) : r.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 10, fontSize: 9, color: '#9ca3af', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
            This is a computer-generated quotation — valid until {computedValidUntil ?? 'as above'} · Accent Techno Solutions Pvt Ltd
          </div>
        </div>
      </article>
    </>
  )
}

export function QuotationDocumentPageLegacyBridge({ initialData }: { initialData: QuotationDocumentPayload }) { void initialData; return null }
