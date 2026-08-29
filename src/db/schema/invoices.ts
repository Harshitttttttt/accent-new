import { bigint, check, date, index, integer, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  gstTypeEnum,
  paymentStatusEnum,
  purchaseInvoiceStatusEnum,
  saleInvoiceStatusEnum,
} from './enums'
import { usersTable } from './auth'
import { companiesTable } from './masters/company'
import { vendorsTable } from './masters/vendor'
import { projectsTable } from './projects'

// ── Sale invoices — you SEND to clients ──────────────────────────────────
// Replaces old `invoices` MySQL table (ATS/I/MMM-YY/NNN, float decimals,
// JSON longtext `items`/`line_items`, `isDelete` tinyint, no FKs).
// New: paise bigint, child lines, deleted_at + partial index, taxRateBps,
// proper FKs + denormalized display names, deterministic SI-NNN-MM-YYYY.

export const saleInvoicesTable = pgTable(
  'sale_invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Human reference SI-NNN-MM-YYYY (serial-month-year), e.g. SI-001-08-2026.
    invoiceNumber: varchar('invoice_number', { length: 24 }).notNull(),
    invoiceDate: date('invoice_date'),
    dueDate: date('due_date'),

    // Client — FK plus denormalized name so invoices survive master deletion
    // and pre-date master entries (same pattern as vendor_quotations/company).
    companyId: uuid('company_id').references(() => companiesTable.id, { onDelete: 'set null' }),
    clientName: varchar('client_name', { length: 255 }).notNull(),
    clientEmail: varchar('client_email', { length: 255 }),
    clientPhone: varchar('client_phone', { length: 50 }),
    clientAddress: text('client_address'),
    clientGstin: varchar('client_gstin', { length: 20 }),
    clientPan: varchar('client_pan', { length: 20 }),
    clientState: varchar('client_state', { length: 100 }),
    clientStateCode: varchar('client_state_code', { length: 10 }),
    kindAttn: varchar('kind_attn', { length: 255 }),

    // Procurement linkage — optional PO context carried from proposal/project.
    projectId: uuid('project_id').references(() => projectsTable.id, { onDelete: 'set null' }),
    poNumber: varchar('po_number', { length: 100 }),
    poDate: date('po_date'),
    // PO value tracking moved to paise; balance is server-computed, not trusted from client.
    originalPoValuePaise: bigint('original_po_value_paise', { mode: 'number' }),
    balancePoValuePaise: bigint('balance_po_value_paise', { mode: 'number' }),

    description: varchar('description', { length: 500 }),
    // Company letterhead / tax identity — denormalized at invoice time for
    // immutability (old stored gst_number/pan/tan per invoice).
    gstNumber: varchar('gst_number', { length: 20 }),
    panNumber: varchar('pan_number', { length: 20 }),
    tanNumber: varchar('tan_number', { length: 20 }),
    serviceCategory: varchar('service_category', { length: 500 }),
    bankAddress: varchar('bank_address', { length: 500 }),

    // Money — all paise integers, no float. Tax stored as basis points.
    subtotalPaise: bigint('subtotal_paise', { mode: 'number' }).notNull().default(0),
    discountPaise: bigint('discount_paise', { mode: 'number' }).notNull().default(0),
    gstType: gstTypeEnum('gst_type').notNull().default('cgst_sgst'),
    cgstRateBps: integer('cgst_rate_bps').notNull().default(900),
    sgstRateBps: integer('sgst_rate_bps').notNull().default(900),
    igstRateBps: integer('igst_rate_bps').notNull().default(1800),
    taxAmountPaise: bigint('tax_amount_paise', { mode: 'number' }).notNull().default(0),
    totalPaise: bigint('total_paise', { mode: 'number' }).notNull().default(0),

    amountPaidPaise: bigint('amount_paid_paise', { mode: 'number' }).notNull().default(0),
    balanceDuePaise: bigint('balance_due_paise', { mode: 'number' }).notNull().default(0),

    notes: text('notes'),
    terms: text('terms'),

    status: saleInvoiceStatusEnum('status').notNull().default('draft'),

    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Uniqueness scoped to live rows only — soft-deleted numbers are reusable.
    unique('uq_sale_invoices_number_active').on(table.invoiceNumber), // partial WHERE deleted_at IS NULL via raw SQL in prod migration
    index('idx_sale_invoices_company').on(table.companyId),
    index('idx_sale_invoices_project').on(table.projectId),
    index('idx_sale_invoices_invoice_date').on(table.invoiceDate),
    index('idx_sale_invoices_due_date').on(table.dueDate),
    index('idx_sale_invoices_active_status').on(table.status).where(sql`deleted_at is null`),
    index('idx_sale_invoices_active_created').on(table.createdAt).where(sql`deleted_at is null`),
    check('chk_sale_invoices_gst_rates_range', sql`${table.cgstRateBps} between 0 and 10000 and ${table.sgstRateBps} between 0 and 10000 and ${table.igstRateBps} between 0 and 10000`),
    check('chk_sale_invoices_amounts_nonneg', sql`${table.subtotalPaise} >= 0 and ${table.discountPaise} >= 0 and ${table.taxAmountPaise} >= 0 and ${table.totalPaise} >= 0 and ${table.amountPaidPaise} >= 0 and ${table.balanceDuePaise} >= 0`),
  ],
)

export const saleInvoiceLinesTable = pgTable(
  'sale_invoice_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => saleInvoicesTable.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull().default(0),
    // quantity * unitPricePaise, computed server-side.
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull().default(0),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('idx_sale_invoice_lines_invoice').on(table.invoiceId, table.position),
    check('chk_sale_invoice_line_qty_positive', sql`${table.quantity} > 0`),
    check('chk_sale_invoice_line_prices_nonneg', sql`${table.unitPricePaise} >= 0 and ${table.amountPaise} >= 0`),
  ],
)

// ── Purchase invoices — you RECEIVE from vendors ──────────────────────────
// Replaces old `purchase_invoices` (PI-NNNNN, float decimals, JSON items,
// `isDelete`, separate payment_status column kept but now strongly typed).

export const purchaseInvoicesTable = pgTable(
  'purchase_invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceNumber: varchar('invoice_number', { length: 24 }).notNull(),
    invoiceDate: date('invoice_date'),
    dueDate: date('due_date'),

    vendorId: uuid('vendor_id').references(() => vendorsTable.id, { onDelete: 'set null' }),
    vendorName: varchar('vendor_name', { length: 255 }).notNull(),
    vendorEmail: varchar('vendor_email', { length: 255 }),
    vendorPhone: varchar('vendor_phone', { length: 50 }),
    vendorAddress: text('vendor_address'),
    vendorGstin: varchar('vendor_gstin', { length: 20 }),
    vendorPan: varchar('vendor_pan', { length: 20 }),

    projectId: uuid('project_id').references(() => projectsTable.id, { onDelete: 'set null' }),
    poNumber: varchar('po_number', { length: 100 }),
    poDate: date('po_date'),

    description: varchar('description', { length: 500 }),

    subtotalPaise: bigint('subtotal_paise', { mode: 'number' }).notNull().default(0),
    discountPaise: bigint('discount_paise', { mode: 'number' }).notNull().default(0),
    taxRateBps: integer('tax_rate_bps').notNull().default(1800),
    cgstAmountPaise: bigint('cgst_amount_paise', { mode: 'number' }).notNull().default(0),
    sgstAmountPaise: bigint('sgst_amount_paise', { mode: 'number' }).notNull().default(0),
    igstAmountPaise: bigint('igst_amount_paise', { mode: 'number' }).notNull().default(0),
    taxAmountPaise: bigint('tax_amount_paise', { mode: 'number' }).notNull().default(0),
    totalPaise: bigint('total_paise', { mode: 'number' }).notNull().default(0),

    amountPaidPaise: bigint('amount_paid_paise', { mode: 'number' }).notNull().default(0),
    balanceDuePaise: bigint('balance_due_paise', { mode: 'number' }).notNull().default(0),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('unpaid'),

    notes: text('notes'),
    terms: text('terms'),
    attachmentUrl: varchar('attachment_url', { length: 500 }),

    status: purchaseInvoiceStatusEnum('status').notNull().default('draft'),

    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('uq_purchase_invoices_number_active').on(table.invoiceNumber), // partial WHERE deleted_at IS NULL via raw SQL in prod migration
    index('idx_purchase_invoices_vendor').on(table.vendorId),
    index('idx_purchase_invoices_project').on(table.projectId),
    index('idx_purchase_invoices_invoice_date').on(table.invoiceDate),
    index('idx_purchase_invoices_due_date').on(table.dueDate),
    index('idx_purchase_invoices_active_status').on(table.status).where(sql`deleted_at is null`),
    index('idx_purchase_invoices_payment_status').on(table.paymentStatus).where(sql`deleted_at is null`),
    index('idx_purchase_invoices_active_created').on(table.createdAt).where(sql`deleted_at is null`),
    check('chk_purchase_invoices_rate_range', sql`${table.taxRateBps} between 0 and 10000`),
    check('chk_purchase_invoices_amounts_nonneg', sql`${table.subtotalPaise} >= 0 and ${table.discountPaise} >= 0 and ${table.taxAmountPaise} >= 0 and ${table.totalPaise} >= 0 and ${table.amountPaidPaise} >= 0 and ${table.balanceDuePaise} >= 0`),
  ],
)

export const purchaseInvoiceLinesTable = pgTable(
  'purchase_invoice_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => purchaseInvoicesTable.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull().default(0),
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull().default(0),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('idx_purchase_invoice_lines_invoice').on(table.invoiceId, table.position),
    check('chk_purchase_invoice_line_qty_positive', sql`${table.quantity} > 0`),
    check('chk_purchase_invoice_line_prices_nonneg', sql`${table.unitPricePaise} >= 0 and ${table.amountPaise} >= 0`),
  ],
)

export type SaleInvoiceRecord = typeof saleInvoicesTable.$inferSelect
export type SaleInvoiceLineRecord = typeof saleInvoiceLinesTable.$inferSelect
export type PurchaseInvoiceRecord = typeof purchaseInvoicesTable.$inferSelect
export type PurchaseInvoiceLineRecord = typeof purchaseInvoiceLinesTable.$inferSelect
