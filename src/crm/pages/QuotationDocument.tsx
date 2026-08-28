import { ArrowLeft, Printer, SquarePen } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { QuotationPDF } from '~/components/crm/QuotationPDF'
import type { QuotationDocumentPayload } from '~/lib/quotations'

export default function QuotationDocumentPage({ initialData }: { initialData: QuotationDocumentPayload }) {
  const navigate = useNavigate()
  const quotation = initialData.quotation

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

  if (!quotation) {
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

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--surface-secondary)' }}>
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
            onClick={() => void navigate({ to: '/proposals/$proposalId', params: { proposalId: quotation.id } })}
          >
            <SquarePen size={14} aria-hidden="true" /> Edit in proposals
          </button>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" /> Print / Save PDF
          </button>
        </div>
      </div>

      <QuotationPDF quotation={quotation} />
    </div>
  )
}
