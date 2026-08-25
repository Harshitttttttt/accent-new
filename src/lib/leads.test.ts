import { describe, expect, it } from 'vitest'
import { computeLeadStats, LEAD_STAGES } from './leads'

describe('computeLeadStats', () => {
  const leads = [
    { stage: 'prospecting' as const, valuePaise: 100_000 },
    { stage: 'prospecting' as const, valuePaise: null },
    { stage: 'qualified' as const, valuePaise: 250_000 },
    { stage: 'negotiation' as const, valuePaise: 400_000 },
    { stage: 'closed_won' as const, valuePaise: 500_000 },
    { stage: 'closed_lost' as const, valuePaise: 999_000 },
  ]

  it('rolls up counts and values per stage, treating null values as zero', () => {
    const stats = computeLeadStats(leads)
    expect(stats.totalLeads).toBe(6)
    expect(stats.byStage.prospecting).toEqual({ count: 2, valuePaise: 100_000 })
    expect(stats.byStage.closed_won).toEqual({ count: 1, valuePaise: 500_000 })
    expect(stats.byStage.proposal_sent).toEqual({ count: 0, valuePaise: 0 })
  })

  it('sums open pipeline across open stages only', () => {
    expect(computeLeadStats(leads).openPipelinePaise).toBe(750_000)
  })

  it('counts won value from closed_won only', () => {
    expect(computeLeadStats(leads).wonValuePaise).toBe(500_000)
  })

  it('returns an all-zero rollup for an empty list', () => {
    const stats = computeLeadStats([])
    expect(stats.totalLeads).toBe(0)
    expect(stats.openPipelinePaise).toBe(0)
    expect(stats.wonValuePaise).toBe(0)
    expect(Object.keys(stats.byStage)).toHaveLength(LEAD_STAGES.length)
  })
})
