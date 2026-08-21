import { boolean, date, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const softwareMastersTable = pgTable(
  'software_masters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 150 }).notNull(),
    vendor: varchar('vendor', { length: 150 }),
    version: varchar('version', { length: 50 }),
    licenseType: varchar('license_type', { length: 50 }),
    totalLicenses: integer('total_licenses').notNull(),
    usedLicenses: integer('used_licenses').notNull().default(0),
    costPaise: integer('cost_paise').notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('INR'),
    purchaseDate: date('purchase_date'),
    expiryDate: date('expiry_date'),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_software_masters_code').on(table.code),
    index('idx_software_masters_name').on(table.name),
    index('idx_software_masters_vendor').on(table.vendor),
    index('idx_software_masters_expiry').on(table.expiryDate),
    index('idx_software_masters_active').on(table.isActive),
  ],
)

export type SoftwareMasterRecord = typeof softwareMastersTable.$inferSelect
export type NewSoftwareMasterRecord = typeof softwareMastersTable.$inferInsert
