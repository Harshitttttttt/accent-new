import { type AnyPgColumn, boolean, index, integer, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { bankAccountTypeEnum, bankStatusEnum } from '../enums'
import { employeesTable } from '../employees'

export const banksTable = pgTable(
  'banks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    bankName: varchar('bank_name', { length: 150 }).notNull(),
    branchName: varchar('branch_name', { length: 150 }),
    branchCode: varchar('branch_code', { length: 50 }),
    accountHolderName: varchar('account_holder_name', { length: 255 }),
    accountNumber: varchar('account_number', { length: 50 }).notNull(),
    accountType: bankAccountTypeEnum('account_type').notNull().default('current'),
    ifscCode: varchar('ifsc_code', { length: 11 }).notNull(),
    swiftCode: varchar('swift_code', { length: 11 }),
    micrCode: varchar('micr_code', { length: 9 }),
    currency: varchar('currency', { length: 10 }).notNull().default('INR'),
    openingBalancePaise: integer('opening_balance_paise').notNull().default(0),
    currentBalancePaise: integer('current_balance_paise').notNull().default(0),
    overdraftLimitPaise: integer('overdraft_limit_paise').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    bankType: varchar('bank_type', { length: 50 }),
    contactPerson: varchar('contact_person', { length: 100 }),
    contactPhone: varchar('contact_phone', { length: 50 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    addressLine1: text('address_line_1'),
    addressLine2: text('address_line_2'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    country: varchar('country', { length: 100 }).default('India'),
    postalCode: varchar('postal_code', { length: 20 }),
    website: varchar('website', { length: 255 }),
    notes: text('notes'),
    accountManagerId: uuid('account_manager_id').references(
      (): AnyPgColumn => employeesTable.id,
      { onDelete: 'set null' },
    ),
    status: bankStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_banks_code').on(table.code),
    index('idx_banks_name').on(table.bankName),
    index('idx_banks_account_number').on(table.accountNumber),
    index('idx_banks_ifsc').on(table.ifscCode),
    index('idx_banks_status').on(table.status),
    index('idx_banks_currency').on(table.currency),
    index('idx_banks_city').on(table.city),
    unique('uq_banks_account_ifsc').on(table.accountNumber, table.ifscCode),
  ],
)

export const bankContactsTable = pgTable(
  'bank_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bankId: uuid('bank_id')
      .notNull()
      .references(() => banksTable.id, { onDelete: 'cascade' }),
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
    index('idx_bank_contacts_bank').on(table.bankId),
    index('idx_bank_contacts_email').on(table.email),
    unique('uq_bank_contacts_bank_email').on(table.bankId, table.email),
  ],
)

export type BankRecord = typeof banksTable.$inferSelect
export type NewBankRecord = typeof banksTable.$inferInsert
export type BankContactRecord = typeof bankContactsTable.$inferSelect
export type NewBankContactRecord = typeof bankContactsTable.$inferInsert
