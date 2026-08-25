import { describe, expect, it } from 'vitest'
import { computeProposalStats, PROPOSAL_STATUSES, quotationLinesTotalPaise } from './proposals'

describe('computeProposalStats', () => {
  const proposals = [
    { status: 'draft' as const, valuePaise: 100_000 },
    { status: 'sent' as const, valuePaise: 250_000 },
    { status: 'negotiation' as const, valuePaise: null },
    { status: 'accepted' as const, valuePaise: 500_000 },
    { status: 'rejected' as const, valuePaise: 999_000 },
  ]

  it('rolls up counts and values per status, treating null values as zero', () => {
    const stats = computeProposalStats(proposals)
    expect(stats.totalProposals).toBe(5)
    expect(stats.byStatus.sent).toEqual({ count: 1, valuePaise: 250_000 })
    expect(stats.byStatus.negotiation).toEqual({ count: 1, valuePaise: 0 })
    expect(stats.byStatus.cancelled).toEqual({ count: 0, valuePaise: 0 })
  })

  it('sums open value across undecided statuses only', () => {
    const stats = computeProposalStats(proposals)
    expect(stats.openValuePaise).toBe(350_000)
    expect(stats.acceptedValuePaise).toBe(500_000)
    expect(stats.totalValuePaise).toBe(1_849_000)
  })

  it('returns an all-zero rollup for an empty list', () => {
    const stats = computeProposalStats([])
    expect(stats.totalProposals).toBe(0)
    expect(stats.totalValuePaise).toBe(0)
    expect(Object.keys(stats.byStatus)).toHaveLength(PROPOSAL_STATUSES.length)
  })
})

describe('quotationLinesTotalPaise', () => {
  it('multiplies quantity by unit price and sums integer paise exactly', () => {
    const lines = [
      { quantity: 3, unitPricePaise: 12_345 },
      { quantity: 1, unitPricePaise: 500 },
      { quantity: 2, unitPricePaise: 0 },
    ]
    expect(quotationLinesTotalPaise(lines)).toBe(3 * 12_345 + 500)
  })

  it('returns zero for no lines', () => {
    expect(quotationLinesTotalPaise([])).toBe(0)
  })
})
