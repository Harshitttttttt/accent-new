import { boolean, index, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'

export const disciplinesTable = pgTable(
  'disciplines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_disciplines_code').on(table.code),
    index('idx_disciplines_name').on(table.name),
    index('idx_disciplines_active').on(table.isActive),
  ],
)

export const disciplineActivitiesTable = pgTable(
  'discipline_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    disciplineId: uuid('discipline_id')
      .notNull()
      .references(() => disciplinesTable.id, { onDelete: 'restrict' }),
    unit: varchar('unit', { length: 50 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_discipline_activities_code').on(table.code),
    index('idx_discipline_activities_discipline').on(table.disciplineId),
    index('idx_discipline_activities_active').on(table.isActive),
    unique('uq_discipline_activities_discipline_code').on(table.disciplineId, table.code),
  ],
)

export const disciplineSubActivitiesTable = pgTable(
  'discipline_sub_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    activityId: uuid('activity_id')
      .notNull()
      .references(() => disciplineActivitiesTable.id, { onDelete: 'cascade' }),
    unit: varchar('unit', { length: 50 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_discipline_sub_activities_code').on(table.code),
    index('idx_discipline_sub_activities_activity').on(table.activityId),
    index('idx_discipline_sub_activities_active').on(table.isActive),
    unique('uq_discipline_sub_activities_activity_code').on(table.activityId, table.code),
  ],
)

export type DisciplineRecord = typeof disciplinesTable.$inferSelect
export type NewDisciplineRecord = typeof disciplinesTable.$inferInsert
export type DisciplineActivityRecord = typeof disciplineActivitiesTable.$inferSelect
export type NewDisciplineActivityRecord = typeof disciplineActivitiesTable.$inferInsert
export type DisciplineSubActivityRecord = typeof disciplineSubActivitiesTable.$inferSelect
export type NewDisciplineSubActivityRecord = typeof disciplineSubActivitiesTable.$inferInsert
