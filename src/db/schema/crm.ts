import { bigint, check, date, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { activityTone, leadEnquiryTypeEnum, leadPriorityEnum, leadSourceCodeEnum, leadStageEnum, projectStatus } from './enums'
import { companiesTable } from './masters/company'
import { employeesTable } from './employees'
import { usersTable } from './auth'

export const crmProjectsTable = pgTable('crm_projects', {
  id: varchar('id', { length: 80 }).primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  status: projectStatus('status').notNull().default('active'),
  owner: varchar('owner', { length: 120 }).notNull(),
})

export const activitiesTable = pgTable('crm_activities', {
  id: varchar('id', { length: 80 }).primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  detail: text('detail').notNull(),
  tone: activityTone('tone').notNull().default('info'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const leadSourcesTable = pgTable('lead_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: leadSourceCodeEnum('code').notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type CrmProjectRecord = typeof crmProjectsTable.$inferSelect
export type NewCrmProjectRecord = typeof crmProjectsTable.$inferInsert
export type ActivityRecord = typeof activitiesTable.$inferSelect
export type NewActivityRecord = typeof activitiesTable.$inferInsert
export type LeadSourceRecord = typeof leadSourcesTable.$inferSelect

export const leadsTable = pgTable(
  'leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Human reference in the format NNN-MM-YYYY (serial-month-year), e.g. 001-08-2026.
    leadNumber: varchar('lead_number', { length: 20 }).notNull().unique(),
    companyId: uuid('company_id').references(() => companiesTable.id, { onDelete: 'set null' }),
    // Denormalized display/search name — leads may arrive before a company master record exists.
    companyName: varchar('company_name', { length: 255 }).notNull(),
    contactName: varchar('contact_name', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 20 }),
    designation: varchar('designation', { length: 100 }),
    // Email of the person from whom the inquiry was received (website/Justdial inquiries arrive by email).
    inquiryEmail: varchar('inquiry_email', { length: 255 }),
    ccEmails: text('cc_emails').array(),
    city: varchar('city', { length: 100 }),
    projectDescription: text('project_description'),
    enquiryType: leadEnquiryTypeEnum('enquiry_type').notNull().default('Email'),
    sourceCode: leadSourceCodeEnum('source_code').notNull().default('website'),
    stage: leadStageEnum('stage').notNull().default('prospecting'),
    priority: leadPriorityEnum('priority').notNull().default('medium'),
    valuePaise: bigint('value_paise', { mode: 'number' }),
    probability: integer('probability'),
    score: integer('score'),
    assignedTo: uuid('assigned_to').references(() => employeesTable.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => usersTable.id, { onDelete: 'set null' }),
    enquiryDate: date('enquiry_date').notNull().defaultNow(),
    expectedCloseDate: date('expected_close_date'),
    // Set automatically when stage enters closed_won/closed_lost; cleared when it leaves.
    closedAt: timestamp('closed_at', { withTimezone: true }),
    // Why the deal was lost — only meaningful while stage = closed_lost.
    lostReason: text('lost_reason'),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_leads_company_id').on(table.companyId),
    index('idx_leads_company_name').on(table.companyName),
    index('idx_leads_contact_email').on(table.contactEmail),
    index('idx_leads_source_code').on(table.sourceCode),
    index('idx_leads_enquiry_date').on(table.enquiryDate),
    // Hot paths always read live leads: assignee+stage board queries and stage rollups.
    index('idx_leads_active_assigned_stage').on(table.assignedTo, table.stage).where(sql`deleted_at is null`),
    index('idx_leads_active_stage').on(table.stage).where(sql`deleted_at is null`),
    check('chk_leads_value_nonnegative', sql`${table.valuePaise} >= 0`),
    check('chk_leads_probability_range', sql`${table.probability} between 0 and 100`),
    check('chk_leads_score_range', sql`${table.score} between 0 and 100`),
  ],
)

export type LeadRecord = typeof leadsTable.$inferSelect

/**
 * Append-only stage transition log — one row per move, plus the initial
 * entry (fromStage null) at creation. Feeds pipeline velocity and
 * stage-conversion analytics without touching the leads row.
 */
export const leadStageHistoryTable = pgTable(
  'lead_stage_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leadsTable.id, { onDelete: 'cascade' }),
    fromStage: leadStageEnum('from_stage'),
    toStage: leadStageEnum('to_stage').notNull(),
    changedBy: uuid('changed_by').references(() => usersTable.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_lead_stage_history_lead').on(table.leadId, table.changedAt)],
)

export type LeadStageHistoryRecord = typeof leadStageHistoryTable.$inferSelect
export type NewLeadRecord = typeof leadsTable.$inferInsert
export type NewLeadStageHistoryRecord = typeof leadStageHistoryTable.$inferInsert
