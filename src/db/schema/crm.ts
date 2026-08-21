import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { activityTone, leadSourceCodeEnum, projectStatus } from './enums'

export const projectsTable = pgTable('crm_projects', {
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

export type ProjectRecord = typeof projectsTable.$inferSelect
export type NewProjectRecord = typeof projectsTable.$inferInsert
export type ActivityRecord = typeof activitiesTable.$inferSelect
export type NewActivityRecord = typeof activitiesTable.$inferInsert
export type LeadSourceRecord = typeof leadSourcesTable.$inferSelect
