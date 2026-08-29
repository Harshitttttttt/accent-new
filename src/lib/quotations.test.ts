import { describe, expect, it } from 'vitest'
import {
  computeClientQuotationStats,
  computeClientQuotationTotals,
  htmlToPlainText,
  CLIENT_QUOTATION_GST_RATE_PCT,
} from './quotations'

describe('computeClientQuotationStats', () => {
  it('rolls up counts and values across the pipeline', () => {
    const stats = computeClientQuotationStats([
      { status: 'draft', valuePaise: 100_00 },
      { status: 'sent', valuePaise: 200_00 },
      { status: 'negotiation', valuePaise: 400_00 },
      { status: 'accepted', valuePaise: 800_00 },
      { status: 'rejected', valuePaise: 1600_00 },
      { status: 'cancelled', valuePaise: null },
    ])

    expect(stats.totalCount).toBe(6)
    expect(stats.draftCount).toBe(1)
    expect(stats.sentCount).toBe(1)
    expect(stats.acceptedCount).toBe(1)
    expect(stats.rejectedCount).toBe(1)
    // Open = draft + internal_review + sent + negotiation.
    expect(stats.openValuePaise).toBe(100_00 + 200_00 + 400_00)
    expect(stats.acceptedValuePaise).toBe(800_00)
  })

  it('returns zeros for an empty list', () => {
    expect(computeClientQuotationStats([])).toEqual({
      totalCount: 0,
      draftCount: 0,
      sentCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      openValuePaise: 0,
      acceptedValuePaise: 0,
    })
  })
})

describe('computeClientQuotationTotals', () => {
  it('sums line amounts and applies GST at the statutory default', () => {
    const totals = computeClientQuotationTotals({
      lines: [
        { quantity: 2, unitPricePaise: 500_00 },
        { quantity: 1, unitPricePaise: 1_000_00 },
      ],
      valuePaise: null,
    })

    expect(totals.subtotalPaise).toBe(2_000_00)
    expect(totals.gstPaise).toBe(Math.round((2_000_00 * CLIENT_QUOTATION_GST_RATE_PCT) / 100))
    expect(totals.totalPaise).toBe(totals.subtotalPaise + totals.gstPaise)
  })

  it('falls back to the manual value when there are no lines', () => {
    const totals = computeClientQuotationTotals({ lines: [], valuePaise: 5_000_00 })
    expect(totals.subtotalPaise).toBe(5_000_00)
    expect(totals.gstPaise).toBe(Math.round((5_000_00 * CLIENT_QUOTATION_GST_RATE_PCT) / 100))
  })

  it('rounds GST HALF_UP into whole paise exactly once', () => {
    // Subtotal ₹999.99 → GST 18% = ₹179.9982 → 17_999.82 paise → 18_000 paise.
    const totals = computeClientQuotationTotals({ lines: [{ quantity: 1, unitPricePaise: 99_999 }], valuePaise: null })
    expect(totals.gstPaise).toBe(18_000)
    expect(totals.totalPaise).toBe(99_999 + 18_000)
  })

  it('treats a missing manual value as zero', () => {
    const totals = computeClientQuotationTotals({ lines: [], valuePaise: null })
    expect(totals.subtotalPaise).toBe(0)
    expect(totals.gstPaise).toBe(0)
    expect(totals.totalPaise).toBe(0)
  })
})

describe('htmlToPlainText', () => {
  it('converts block structure to newlines and list items to bullets', () => {
    expect(
      htmlToPlainText('<h2>Scope</h2><p>First para</p><p>Second para</p><ul><li>Alpha</li><li>Beta</li></ul>'),
    ).toBe('Scope\nFirst para\nSecond para\n• Alpha\n• Beta')
  })

  it('decodes editor entities and drops tags without leaving tag soup', () => {
    expect(htmlToPlainText('<p>GST &amp; TDS &lt;18%&gt;&nbsp;extra</p>')).toBe('GST & TDS <18%> extra')
  })

  it('removes script/style content entirely', () => {
    expect(htmlToPlainText('<script>alert(1)</script><p>Safe</p>')).toBe('Safe')
  })

  it('returns an empty string for empty input', () => {
    expect(htmlToPlainText('')).toBe('')
  })
})
