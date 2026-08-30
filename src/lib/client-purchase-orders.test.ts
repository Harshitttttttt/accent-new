import { describe, expect, it } from 'vitest'
import {
  computeClientPurchaseOrderStats,
  computeClientPurchaseOrderTotals,
  clientPurchaseOrderInputSchema,
  type ClientPurchaseOrderListItem,
} from './client-purchase-orders'

describe('Client Purchase Orders Math & Validation', () => {
  it('computes line totals, GST and net total in paise with Decimal.js precision', () => {
    // 2 items: 2 * ₹1,500.00 (150000 paise) = ₹3,000.00 (300000 paise)
    //          1 * ₹2,000.50 (200050 paise) = ₹2,000.50 (200050 paise)
    // Subtotal = ₹5,000.50 (500050 paise)
    // Discount = ₹500.00 (50000 paise) => Taxable = ₹4,500.50 (450050 paise)
    // Tax rate 1800 bps (18.00%) => Tax = 450050 * 0.18 = 81009 paise
    // Total = 450050 + 81009 = 531059 paise (₹5,310.59)
    const items = [
      { quantity: 2, unitPricePaise: 150000 },
      { quantity: 1, unitPricePaise: 200050 },
    ]

    const totals = computeClientPurchaseOrderTotals(items, 50000, 1800)

    expect(totals.subtotalPaise).toBe(500050)
    expect(totals.discountPaise).toBe(50000)
    expect(totals.taxAmountPaise).toBe(81009)
    expect(totals.cgstAmountPaise + totals.sgstAmountPaise).toBe(81009)
    expect(totals.totalPaise).toBe(531059)
  })

  it('caps discount at subtotal to prevent negative totals', () => {
    const items = [{ quantity: 1, unitPricePaise: 100000 }] // ₹1,000
    const totals = computeClientPurchaseOrderTotals(items, 200000, 1800) // ₹2,000 discount attempted

    expect(totals.subtotalPaise).toBe(100000)
    expect(totals.discountPaise).toBe(100000)
    expect(totals.taxAmountPaise).toBe(0)
    expect(totals.totalPaise).toBe(0)
  })

  it('aggregates list metrics and KPI stats correctly', () => {
    const sampleOrders: ClientPurchaseOrderListItem[] = [
      {
        id: '1',
        orderNumber: 'CPO-001-08-2026',
        clientPoNumber: 'PO-CLIENT-101',
        companyId: 'comp-1',
        companyName: 'Acme Corp',
        clientContactName: 'John Doe',
        subject: 'Engineering drawings',
        poDate: '2026-08-15',
        deliveryDueDate: '2026-09-15',
        status: 'draft',
        priority: 'high',
        subtotalPaise: 1000000,
        taxAmountPaise: 180000,
        totalPaise: 1180000,
        invoicedAmountPaise: 0,
        remainingAmountPaise: 1180000,
        createdAt: '2026-08-15T00:00:00Z',
      },
      {
        id: '2',
        orderNumber: 'CPO-002-08-2026',
        clientPoNumber: 'PO-CLIENT-102',
        companyId: 'comp-2',
        companyName: 'Beta Ltd',
        clientContactName: 'Alice Smith',
        subject: 'HVAC Design',
        poDate: '2026-08-16',
        deliveryDueDate: '2026-10-15',
        status: 'in_progress',
        priority: 'medium',
        subtotalPaise: 2000000,
        taxAmountPaise: 360000,
        totalPaise: 2360000,
        invoicedAmountPaise: 1000000,
        remainingAmountPaise: 1360000,
        createdAt: '2026-08-16T00:00:00Z',
      },
      {
        id: '3',
        orderNumber: 'CPO-003-08-2026',
        clientPoNumber: 'PO-CLIENT-103',
        companyId: 'comp-3',
        companyName: 'Gamma Systems',
        clientContactName: 'Bob Vance',
        subject: 'Piping Analysis',
        poDate: '2026-08-17',
        deliveryDueDate: '2026-08-25',
        status: 'fulfilled',
        priority: 'low',
        subtotalPaise: 500000,
        taxAmountPaise: 90000,
        totalPaise: 590000,
        invoicedAmountPaise: 590000,
        remainingAmountPaise: 0,
        createdAt: '2026-08-17T00:00:00Z',
      },
    ]

    const stats = computeClientPurchaseOrderStats(sampleOrders)

    expect(stats.totalCount).toBe(3)
    expect(stats.totalValuePaise).toBe(4130000)
    expect(stats.openCount).toBe(1)
    expect(stats.openValuePaise).toBe(1180000)
    expect(stats.inProgressCount).toBe(1)
    expect(stats.inProgressValuePaise).toBe(2360000)
    expect(stats.fulfilledCount).toBe(1)
    expect(stats.fulfilledValuePaise).toBe(590000)
    expect(stats.invoicedValuePaise).toBe(1590000)
    expect(stats.remainingValuePaise).toBe(2540000)
  })

  it('validates client purchase order input schema correctly', () => {
    const valid = {
      clientPoNumber: 'PO-998822',
      companyName: 'Global Infra Ltd',
      status: 'draft',
      priority: 'high',
      items: [
        {
          description: 'Structural calculations report',
          quantity: 1,
          unit: 'report',
          unitPricePaise: 5000000,
          taxRateBps: 1800,
        },
      ],
    }

    const parseResult = clientPurchaseOrderInputSchema.safeParse(valid)
    expect(parseResult.success).toBe(true)

    const invalid = {
      clientPoNumber: '', // required
      companyName: '',
      status: 'invalid_status',
      items: [],
    }
    const failResult = clientPurchaseOrderInputSchema.safeParse(invalid)
    expect(failResult.success).toBe(false)
  })
})
