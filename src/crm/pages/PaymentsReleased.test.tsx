import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PaymentsReleased from './PaymentsReleased'
import type { PaymentsReleasedPagePayload } from '~/lib/payments-released'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('~/lib/payments-released.functions', () => ({
  getPaymentsReleasedPageData: vi.fn(),
  getPaymentReleasedDetailData: vi.fn().mockResolvedValue({
    payment: {
      id: 'rel-1',
      paymentNumber: 'REL-001-08-2026',
      companyId: 'comp-1',
      companyName: 'Tata Projects',
      projectId: 'proj-1',
      projectName: 'Solar Park EPC',
      saleInvoiceId: null,
      invoiceNumber: null,
      disbursingBankId: 'bank-1',
      disbursingBankName: 'HDFC Bank',
      clientBankName: 'ICICI Bank',
      clientAccountNumber: '000105001234',
      clientIfscCode: 'ICIC0000001',
      releaseDate: '2026-08-28',
      releaseType: 'security_deposit_refund',
      paymentMode: 'rtgs',
      transactionReference: 'RTGS11223344',
      amountPaise: 50000000,
      deductionPaise: 0,
      netAmountPaise: 50000000,
      status: 'pending_approval',
      reason: 'Earnest Money Deposit return on tender conclusion',
      notes: 'Tender committee approval ref #ATS-2026-TND-99',
      attachmentUrl: null,
      approvedBy: null,
      approvedAt: null,
      activities: [
        {
          id: 'act-1',
          actorUserId: 'u-1',
          actorName: 'Accounts Officer',
          action: 'created',
          oldValue: null,
          newValue: 'Created release REL-001-08-2026',
          createdAt: '2026-08-28T11:00:00Z',
        },
      ],
      createdAt: '2026-08-28T11:00:00Z',
      updatedAt: '2026-08-28T11:00:00Z',
    },
  }),
  createPaymentReleasedAction: vi.fn().mockResolvedValue({ ok: true }),
  approvePaymentReleasedAction: vi.fn().mockResolvedValue({ ok: true }),
  updatePaymentReleasedAction: vi.fn().mockResolvedValue({ ok: true }),
  updatePaymentReleasedStatusAction: vi.fn().mockResolvedValue({ ok: true }),
  deletePaymentReleasedAction: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('PaymentsReleased Component', () => {
  const mockPayload: PaymentsReleasedPagePayload = {
    canWrite: true,
    isAdmin: true,
    payments: [
      {
        id: 'rel-1',
        paymentNumber: 'REL-001-08-2026',
        companyId: 'comp-1',
        companyName: 'Tata Projects',
        projectId: 'proj-1',
        projectName: 'Solar Park EPC',
        saleInvoiceId: null,
        invoiceNumber: null,
        disbursingBankId: 'bank-1',
        disbursingBankName: 'HDFC Bank',
        clientBankName: 'ICICI Bank',
        clientAccountNumber: '000105001234',
        clientIfscCode: 'ICIC0000001',
        releaseDate: '2026-08-28',
        releaseType: 'security_deposit_refund',
        paymentMode: 'rtgs',
        transactionReference: 'RTGS11223344',
        amountPaise: 50000000,
        deductionPaise: 0,
        netAmountPaise: 50000000,
        status: 'pending_approval',
        reason: 'Earnest Money Deposit return on tender conclusion',
        notes: 'Tender committee approval ref #ATS-2026-TND-99',
        attachmentUrl: null,
        approvedBy: null,
        approvedAt: null,
        createdAt: '2026-08-28T11:00:00Z',
        updatedAt: '2026-08-28T11:00:00Z',
      },
    ],
    options: {
      companies: [{ id: 'comp-1', name: 'Tata Projects' }],
      projects: [{ id: 'proj-1', name: 'Solar Park EPC', companyId: 'comp-1' }],
      saleInvoices: [],
      banks: [{ id: 'bank-1', bankName: 'HDFC Bank', accountNumber: '50200012345678', ifscCode: 'HDFC0001234', branchName: 'Fort', isPrimary: true }],
    },
  }

  it('renders page header, KPI metrics ribbon, and payment rows', () => {
    render(<PaymentsReleased initialData={mockPayload} />)

    expect(screen.getByText(/Payments Released to Client/i)).toBeInTheDocument()
    expect(screen.getByText('REL-001-08-2026')).toBeInTheDocument()
    expect(screen.getByText('Tata Projects')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /New Disbursement \/ Refund/i })).toBeInTheDocument()
  })

  it('filters rows based on search query', async () => {
    const user = userEvent.setup()
    render(<PaymentsReleased initialData={mockPayload} />)

    const searchInput = screen.getByPlaceholderText(/search voucher/i)
    await user.type(searchInput, 'NonExistent')

    expect(screen.getByText(/No payment releases found/i)).toBeInTheDocument()
    expect(screen.queryByText('REL-001-08-2026')).not.toBeInTheDocument()
  })

  it('opens detail drawer and shows approval action when clicking a row', async () => {
    const user = userEvent.setup()
    render(<PaymentsReleased initialData={mockPayload} />)

    const row = screen.getByText('REL-001-08-2026')
    await user.click(row)

    expect(await screen.findByText('Disbursement Summary')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Approve Disbursement/i })).toBeInTheDocument()
  })
})
