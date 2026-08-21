import { type AnyPgColumn, date, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { employeeStatusEnum, employmentTypeEnum } from './enums'
import { usersTable } from './auth'

export const departmentsTable = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const designationsTable = pgTable('designations', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const employeesTable = pgTable(
  'employees',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeCode: varchar('employee_code', { length: 50 }).notNull().unique(),
    userId: uuid('user_id').unique().references(() => usersTable.id, { onDelete: 'set null' }),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    departmentId: uuid('department_id').references(() => departmentsTable.id, { onDelete: 'set null' }),
    designationId: uuid('designation_id').references(() => designationsTable.id, { onDelete: 'set null' }),
    managerId: uuid('manager_id').references((): AnyPgColumn => employeesTable.id, { onDelete: 'set null' }),
    employmentType: employmentTypeEnum('employment_type').notNull().default('full_time'),
    status: employeeStatusEnum('status').notNull().default('active'),
    joiningDate: date('joining_date').notNull(),
    leavingDate: date('leaving_date'),
    skills: text('skills').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_employees_code').on(table.employeeCode),
    index('idx_employees_user_id').on(table.userId),
    index('idx_employees_dept').on(table.departmentId),
    index('idx_employees_designation').on(table.designationId),
    index('idx_employees_manager').on(table.managerId),
    index('idx_employees_status').on(table.status),
  ],
)

export type DepartmentRecord = typeof departmentsTable.$inferSelect
export type NewDepartmentRecord = typeof departmentsTable.$inferInsert
export type DesignationRecord = typeof designationsTable.$inferSelect
export type NewDesignationRecord = typeof designationsTable.$inferInsert
export type EmployeeRecord = typeof employeesTable.$inferSelect
export type NewEmployeeRecord = typeof employeesTable.$inferInsert
