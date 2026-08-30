import { describe, expect, it } from 'vitest'
import {
  addTicketCommentSchema,
  computeSupportTicketStats,
  createTicketSchema,
  isTicketOverdue,
  updateTicketSchema,
  updateTicketStatusSchema,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from './support-tickets'

describe('computeSupportTicketStats', () => {
  it('returns zeroed stats when ticket list is empty', () => {
    const stats = computeSupportTicketStats([])
    expect(stats.total).toBe(0)
    expect(stats.open).toBe(0)
    expect(stats.inProgress).toBe(0)
    expect(stats.waiting).toBe(0)
    expect(stats.resolved).toBe(0)
    expect(stats.closed).toBe(0)
    expect(stats.urgentOrHigh).toBe(0)
    expect(stats.overdue).toBe(0)
  })

  it('accurately aggregates status, priority, and category counts', () => {
    const fixedNow = new Date('2026-08-30T12:00:00Z')
    const sampleTickets: {
      status: TicketStatus
      priority: TicketPriority
      category: TicketCategory
      dueDate: string | null
    }[] = [
      { status: 'open', priority: 'urgent', category: 'it_support', dueDate: '2026-08-25' }, // overdue & urgent
      { status: 'open', priority: 'high', category: 'software_license', dueDate: '2026-09-05' }, // high
      { status: 'in_progress', priority: 'medium', category: 'hardware', dueDate: '2026-08-28' }, // overdue
      { status: 'waiting_on_user', priority: 'low', category: 'admin', dueDate: null },
      { status: 'resolved', priority: 'high', category: 'billing', dueDate: '2026-08-20' }, // resolved, not overdue
      { status: 'closed', priority: 'low', category: 'other', dueDate: null },
    ]

    const stats = computeSupportTicketStats(sampleTickets, fixedNow)

    expect(stats.total).toBe(6)
    expect(stats.open).toBe(2)
    expect(stats.inProgress).toBe(1)
    expect(stats.waiting).toBe(1)
    expect(stats.resolved).toBe(1)
    expect(stats.closed).toBe(1)
    expect(stats.urgentOrHigh).toBe(3) // 1 urgent, 2 high
    expect(stats.overdue).toBe(2) // 2 open/in_progress before 2026-08-30
    expect(stats.byCategory.it_support).toBe(1)
    expect(stats.byCategory.software_license).toBe(1)
    expect(stats.byCategory.hardware).toBe(1)
    expect(stats.byPriority.urgent).toBe(1)
    expect(stats.byPriority.high).toBe(2)
  })
})

describe('isTicketOverdue', () => {
  const fixedNow = new Date('2026-08-30T12:00:00Z')

  it('returns false for null due date', () => {
    expect(isTicketOverdue(null, 'open', fixedNow)).toBe(false)
  })

  it('returns false for resolved or closed tickets even if past due', () => {
    expect(isTicketOverdue('2026-08-20', 'resolved', fixedNow)).toBe(false)
    expect(isTicketOverdue('2026-08-20', 'closed', fixedNow)).toBe(false)
  })

  it('returns true for past due open/in-progress tickets', () => {
    expect(isTicketOverdue('2026-08-25', 'open', fixedNow)).toBe(true)
    expect(isTicketOverdue('2026-08-29', 'in_progress', fixedNow)).toBe(true)
    expect(isTicketOverdue('2026-08-29', 'waiting_on_user', fixedNow)).toBe(true)
  })

  it('returns false for future due dates', () => {
    expect(isTicketOverdue('2026-09-10', 'open', fixedNow)).toBe(false)
  })
})

describe('createTicketSchema validator', () => {
  it('validates a valid ticket payload and applies default values', () => {
    const result = createTicketSchema.safeParse({
      title: 'AutoCAD license expired',
      description: 'The license for civil workstation 04 threw an activation error.',
      requesterName: 'Ahmed Al-Rashidi',
      category: 'software_license',
      priority: 'high',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBe('software_license')
      expect(result.data.priority).toBe('high')
      expect(result.data.title).toBe('AutoCAD license expired')
    }
  })

  it('fails when title or description is too short', () => {
    const result = createTicketSchema.safeParse({
      title: 'Hi',
      description: 'Bad',
      requesterName: 'Sara',
    })

    expect(result.success).toBe(false)
  })

  it('accepts optional tags and due date', () => {
    const result = createTicketSchema.safeParse({
      title: 'VPN Connection issue',
      description: 'Unable to access corporate network via WireGuard.',
      requesterName: 'Omar Hassan',
      dueDate: '2026-09-01',
      tags: ['network', 'vpn', 'remote'],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dueDate).toBe('2026-09-01')
      expect(result.data.tags).toEqual(['network', 'vpn', 'remote'])
    }
  })
})

describe('updateTicketStatusSchema validator', () => {
  it('validates status updates with optional resolution notes', () => {
    const valid = updateTicketStatusSchema.safeParse({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      status: 'resolved',
      resolutionNotes: 'Assigned new license key and tested activation.',
    })

    expect(valid.success).toBe(true)
  })

  it('rejects invalid uuid or invalid status', () => {
    const invalid = updateTicketStatusSchema.safeParse({
      id: 'invalid-id',
      status: 'non_existent_status',
    })

    expect(invalid.success).toBe(false)
  })
})

describe('addTicketCommentSchema validator', () => {
  it('validates comments and internal note flags', () => {
    const result = addTicketCommentSchema.safeParse({
      ticketId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      message: 'License key ordered from vendor, ETA 2 hours.',
      isInternal: true,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isInternal).toBe(true)
    }
  })

  it('rejects empty message', () => {
    const result = addTicketCommentSchema.safeParse({
      ticketId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      message: '   ',
    })

    expect(result.success).toBe(false)
  })
})
