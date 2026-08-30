import { boolean, date, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { ticketCategoryEnum, ticketPriorityEnum, ticketStatusEnum } from './enums'
import { usersTable } from './auth'
import { employeesTable } from './employees'
import { crmProjectsTable } from './crm'

export const supportTicketsTable = pgTable(
  'support_tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Human reference format: TKT-YYYY-NNN (e.g. TKT-2026-001)
    ticketNumber: varchar('ticket_number', { length: 20 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    category: ticketCategoryEnum('category').notNull().default('it_support'),
    priority: ticketPriorityEnum('priority').notNull().default('medium'),
    status: ticketStatusEnum('status').notNull().default('open'),
    requesterId: uuid('requester_id').references(() => usersTable.id, { onDelete: 'set null' }),
    requesterName: varchar('requester_name', { length: 255 }).notNull(),
    requesterEmail: varchar('requester_email', { length: 255 }),
    assignedTo: uuid('assigned_to').references(() => employeesTable.id, { onDelete: 'set null' }),
    relatedProjectId: varchar('related_project_id', { length: 80 }).references(() => crmProjectsTable.id, {
      onDelete: 'set null',
    }),
    dueDate: date('due_date'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => usersTable.id, { onDelete: 'set null' }),
    resolutionNotes: text('resolution_notes'),
    tags: text('tags').array(),
    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => usersTable.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_support_tickets_status').on(table.status),
    index('idx_support_tickets_priority').on(table.priority),
    index('idx_support_tickets_category').on(table.category),
    index('idx_support_tickets_assigned_to').on(table.assignedTo),
    index('idx_support_tickets_requester_id').on(table.requesterId),
    index('idx_support_tickets_created_at').on(table.createdAt),
  ],
)

export const supportTicketCommentsTable = pgTable(
  'support_ticket_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTicketsTable.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').references(() => usersTable.id, { onDelete: 'set null' }),
    authorName: varchar('author_name', { length: 255 }).notNull(),
    authorRole: varchar('author_role', { length: 50 }).notNull().default('staff'),
    message: text('message').notNull(),
    isInternal: boolean('is_internal').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_ticket_comments_ticket_id').on(table.ticketId, table.createdAt)],
)

export const supportTicketActivitiesTable = pgTable(
  'support_ticket_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTicketsTable.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => usersTable.id, { onDelete: 'set null' }),
    actorName: varchar('actor_name', { length: 255 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_ticket_activities_ticket_id').on(table.ticketId, table.createdAt)],
)

export type SupportTicketRecord = typeof supportTicketsTable.$inferSelect
export type NewSupportTicketRecord = typeof supportTicketsTable.$inferInsert
export type SupportTicketCommentRecord = typeof supportTicketCommentsTable.$inferSelect
export type NewSupportTicketCommentRecord = typeof supportTicketCommentsTable.$inferInsert
export type SupportTicketActivityRecord = typeof supportTicketActivitiesTable.$inferSelect
export type NewSupportTicketActivityRecord = typeof supportTicketActivitiesTable.$inferInsert
