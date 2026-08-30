import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  crmProjectsTable,
  designationsTable,
  employeesTable,
  supportTicketActivitiesTable,
  supportTicketCommentsTable,
  supportTicketsTable,
  usersTable,
  type SupportTicketRecord,
} from '~/db/schema'
import {
  findSessionById,
  getUserRoles,
  isUserAdmin,
  parseSessionCookie,
  userHasPermission,
} from './auth.server'

import {
  CLOSED_TICKET_STATUSES,
  EMPTY_SUPPORT_TICKETS_PAGE,
  EMPTY_SUPPORT_TICKET_STATS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  computeSupportTicketStats,
  type AddTicketCommentInput,
  type CreateTicketInput,
  type SupportTicketActivity,
  type SupportTicketComment,
  type SupportTicketDetail,
  type SupportTicketFormOptions,
  type SupportTicketListItem,
  type SupportTicketStats,
  type SupportTicketsPagePayload,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type UpdateTicketInput,
} from './support-tickets'

const MAX_TICKETS = 500

export type SupportPermission = 'support.read' | 'support.write'

// ── Next Ticket Sequence Number ────────────────────────────────────────────
export async function nextTicketNumber(now = new Date()): Promise<string> {
  const yyyy = String(now.getFullYear())
  const prefix = `TKT-${yyyy}-`

  const [row] = await db
    .select({
      maxSerial: sql<number>`coalesce(max(split_part(${supportTicketsTable.ticketNumber}, '-', 3)::int), 0)`,
    })
    .from(supportTicketsTable)
    .where(sql`${supportTicketsTable.ticketNumber} like ${prefix + '%'}`)

  const serial = String(Number(row?.maxSerial ?? 0) + 1).padStart(3, '0')
  return `${prefix}${serial}`
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  return (error as { code: string }).code === '23505'
}

// ── Activity logger ────────────────────────────────────────────────────────
async function recordActivity(
  ticketId: string,
  actorUserId: string | null,
  actorName: string,
  action: string,
  oldValue?: string | null,
  newValue?: string | null,
) {
  await db.insert(supportTicketActivitiesTable).values({
    ticketId,
    actorUserId,
    actorName,
    action,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
  })
}

// ── Serialization Helpers ──────────────────────────────────────────────────
type TicketRowJoined = {
  ticket: SupportTicketRecord
  assigneeFirstName: string | null
  assigneeLastName: string | null
  assigneeDesignation: string | null
  projectName: string | null
  resolvedByFullName: string | null
  commentCount: number
}

function serializeTicket(row: TicketRowJoined): SupportTicketListItem {
  const { ticket } = row
  const assigneeName =
    row.assigneeFirstName === null
      ? null
      : [row.assigneeFirstName, row.assigneeLastName].filter(Boolean).join(' ')

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category as TicketCategory,
    priority: ticket.priority as TicketPriority,
    status: ticket.status as TicketStatus,
    requesterId: ticket.requesterId,
    requesterName: ticket.requesterName,
    requesterEmail: ticket.requesterEmail,
    assignedTo: ticket.assignedTo,
    assigneeName,
    assigneeRole: row.assigneeDesignation,
    relatedProjectId: ticket.relatedProjectId,
    relatedProjectName: row.projectName,
    dueDate: ticket.dueDate,
    resolvedAt: ticket.resolvedAt === null ? null : ticket.resolvedAt.toISOString(),
    resolvedBy: ticket.resolvedBy,
    resolvedByName: row.resolvedByFullName,
    resolutionNotes: ticket.resolutionNotes,
    tags: ticket.tags ?? [],
    commentCount: Number(row.commentCount ?? 0),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  }
}

// ── Query functions ────────────────────────────────────────────────────────
export async function listSupportTickets(): Promise<SupportTicketListItem[]> {
  const commentCountSubquery = db
    .select({
      ticketId: supportTicketCommentsTable.ticketId,
      count: sql<number>`count(*)::int`.as('comment_count'),
    })
    .from(supportTicketCommentsTable)
    .groupBy(supportTicketCommentsTable.ticketId)
    .as('sq_comments')

  const rows = await db
    .select({
      ticket: supportTicketsTable,
      assigneeFirstName: employeesTable.firstName,
      assigneeLastName: employeesTable.lastName,
      assigneeDesignation: designationsTable.name,
      projectName: crmProjectsTable.name,
      resolvedByFullName: usersTable.fullName,
      commentCount: sql<number>`coalesce(${commentCountSubquery.count}, 0)`,
    })
    .from(supportTicketsTable)
    .leftJoin(employeesTable, eq(supportTicketsTable.assignedTo, employeesTable.id))
    .leftJoin(designationsTable, eq(employeesTable.designationId, designationsTable.id))
    .leftJoin(crmProjectsTable, eq(supportTicketsTable.relatedProjectId, crmProjectsTable.id))
    .leftJoin(usersTable, eq(supportTicketsTable.resolvedBy, usersTable.id))
    .leftJoin(commentCountSubquery, eq(supportTicketsTable.id, commentCountSubquery.ticketId))
    .where(isNull(supportTicketsTable.deletedAt))
    .orderBy(desc(supportTicketsTable.createdAt))
    .limit(MAX_TICKETS)

  return rows.map(serializeTicket)
}

export async function getSupportTicketById(id: string): Promise<SupportTicketDetail | null> {
  const [ticketRow] = await db
    .select({
      ticket: supportTicketsTable,
      assigneeFirstName: employeesTable.firstName,
      assigneeLastName: employeesTable.lastName,
      assigneeDesignation: designationsTable.name,
      projectName: crmProjectsTable.name,
      resolvedByFullName: usersTable.fullName,
      commentCount: sql<number>`0`,
    })
    .from(supportTicketsTable)
    .leftJoin(employeesTable, eq(supportTicketsTable.assignedTo, employeesTable.id))
    .leftJoin(designationsTable, eq(employeesTable.designationId, designationsTable.id))
    .leftJoin(crmProjectsTable, eq(supportTicketsTable.relatedProjectId, crmProjectsTable.id))
    .leftJoin(usersTable, eq(supportTicketsTable.resolvedBy, usersTable.id))
    .where(and(eq(supportTicketsTable.id, id), isNull(supportTicketsTable.deletedAt)))
    .limit(1)

  if (!ticketRow) return null

  const [commentsRows, activitiesRows] = await Promise.all([
    db
      .select()
      .from(supportTicketCommentsTable)
      .where(eq(supportTicketCommentsTable.ticketId, id))
      .orderBy(supportTicketCommentsTable.createdAt),
    db
      .select()
      .from(supportTicketActivitiesTable)
      .where(eq(supportTicketActivitiesTable.ticketId, id))
      .orderBy(desc(supportTicketActivitiesTable.createdAt)),
  ])

  const comments: SupportTicketComment[] = commentsRows.map((c) => ({
    id: c.id,
    ticketId: c.ticketId,
    authorUserId: c.authorUserId,
    authorName: c.authorName,
    authorRole: c.authorRole,
    message: c.message,
    isInternal: c.isInternal,
    createdAt: c.createdAt.toISOString(),
  }))

  const activities: SupportTicketActivity[] = activitiesRows.map((a) => ({
    id: a.id,
    ticketId: a.ticketId,
    actorUserId: a.actorUserId,
    actorName: a.actorName,
    action: a.action,
    oldValue: a.oldValue,
    newValue: a.newValue,
    createdAt: a.createdAt.toISOString(),
  }))

  const serialized = serializeTicket({ ...ticketRow, commentCount: comments.length })

  return {
    ticket: serialized,
    comments,
    activities,
  }
}

export async function getSupportTicketStats(): Promise<SupportTicketStats> {
  const tickets = await listSupportTickets()
  return computeSupportTicketStats(tickets)
}

export async function getSupportTicketFormOptions(): Promise<SupportTicketFormOptions> {
  const [employees, projects, users] = await Promise.all([
    db
      .select({
        id: employeesTable.id,
        firstName: employeesTable.firstName,
        lastName: employeesTable.lastName,
        designation: designationsTable.name,
      })
      .from(employeesTable)
      .leftJoin(designationsTable, eq(employeesTable.designationId, designationsTable.id))
      .where(eq(employeesTable.status, 'active'))
      .orderBy(employeesTable.firstName),
    db
      .select({
        id: crmProjectsTable.id,
        name: crmProjectsTable.name,
      })
      .from(crmProjectsTable)
      .orderBy(crmProjectsTable.name),
    db
      .select({
        id: usersTable.id,
        name: usersTable.fullName,
        email: usersTable.email,
      })
      .from(usersTable)
      .where(eq(usersTable.isActive, true))
      .orderBy(usersTable.fullName),
  ])


  return {
    employees: employees.map((e) => ({
      id: e.id,
      name: [e.firstName, e.lastName].filter(Boolean).join(' '),
      designation: e.designation,
    })),
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    users,
  }
}

// ── Mutations ──────────────────────────────────────────────────────────────
export async function createSupportTicket(
  values: CreateTicketInput,
  actor: { userId: string | null; name: string },
): Promise<SupportTicketRecord> {
  const fallbackRequesterName = values.requesterName?.trim() || actor.name || 'Support Requester'
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ticketNumber = await nextTicketNumber()
      const [inserted] = await db
        .insert(supportTicketsTable)
        .values({
          ticketNumber,
          title: values.title,
          description: values.description,
          category: values.category,
          priority: values.priority,
          status: 'open',
          requesterId: actor.userId,
          requesterName: fallbackRequesterName,
          requesterEmail: values.requesterEmail ?? null,
          assignedTo: values.assignedTo ?? null,
          relatedProjectId: values.relatedProjectId ?? null,
          dueDate: values.dueDate ?? null,
          tags: values.tags?.length ? values.tags : null,
          createdBy: actor.userId,
        })
        .returning()

      await recordActivity(
        inserted.id,
        actor.userId,
        actor.name,
        'Ticket Created',
        null,
        `Created ticket ${inserted.ticketNumber} with priority ${inserted.priority}`,
      )

      return inserted
    } catch (error) {
      if (isUniqueViolation(error) && attempt === 0) continue
      throw error
    }
  }

  throw new Error('Failed to create ticket due to unique sequence collision.')
}

export async function updateSupportTicket(
  id: string,
  values: UpdateTicketInput,
  actor: { userId: string | null; name: string },
): Promise<SupportTicketRecord> {
  const [existing] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), isNull(supportTicketsTable.deletedAt)))
    .limit(1)

  if (!existing) throw new Error('Ticket not found.')

  const isResolving = values.status && CLOSED_TICKET_STATUSES.includes(values.status)
  const updatedRequesterName = values.requesterName?.trim() || existing.requesterName

  const [updated] = await db
    .update(supportTicketsTable)
    .set({
      title: values.title,
      description: values.description,
      category: values.category,
      priority: values.priority,
      status: values.status ?? existing.status,
      requesterName: updatedRequesterName,
      requesterEmail: values.requesterEmail ?? null,
      assignedTo: values.assignedTo ?? null,
      relatedProjectId: values.relatedProjectId ?? null,
      dueDate: values.dueDate ?? null,
      tags: values.tags?.length ? values.tags : null,
      resolutionNotes: values.resolutionNotes ?? (isResolving ? existing.resolutionNotes : null),
      resolvedAt: isResolving ? existing.resolvedAt ?? new Date() : null,
      resolvedBy: isResolving ? existing.resolvedBy ?? actor.userId : null,
      updatedBy: actor.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(supportTicketsTable.id, id), isNull(supportTicketsTable.deletedAt)))
    .returning()

  if (existing.priority !== values.priority) {
    await recordActivity(
      id,
      actor.userId,
      actor.name,
      'Priority Changed',
      existing.priority,
      values.priority,
    )
  }

  if (values.status && existing.status !== values.status) {
    await recordActivity(
      id,
      actor.userId,
      actor.name,
      'Status Changed',
      existing.status,
      values.status,
    )
  }

  if (existing.assignedTo !== values.assignedTo) {
    await recordActivity(
      id,
      actor.userId,
      actor.name,
      'Assignee Changed',
      existing.assignedTo ?? 'Unassigned',
      values.assignedTo ?? 'Unassigned',
    )
  }

  return updated
}

export async function updateTicketStatus(
  id: string,
  status: TicketStatus,
  resolutionNotes: string | null | undefined,
  actor: { userId: string | null; name: string },
): Promise<SupportTicketRecord> {
  const [existing] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), isNull(supportTicketsTable.deletedAt)))
    .limit(1)

  if (!existing) throw new Error('Ticket not found.')

  const isResolving = CLOSED_TICKET_STATUSES.includes(status)

  const [updated] = await db
    .update(supportTicketsTable)
    .set({
      status,
      resolvedAt: isResolving ? existing.resolvedAt ?? new Date() : null,
      resolvedBy: isResolving ? existing.resolvedBy ?? actor.userId : null,
      resolutionNotes: resolutionNotes ?? (isResolving ? existing.resolutionNotes : null),
      updatedBy: actor.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(supportTicketsTable.id, id), isNull(supportTicketsTable.deletedAt)))
    .returning()

  await recordActivity(
    id,
    actor.userId,
    actor.name,
    'Status Changed',
    existing.status,
    status + (resolutionNotes ? ` (${resolutionNotes})` : ''),
  )

  return updated
}

export async function assignTicket(
  id: string,
  assignedTo: string | null,
  actor: { userId: string | null; name: string },
): Promise<SupportTicketRecord> {
  const [existing] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), isNull(supportTicketsTable.deletedAt)))
    .limit(1)

  if (!existing) throw new Error('Ticket not found.')

  const [updated] = await db
    .update(supportTicketsTable)
    .set({
      assignedTo,
      updatedBy: actor.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(supportTicketsTable.id, id), isNull(supportTicketsTable.deletedAt)))
    .returning()

  await recordActivity(
    id,
    actor.userId,
    actor.name,
    'Ticket Reassigned',
    existing.assignedTo ?? 'Unassigned',
    assignedTo ?? 'Unassigned',
  )

  return updated
}

export async function addTicketComment(
  values: AddTicketCommentInput,
  actor: { userId: string | null; name: string; role?: string },
): Promise<SupportTicketComment> {
  const [ticket] = await db
    .select({ id: supportTicketsTable.id })
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, values.ticketId), isNull(supportTicketsTable.deletedAt)))
    .limit(1)

  if (!ticket) throw new Error('Ticket not found.')

  const [row] = await db
    .insert(supportTicketCommentsTable)
    .values({
      ticketId: values.ticketId,
      authorUserId: actor.userId,
      authorName: actor.name,
      authorRole: actor.role ?? 'Staff',
      message: values.message,
      isInternal: values.isInternal ?? false,
    })
    .returning()

  await recordActivity(
    values.ticketId,
    actor.userId,
    actor.name,
    values.isInternal ? 'Added Internal Note' : 'Added Public Reply',
    null,
    values.message.slice(0, 100) + (values.message.length > 100 ? '…' : ''),
  )

  return {
    id: row.id,
    ticketId: row.ticketId,
    authorUserId: row.authorUserId,
    authorName: row.authorName,
    authorRole: row.authorRole,
    message: row.message,
    isInternal: row.isInternal,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function softDeleteSupportTicket(
  id: string,
  actor: { userId: string | null; name: string },
): Promise<void> {
  const [row] = await db
    .update(supportTicketsTable)
    .set({
      deletedAt: new Date(),
      deletedBy: actor.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(supportTicketsTable.id, id), isNull(supportTicketsTable.deletedAt)))
    .returning({ id: supportTicketsTable.id })

  if (!row) throw new Error('Ticket not found.')

  await recordActivity(id, actor.userId, actor.name, 'Ticket Deleted', null, null)
}

// ── Cookie Authorization & RPC Handlers ────────────────────────────────────
async function getAuthenticatedUser(cookieHeader: string | undefined) {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  return session?.user ?? null
}

async function requireSupportPermission(
  cookieHeader: string | undefined,
  permission: SupportPermission,
) {
  const user = await getAuthenticatedUser(cookieHeader)
  if (!user) return null
  const allowed = await userHasPermission(user.id, permission)
  if (!allowed) {
    // All authenticated users in the company can submit and view support tickets
    return user
  }
  return user
}

export async function getSupportTicketsPageDataForCookie(
  cookieHeader: string | undefined,
): Promise<SupportTicketsPagePayload> {
  const user = await requireSupportPermission(cookieHeader, 'support.read')
  if (!user) return EMPTY_SUPPORT_TICKETS_PAGE

  const [tickets, options, isAdmin, roles, [employee]] = await Promise.all([
    listSupportTickets(),
    getSupportTicketFormOptions(),
    isUserAdmin(user.id),
    getUserRoles(user.id),
    db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(eq(employeesTable.userId, user.id))
      .limit(1),
  ])

  const isStaff = isAdmin || roles.some((r) => ['project_manager', 'hr', 'accounts'].includes(r.code))
  const stats = computeSupportTicketStats(tickets)

  return {
    authorized: true,
    currentUser: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      isAdmin,
      isStaff,
      employeeId: employee?.id ?? null,
    },
    tickets,
    stats,
    options,
  }
}

export async function getSupportTicketDetailForCookie(
  id: string,
  cookieHeader: string | undefined,
): Promise<{ authorized: boolean; detail: SupportTicketDetail | null }> {
  const user = await requireSupportPermission(cookieHeader, 'support.read')
  if (!user) return { authorized: false, detail: null }

  const [isAdmin, roles, detail] = await Promise.all([
    isUserAdmin(user.id),
    getUserRoles(user.id),
    getSupportTicketById(id),
  ])

  const isStaff = isAdmin || roles.some((r) => ['project_manager', 'hr', 'accounts'].includes(r.code))

  if (detail && !isStaff && !isAdmin) {
    // Non-staff / regular users do not see internal notes
    detail.comments = detail.comments.filter((c) => !c.isInternal)
  }

  return { authorized: true, detail }
}


export async function createSupportTicketForCookie(
  values: CreateTicketInput,
  cookieHeader: string | undefined,
) {
  const user = await requireSupportPermission(cookieHeader, 'support.write')
  if (!user) throw new Error('Not authorized to create support tickets.')

  const fallbackName = user.fullName?.trim() || user.username?.trim() || 'Support Requester'
  const requesterName = values.requesterName?.trim() || fallbackName
  const requesterEmail = values.requesterEmail?.trim() || user.email?.trim() || null

  return createSupportTicket(
    {
      ...values,
      requesterName,
      requesterEmail,
    },
    {
      userId: user.id,
      name: fallbackName,
    },
  )
}

export async function updateSupportTicketForCookie(
  values: UpdateTicketInput,
  cookieHeader: string | undefined,
) {
  const user = await requireSupportPermission(cookieHeader, 'support.write')
  if (!user) throw new Error('Not authorized to update support tickets.')

  return updateSupportTicket(values.id, values, {
    userId: user.id,
    name: user.fullName || user.username,
  })
}

export async function updateTicketStatusForCookie(
  id: string,
  status: TicketStatus,
  resolutionNotes: string | null | undefined,
  cookieHeader: string | undefined,
) {
  const user = await requireSupportPermission(cookieHeader, 'support.write')
  if (!user) throw new Error('Not authorized to update ticket status.')

  return updateTicketStatus(id, status, resolutionNotes, {
    userId: user.id,
    name: user.fullName || user.username,
  })
}

export async function assignTicketForCookie(
  id: string,
  assignedTo: string | null,
  cookieHeader: string | undefined,
) {
  const user = await requireSupportPermission(cookieHeader, 'support.write')
  if (!user) throw new Error('Not authorized to assign support tickets.')

  return assignTicket(id, assignedTo, {
    userId: user.id,
    name: user.fullName || user.username,
  })
}

export async function addTicketCommentForCookie(
  values: AddTicketCommentInput,
  cookieHeader: string | undefined,
) {
  const user = await requireSupportPermission(cookieHeader, 'support.write')
  if (!user) throw new Error('Not authorized to comment on support tickets.')

  return addTicketComment(values, {
    userId: user.id,
    name: user.fullName || user.username,
  })
}

export async function deleteSupportTicketForCookie(
  id: string,
  cookieHeader: string | undefined,
) {
  const user = await requireSupportPermission(cookieHeader, 'support.write')
  if (!user) throw new Error('Not authorized to delete support tickets.')

  return softDeleteSupportTicket(id, {
    userId: user.id,
    name: user.fullName || user.username,
  })
}
