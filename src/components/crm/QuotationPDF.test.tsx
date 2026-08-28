import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuotationPDF } from './QuotationPDF'
import type { ProposalDetail } from '~/lib/proposals'
import { computeQuotationTotals } from '~/lib/quotations'
import { formatPaise, amountInWordsINR } from '~/lib/money'

function makeQuotation(overrides: Partial<ProposalDetail> = {}): ProposalDetail {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    proposalNumber: 'P-042-08-2026',
    companyName: 'Acme Engineering Pvt Ltd',
    title: 'Structural design for effluent plant',
    description: null,
    status: 'sent',
    priority: 'medium',
    contractType: 'lumpsum',
    valuePaise: 150_000_00,
    currency: 'INR',
    contactName: 'R. Sharma',
    contactEmail: 'r.sharma@acme.example',
    contactPhone: null,
    designation: 'Project Manager',
    city: 'Mumbai',
    siteLocation: 'Taloja MIDC',
    scopeOfWork: '<p>Detailed engineering for ETP civil &amp; structural</p>',
    plannedStartDate: null,
    plannedEndDate: null,
    dueDate: null,
    modeOfDelivery: null,
    revisionsIncluded: 2,
    siteVisits: 1,
    siteVisitNotes: null,
    validityDays: 30,
    estimatedCostPaise: null,
    commercialNotes: null,
    paymentTerms: '100% against delivery of GFC drawings.',
    otherTerms: 'GST 18% extra as applicable.',
    createdAt: '2026-08-20T06:00:00.000Z',
    updatedAt: '2026-08-20T06:00:00.000Z',
    createdBy: null,
    updatedBy: null,
    companyId: null,
    leadId: null,
    inputDocuments: [],
    deliverables: [],
    exclusions: [],
    software: [],
    quotationLines: [
      { id: 'line-1', description: 'Civil & structural design', quantity: 1, unitPricePaise: 100_000_00, amountPaise: 100_000_00 },
      { id: 'line-2', description: 'Detailed BOQ', quantity: 1, unitPricePaise: 50_000_00, amountPaise: 50_000_00 },
    ],
    comments: [],
    timeline: [],
    followUps: [],
    ...overrides,
  } as unknown as ProposalDetail
}

describe('QuotationPDF', () => {
  it('renders header, table amounts, totals and amount-in-words via paise helpers', () => {
    const quotation = makeQuotation()
    const totals = computeQuotationTotals({ lines: quotation.quotationLines, valuePaise: quotation.valuePaise })

    render(<QuotationPDF quotation={quotation} />)

    expect(screen.getByLabelText(`Quotation ${quotation.proposalNumber}`)).toBeInTheDocument()
    expect(screen.getByText('Accent Techno Solutions Pvt Ltd')).toBeInTheDocument()
    expect(screen.getByText(quotation.proposalNumber)).toBeInTheDocument()

    // Line amounts are formatted via formatPaise (paise-integer canonical).
    // Rate and Amount columns duplicate when qty=1, so use getAllByText.
    expect(screen.getAllByText(formatPaise(100_000_00)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(formatPaise(50_000_00)).length).toBeGreaterThanOrEqual(1)

    // Totals rail — subtotal + GST @ 18% + total.
    expect(screen.getByText(formatPaise(totals.subtotalPaise))).toBeInTheDocument()
    expect(screen.getByText(formatPaise(totals.gstPaise))).toBeInTheDocument()
    expect(screen.getByText(formatPaise(totals.totalPaise))).toBeInTheDocument()

    // Amount in words uses the paise total, not a float.
    expect(screen.getByText(amountInWordsINR(totals.totalPaise))).toBeInTheDocument()
  })

  it('falls back to a lump-sum row when there are no quotation lines', () => {
    const quotation = makeQuotation({ quotationLines: [], valuePaise: 75_000_00 })
    render(<QuotationPDF quotation={quotation} />)
    expect(screen.getByText(/Quoted as a lump sum/)).toBeInTheDocument()
    expect(screen.getAllByText(formatPaise(75_000_00)).length).toBeGreaterThanOrEqual(1)
  })

  it('respects a custom validUntil and displayCompany', () => {
    const quotation = makeQuotation()
    render(<QuotationPDF quotation={quotation} validUntil="20 Sep 2026" displayCompany={{ name: 'ATSPL', address: 'Mumbai, MH', gstin: '27AAAAA0000A1Z5' }} />)
    expect(screen.getByText('ATSPL')).toBeInTheDocument()
    expect(screen.getByText(/GSTIN: 27AAAAA0000A1Z5/)).toBeInTheDocument()
    expect(screen.getByText('20 Sep 2026')).toBeInTheDocument()
  })
})
