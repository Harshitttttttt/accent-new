import { bigint, check, date, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  clientPaymentStatusEnum,
  clientPaymentTypeEnum,
  paymentModeEnum,
  paymentReleaseStatusEnum,
  paymentReleaseTypeEnum,
} from './enums'
import { usersTable } from './auth'
import { companiesTable } from './masters/company'
import { projectsTable } from './projects'
import { saleInvoicesTable } from './invoices'
import { banksTable } from './masters/bank'
import { clientPurchaseOrdersTable } from './purchase-orders'

// ── Client Payments (Payments Received from Client) ───────────────────────
/**
 * Customer / Client receipts — records all incoming payments from clients
 * against sale invoices, advances, or project milestones.
 * All monetary amounts are stored as integer paise (1 INR = 100 paise).
 */
export const clientPaymentsTable = pgTable(
  'client_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Human reference in the format REC-NNN-MM-YYYY (e.g. REC-001-08-2026)
    receiptNumber: varchar('receipt_number', { length: 24 }).notNull().unique(),

    // Client / Company link + denormalized name
    companyId: uuid('company_id').references(() => companiesTable.id, { onDelete: 'set null' }),
    companyName: varchar('company_name', { length: 255 }).notNull(),

    // Commercial linkages
    projectId: uuid('project_id').references(() => projectsTable.id, { onDelete: 'set null' }),
    projectName: varchar('project_name', { length: 255 }),
    invoiceId: uuid('invoice_id').references(() => saleInvoicesTable.id, { onDelete: 'set null' }),
    invoiceNumber: varchar('invoice_number', { length: 50 }),
    clientPoId: uuid('client_po_id').references(() => clientPurchaseOrdersTable.id, { onDelete: 'set null' }),
    clientPoNumber: varchar('client_po_number', { length: 100 }),

    // Depositing Bank Account
    bankId: uuid('bank_id').references(() => banksTable.id, { onDelete: 'set null' }),
    bankName: varchar('bank_name', { length: 150 }),
    bankAccountNumber: varchar('bank_account_number', { length: 50 }),

    paymentDate: date('payment_date').notNull(),
    paymentType: clientPaymentTypeEnum('payment_type').notNull().default('invoice_payment'),
    paymentMode: paymentModeEnum('payment_mode').notNull().default('neft'),

    // Reference information
    transactionReference: varchar('transaction_reference', { length: 100 }), // UTR / Cheque / Ref Number
    chequeDate: date('cheque_date'),
    chequeBank: varchar('cheque_bank', { length: 150 }),

    // Financial amounts in paise
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull().default(0), // Gross amount received
    tdsDeductedPaise: bigint('tds_deducted_paise', { mode: 'number' }).notNull().default(0), // TDS deducted by client
    bankChargesPaise: bigint('bank_charges_paise', { mode: 'number' }).notNull().default(0), // Bank/gateway fees
    netAmountPaise: bigint('net_amount_paise', { mode: 'number' }).notNull().default(0), // Net credited to account

    status: clientPaymentStatusEnum('status').notNull().default('cleared'),
    notes: text('notes'),
    receiptUrl: varchar('receipt_url', { length: 500 }),

    createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => usersTable.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => usersTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_client_payments_company').on(table.companyId),
    index('idx_client_payments_project').on(table.projectId),
    index('idx_client_payments_invoice').on(table.invoiceId),
    index('idx_client_payments_bank').on(table.bankId),
    index('idx_client_payments_date').on(table.paymentDate),
    index('idx_client_payments_active_status').on(table.status).where(sql`deleted_at is null`),
    index('idx_client_payments_active_created').on(table.createdAt).where(sql`deleted_at is null`),
    check(
      'chk_client_payments_amounts_nonneg',
      sql`${table.amountPaise} >= 0 and ${table.tdsDeductedPaise} >= 0 and ${table.bankChargesPaise} >= 0 and ${table.netAmountPaise} >= 0`,
    ),
  ],
)

// ── Client Payment Allocations (Multi-invoice split) ──────────────────────
export const clientPaymentAllocationsTable = pgTable(
  'client_payment_allocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => clientPaymentsTable.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => saleInvoicesTable.id, { onDelete: 'cascade' }),
    allocatedAmountPaise: bigint('allocated_amount_paise', { mode: 'number' }).notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_payment_allocations_payment').on(table.paymentId),
    index('idx_payment_allocations_invoice').on(table.invoiceId),
    check('chk_payment_allocations_amount_pos', sql`${table.allocatedAmountPaise} > 0`),
  ],
)

// ── Payments Released to Client (Disbursements & Refunds) ─────────────────
/**
 * Outgoing disbursements / refunds to clients — tracks security deposit returns,
 * advance refunds, client retention releases, and credit note settlements.
 * Dual-control maker-checker support with approved_by and approved_at.
 */
export const paymentsReleasedTable = pgTable(
  'payments_released',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Human reference in the format REL-NNN-MM-YYYY (e.g. REL-001-08-2026)
    paymentNumber: varchar('payment_number', { length: 24 }).notNull().unique(),

    // Client / Company link + denormalized name
    companyId: uuid('company_id').references(() => companiesTable.id, { onDelete: 'set null' }),
    companyName: varchar('company_name', { length: 255 }).notNull(),

    // Commercial context
    projectId: uuid('project_id').references(() => projectsTable.id, { onDelete: 'set null' }),
    projectName: varchar('project_name', { length: 255 }),
    saleInvoiceId: uuid('sale_invoice_id').references(() => saleInvoicesTable.id, { onDelete: 'set null' }),
    invoiceNumber: varchar('invoice_number', { length: 50 }),

    // Disbursing Bank Account (Accent)
    disbursingBankId: uuid('disbursing_bank_id').references(() => banksTable.id, { onDelete: 'set null' }),
    disbursingBankName: varchar('disbursing_bank_name', { length: 150 }),

    // Client Beneficiary Bank Details
    clientBankName: varchar('client_bank_name', { length: 150 }),
    clientAccountNumber: varchar('client_account_number', { length: 50 }),
    clientIfscCode: varchar('client_ifsc_code', { length: 11 }),

    releaseDate: date('release_date').notNull(),
    releaseType: paymentReleaseTypeEnum('release_type').notNull().default('advance_refund'),
    paymentMode: paymentModeEnum('payment_mode').notNull().default('neft'),
    transactionReference: varchar('transaction_reference', { length: 100 }), // UTR / Cheque Ref

    // Financial amounts in paise
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull().default(0), // Gross release
    deductionPaise: bigint('deduction_paise', { mode: 'number' }).notNull().default(0), // Admin / fee deductions
    netAmountPaise: bigint('net_amount_paise', { mode: 'number' }).notNull().default(0), // Net transferred

    status: paymentReleaseStatusEnum('status').notNull().default('draft'),
    reason: varchar('reason', { length: 500 }),
    notes: text('notes'),
    attachmentUrl: varchar('attachment_url', { length: 500 }),

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
    index('idx_payments_released_company').on(table.companyId),
    index('idx_payments_released_project').on(table.projectId),
    index('idx_payments_released_disbursing_bank').on(table.disbursingBankId),
    index('idx_payments_released_date').on(table.releaseDate),
    index('idx_payments_released_active_status').on(table.status).where(sql`deleted_at is null`),
    index('idx_payments_released_active_created').on(table.createdAt).where(sql`deleted_at is null`),
    check(
      'chk_payments_released_amounts_nonneg',
      sql`${table.amountPaise} >= 0 and ${table.deductionPaise} >= 0 and ${table.netAmountPaise} >= 0`,
    ),
  ],
)

// ── Payment Activities (Audit & timeline log) ─────────────────────────────
export const paymentActivitiesTable = pgTable(
  'payment_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: varchar('entity_type', { length: 20 }).notNull(), // 'received' | 'released'
    entityId: uuid('entity_id').notNull(),
    actorUserId: uuid('actor_user_id').references(() => usersTable.id, { onDelete: 'set null' }),
    actorName: varchar('actor_name', { length: 255 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_payment_activities_entity').on(table.entityType, table.entityId, table.createdAt),
  ],
)

export type ClientPaymentRecord = typeof clientPaymentsTable.$inferSelect
export type ClientPaymentAllocationRecord = typeof clientPaymentAllocationsTable.$inferSelect
export type PaymentReleasedRecord = typeof paymentsReleasedTable.$inferSelect
export type PaymentActivityRecord = typeof paymentActivitiesTable.$inferSelect
