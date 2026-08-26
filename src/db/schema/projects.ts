import { bigint, check, date, index, integer, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  assignmentPriorityEnum,
  assignmentStatusEnum,
  leadPriorityEnum,
  milestoneStatusEnum,
  projectLifecycleEnum,
  proposalContractTypeEnum,
  riskSeverityEnum,
  riskStatusEnum,
} from './enums'
import { leadsTable } from './crm'
import { proposalsTable } from './proposals'
import { usersTable } from './auth'
import { employeesTable } from './employees'
import { companiesTable } from './masters/company'
import { softwareMastersTable } from './masters/software'
import { disciplineActivitiesTable, disciplineSubActivitiesTable, disciplinesTable } from './masters/discipline'

/**
 * Delivery projects. A project is typically created by converting an accepted
 * proposal (`proposalId` provenance, mirroring `leadId` on proposals). The old
 * CRM kept everything in one wide table with JSON-encoded lists; here scalar
 * facts live on the main row and every managing area is a child table.
 *
 * Note: `crm_projects` (schema/crm.ts) is the legacy mock feed powering the
 * dashboard activity widgets — unrelated to this table.
 */
export const projectsTable = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Human reference PRJ-NNN-MM-YYYY (serial-month-year), e.g. PRJ-001-08-2026.
    projectNumber: varchar('project_number', { length: 27 }).notNull().unique(),
    // Provenance chain: lead → proposal → project.
    proposalId: uuid('proposal_id').references(() => proposalsTable.id, { onDelete: 'set null' }),
    leadId: uuid('lead_id').references(() => leadsTable.id, { onDelete: 'set null' }),
    companyId: uuid('company_id').references(() => companiesTable.id, { onDelete: 'set null' }),
    // Denormalized display/search name — projects may exist before a company master record.
    companyName: varchar('company_name', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    status: projectLifecycleEnum('status').notNull().default('planning'),
    priority: leadPriorityEnum('priority').notNull().default('medium'),
    contractType: proposalContractTypeEnum('contract_type').notNull().default('lumpsum'),
    // 0–100, manually updated from the Overview tab.
    progress: integer('progress').notNull().default(0),

    // Commercial anchors carried from the proposal.
    contractValuePaise: bigint('contract_value_paise', { mode: 'number' }),
    estimatedCostPaise: bigint('estimated_cost_paise', { mode: 'number' }),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),

    // Client contact snapshot.
    contactName: varchar('contact_name', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 20 }),
    designation: varchar('designation', { length: 100 }),

    city: varchar('city', { length: 100 }),
    siteLocation: varchar('site_location', { length: 255 }),

    // Scope of work carried from the proposal at conversion.
    scopeOfWork: text('scope_of_work'),

    startDate: date('start_date'),
    endDate: date('end_date'),
    kickoffMeetingDate: date('kickoff_meeting_date'),
    modeOfDelivery: varchar('mode_of_delivery', { length: 100 }),

    paymentTerms: text('payment_terms'),
    otherTerms: text('other_terms'),
    notes: text('notes'),

    // Accountable owner (delivery lead).
    projectManagerId: uuid('project_manager_id').references(() => employeesTable.id, {
      onDelete: 'set null',
    }),

    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => usersTable.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_projects_status').on(table.status),
    index('idx_projects_company').on(table.companyId),
    index('idx_projects_proposal').on(table.proposalId),
    index('idx_projects_pm').on(table.projectManagerId),
    // Hot path: the list page only ever reads live projects, newest first.
    index('idx_projects_active_created').on(table.createdAt).where(sql`deleted_at is null`),
    check('chk_projects_progress_range', sql`${table.progress} between 0 and 100`),
    check('chk_projects_values_nonnegative', sql`${table.contractValuePaise} >= 0 and ${table.estimatedCostPaise} >= 0`),
  ],
)

export const projectMembersTable = pgTable(
  'project_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employeesTable.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 100 }).notNull().default('Engineer'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_project_members_project').on(table.projectId, table.position),
    // One row per employee per project.
    unique('uq_project_members_project_employee').on(table.projectId, table.employeeId),
  ],
)

export const projectMilestonesTable = pgTable(
  'project_milestones',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    dueDate: date('due_date'),
    status: milestoneStatusEnum('status').notNull().default('pending'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    position: integer('position').notNull().default(0),
  },
  (table) => [index('idx_project_milestones_project').on(table.projectId, table.position)],
)

export const projectRisksTable = pgTable(
  'project_risks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 1_000 }).notNull(),
    severity: riskSeverityEnum('severity').notNull().default('medium'),
    mitigation: text('mitigation'),
    status: riskStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_project_risks_project').on(table.projectId, table.status)],
)

// ── Scope annexure children (copied from the proposal on conversion) ─────
export const projectInputDocumentsTable = pgTable(
  'project_input_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 500 }).notNull(),
    position: integer('position').notNull().default(0),
  },
  (table) => [index('idx_project_input_docs_project').on(table.projectId, table.position)],
)

export const projectDeliverablesTable = pgTable(
  'project_deliverables',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 500 }).notNull(),
    position: integer('position').notNull().default(0),
  },
  (table) => [index('idx_project_deliverables_project').on(table.projectId, table.position)],
)

export const projectExclusionsTable = pgTable(
  'project_exclusions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 500 }).notNull(),
    position: integer('position').notNull().default(0),
  },
  (table) => [index('idx_project_exclusions_project').on(table.projectId, table.position)],
)

export const projectSoftwareTable = pgTable(
  'project_software',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    softwareId: uuid('software_id').references(() => softwareMastersTable.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    notes: varchar('notes', { length: 500 }),
    position: integer('position').notNull().default(0),
  },
  (table) => [index('idx_project_software_project').on(table.projectId, table.position)],
)

/** Append-only discussion thread on a project. */
export const projectCommentsTable = pgTable(
  'project_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => usersTable.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_project_comments_project').on(table.projectId, table.createdAt)],
)

/** Append-only audit trail of lifecycle transitions. */
export const projectStatusHistoryTable = pgTable(
  'project_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    fromStatus: projectLifecycleEnum('from_status'),
    toStatus: projectLifecycleEnum('to_status').notNull(),
    note: text('note'),
    changedBy: uuid('changed_by').references(() => usersTable.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_project_status_history_project').on(table.projectId, table.changedAt)],
)

export type ProjectDataRecord = typeof projectsTable.$inferSelect
export type NewProjectDataRecord = typeof projectsTable.$inferInsert

/**
 * Work assignments: which master activity (discipline → activity → optional
 * sub-activity) a team member is responsible for on a project, with planned
 * effort. Master links are nullable with name snapshots so restructuring the
 * masters never corrupts historical assignments.
 *
 * Actual effort lives in `project_activity_logs` (one row per work entry) —
 * the old CRM kept a `daily_entries` JSON blob plus a drift-prone
 * `actual_hours` counter; child rows + SUM give the same view with no dual
 * source of truth.
 */
export const projectActivityAssignmentsTable = pgTable(
  'project_activity_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    disciplineId: uuid('discipline_id').references(() => disciplinesTable.id, { onDelete: 'set null' }),
    activityId: uuid('activity_id').references(() => disciplineActivitiesTable.id, { onDelete: 'set null' }),
    subActivityId: uuid('sub_activity_id').references(() => disciplineSubActivitiesTable.id, {
      onDelete: 'set null',
    }),
    // Denormalized display names captured at assignment time.
    disciplineName: varchar('discipline_name', { length: 150 }).notNull(),
    activityName: varchar('activity_name', { length: 150 }).notNull(),
    subActivityName: varchar('sub_activity_name', { length: 150 }),
    assigneeId: uuid('assignee_id').references(() => employeesTable.id, { onDelete: 'set null' }),
    plannedMinutes: integer('planned_minutes').notNull().default(0),
    // Optional deliverable count (e.g. number of drawings), unit comes from the master activity.
    quantity: integer('quantity'),
    dueDate: date('due_date'),
    priority: assignmentPriorityEnum('priority').notNull().default('medium'),
    status: assignmentStatusEnum('status').notNull().default('not_started'),
    remark: text('remark'),
    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_paa_project').on(table.projectId, table.status),
    index('idx_paa_assignee').on(table.assigneeId),
    check('chk_paa_planned_nonnegative', sql`${table.plannedMinutes} >= 0`),
    check('chk_paa_quantity_positive', sql`${table.quantity} is null or ${table.quantity} > 0`),
  ],
)

/**
 * Work entries against an assignment — one row per log ("2h on 2026-08-25").
 * `projectId` is denormalized so the day-wise work-log view is a single-table
 * range scan.
 */
export const projectActivityLogsTable = pgTable(
  'project_activity_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => projectActivityAssignmentsTable.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
    logDate: date('log_date').notNull(),
    minutes: integer('minutes').notNull(),
    note: text('note'),
    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_pal_assignment').on(table.assignmentId, table.logDate),
    index('idx_pal_project_date').on(table.projectId, table.logDate),
    check('chk_pal_minutes_range', sql`${table.minutes} > 0 and ${table.minutes} <= 1440`),
  ],
)

export type ProjectActivityAssignmentRecord = typeof projectActivityAssignmentsTable.$inferSelect
export type NewProjectActivityAssignmentRecord = typeof projectActivityAssignmentsTable.$inferInsert
export type ProjectActivityLogRecord = typeof projectActivityLogsTable.$inferSelect
