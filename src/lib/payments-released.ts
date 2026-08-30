import { z } from 'zod'
import { Decimal } from './money'
import { PAYMENT_MODES, type PaymentMode, PAYMENT_MODE_LABELS } from './payments-received'

// ── Vocabularies & Statuses ────────────────────────────────────────────────
export const PAYMENT_RELEASE_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'processed',
  'cleared',
  'failed',
  'cancelled',
] as const

export type PaymentReleaseStatus = (typeof PAYMENT_RELEASE_STATUSES)[number]

export const PAYMENT_RELEASE_STATUS_LABELS: Record<PaymentReleaseStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  processed: 'Processing',
  cleared: 'Disbursed / Cleared',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export const PAYMENT_RELEASE_STATUS_BADGES: Record<PaymentReleaseStatus, string> = {
  draft: 'badge-neutral',
  pending_approval: 'badge-warning',
  approved: 'badge-cyan',
  processed: 'badge-primary',
  cleared: 'badge-success',
  failed: 'badge-danger',
  cancelled: 'badge-muted',
}

export const PAYMENT_RELEASE_TYPES = [
  'advance_refund',
  'security_deposit_refund',
  'retention_release',
  'excess_payment_refund',
  'credit_settlement',
  'other',
] as const

export type PaymentReleaseType = (typeof PAYMENT_RELEASE_TYPES)[number]

export const PAYMENT_RELEASE_TYPE_LABELS: Record<PaymentReleaseType, string> = {
  advance_refund: 'Client Advance Refund',
  security_deposit_refund: 'Security Deposit / EMD Refund',
  retention_release: 'Retention Release',
  excess_payment_refund: 'Excess Payment Refund',
  credit_settlement: 'Credit Note Settlement',
  other: 'Other Client Disbursement',
}

export { PAYMENT_MODES, type PaymentMode, PAYMENT_MODE_LABELS }

// ── Validators shared across client and server ─────────────────────────────
const emptyToNull = (value: unknown) =>
  value === '' || value === undefined ? null : typeof value === 'string' ? value.trim() || null : value

const optionalShortText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().default(null))
const optionalDate = z.preprocess(emptyToNull, z.string().date().nullable().default(null))
const optionalUuid = z.preprocess(emptyToNull, z.string().uuid().nullable().default(null))

export const paymentReleasedInputSchema = z.object({
  companyId: optionalUuid,
  companyName: z.string().trim().min(1, 'Client / Company name is required').max(255),
  projectId: optionalUuid,
  projectName: optionalShortText(255),
  saleInvoiceId: optionalUuid,
  invoiceNumber: optionalShortText(50),
  disbursingBankId: optionalUuid,
  disbursingBankName: optionalShortText(150),
  clientBankName: optionalShortText(150),
  clientAccountNumber: optionalShortText(50),
  clientIfscCode: optionalShortText(11),
  releaseDate: z.string().date('Valid release date is required'),
  releaseType: z.enum(PAYMENT_RELEASE_TYPES).default('advance_refund'),
  paymentMode: z.enum(PAYMENT_MODES).default('neft'),
  transactionReference: optionalShortText(100),
  amountPaise: z.number().int().min(1, 'Gross amount must be at least 1 paise').max(Number.MAX_SAFE_INTEGER),
  deductionPaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  status: z.enum(PAYMENT_RELEASE_STATUSES).default('draft'),
  reason: optionalShortText(500),
  notes: optionalShortText(5000),
  attachmentUrl: optionalShortText(500),
})

export type PaymentReleasedInput = z.infer<typeof paymentReleasedInputSchema>

export const paymentReleasedUpdateSchema = paymentReleasedInputSchema.extend({
  id: z.string().uuid(),
})

export type PaymentReleasedUpdate = z.infer<typeof paymentReleasedUpdateSchema>

export const paymentReleasedStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(PAYMENT_RELEASE_STATUSES),
})

export const paymentReleasedIdSchema = z.object({
  id: z.string().uuid(),
})

// ── Financial Calculations ─────────────────────────────────────────────────
export function computePaymentReleasedNet(
  amountPaise: number,
  deductionPaise = 0,
): number {
  const gross = new Decimal(amountPaise || 0)
  const ded = new Decimal(deductionPaise || 0)
  const net = gross.minus(ded)
  return Math.max(0, net.toNumber())
}

export interface PaymentReleasedListItem {
  id: string
  paymentNumber: string
  companyId: string | null
  companyName: string
  projectId: string | null
  projectName: string | null
  saleInvoiceId: string | null
  invoiceNumber: string | null
  disbursingBankId: string | null
  disbursingBankName: string | null
  clientBankName: string | null
  clientAccountNumber: string | null
  clientIfscCode: string | null
  releaseDate: string
  releaseType: PaymentReleaseType
  paymentMode: PaymentMode
  transactionReference: string | null
  amountPaise: number
  deductionPaise: number
  netAmountPaise: number
  status: PaymentReleaseStatus
  reason: string | null
  notes: string | null
  attachmentUrl: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PaymentReleasedActivityItem {
  id: string
  actorUserId: string | null
  actorName: string
  action: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export interface PaymentReleasedDetail extends PaymentReleasedListItem {
  activities: PaymentReleasedActivityItem[]
}

export interface PaymentsReleasedStats {
  totalReleasedPaise: number
  clearedPaise: number
  pendingApprovalPaise: number
  approvedPaise: number
  totalCount: number
  clearedCount: number
  pendingCount: number
}

export function computePaymentsReleasedStats(
  items: readonly PaymentReleasedListItem[],
): PaymentsReleasedStats {
  let totalReleased = new Decimal(0)
  let cleared = new Decimal(0)
  let pendingApproval = new Decimal(0)
  let approved = new Decimal(0)
  let clearedCount = 0
  let pendingCount = 0

  for (const item of items) {
    const amt = new Decimal(item.amountPaise || 0)
    totalReleased = totalReleased.plus(amt)

    if (item.status === 'cleared' || item.status === 'processed') {
      cleared = cleared.plus(amt)
      clearedCount++
    } else if (item.status === 'pending_approval' || item.status === 'draft') {
      pendingApproval = pendingApproval.plus(amt)
      pendingCount++
    } else if (item.status === 'approved') {
      approved = approved.plus(amt)
    }
  }

  return {
    totalReleasedPaise: totalReleased.toNumber(),
    clearedPaise: cleared.toNumber(),
    pendingApprovalPaise: pendingApproval.toNumber(),
    approvedPaise: approved.toNumber(),
    totalCount: items.length,
    clearedCount,
    pendingCount,
  }
}

export interface PaymentReleasedFormOptions {
  companies: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string; companyId: string | null }>
  saleInvoices: Array<{
    id: string
    invoiceNumber: string
    clientName: string
    companyId: string | null
    projectId: string | null
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

export interface PaymentsReleasedPagePayload {
  payments: PaymentReleasedListItem[]
  options: PaymentReleasedFormOptions
  canWrite: boolean
  isAdmin: boolean
}
