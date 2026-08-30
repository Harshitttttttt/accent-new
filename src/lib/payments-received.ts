import { z } from 'zod'
import { Decimal } from './money'

// ── Vocabularies & Statuses ────────────────────────────────────────────────
export const CLIENT_PAYMENT_STATUSES = [
  'draft',
  'pending_clearance',
  'cleared',
  'bounced',
  'cancelled',
] as const

export type ClientPaymentStatus = (typeof CLIENT_PAYMENT_STATUSES)[number]

export const CLIENT_PAYMENT_STATUS_LABELS: Record<ClientPaymentStatus, string> = {
  draft: 'Draft',
  pending_clearance: 'In Clearance',
  cleared: 'Cleared / Credited',
  bounced: 'Bounced / Failed',
  cancelled: 'Cancelled',
}

export const CLIENT_PAYMENT_STATUS_BADGES: Record<ClientPaymentStatus, string> = {
  draft: 'badge-neutral',
  pending_clearance: 'badge-warning',
  cleared: 'badge-success',
  bounced: 'badge-danger',
  cancelled: 'badge-muted',
}

export const CLIENT_PAYMENT_TYPES = [
  'invoice_payment',
  'advance_payment',
  'retention_release',
  'security_deposit',
  'other',
] as const

export type ClientPaymentType = (typeof CLIENT_PAYMENT_TYPES)[number]

export const CLIENT_PAYMENT_TYPE_LABELS: Record<ClientPaymentType, string> = {
  invoice_payment: 'Invoice Settlement',
  advance_payment: 'Advance Payment',
  retention_release: 'Retention Release',
  security_deposit: 'Security Deposit',
  other: 'Other Receipt',
}

export const PAYMENT_MODES = [
  'neft',
  'rtgs',
  'imps',
  'cheque',
  'upi',
  'bank_transfer',
  'wire_transfer',
  'cash',
  'other',
] as const

export type PaymentMode = (typeof PAYMENT_MODES)[number]

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  neft: 'NEFT',
  rtgs: 'RTGS',
  imps: 'IMPS',
  cheque: 'Cheque / DD',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  wire_transfer: 'Wire Transfer / Swift',
  cash: 'Cash',
  other: 'Other',
}

// ── Validators shared across client and server ─────────────────────────────
const emptyToNull = (value: unknown) =>
  value === '' || value === undefined ? null : typeof value === 'string' ? value.trim() || null : value

const optionalShortText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().default(null))
const optionalDate = z.preprocess(emptyToNull, z.string().date().nullable().default(null))
const optionalUuid = z.preprocess(emptyToNull, z.string().uuid().nullable().default(null))

export const paymentAllocationInputSchema = z.object({
  invoiceId: z.string().uuid(),
  allocatedAmountPaise: z.number().int().min(1, 'Allocated amount must be positive'),
  notes: optionalShortText(500),
})

export type PaymentAllocationInput = z.infer<typeof paymentAllocationInputSchema>

export const paymentReceivedInputSchema = z.object({
  companyId: optionalUuid,
  companyName: z.string().trim().min(1, 'Client / Company name is required').max(255),
  projectId: optionalUuid,
  projectName: optionalShortText(255),
  invoiceId: optionalUuid,
  invoiceNumber: optionalShortText(50),
  clientPoId: optionalUuid,
  clientPoNumber: optionalShortText(100),
  bankId: optionalUuid,
  bankName: optionalShortText(150),
  bankAccountNumber: optionalShortText(50),
  paymentDate: z.string().date('Valid payment date is required'),
  paymentType: z.enum(CLIENT_PAYMENT_TYPES).default('invoice_payment'),
  paymentMode: z.enum(PAYMENT_MODES).default('neft'),
  transactionReference: optionalShortText(100),
  chequeDate: optionalDate,
  chequeBank: optionalShortText(150),
  amountPaise: z.number().int().min(1, 'Gross amount must be at least 1 paise').max(Number.MAX_SAFE_INTEGER),
  tdsDeductedPaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  bankChargesPaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  status: z.enum(CLIENT_PAYMENT_STATUSES).default('cleared'),
  notes: optionalShortText(5000),
  receiptUrl: optionalShortText(500),
  allocations: z.array(paymentAllocationInputSchema).default([]),
})

export type PaymentReceivedInput = z.infer<typeof paymentReceivedInputSchema>

export const paymentReceivedUpdateSchema = paymentReceivedInputSchema.extend({
  id: z.string().uuid(),
})

export type PaymentReceivedUpdate = z.infer<typeof paymentReceivedUpdateSchema>

export const paymentReceivedStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(CLIENT_PAYMENT_STATUSES),
})

export const paymentReceivedIdSchema = z.object({
  id: z.string().uuid(),
})

// ── Financial Calculation Helpers ──────────────────────────────────────────
export function computePaymentReceivedNet(
  amountPaise: number,
  tdsDeductedPaise = 0,
  bankChargesPaise = 0,
): number {
  const gross = new Decimal(amountPaise || 0)
  const tds = new Decimal(tdsDeductedPaise || 0)
  const charges = new Decimal(bankChargesPaise || 0)
  const net = gross.minus(tds).minus(charges)
  return Math.max(0, net.toNumber())
}

export interface PaymentReceivedListItem {
  id: string
  receiptNumber: string
  companyId: string | null
  companyName: string
  projectId: string | null
  projectName: string | null
  invoiceId: string | null
  invoiceNumber: string | null
  clientPoId: string | null
  clientPoNumber: string | null
  bankId: string | null
  bankName: string | null
  bankAccountNumber: string | null
  paymentDate: string
  paymentType: ClientPaymentType
  paymentMode: PaymentMode
  transactionReference: string | null
  chequeDate: string | null
  chequeBank: string | null
  amountPaise: number
  tdsDeductedPaise: number
  bankChargesPaise: number
  netAmountPaise: number
  status: ClientPaymentStatus
  receiptUrl: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PaymentReceivedAllocationItem {
  id: string
  invoiceId: string
  invoiceNumber: string | null
  allocatedAmountPaise: number
  notes: string | null
}

export interface PaymentReceivedActivityItem {
  id: string
  actorUserId: string | null
  actorName: string
  action: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export interface PaymentReceivedDetail extends PaymentReceivedListItem {
  allocations: PaymentReceivedAllocationItem[]
  activities: PaymentReceivedActivityItem[]
}

export interface PaymentsReceivedStats {
  totalReceivedPaise: number
  clearedPaise: number
  pendingPaise: number
  totalTdsPaise: number
  netDepositedPaise: number
  totalCount: number
  clearedCount: number
  pendingCount: number
}

export function computePaymentsReceivedStats(
  items: readonly PaymentReceivedListItem[],
): PaymentsReceivedStats {
  let totalReceived = new Decimal(0)
  let cleared = new Decimal(0)
  let pending = new Decimal(0)
  let totalTds = new Decimal(0)
  let netDeposited = new Decimal(0)
  let clearedCount = 0
  let pendingCount = 0

  for (const item of items) {
    const amt = new Decimal(item.amountPaise || 0)
    const net = new Decimal(item.netAmountPaise || 0)
    const tds = new Decimal(item.tdsDeductedPaise || 0)

    totalReceived = totalReceived.plus(amt)
    totalTds = totalTds.plus(tds)

    if (item.status === 'cleared') {
      cleared = cleared.plus(amt)
      netDeposited = netDeposited.plus(net)
      clearedCount++
    } else if (item.status === 'pending_clearance' || item.status === 'draft') {
      pending = pending.plus(amt)
      pendingCount++
    }
  }

  return {
    totalReceivedPaise: totalReceived.toNumber(),
    clearedPaise: cleared.toNumber(),
    pendingPaise: pending.toNumber(),
    totalTdsPaise: totalTds.toNumber(),
    netDepositedPaise: netDeposited.toNumber(),
    totalCount: items.length,
    clearedCount,
    pendingCount,
  }
}

export interface PaymentReceivedFormOptions {
  companies: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string; companyId: string | null }>
  saleInvoices: Array<{
    id: string
    invoiceNumber: string
    clientName: string
    companyId: string | null
    projectId: string | null
    totalPaise: number
    amountPaidPaise: number
    balanceDuePaise: number
  }>
  banks: Array<{
    id: string
    bankName: string
    accountNumber: string
    ifscCode: string
    branchName: string | null
    isPrimary: boolean
  }>
}

export interface PaymentsReceivedPagePayload {
  payments: PaymentReceivedListItem[]
  options: PaymentReceivedFormOptions
  canWrite: boolean
  isAdmin: boolean
}
