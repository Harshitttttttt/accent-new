import { type AnyPgColumn, boolean, index, integer, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { vendorCategoryEnum, vendorStatusEnum } from '../enums'
import { employeesTable } from '../employees'

export const vendorsTable = pgTable(
  'vendors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }),
    vendorCategory: vendorCategoryEnum('vendor_category').notNull().default('supplier'),
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
    status: vendorStatusEnum('status').notNull().default('active'),
    rating: integer('rating'),
    paymentTerms: varchar('payment_terms', { length: 100 }),
    msmeNumber: varchar('msme_number', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_vendors_code').on(table.code),
    index('idx_vendors_name').on(table.name),
    index('idx_vendors_status').on(table.status),
    index('idx_vendors_category').on(table.vendorCategory),
    index('idx_vendors_city').on(table.city),
    index('idx_vendors_account_mgr').on(table.accountManagerId),
  ],
)

export const vendorContactsTable = pgTable(
  'vendor_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorsTable.id, { onDelete: 'cascade' }),
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
    index('idx_vendor_contacts_vendor').on(table.vendorId),
    index('idx_vendor_contacts_email').on(table.email),
    unique('uq_vendor_contacts_vendor_email').on(table.vendorId, table.email),
  ],
)

export const vendorEmailsTable = pgTable(
  'vendor_emails',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendorsTable.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_vendor_emails_vendor').on(table.vendorId)],
)

export type VendorRecord = typeof vendorsTable.$inferSelect
export type NewVendorRecord = typeof vendorsTable.$inferInsert
export type VendorContactRecord = typeof vendorContactsTable.$inferSelect
export type NewVendorContactRecord = typeof vendorContactsTable.$inferInsert
export type VendorEmailRecord = typeof vendorEmailsTable.$inferSelect
