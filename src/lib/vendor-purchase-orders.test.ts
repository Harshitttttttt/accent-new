import { describe, expect, it } from 'vitest'
import {
  computeVendorPurchaseOrderStats,
  computeVendorPurchaseOrderTotals,
  vendorPurchaseOrderInputSchema,
  type VendorPurchaseOrderListItem,
} from './vendor-purchase-orders'

describe('Vendor Purchase Orders Math & Validation', () => {
  it('computes line totals, GST and net total in paise with Decimal.js precision', () => {
    // 3 items: 5 * ₹500.00 (50000 paise) = ₹2,500.00 (250000 paise)
    //          2 * ₹1,250.00 (125000 paise) = ₹2,500.00 (250000 paise)
    // Subtotal = ₹5,000.00 (500000 paise)
    // Discount = ₹200.00 (20000 paise) => Taxable = ₹4,800.00 (480000 paise)
    // Tax rate 1800 bps (18.00%) => Tax = 480000 * 0.18 = 86400 paise
    // Total = 480000 + 86400 = 566400 paise (₹5,664.00)
    const items = [
      { quantity: 5, unitPricePaise: 50000 },
      { quantity: 2, unitPricePaise: 125000 },
    ]

    const totals = computeVendorPurchaseOrderTotals(items, 20000, 1800)

    expect(totals.subtotalPaise).toBe(500000)
    expect(totals.discountPaise).toBe(20000)
    expect(totals.taxAmountPaise).toBe(86400)
    expect(totals.cgstAmountPaise + totals.sgstAmountPaise).toBe(86400)
    expect(totals.totalPaise).toBe(566400)
  })

  it('aggregates list metrics and KPI stats correctly for vendor POs', () => {
    const samplePOs: VendorPurchaseOrderListItem[] = [
      {
        id: '1',
        poNumber: 'VPO-001-08-2026',
        vendorId: 'vend-1',
        vendorName: 'Steel Tech Suppliers',
        subject: 'Structural Beams',
        poDate: '2026-08-10',
        expectedDeliveryDate: '2026-08-25',
        status: 'pending_approval',
        priority: 'high',
        subtotalPaise: 5000000,
        taxAmountPaise: 900000,
        totalPaise: 5900000,
        billedAmountPaise: 0,
        balanceAmountPaise: 5900000,
        approvedAt: null,
        createdAt: '2026-08-10T00:00:00Z',
      },
      {
        id: '2',
        poNumber: 'VPO-002-08-2026',
        vendorId: 'vend-2',
        vendorName: 'Apex Fluidics',
        subject: 'Piping Valves',
        poDate: '2026-08-12',
        expectedDeliveryDate: '2026-08-30',
        status: 'issued',
        priority: 'medium',
        subtotalPaise: 3000000,
        taxAmountPaise: 540000,
        totalPaise: 3540000,
        billedAmountPaise: 1540000,
        balanceAmountPaise: 2000000,
        approvedAt: '2026-08-12T10:00:00Z',
        createdAt: '2026-08-12T00:00:00Z',
      },
      {
        id: '3',
        poNumber: 'VPO-003-08-2026',
        vendorId: 'vend-3',
        vendorName: 'Precision Tools',
        subject: 'Calibrated Gauges',
        poDate: '2026-08-01',
        expectedDeliveryDate: '2026-08-15',
        status: 'fulfilled',
        priority: 'low',
        subtotalPaise: 1000000,
        taxAmountPaise: 180000,
        totalPaise: 1180000,
        billedAmountPaise: 1180000,
        balanceAmountPaise: 0,
        approvedAt: '2026-08-01T10:00:00Z',
        createdAt: '2026-08-01T00:00:00Z',
      },
    ]

    const stats = computeVendorPurchaseOrderStats(samplePOs)

    expect(stats.totalCount).toBe(3)
    expect(stats.totalValuePaise).toBe(10620000)
    expect(stats.pendingApprovalCount).toBe(1)
    expect(stats.pendingApprovalValuePaise).toBe(5900000)
    expect(stats.issuedCount).toBe(1)
    expect(stats.issuedValuePaise).toBe(3540000)
    expect(stats.fulfilledCount).toBe(1)
    expect(stats.fulfilledValuePaise).toBe(1180000)
    expect(stats.billedValuePaise).toBe(2720000)
    expect(stats.balanceValuePaise).toBe(7900000)
  })

  it('validates vendor purchase order input schema correctly', () => {
    const valid = {
      vendorName: 'Universal Power Solutions',
      status: 'pending_approval',
      priority: 'high',
      items: [
        {
          description: '100kVA Transformer servicing',
          quantity: 1,
          unit: 'unit',
          unitPricePaise: 15000000,
          taxRateBps: 1800,
        },
      ],
    }

    const parseResult = vendorPurchaseOrderInputSchema.safeParse(valid)
    expect(parseResult.success).toBe(true)

    const invalid = {
      vendorName: '', // required
      status: 'invalid_status',
      items: [],
    }
    const failResult = vendorPurchaseOrderInputSchema.safeParse(invalid)
    expect(failResult.success).toBe(false)
  })
})
