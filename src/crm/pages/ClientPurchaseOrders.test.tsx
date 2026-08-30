import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ClientPurchaseOrders from './ClientPurchaseOrders'
import type { ClientPurchaseOrdersPagePayload } from '~/lib/client-purchase-orders'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('~/lib/client-purchase-orders.functions', () => ({
  getClientPurchaseOrdersPageData: vi.fn(),
  getClientPurchaseOrderDetailData: vi.fn().mockResolvedValue({
    order: {
      id: 'cpo-1',
      orderNumber: 'CPO-001-08-2026',
      clientPoNumber: 'PO-ADNOC-2026-99',
      companyId: 'comp-1',
      companyName: 'ADNOC Refining',
      clientContactName: 'Omar Al-Hashimi',
      clientContactEmail: 'omar@adnoc.ae',
      clientContactPhone: '+971 2 1234567',
      billingAddress: 'Corniche Road, Abu Dhabi',
      shippingAddress: 'Ruwais Refinery Complex',
      clientGstin: '27AAAAA1234A1Z5',
      clientPan: 'ABCDE1234F',
      proposalId: null,
      proposalNumber: null,
      projectId: null,
      projectName: null,
      subject: 'FEED study for flare recovery unit',
      poDate: '2026-08-10',
      receivedDate: '2026-08-11',
      deliveryDueDate: '2026-12-15',
      status: 'acknowledged',
      priority: 'high',
      subtotalPaise: 50000000,
      taxRateBps: 1800,
      discountPaise: 0,
      cgstAmountPaise: 4500000,
      sgstAmountPaise: 4500000,
      igstAmountPaise: 0,
      taxAmountPaise: 9000000,
      totalPaise: 59000000,
      invoicedAmountPaise: 10000000,
      remainingAmountPaise: 49000000,
      paymentTerms: '30% advance, 70% milestone',
      deliveryTerms: 'Electronic submittal',
      scopeOfWork: 'Complete engineering deliverables',
      specialInstructions: null,
      attachmentUrl: null,
      notes: null,
      items: [
        {
          id: 'item-1',
          itemCode: 'ENG-FEED-01',
          description: 'Process Simulation and P&ID diagrams',
          quantity: 1,
          unit: 'pkg',
          unitPricePaise: 50000000,
          taxRateBps: 1800,
          amountPaise: 50000000,
          position: 0,
        },
      ],
      activities: [
        {
          id: 'act-1',
          actorUserId: 'u-1',
          actorName: 'Admin',
          action: 'order_created',
          oldValue: null,
          newValue: 'Order created',
          createdAt: '2026-08-11T10:00:00Z',
        },
      ],
      createdAt: '2026-08-11T10:00:00Z',
    },
    options: { companies: [], proposals: [], projects: [] },
  }),
  updateClientPurchaseOrderStatusAction: vi.fn().mockResolvedValue({ ok: true }),
  deleteClientPurchaseOrderAction: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('ClientPurchaseOrders Component', () => {
  const mockPayload: ClientPurchaseOrdersPagePayload = {
    authorized: true,
    canWrite: true,
    orders: [
      {
        id: 'cpo-1',
        orderNumber: 'CPO-001-08-2026',
        clientPoNumber: 'PO-ADNOC-2026-99',
        companyId: 'comp-1',
        companyName: 'ADNOC Refining',
        clientContactName: 'Omar Al-Hashimi',
        subject: 'FEED study for flare recovery unit',
        poDate: '2026-08-10',
        deliveryDueDate: '2026-12-15',
        status: 'acknowledged',
        priority: 'high',
        subtotalPaise: 50000000,
        taxAmountPaise: 9000000,
        totalPaise: 59000000,
        invoicedAmountPaise: 10000000,
        remainingAmountPaise: 49000000,
        createdAt: '2026-08-11T10:00:00Z',
      },
    ],
    options: {
      companies: [{ id: 'comp-1', name: 'ADNOC Refining' }],
      proposals: [],
      projects: [],
    },
  }

  it('renders page header, KPI metrics ribbon and order rows', () => {
    render(<ClientPurchaseOrders initialData={mockPayload} />)

    expect(screen.getByText(/Client Purchase Orders \(Incoming\)/i)).toBeInTheDocument()
    expect(screen.getByText('CPO-001-08-2026')).toBeInTheDocument()
    expect(screen.getByText('PO-ADNOC-2026-99')).toBeInTheDocument()
    expect(screen.getByText('ADNOC Refining')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /New Client PO/i })).toBeInTheDocument()
  })

  it('filters rows based on search query', async () => {
    const user = userEvent.setup()
    render(<ClientPurchaseOrders initialData={mockPayload} />)

    const searchInput = screen.getByPlaceholderText(/search by po/i)
    await user.type(searchInput, 'NonExistent')

    expect(screen.getByText(/No Client Purchase Orders Found/i)).toBeInTheDocument()
    expect(screen.queryByText('CPO-001-08-2026')).not.toBeInTheDocument()
  })

  it('opens detail drawer when clicking a row', async () => {
    const user = userEvent.setup()
    render(<ClientPurchaseOrders initialData={mockPayload} />)

    const row = screen.getByText('CPO-001-08-2026')
    await user.click(row)

    expect(await screen.findByText('Process Simulation and P&ID diagrams')).toBeInTheDocument()
    expect(screen.getByText(/Corniche Road, Abu Dhabi/i)).toBeInTheDocument()
  })
})
