import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PaymentsReceived from './PaymentsReceived'
import type { PaymentsReceivedPagePayload } from '~/lib/payments-received'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('~/lib/payments-received.functions', () => ({
  getPaymentsReceivedPageData: vi.fn(),
  getPaymentReceivedDetailData: vi.fn().mockResolvedValue({
    payment: {
      id: 'pay-1',
      receiptNumber: 'REC-001-08-2026',
      companyId: 'comp-1',
      companyName: 'Larsen & Toubro',
      projectId: 'proj-1',
      projectName: 'Metro Station Electricals',
      invoiceId: 'inv-1',
      invoiceNumber: 'SI-001-08-2026',
      clientPoId: null,
      clientPoNumber: null,
      bankId: 'bank-1',
      bankName: 'HDFC Bank',
      bankAccountNumber: '50200012345678',
      paymentDate: '2026-08-28',
      paymentType: 'invoice_payment',
      paymentMode: 'neft',
      transactionReference: 'NEFT99887766',
      chequeDate: null,
      chequeBank: null,
      amountPaise: 10000000,
      tdsDeductedPaise: 200000,
      bankChargesPaise: 0,
      netAmountPaise: 9800000,
      status: 'cleared',
      receiptUrl: null,
      notes: 'Full invoice settlement received on time',
      allocations: [],
      activities: [
        {
          id: 'act-1',
          actorUserId: 'u-1',
          actorName: 'Accounts Team',
          action: 'created',
          oldValue: null,
          newValue: 'Recorded receipt REC-001-08-2026',
          createdAt: '2026-08-28T10:00:00Z',
        },
      ],
      createdAt: '2026-08-28T10:00:00Z',
      updatedAt: '2026-08-28T10:00:00Z',
    },
  }),
  createPaymentReceivedAction: vi.fn().mockResolvedValue({ ok: true }),
  updatePaymentReceivedAction: vi.fn().mockResolvedValue({ ok: true }),
  updatePaymentReceivedStatusAction: vi.fn().mockResolvedValue({ ok: true }),
  deletePaymentReceivedAction: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('PaymentsReceived Component', () => {
  const mockPayload: PaymentsReceivedPagePayload = {
    canWrite: true,
    isAdmin: true,
    payments: [
      {
        id: 'pay-1',
        receiptNumber: 'REC-001-08-2026',
        companyId: 'comp-1',
        companyName: 'Larsen & Toubro',
        projectId: 'proj-1',
        projectName: 'Metro Station Electricals',
        invoiceId: 'inv-1',
        invoiceNumber: 'SI-001-08-2026',
        clientPoId: null,
        clientPoNumber: null,
        bankId: 'bank-1',
        bankName: 'HDFC Bank',
        bankAccountNumber: '50200012345678',
        paymentDate: '2026-08-28',
        paymentType: 'invoice_payment',
        paymentMode: 'neft',
        transactionReference: 'NEFT99887766',
        chequeDate: null,
        chequeBank: null,
        amountPaise: 10000000,
        tdsDeductedPaise: 200000,
        bankChargesPaise: 0,
        netAmountPaise: 9800000,
        status: 'cleared',
        receiptUrl: null,
        notes: 'Full invoice settlement received on time',
        createdAt: '2026-08-28T10:00:00Z',
        updatedAt: '2026-08-28T10:00:00Z',
      },
    ],
    options: {
      companies: [{ id: 'comp-1', name: 'Larsen & Toubro' }],
      projects: [{ id: 'proj-1', name: 'Metro Station Electricals', companyId: 'comp-1' }],
      saleInvoices: [],
      banks: [{ id: 'bank-1', bankName: 'HDFC Bank', accountNumber: '50200012345678', ifscCode: 'HDFC0001234', branchName: 'Fort', isPrimary: true }],
    },
  }

  it('renders page header, KPI metrics ribbon, and payment rows', () => {
    render(<PaymentsReceived initialData={mockPayload} />)

    expect(screen.getByText(/Payments Received from Client/i)).toBeInTheDocument()
    expect(screen.getByText('REC-001-08-2026')).toBeInTheDocument()
    expect(screen.getByText('Larsen & Toubro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Record Payment/i })).toBeInTheDocument()
  })

  it('filters rows based on search query', async () => {
    const user = userEvent.setup()
    render(<PaymentsReceived initialData={mockPayload} />)

    const searchInput = screen.getByPlaceholderText(/search receipt/i)
    await user.type(searchInput, 'NonExistent')

    expect(screen.getByText(/No payments found/i)).toBeInTheDocument()
    expect(screen.queryByText('REC-001-08-2026')).not.toBeInTheDocument()
  })

  it('opens detail drawer when clicking a payment row', async () => {
    const user = userEvent.setup()
    render(<PaymentsReceived initialData={mockPayload} />)

    const row = screen.getByText('REC-001-08-2026')
    await user.click(row)

    expect(await screen.findByText('Full invoice settlement received on time')).toBeInTheDocument()
    expect(screen.getAllByText('NEFT99887766').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Financial Summary')).toBeInTheDocument()
  })
})
