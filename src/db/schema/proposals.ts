import { bigint, check, date, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { leadPriorityEnum, proposalContractTypeEnum, proposalStatusEnum } from './enums'
import { leadsTable } from './crm'
import { usersTable } from './auth'
import { companiesTable } from './masters/company'
import { softwareMastersTable } from './masters/software'

/**
 * Commercial proposals. The old CRM kept ~60 columns (many JSON-encoded lists)
 * in one MySQL table; here the main row holds scalar facts and every list lives
 * in a proper child table ordered by `position`.
 */
export const proposalsTable = pgTable(
  'proposals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Human reference in the format P-NNN-MM-YYYY (serial-month-year), e.g. P-001-08-2026.
    proposalNumber: varchar('proposal_number', { length: 24 }).notNull().unique(),
    // Provenance — the lead this proposal was converted from, if any.
    leadId: uuid('lead_id').references(() => leadsTable.id, { onDelete: 'set null' }),
    companyId: uuid('company_id').references(() => companiesTable.id, { onDelete: 'set null' }),
    // Denormalized display/search name — proposals may exist before a company master record.
    companyName: varchar('company_name', { length: 255 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),

    status: proposalStatusEnum('status').notNull().default('draft'),
    priority: leadPriorityEnum('priority').notNull().default('medium'),
    contractType: proposalContractTypeEnum('contract_type').notNull().default('lumpsum'),

    // Quoted value in paise. Recomputed from quotation lines whenever those are
    // saved; line-less proposals keep whatever value was entered manually.
    valuePaise: bigint('value_paise', { mode: 'number' }),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),

    // Client contact snapshot taken when the proposal is created from a lead.
    contactName: varchar('contact_name', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 20 }),
    designation: varchar('designation', { length: 100 }),

    city: varchar('city', { length: 100 }),
    siteLocation: varchar('site_location', { length: 255 }),

    scopeOfWork: text('scope_of_work'),

    plannedStartDate: date('planned_start_date'),
    plannedEndDate: date('planned_end_date'),
    dueDate: date('due_date'),

    modeOfDelivery: varchar('mode_of_delivery', { length: 100 }),
    revisionsIncluded: integer('revisions_included').notNull().default(1),
    siteVisits: integer('site_visits').notNull().default(0),
    siteVisitNotes: text('site_visit_notes'),
    // How many days from creation the quoted prices hold.
    validityDays: integer('validity_days'),

    // Commercials — cost side feeds the margin estimate (value side is valuePaise).
    estimatedCostPaise: bigint('estimated_cost_paise', { mode: 'number' }),
    commercialNotes: text('commercial_notes'),

    paymentTerms: text('payment_terms'),
    otherTerms: text('other_terms'),

    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => usersTable.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_proposals_status').on(table.status),
    index('idx_proposals_company').on(table.companyId),
    index('idx_proposals_lead').on(table.leadId),
    // Hot path: the list page only ever reads live proposals, newest first.
    index('idx_proposals_active_created').on(table.createdAt).where(sql`deleted_at is null`),
    check('chk_proposals_value_nonnegative', sql`${table.valuePaise} >= 0`),
    check('chk_proposals_cost_nonnegative', sql`${table.estimatedCostPaise} >= 0`),
  ],
)

export const proposalInputDocumentsTable = pgTable(
  'proposal_input_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposalsTable.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 500 }).notNull(),
    position: integer('position').notNull().default(0),
  },
  (table) => [index('idx_proposal_input_docs_proposal').on(table.proposalId, table.position)],
)

export const proposalDeliverablesTable = pgTable(
  'proposal_deliverables',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposalsTable.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 500 }).notNull(),
    position: integer('position').notNull().default(0),
  },
  (table) => [index('idx_proposal_deliverables_proposal').on(table.proposalId, table.position)],
)

export const proposalSoftwareTable = pgTable(
  'proposal_software',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposalsTable.id, { onDelete: 'cascade' }),
    // Optional link to the software master; name is snapshotted so the quote
    // stays historically accurate even if the master entry changes.
    softwareId: uuid('software_id').references(() => softwareMastersTable.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    notes: varchar('notes', { length: 500 }),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('idx_proposal_software_proposal').on(table.proposalId, table.position),
    index('idx_proposal_software_master').on(table.softwareId),
  ],
)

export const proposalExclusionsTable = pgTable(
  'proposal_exclusions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposalsTable.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 500 }).notNull(),
    position: integer('position').notNull().default(0),
  },
  (table) => [index('idx_proposal_exclusions_proposal').on(table.proposalId, table.position)],
)

export const clientQuotationLinesTable = pgTable(
  'client_quotation_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposalsTable.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull().default(0),
    // quantity * unitPricePaise, computed server-side on every save.
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull().default(0),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('idx_proposal_quote_lines_proposal').on(table.proposalId, table.position),
    check('chk_proposal_quote_qty_positive', sql`${table.quantity} > 0`),
    check('chk_proposal_quote_prices_nonnegative', sql`${table.unitPricePaise} >= 0 and ${table.amountPaise} >= 0`),
  ],
)

export const proposalFollowUpsTable = pgTable(
  'proposal_follow_ups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposalsTable.id, { onDelete: 'cascade' }),
    dueDate: date('due_date').notNull(),
    note: text('note').notNull(),
    doneAt: timestamp('done_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_proposal_follow_ups_proposal').on(table.proposalId, table.dueDate)],
)

/** Append-only discussion thread on a proposal. */
export const proposalCommentsTable = pgTable(
  'proposal_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposalsTable.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => usersTable.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_proposal_comments_proposal').on(table.proposalId, table.createdAt)],
)

/** Append-only audit trail of status transitions (mirrors lead_stage_history). */
export const proposalStatusHistoryTable = pgTable(
  'proposal_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposalsTable.id, { onDelete: 'cascade' }),
    fromStatus: proposalStatusEnum('from_status'),
    toStatus: proposalStatusEnum('to_status').notNull(),
    note: text('note'),
    changedBy: uuid('changed_by').references(() => usersTable.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_proposal_status_history_proposal').on(table.proposalId, table.changedAt)],
)

export type ProposalRecord = typeof proposalsTable.$inferSelect
export type NewProposalRecord = typeof proposalsTable.$inferInsert
export type ClientQuotationLineRecord = typeof clientQuotationLinesTable.$inferSelect
/** @deprecated use ClientQuotationLineRecord */
export type ProposalQuotationLineRecord = ClientQuotationLineRecord
export type ProposalFollowUpRecord = typeof proposalFollowUpsTable.$inferSelect
export type ProposalCommentRecord = typeof proposalCommentsTable.$inferSelect

// ── Backward compat: old variable name → new client name ──
// TEMP removed for drizzle generate — deprecated alias
// export const proposalQuotationLinesTable = clientQuotationLinesTable
