import { bigint, check, date, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { vendorQuotationStatusEnum } from './enums'
import { usersTable } from './auth'
import { vendorsTable } from './masters/vendor'
import { projectsTable } from './projects'

/**
 * Vendor quotations — quotations RECEIVED from vendors (the old CRM's
 * misleadingly named `outgoing_quotations` table / "Quotation (Incoming)"
 * page). Money is paise integers; the tax rate is stored as basis points
 * (1800 = 18.00%) so no float ever touches storage or math.
 */
export const vendorQuotationsTable = pgTable(
  'vendor_quotations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Human reference in the format VQ-NNN-MM-YYYY (serial-month-year), e.g. VQ-001-08-2026.
    quotationNumber: varchar('quotation_number', { length: 24 }).notNull().unique(),
    quotationDate: date('quotation_date'),

    // Vendor master link plus a denormalized display name — quotations may be
    // recorded before a vendor master entry exists (same pattern as leads).
    vendorId: uuid('vendor_id').references(() => vendorsTable.id, { onDelete: 'set null' }),
    vendorName: varchar('vendor_name', { length: 255 }).notNull(),
    vendorEmail: varchar('vendor_email', { length: 255 }),
    vendorPhone: varchar('vendor_phone', { length: 50 }),
    vendorAddress: text('vendor_address'),

    subject: varchar('subject', { length: 500 }),

    // Optional procurement context.
    projectId: uuid('project_id').references(() => projectsTable.id, { onDelete: 'set null' }),

    // Tax rate in basis points (1800 = 18%). Integer keeps Decimal math exact.
    taxRateBps: integer('tax_rate_bps').notNull().default(1800),
    // Manual subtotal used only when the quotation has no item lines.
    manualSubtotalPaise: bigint('manual_subtotal_paise', { mode: 'number' }),
    discountPaise: bigint('discount_paise', { mode: 'number' }).notNull().default(0),
    // Server-computed on every save from lines (or manual subtotal), rate and discount.
    taxAmountPaise: bigint('tax_amount_paise', { mode: 'number' }).notNull().default(0),
    totalPaise: bigint('total_paise', { mode: 'number' }).notNull().default(0),

    validUntil: date('valid_until'),
    notes: text('notes'),
    terms: text('terms'),

    status: vendorQuotationStatusEnum('status').notNull().default('draft'),

    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_vendor_quotations_vendor_id').on(table.vendorId),
    index('idx_vendor_quotations_project_id').on(table.projectId),
    index('idx_vendor_quotations_quotation_date').on(table.quotationDate),
    // Hot paths read live rows by status (KPI tiles + filtered lists).
    index('idx_vendor_quotations_active_status').on(table.status).where(sql`deleted_at is null`),
    check('chk_vendor_quotations_rate_range', sql`${table.taxRateBps} between 0 and 10000`),
    check(
      'chk_vendor_quotations_amounts_nonnegative',
      sql`${table.manualSubtotalPaise} >= 0 and ${table.discountPaise} >= 0 and ${table.taxAmountPaise} >= 0 and ${table.totalPaise} >= 0`,
    ),
  ],
)

/**
 * Item lines — the old CRM kept these as a JSON `longtext` blob that the UI
 * never exposed; here they are first-class rows ordered by `position`,
 * mirroring `proposal_quotation_lines`.
 */
export const vendorQuotationItemsTable = pgTable(
  'vendor_quotation_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    quotationId: uuid('quotation_id')
      .notNull()
      .references(() => vendorQuotationsTable.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull().default(0),
    // quantity * unitPricePaise, computed server-side on every save.
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull().default(0),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('idx_vendor_quotation_items_quotation').on(table.quotationId, table.position),
    check('chk_vendor_quotation_item_qty_positive', sql`${table.quantity} > 0`),
    check('chk_vendor_quotation_item_prices_nonnegative', sql`${table.unitPricePaise} >= 0 and ${table.amountPaise} >= 0`),
  ],
)

export type VendorQuotationRecord = typeof vendorQuotationsTable.$inferSelect
export type VendorQuotationItemRecord = typeof vendorQuotationItemsTable.$inferSelect
