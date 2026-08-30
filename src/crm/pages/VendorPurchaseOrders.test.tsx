import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import VendorPurchaseOrders from './VendorPurchaseOrders'
import type { VendorPurchaseOrdersPagePayload } from '~/lib/vendor-purchase-orders'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('~/lib/vendor-purchase-orders.functions', () => ({
  getVendorPurchaseOrdersPageData: vi.fn(),
  getVendorPurchaseOrderDetailData: vi.fn().mockResolvedValue({
    order: {
      id: 'vpo-1',
      poNumber: 'VPO-001-08-2026',
      vendorId: 'vend-1',
      vendorName: 'Gulf Steel Mills',
      vendorEmail: 'sales@gulfsteel.com',
      vendorPhone: '+971 4 9876543',
      vendorAddress: 'Jebel Ali Industrial Area 1, Dubai',
      vendorGstin: '27AAAAA9999A1Z1',
      vendorPan: 'ABCDE9999F',
      vendorQuotationId: null,
      quotationNumber: null,
      projectId: null,
      projectName: null,
      subject: 'High-strength structural beams',
      poDate: '2026-08-12',
      expectedDeliveryDate: '2026-09-01',
      status: 'issued',
      priority: 'high',
      subtotalPaise: 25000000,
      taxRateBps: 1800,
      discountPaise: 0,
      cgstAmountPaise: 2250000,
      sgstAmountPaise: 2250000,
      igstAmountPaise: 0,
      taxAmountPaise: 4500000,
      totalPaise: 29500000,
      billedAmountPaise: 10000000,
      balanceAmountPaise: 19500000,
      deliveryTerms: 'FOB Site Jebel Ali',
      paymentTerms: 'Net 30 days',
      shippingAddress: 'Accent Techno Central Fabrication Yard',
      modeOfDelivery: 'Heavy Trailer Transport',
      attachmentUrl: null,
      notes: null,
      terms: 'Mill test certificates required upon dispatch',
      approvedAt: '2026-08-12T14:00:00Z',
      items: [
        {
          id: 'item-1',
          itemCode: 'STL-UB-457',
          description: 'Universal Beams 457x191x82 kg/m Grade S355JR',
          quantity: 20,
          unit: 'MT',
          unitPricePaise: 1250000,
          taxRateBps: 1800,
          amountPaise: 25000000,
          position: 0,
        },
      ],
      activities: [
        {
          id: 'act-1',
          actorUserId: 'u-1',
          actorName: 'Procurement Lead',
          action: 'po_created',
          oldValue: null,
          newValue: 'PO Created',
          createdAt: '2026-08-12T10:00:00Z',
        },
      ],
      createdAt: '2026-08-12T10:00:00Z',
    },
    options: { vendors: [], vendorQuotations: [], projects: [] },
  }),
  updateVendorPurchaseOrderStatusAction: vi.fn().mockResolvedValue({ ok: true }),
  deleteVendorPurchaseOrderAction: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('VendorPurchaseOrders Component', () => {
  const mockPayload: VendorPurchaseOrdersPagePayload = {
    authorized: true,
    canWrite: true,
    orders: [
      {
        id: 'vpo-1',
        poNumber: 'VPO-001-08-2026',
        vendorId: 'vend-1',
        vendorName: 'Gulf Steel Mills',
        subject: 'High-strength structural beams',
        poDate: '2026-08-12',
        expectedDeliveryDate: '2026-09-01',
        status: 'issued',
        priority: 'high',
        subtotalPaise: 25000000,
        taxAmountPaise: 4500000,
        totalPaise: 29500000,
        billedAmountPaise: 10000000,
        balanceAmountPaise: 19500000,
        approvedAt: '2026-08-12T14:00:00Z',
        createdAt: '2026-08-12T10:00:00Z',
      },
    ],
    options: {
      vendors: [{ id: 'vend-1', name: 'Gulf Steel Mills' }],
      vendorQuotations: [],
      projects: [],
    },
  }

  it('renders page header, KPI metrics ribbon and order rows', () => {
    render(<VendorPurchaseOrders initialData={mockPayload} />)

    expect(screen.getByText(/Vendor Purchase Orders \(Outgoing\)/i)).toBeInTheDocument()
    expect(screen.getByText('VPO-001-08-2026')).toBeInTheDocument()
    expect(screen.getByText('Gulf Steel Mills')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /New Vendor PO/i })).toBeInTheDocument()
  })

  it('filters rows based on search query', async () => {
    const user = userEvent.setup()
    render(<VendorPurchaseOrders initialData={mockPayload} />)

    const searchInput = screen.getByPlaceholderText(/search by po/i)
    await user.type(searchInput, 'NonExistent')

    expect(screen.getByText(/No Vendor Purchase Orders Found/i)).toBeInTheDocument()
    expect(screen.queryByText('VPO-001-08-2026')).not.toBeInTheDocument()
  })

  it('opens detail drawer when clicking a row', async () => {
    const user = userEvent.setup()
    render(<VendorPurchaseOrders initialData={mockPayload} />)

    const row = screen.getByText('VPO-001-08-2026')
    await user.click(row)

    expect(await screen.findByText('Universal Beams 457x191x82 kg/m Grade S355JR')).toBeInTheDocument()
    expect(screen.getByText(/Jebel Ali Industrial Area 1, Dubai/i)).toBeInTheDocument()
  })
})
