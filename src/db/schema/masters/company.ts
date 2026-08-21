import { type AnyPgColumn, boolean, index, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { companyStatusEnum } from '../enums'
import { employeesTable } from '../employees'

export const companiesTable = pgTable(
  'companies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }),
    website: varchar('website', { length: 255 }),
    industry: varchar('industry', { length: 100 }),
    gstin: varchar('gstin', { length: 15 }).unique(),
    pan: varchar('pan', { length: 10 }),
    addressLine1: text('address_line_1'),
    addressLine2: text('address_line_2'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    country: varchar('country', { length: 100 }).default('India'),
    postalCode: varchar('postal_code', { length: 20 }),
    inquiryEmail: varchar('inquiry_email', { length: 255 }),
    notes: text('notes'),
    accountManagerId: uuid('account_manager_id').references(
      (): AnyPgColumn => employeesTable.id,
      { onDelete: 'set null' },
    ),
    status: companyStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_companies_code').on(table.code),
    index('idx_companies_name').on(table.name),
    index('idx_companies_status').on(table.status),
    index('idx_companies_city').on(table.city),
    index('idx_companies_account_mgr').on(table.accountManagerId),
  ],
)

export const contactsTable = pgTable(
  'contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companiesTable.id, { onDelete: 'cascade' }),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    designation: varchar('designation', { length: 100 }),
    isPrimary: boolean('is_primary').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_contacts_company').on(table.companyId),
    index('idx_contacts_email').on(table.email),
    unique('uq_contacts_company_email').on(table.companyId, table.email),
  ],
)

export const companyEmailsTable = pgTable(
  'company_emails',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companiesTable.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_company_emails_company').on(table.companyId)],
)

export type CompanyRecord = typeof companiesTable.$inferSelect
export type NewCompanyRecord = typeof companiesTable.$inferInsert
export type ContactRecord = typeof contactsTable.$inferSelect
export type NewContactRecord = typeof contactsTable.$inferInsert
export type CompanyEmailRecord = typeof companyEmailsTable.$inferSelect
