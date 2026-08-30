import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ProposalDetailPage from './ProposalDetail'
import type { ProposalDetailPayload } from '~/lib/proposals'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))

vi.mock('~/lib/proposals.functions', () => ({
  getProposalDetailData: vi.fn(),
  updateProposalAction: vi.fn().mockResolvedValue({ ok: true }),
  updateProposalStatusAction: vi.fn().mockResolvedValue({ ok: true }),
  convertProposalToProjectAction: vi.fn().mockResolvedValue({ ok: true, data: { id: 'p1', projectNumber: 'PRJ-001' } }),
  addProposalFollowUpAction: vi.fn().mockResolvedValue({ ok: true }),
  toggleProposalFollowUpAction: vi.fn().mockResolvedValue({ ok: true }),
  addProposalCommentAction: vi.fn().mockResolvedValue({ ok: true }),
}))

const mockPayload: ProposalDetailPayload = {
  authorized: true,
  proposal: {
    id: 'prop-1',
    proposalNumber: 'PROP-2026-001',
    leadId: 'lead-1',
    leadNumber: 'LEAD-001',
    title: 'Adnoc Gas Plant Expansion Study',
    description: 'Detailed structural design and piping stresses',
    companyId: 'comp-1',
    companyName: 'ADNOC Offshore',
    contactName: 'Ahmed Al Mansoori',
    contactEmail: 'ahmed@adnoc.ae',
    contactPhone: '+971 50 1234567',
    designation: 'Project Director',
    city: 'Abu Dhabi',
    siteLocation: 'Das Island Terminal',
    scopeOfWork: '<p>Complete FEED & detailed engineering</p>',
    priority: 'high',
    contractType: 'lumpsum',
    valuePaise: 450000000,
    currency: 'INR',
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2027-03-31',
    dueDate: '2026-08-31',
    modeOfDelivery: 'Hybrid (Onsite + Remote)',
    revisionsIncluded: 2,
    siteVisits: 3,
    siteVisitNotes: 'Initial kick-off + two technical walkthroughs',
    validityDays: 60,
    estimatedCostPaise: 320000000,
    commercialNotes: 'Payment in 4 milestones',
    paymentTerms: '30% Advance, 30% Draft, 40% Final Deliverable',
    otherTerms: 'Standard ATS liabilities apply',
    status: 'draft',
    inputDocuments: ['P&ID Rev 2', 'Plot Plan'],
    deliverables: ['Piping Stress Report', '3D Model Review'],
    exclusions: ['Civil construction', 'Permitting fees'],
    software: [{ id: 'sw-line-1', softwareId: 'sw-1', name: 'CAESAR II', notes: '1 license' }],
    quotationLines: [
      {
        id: 'ql-1',
        description: 'Piping stress analysis',
        quantity: 1,
        unitPricePaise: 250000000,
        amountPaise: 250000000,
      },
      {
        id: 'ql-2',
        description: 'Structural FEA study',
        quantity: 1,
        unitPricePaise: 200000000,
        amountPaise: 200000000,
      },
    ],
    followUps: [
      {
        id: 'fu-1',
        dueDate: '2026-09-05',
        note: 'Call client to confirm kickoff date',
        doneAt: null,
      },
    ],
    comments: [],
    timeline: [
      {
        id: 't-1',
        kind: 'status',
        fromStatus: null,
        toStatus: 'draft',
        note: 'Proposal created',
        body: null,
        authorName: 'Admin',
        at: '2026-08-20T10:00:00Z',
      },
    ],
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: '2026-08-20T00:00:00Z',
  },
  options: {
    companies: [{ id: 'comp-1', code: 'ADNOC', name: 'ADNOC Offshore' }],
    software: [{ id: 'sw-1', name: 'CAESAR II', version: '2024' }],
  },
}

describe('ProposalDetail Component', () => {
  it('renders primary proposal heading and tab list with ARIA attributes', () => {
    render(<ProposalDetailPage initialData={mockPayload} />)

    // Heading landmark
    const heading = screen.getByRole('heading', { level: 1, name: /prop-2026-001 — adnoc gas plant expansion study/i })
    expect(heading).toBeInTheDocument()

    // Accessible buttons & actions
    expect(screen.getByRole('button', { name: /back to proposals/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /convert to project/i })).toBeInTheDocument()

    // Tablist semantics
    const tablist = screen.getByRole('tablist', { name: /proposal details sections/i })
    expect(tablist).toBeInTheDocument()

    const overviewTab = screen.getByRole('tab', { name: /overview/i })
    expect(overviewTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /scope & technical/i })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: /commercial & quotation/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('switches tabs and displays the respective domain panels', async () => {
    const user = userEvent.setup()
    render(<ProposalDetailPage initialData={mockPayload} />)

    // Switch to Scope & Technical tab
    const technicalTab = screen.getByRole('tab', { name: /scope & technical/i })
    await user.click(technicalTab)
    expect(technicalTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Scope of work')).toBeInTheDocument()
    expect(screen.getByText('Input documents')).toBeInTheDocument()
    expect(screen.getByText('Deliverables')).toBeInTheDocument()

    // Switch to Commercial & Quotation tab
    const commercialTab = screen.getByRole('tab', { name: /commercial & quotation/i })
    await user.click(commercialTab)
    expect(commercialTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Quotation details')).toBeInTheDocument()
    expect(screen.getByText('Commercials & Costing')).toBeInTheDocument()

    // Switch to Follow-ups tab
    const followupsTab = screen.getByRole('tab', { name: /follow-ups/i })
    await user.click(followupsTab)
    expect(followupsTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Call client to confirm kickoff date')).toBeInTheDocument()
  })

  it('displays tabular financial values and margin calculations', () => {
    render(<ProposalDetailPage initialData={mockPayload} />)

    // Financial header value formatted via paise helpers
    expect(screen.getAllByText(/₹\s*45,00,000/).length).toBeGreaterThan(0)
    expect(screen.getByText(/28\.9%/)).toBeInTheDocument()
  })
})
