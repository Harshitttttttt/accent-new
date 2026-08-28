import { describe, expect, it } from 'vitest'
import {
  computeVendorQuotationStats,
  computeVendorQuotationTotals,
  VENDOR_QUOTATION_DEFAULT_TAX_BPS,
  vendorQuotationInputSchema,
  vendorQuotationItemsTotalPaise,
} from './vendor-quotations'

describe('vendorQuotationItemsTotalPaise', () => {
  it('sums quantity × unit price in integer paise', () => {
    expect(
      vendorQuotationItemsTotalPaise([
        { quantity: 2, unitPricePaise: 150_00 },
        { quantity: 3, unitPricePaise: 99_50 },
      ]),
    ).toBe(2 * 150_00 + 3 * 99_50)
  })

  it('returns 0 for an empty list', () => {
    expect(vendorQuotationItemsTotalPaise([])).toBe(0)
  })
})

describe('computeVendorQuotationTotals', () => {
  it('prefers item lines over the manual subtotal', () => {
    const totals = computeVendorQuotationTotals({
      items: [{ quantity: 1, unitPricePaise: 100_00 }],
      manualSubtotalPaise: 999_99,
      taxRateBps: VENDOR_QUOTATION_DEFAULT_TAX_BPS,
      discountPaise: 0,
    })
    expect(totals.subtotalPaise).toBe(100_00)
    expect(totals.taxablePaise).toBe(100_00)
    expect(totals.taxPaise).toBe(18_00)
    expect(totals.totalPaise).toBe(118_00)
  })

  it('falls back to the manual subtotal when there are no lines', () => {
    const totals = computeVendorQuotationTotals({
      items: [],
      manualSubtotalPaise: 50_00,
      taxRateBps: VENDOR_QUOTATION_DEFAULT_TAX_BPS,
      discountPaise: 0,
    })
    expect(totals.subtotalPaise).toBe(50_00)
    expect(totals.totalPaise).toBe(59_00)
  })

  it('subtracts the discount before tax', () => {
    const totals = computeVendorQuotationTotals({
      items: [{ quantity: 1, unitPricePaise: 100_00 }],
      manualSubtotalPaise: null,
      taxRateBps: VENDOR_QUOTATION_DEFAULT_TAX_BPS,
      discountPaise: 20_00,
    })
    expect(totals.taxablePaise).toBe(80_00)
    expect(totals.taxPaise).toBe(14_40)
    expect(totals.totalPaise).toBe(94_40)
  })

  it('clamps the discount to the subtotal so the tax base never goes negative', () => {
    const totals = computeVendorQuotationTotals({
      items: [{ quantity: 1, unitPricePaise: 10_00 }],
      manualSubtotalPaise: null,
      taxRateBps: VENDOR_QUOTATION_DEFAULT_TAX_BPS,
      discountPaise: 99_00,
    })
    expect(totals.taxablePaise).toBe(0)
    expect(totals.taxPaise).toBe(0)
    expect(totals.totalPaise).toBe(0)
  })

  it('rounds tax HALF_UP into whole paise exactly once', () => {
    // 1.25 rupees × 18% = 22.5 paise → 23 (HALF_UP at the exact .5 boundary).
    const halfUp = computeVendorQuotationTotals({
      items: [{ quantity: 1, unitPricePaise: 125 }],
      manualSubtotalPaise: null,
      taxRateBps: VENDOR_QUOTATION_DEFAULT_TAX_BPS,
      discountPaise: 0,
    })
    expect(halfUp.taxPaise).toBe(23)

    // 6 paise × 18% = 1.08 paise → 1 paise (fraction below .5).
    const fractional = computeVendorQuotationTotals({
      items: [{ quantity: 1, unitPricePaise: 6 }],
      manualSubtotalPaise: null,
      taxRateBps: VENDOR_QUOTATION_DEFAULT_TAX_BPS,
      discountPaise: 0,
    })
    expect(fractional.taxPaise).toBe(1)

    // Exact half: 25 paise × 18% = 4.5 paise → 5 (HALF_UP).
    const exactHalf = computeVendorQuotationTotals({
      items: [{ quantity: 1, unitPricePaise: 25 }],
      manualSubtotalPaise: null,
      taxRateBps: VENDOR_QUOTATION_DEFAULT_TAX_BPS,
      discountPaise: 0,
    })
    expect(exactHalf.taxPaise).toBe(5)
  })

  it('handles a zero tax rate', () => {
    const totals = computeVendorQuotationTotals({
      items: [{ quantity: 4, unitPricePaise: 25_00 }],
      manualSubtotalPaise: null,
      taxRateBps: 0,
      discountPaise: 0,
    })
    expect(totals.taxPaise).toBe(0)
    expect(totals.totalPaise).toBe(100_00)
  })

  it('treats a negative manual subtotal as zero', () => {
    const totals = computeVendorQuotationTotals({
      items: [],
      manualSubtotalPaise: -500,
      taxRateBps: VENDOR_QUOTATION_DEFAULT_TAX_BPS,
      discountPaise: 0,
    })
    expect(totals.subtotalPaise).toBe(0)
    expect(totals.totalPaise).toBe(0)
  })
})

describe('computeVendorQuotationStats', () => {
  it('rolls up counts and values across the pipeline', () => {
    const stats = computeVendorQuotationStats([
      { status: 'draft', totalPaise: 100_00 },
      { status: 'sent', totalPaise: 200_00 },
      { status: 'approved', totalPaise: 400_00 },
      { status: 'rejected', totalPaise: 800_00 },
      { status: 'expired', totalPaise: 1600_00 },
    ])

    expect(stats.totalCount).toBe(5)
    expect(stats.draftCount).toBe(1)
    expect(stats.sentCount).toBe(1)
    expect(stats.approvedCount).toBe(1)
    expect(stats.rejectedCount).toBe(1)
    expect(stats.expiredCount).toBe(1)
    // Open = draft + sent.
    expect(stats.openValuePaise).toBe(100_00 + 200_00)
    expect(stats.approvedValuePaise).toBe(400_00)
    expect(stats.totalValuePaise).toBe(100_00 + 200_00 + 400_00 + 800_00 + 1600_00)
  })

  it('returns zeros for an empty list', () => {
    expect(computeVendorQuotationStats([])).toEqual({
      totalCount: 0,
      draftCount: 0,
      sentCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      expiredCount: 0,
      openValuePaise: 0,
      approvedValuePaise: 0,
      totalValuePaise: 0,
    })
  })
})

describe('vendorQuotationInputSchema', () => {
  const valid = {
    vendorId: null,
    vendorName: 'Acme Steels',
    vendorEmail: null,
    vendorPhone: null,
    vendorAddress: null,
    subject: null,
    projectId: null,
    quotationDate: '2026-08-27',
    taxRateBps: 1800,
    manualSubtotalPaise: null,
    discountPaise: 0,
    validUntil: null,
    notes: null,
    terms: null,
    status: 'draft' as const,
    items: [],
  }

  it('accepts a minimal valid payload', () => {
    expect(vendorQuotationInputSchema.parse(valid).vendorName).toBe('Acme Steels')
  })

  it('converts empty strings to null', () => {
    const parsed = vendorQuotationInputSchema.parse({
      ...valid,
      vendorEmail: '',
      subject: '   ',
      quotationDate: '',
    })
    expect(parsed.vendorEmail).toBeNull()
    expect(parsed.subject).toBeNull()
    expect(parsed.quotationDate).toBeNull()
  })

  it('rejects a missing vendor name', () => {
    expect(() => vendorQuotationInputSchema.parse({ ...valid, vendorName: '' })).toThrow()
  })

  it('rejects an out-of-range tax rate', () => {
    expect(() => vendorQuotationInputSchema.parse({ ...valid, taxRateBps: 10_001 })).toThrow()
  })

  it('rejects an unknown status', () => {
    expect(() => vendorQuotationInputSchema.parse({ ...valid, status: 'accepted' })).toThrow()
  })
})
