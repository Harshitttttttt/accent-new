import { bigint, check, date, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { clientPurchaseOrderStatusEnum, leadPriorityEnum, vendorPurchaseOrderStatusEnum } from './enums'
import { usersTable } from './auth'
import { companiesTable } from './masters/company'
import { vendorsTable } from './masters/vendor'
import { projectsTable } from './projects'
import { proposalsTable } from './proposals'
import { vendorQuotationsTable } from './vendor-quotations'

// ── Client Purchase Orders (Incoming from Clients) ─────────────────────────
/**
 * Customer / Client purchase orders — orders RECEIVED from clients/customers
 * to confirm commercial proposals or authorize project execution and billing.
 * All monetary amounts are stored as integer paise (1 INR = 100 paise).
 */
export const clientPurchaseOrdersTable = pgTable(
  'client_purchase_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Human reference in the format CPO-NNN-MM-YYYY (e.g. CPO-001-08-2026)
    orderNumber: varchar('order_number', { length: 24 }).notNull().unique(),
    // Client's external reference from their official letter/document
    clientPoNumber: varchar('client_po_number', { length: 100 }).notNull(),

    // Client master link + denormalized display name
    companyId: uuid('company_id').references(() => companiesTable.id, { onDelete: 'set null' }),
    companyName: varchar('company_name', { length: 255 }).notNull(),
    clientContactName: varchar('client_contact_name', { length: 255 }),
    clientContactEmail: varchar('client_contact_email', { length: 255 }),
    clientContactPhone: varchar('client_contact_phone', { length: 50 }),
    billingAddress: text('billing_address'),
    shippingAddress: text('shipping_address'),
    clientGstin: varchar('client_gstin', { length: 20 }),
    clientPan: varchar('client_pan', { length: 20 }),

    // Commercial provenance — optional proposal converted to this PO, and fulfilling project
    proposalId: uuid('proposal_id').references(() => proposalsTable.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').references(() => projectsTable.id, { onDelete: 'set null' }),

    subject: varchar('subject', { length: 500 }),
    poDate: date('po_date'),
    receivedDate: date('received_date').defaultNow(),
    deliveryDueDate: date('delivery_due_date'),

    status: clientPurchaseOrderStatusEnum('status').notNull().default('draft'),
    priority: leadPriorityEnum('priority').notNull().default('medium'),

    // Money in paise (1 INR = 100 paise), tax in basis points (1800 = 18.00%)
    subtotalPaise: bigint('subtotal_paise', { mode: 'number' }).notNull().default(0),
    taxRateBps: integer('tax_rate_bps').notNull().default(1800),
    discountPaise: bigint('discount_paise', { mode: 'number' }).notNull().default(0),
    cgstAmountPaise: bigint('cgst_amount_paise', { mode: 'number' }).notNull().default(0),
    sgstAmountPaise: bigint('sgst_amount_paise', { mode: 'number' }).notNull().default(0),
    igstAmountPaise: bigint('igst_amount_paise', { mode: 'number' }).notNull().default(0),
    taxAmountPaise: bigint('tax_amount_paise', { mode: 'number' }).notNull().default(0),
    totalPaise: bigint('total_paise', { mode: 'number' }).notNull().default(0),

    // Invoicing progress against this PO (tracked from Sale Invoices)
    invoicedAmountPaise: bigint('invoiced_amount_paise', { mode: 'number' }).notNull().default(0),
    remainingAmountPaise: bigint('remaining_amount_paise', { mode: 'number' }).notNull().default(0),

    paymentTerms: text('payment_terms'),
    deliveryTerms: text('delivery_terms'),
    scopeOfWork: text('scope_of_work'),
    specialInstructions: text('special_instructions'),
    attachmentUrl: varchar('attachment_url', { length: 500 }),
    notes: text('notes'),

    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => usersTable.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_client_pos_company_id').on(table.companyId),
    index('idx_client_pos_project_id').on(table.projectId),
    index('idx_client_pos_proposal_id').on(table.proposalId),
    index('idx_client_pos_po_date').on(table.poDate),
    index('idx_client_pos_client_po_num').on(table.clientPoNumber),
    index('idx_client_pos_active_status').on(table.status).where(sql`deleted_at is null`),
    index('idx_client_pos_active_created').on(table.createdAt).where(sql`deleted_at is null`),
    check('chk_client_pos_rate_range', sql`${table.taxRateBps} between 0 and 10000`),
    check(
      'chk_client_pos_amounts_nonneg',
      sql`${table.subtotalPaise} >= 0 and ${table.discountPaise} >= 0 and ${table.taxAmountPaise} >= 0 and ${table.totalPaise} >= 0 and ${table.invoicedAmountPaise} >= 0 and ${table.remainingAmountPaise} >= 0`,
    ),
  ],
)

export const clientPurchaseOrderItemsTable = pgTable(
  'client_purchase_order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => clientPurchaseOrdersTable.id, { onDelete: 'cascade' }),
    itemCode: varchar('item_code', { length: 100 }),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    unit: varchar('unit', { length: 50 }).notNull().default('nos'),
    unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull().default(0),
    taxRateBps: integer('tax_rate_bps').notNull().default(1800),
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull().default(0),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('idx_client_po_items_order').on(table.orderId, table.position),
    check('chk_client_po_items_qty_positive', sql`${table.quantity} > 0`),
    check('chk_client_po_items_prices_nonneg', sql`${table.unitPricePaise} >= 0 and ${table.amountPaise} >= 0`),
  ],
)

export const clientPurchaseOrderActivitiesTable = pgTable(
  'client_purchase_order_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => clientPurchaseOrdersTable.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => usersTable.id, { onDelete: 'set null' }),
    actorName: varchar('actor_name', { length: 255 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_client_po_activities_order').on(table.orderId, table.createdAt)],
)

// ── Vendor Purchase Orders (Outgoing to Vendors) ───────────────────────────
/**
 * Vendor / Supplier purchase orders — orders ISSUED to suppliers, vendors,
 * and subcontractors for procurement of goods, licenses, and outsourced works.
 * All monetary amounts are stored as integer paise (1 INR = 100 paise).
 */
export const vendorPurchaseOrdersTable = pgTable(
  'vendor_purchase_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Human reference in the format VPO-NNN-MM-YYYY (e.g. VPO-001-08-2026)
    poNumber: varchar('po_number', { length: 24 }).notNull().unique(),

    // Vendor master link + denormalized display name
    vendorId: uuid('vendor_id').references(() => vendorsTable.id, { onDelete: 'set null' }),
    vendorName: varchar('vendor_name', { length: 255 }).notNull(),
    vendorEmail: varchar('vendor_email', { length: 255 }),
    vendorPhone: varchar('vendor_phone', { length: 50 }),
    vendorAddress: text('vendor_address'),
    vendorGstin: varchar('vendor_gstin', { length: 20 }),
    vendorPan: varchar('vendor_pan', { length: 20 }),

    // Commercial provenance — source quotation from vendor, and project context
    vendorQuotationId: uuid('vendor_quotation_id').references(() => vendorQuotationsTable.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').references(() => projectsTable.id, { onDelete: 'set null' }),

    subject: varchar('subject', { length: 500 }),
    poDate: date('po_date'),
    expectedDeliveryDate: date('expected_delivery_date'),

    status: vendorPurchaseOrderStatusEnum('status').notNull().default('draft'),
    priority: leadPriorityEnum('priority').notNull().default('medium'),

    // Money in paise (1 INR = 100 paise), tax in basis points (1800 = 18.00%)
    subtotalPaise: bigint('subtotal_paise', { mode: 'number' }).notNull().default(0),
    taxRateBps: integer('tax_rate_bps').notNull().default(1800),
    discountPaise: bigint('discount_paise', { mode: 'number' }).notNull().default(0),
    cgstAmountPaise: bigint('cgst_amount_paise', { mode: 'number' }).notNull().default(0),
    sgstAmountPaise: bigint('sgst_amount_paise', { mode: 'number' }).notNull().default(0),
    igstAmountPaise: bigint('igst_amount_paise', { mode: 'number' }).notNull().default(0),
    taxAmountPaise: bigint('tax_amount_paise', { mode: 'number' }).notNull().default(0),
    totalPaise: bigint('total_paise', { mode: 'number' }).notNull().default(0),

    // Billing progress against this PO (tracked from Purchase Invoices)
    billedAmountPaise: bigint('billed_amount_paise', { mode: 'number' }).notNull().default(0),
    balanceAmountPaise: bigint('balance_amount_paise', { mode: 'number' }).notNull().default(0),

    deliveryTerms: text('delivery_terms'),
    paymentTerms: text('payment_terms'),
    shippingAddress: text('shipping_address'),
    modeOfDelivery: varchar('mode_of_delivery', { length: 100 }),
    attachmentUrl: varchar('attachment_url', { length: 500 }),
    notes: text('notes'),
    terms: text('terms'),

    approvedBy: uuid('approved_by').references(() => usersTable.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => usersTable.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_vendor_pos_vendor_id').on(table.vendorId),
    index('idx_vendor_pos_project_id').on(table.projectId),
    index('idx_vendor_pos_quotation_id').on(table.vendorQuotationId),
    index('idx_vendor_pos_po_date').on(table.poDate),
    index('idx_vendor_pos_active_status').on(table.status).where(sql`deleted_at is null`),
    index('idx_vendor_pos_active_created').on(table.createdAt).where(sql`deleted_at is null`),
    check('chk_vendor_pos_rate_range', sql`${table.taxRateBps} between 0 and 10000`),
    check(
      'chk_vendor_pos_amounts_nonneg',
      sql`${table.subtotalPaise} >= 0 and ${table.discountPaise} >= 0 and ${table.taxAmountPaise} >= 0 and ${table.totalPaise} >= 0 and ${table.billedAmountPaise} >= 0 and ${table.balanceAmountPaise} >= 0`,
    ),
  ],
)

export const vendorPurchaseOrderItemsTable = pgTable(
  'vendor_purchase_order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    poId: uuid('po_id')
      .notNull()
      .references(() => vendorPurchaseOrdersTable.id, { onDelete: 'cascade' }),
    itemCode: varchar('item_code', { length: 100 }),
    description: varchar('description', { length: 500 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    unit: varchar('unit', { length: 50 }).notNull().default('nos'),
    unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull().default(0),
    taxRateBps: integer('tax_rate_bps').notNull().default(1800),
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull().default(0),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('idx_vendor_po_items_po').on(table.poId, table.position),
    check('chk_vendor_po_items_qty_positive', sql`${table.quantity} > 0`),
    check('chk_vendor_po_items_prices_nonneg', sql`${table.unitPricePaise} >= 0 and ${table.amountPaise} >= 0`),
  ],
)

export const vendorPurchaseOrderActivitiesTable = pgTable(
  'vendor_purchase_order_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    poId: uuid('po_id')
      .notNull()
      .references(() => vendorPurchaseOrdersTable.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => usersTable.id, { onDelete: 'set null' }),
    actorName: varchar('actor_name', { length: 255 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_vendor_po_activities_po').on(table.poId, table.createdAt)],
)

export type ClientPurchaseOrderRecord = typeof clientPurchaseOrdersTable.$inferSelect
export type ClientPurchaseOrderItemRecord = typeof clientPurchaseOrderItemsTable.$inferSelect
export type ClientPurchaseOrderActivityRecord = typeof clientPurchaseOrderActivitiesTable.$inferSelect

export type VendorPurchaseOrderRecord = typeof vendorPurchaseOrdersTable.$inferSelect
export type VendorPurchaseOrderItemRecord = typeof vendorPurchaseOrderItemsTable.$inferSelect
export type VendorPurchaseOrderActivityRecord = typeof vendorPurchaseOrderActivitiesTable.$inferSelect
