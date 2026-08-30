import { z } from 'zod'

// ── Vocabularies & Labels ──────────────────────────────────────────────────
export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'waiting_on_user',
  'resolved',
  'closed',
] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_user: 'Waiting on User',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = [
  'open',
  'in_progress',
  'waiting_on_user',
]

export const CLOSED_TICKET_STATUSES: readonly TicketStatus[] = ['resolved', 'closed']

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const TICKET_CATEGORIES = [
  'it_support',
  'software_license',
  'hardware',
  'admin',
  'hr',
  'billing',
  'access_request',
  'other',
] as const

export type TicketCategory = (typeof TICKET_CATEGORIES)[number]

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  it_support: 'IT Support',
  software_license: 'Software License',
  hardware: 'Hardware & Devices',
  admin: 'Administration',
  hr: 'HR & Facilities',
  billing: 'Billing & Invoicing',
  access_request: 'Access & Permissions',
  other: 'General Inquiry',
}

// ── Badge & Styling Helpers ───────────────────────────────────────────────
export const TICKET_STATUS_BADGES: Record<TicketStatus, string> = {
  open: 'badge-cyan',
  in_progress: 'badge-purple',
  waiting_on_user: 'badge-warning',
  resolved: 'badge-success',
  closed: 'badge-neutral',
}

export const TICKET_PRIORITY_BADGES: Record<TicketPriority, string> = {
  low: 'badge-neutral',
  medium: 'badge-warning',
  high: 'badge-danger',
  urgent: 'badge-danger font-bold',
}

export const TICKET_CATEGORY_COLORS: Record<TicketCategory, string> = {
  it_support: '#3B82F6',
  software_license: '#8B5CF6',
  hardware: '#EC4899',
  admin: '#64748B',
  hr: '#10B981',
  billing: '#F59E0B',
  access_request: '#6366F1',
  other: '#6B7280',
}

// ── Serialized Types ───────────────────────────────────────────────────────
export type SupportTicketListItem = {
  id: string
  ticketNumber: string
  title: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  requesterId: string | null
  requesterName: string
  requesterEmail: string | null
  assignedTo: string | null
  assigneeName: string | null
  assigneeRole: string | null
  relatedProjectId: string | null
  relatedProjectName: string | null
  dueDate: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  resolvedByName: string | null
  resolutionNotes: string | null
  tags: string[]
  commentCount: number
  createdAt: string
  updatedAt: string
}

export type SupportTicketComment = {
  id: string
  ticketId: string
  authorUserId: string | null
  authorName: string
  authorRole: string
  message: string
  isInternal: boolean
  createdAt: string
}

export type SupportTicketActivity = {
  id: string
  ticketId: string
  actorUserId: string | null
  actorName: string
  action: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export type SupportTicketDetail = {
  ticket: SupportTicketListItem
  comments: SupportTicketComment[]
  activities: SupportTicketActivity[]
}

export type SupportTicketStats = {
  total: number
  open: number
  inProgress: number
  waiting: number
  resolved: number
  closed: number
  urgentOrHigh: number
  overdue: number
  byCategory: Record<TicketCategory, number>
  byPriority: Record<TicketPriority, number>
  byStatus: Record<TicketStatus, number>
}

export type SupportTicketFormOptions = {
  employees: { id: string; name: string; designation: string | null }[]
  projects: { id: string; name: string }[]
  users: { id: string; name: string; email: string }[]
}

export type SupportCurrentUser = {
  id: string
  fullName: string
  email: string
  username: string
  isAdmin: boolean
  isStaff: boolean
  employeeId?: string | null
}

export type SupportTicketsPagePayload = {
  authorized: boolean
  currentUser?: SupportCurrentUser | null
  tickets: SupportTicketListItem[]
  stats: SupportTicketStats
  options: SupportTicketFormOptions
}

export const EMPTY_SUPPORT_TICKET_STATS: SupportTicketStats = {
  total: 0,
  open: 0,
  inProgress: 0,
  waiting: 0,
  resolved: 0,
  closed: 0,
  urgentOrHigh: 0,
  overdue: 0,
  byCategory: Object.fromEntries(TICKET_CATEGORIES.map((c) => [c, 0])) as Record<TicketCategory, number>,
  byPriority: Object.fromEntries(TICKET_PRIORITIES.map((p) => [p, 0])) as Record<TicketPriority, number>,
  byStatus: Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<TicketStatus, number>,
}

export const EMPTY_SUPPORT_TICKETS_PAGE: SupportTicketsPagePayload = {
  authorized: false,
  currentUser: null,
  tickets: [],
  stats: EMPTY_SUPPORT_TICKET_STATS,
  options: { employees: [], projects: [], users: [] },
}


export function isTicketOverdue(
  dueDate: string | null,
  status: TicketStatus,
  now = new Date(),
): boolean {
  if (!dueDate || CLOSED_TICKET_STATUSES.includes(status)) return false
  const due = new Date(dueDate)
  due.setHours(23, 59, 59, 999)
  return due.getTime() < now.getTime()
}

export function computeSupportTicketStats(
  tickets: readonly {
    status: TicketStatus
    priority: TicketPriority
    category: TicketCategory
    dueDate: string | null
  }[],
  now = new Date(),
): SupportTicketStats {
  const stats: SupportTicketStats = {
    total: tickets.length,
    open: 0,
    inProgress: 0,
    waiting: 0,
    resolved: 0,
    closed: 0,
    urgentOrHigh: 0,
    overdue: 0,
    byCategory: Object.fromEntries(TICKET_CATEGORIES.map((c) => [c, 0])) as Record<TicketCategory, number>,
    byPriority: Object.fromEntries(TICKET_PRIORITIES.map((p) => [p, 0])) as Record<TicketPriority, number>,
    byStatus: Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<TicketStatus, number>,
  }

  for (const t of tickets) {
    stats.byStatus[t.status] = (stats.byStatus[t.status] ?? 0) + 1
    stats.byPriority[t.priority] = (stats.byPriority[t.priority] ?? 0) + 1
    stats.byCategory[t.category] = (stats.byCategory[t.category] ?? 0) + 1

    if (t.status === 'open') stats.open += 1
    if (t.status === 'in_progress') stats.inProgress += 1
    if (t.status === 'waiting_on_user') stats.waiting += 1
    if (t.status === 'resolved') stats.resolved += 1
    if (t.status === 'closed') stats.closed += 1

    if (t.priority === 'urgent' || t.priority === 'high') {
      stats.urgentOrHigh += 1
    }

    if (isTicketOverdue(t.dueDate, t.status, now)) {
      stats.overdue += 1
    }
  }

  return stats
}

// ── Validators (Zod) ───────────────────────────────────────────────────────
const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

const optionalEmail = z.preprocess(emptyToNull, z.string().trim().max(255).email().nullable())
const optionalShortText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable())
const optionalDate = z.preprocess(emptyToNull, z.string().date().nullable())

export const createTicketSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(255),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(10000),
  category: z.enum(TICKET_CATEGORIES).default('it_support'),
  priority: z.enum(TICKET_PRIORITIES).default('medium'),
  requesterName: z.preprocess(emptyToNull, z.string().trim().max(255).nullable()).optional(),
  requesterEmail: optionalEmail.optional(),
  assignedTo: z.preprocess(emptyToNull, z.string().uuid().nullable()).optional(),
  relatedProjectId: optionalShortText(80).optional(),
  dueDate: optionalDate.optional(),
  tags: z.array(z.string().trim().max(50)).max(10).optional(),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>

export const updateTicketSchema = createTicketSchema.extend({
  id: z.string().uuid(),
  status: z.enum(TICKET_STATUSES).optional(),
  resolutionNotes: optionalShortText(5000).optional(),
})

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>

export const updateTicketStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(TICKET_STATUSES),
  resolutionNotes: optionalShortText(5000).optional(),
})

export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>

export const assignTicketSchema = z.object({
  id: z.string().uuid(),
  assignedTo: z.preprocess(emptyToNull, z.string().uuid().nullable()),
})

export type AssignTicketInput = z.infer<typeof assignTicketSchema>

export const addTicketCommentSchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().trim().min(1, 'Comment message is required').max(5000),
  isInternal: z.boolean().default(false),
})

export type AddTicketCommentInput = z.infer<typeof addTicketCommentSchema>

export const deleteTicketSchema = z.object({
  id: z.string().uuid(),
})
