import { z } from 'zod'
import { Decimal } from './money'

// ── Vocabulary ────────────────────────────────────────────────────────────
/**
 * Vendor quotations — quotations RECEIVED from vendors (the old CRM's
 * misleadingly named `outgoing_quotations` table, rendered as the
 * "Quotation (Incoming)" page). Independent status vocabulary from the
 * customer-facing proposal pipeline: a vendor quote is drafted, sent for
 * internal approval, then approved/rejected, or expires.
 */
export const VENDOR_QUOTATION_STATUSES = ['draft', 'sent', 'approved', 'rejected', 'expired'] as const

export type VendorQuotationStatus = (typeof VENDOR_QUOTATION_STATUSES)[number]

export const VENDOR_QUOTATION_STATUS_LABELS: Record<VendorQuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
}

export const VENDOR_QUOTATION_STATUS_BADGES: Record<VendorQuotationStatus, string> = {
  draft: 'badge-neutral',
  sent: 'badge-cyan',
  approved: 'badge-success',
  rejected: 'badge-danger',
  expired: 'badge-warning',
}

/** Statuses still awaiting a decision (KPI "open" bucket). */
export const OPEN_VENDOR_QUOTATION_STATUSES: readonly VendorQuotationStatus[] = ['draft', 'sent']

/** Statutory GST default — 1800 basis points = 18.00%. */
export const VENDOR_QUOTATION_DEFAULT_TAX_BPS = 1800

// ── Validators shared by server functions ────────────────────────────────
const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

const optionalShortText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable())
const optionalDate = z.preprocess(emptyToNull, z.string().date().nullable())
const optionalMoney = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
)

export const vendorQuotationItemInputSchema = z.object({
  description: z.string().trim().min(1, 'Item description is required').max(500),
  quantity: z.number().int().min(1).max(100_000),
  unitPricePaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
})

export const vendorQuotationInputSchema = z.object({
  vendorId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  vendorName: z.string().trim().min(1, 'Vendor name is required').max(255),
  vendorEmail: z.preprocess(emptyToNull, z.string().trim().max(255).email().nullable()),
  vendorPhone: optionalShortText(50),
  vendorAddress: optionalShortText(10_000),
  subject: optionalShortText(500),
  projectId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  quotationDate: optionalDate,
  taxRateBps: z.number().int().min(0).max(10_000),
  manualSubtotalPaise: optionalMoney,
  discountPaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  validUntil: optionalDate,
  notes: optionalShortText(10_000),
  terms: optionalShortText(10_000),
  status: z.enum(VENDOR_QUOTATION_STATUSES),
  items: z.array(vendorQuotationItemInputSchema).max(200),
})

export type VendorQuotationInput = z.infer<typeof vendorQuotationInputSchema>

export const vendorQuotationUpdateSchema = vendorQuotationInputSchema.extend({
  id: z.string().uuid(),
})
export type VendorQuotationUpdate = z.infer<typeof vendorQuotationUpdateSchema>

export const vendorQuotationStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(VENDOR_QUOTATION_STATUSES),
})

export const vendorQuotationIdSchema = z.object({
  id: z.string().uuid(),
})

// ── Serialized shapes crossing the RPC boundary ──────────────────────────
export type VendorQuotationListItem = {
  id: string
  quotationNumber: string
  quotationDate: string | null
  vendorId: string | null
  vendorName: string
  subject: string | null
  status: VendorQuotationStatus
  totalPaise: number
  validUntil: string | null
  createdAt: string
}

export type VendorQuotationItemLine = {
  id: string
  description: string
  quantity: number
  unitPricePaise: number
  amountPaise: number
}

export type VendorQuotationDetail = {
  id: string
  quotationNumber: string
  quotationDate: string | null
  vendorId: string | null
  vendorName: string
  vendorEmail: string | null
  vendorPhone: string | null
  vendorAddress: string | null
  subject: string | null
  projectId: string | null
  projectName: string | null
  taxRateBps: number
  manualSubtotalPaise: number | null
  discountPaise: number
  taxAmountPaise: number
  totalPaise: number
  validUntil: string | null
  notes: string | null
  terms: string | null
  status: VendorQuotationStatus
  items: VendorQuotationItemLine[]
  createdAt: string
  updatedAt: string
}

export type VendorQuotationFormOptions = {
  vendors: { id: string; code: string; name: string }[]
  projects: { id: string; name: string }[]
}

export type VendorQuotationsPagePayload = {
  authorized: boolean
  canWrite: boolean
  quotations: VendorQuotationListItem[]
  options: VendorQuotationFormOptions
}

export type VendorQuotationDetailPayload = {
  authorized: boolean
  canWrite: boolean
  quotation: VendorQuotationDetail | null
  options: VendorQuotationFormOptions
}

// ── Totals (exact integer-paise math, Decimal only for the tax rounding) ──
export type VendorQuotationTotals = {
  subtotalPaise: number
  taxablePaise: number
  taxPaise: number
  totalPaise: number
}

/** Sum of item line amounts — integer paise math, safe for display. */
export function vendorQuotationItemsTotalPaise(
  items: readonly { quantity: number; unitPricePaise: number }[],
): number {
  return items.reduce((total, item) => total + item.quantity * item.unitPricePaise, 0)
}

/**
 * Server-authoritative totals recomputed on every save. Item lines win over
 * the manual subtotal (same precedence as proposal quotation lines). The
 * discount is clamped to the subtotal so the tax base never goes negative,
 * and tax = taxable × rate(bps)/10000 rounds HALF_UP into whole paise
 * exactly once, at the end.
 */
export function computeVendorQuotationTotals(input: {
  items: readonly { quantity: number; unitPricePaise: number }[]
  manualSubtotalPaise: number | null
  taxRateBps: number
  discountPaise: number
}): VendorQuotationTotals {
  const subtotalPaise =
    input.items.length > 0 ? vendorQuotationItemsTotalPaise(input.items) : Math.max(0, input.manualSubtotalPaise ?? 0)
  const discountPaise = Math.min(Math.max(0, input.discountPaise), subtotalPaise)
  const taxablePaise = subtotalPaise - discountPaise

  // Decimal keeps the bps division exact; money.ts configures ROUND_HALF_UP.
  const taxPaise = new Decimal(taxablePaise).times(input.taxRateBps).dividedBy(10_000).toDecimalPlaces(0).toNumber()

  return { subtotalPaise, taxablePaise, taxPaise, totalPaise: taxablePaise + taxPaise }
}

// ── Client-side rollups (mirror computeQuotationStats) ────────────────────
export type VendorQuotationStats = {
  totalCount: number
  draftCount: number
  sentCount: number
  approvedCount: number
  rejectedCount: number
  expiredCount: number
  /** Value still awaiting a decision (draft + sent). */
  openValuePaise: number
  approvedValuePaise: number
  totalValuePaise: number
}

export function computeVendorQuotationStats(
  quotations: readonly { status: VendorQuotationStatus; totalPaise: number }[],
): VendorQuotationStats {
  let draftCount = 0
  let sentCount = 0
  let approvedCount = 0
  let rejectedCount = 0
  let expiredCount = 0
  let openValuePaise = 0
  let approvedValuePaise = 0
  let totalValuePaise = 0

  for (const quotation of quotations) {
    totalValuePaise += quotation.totalPaise
    switch (quotation.status) {
      case 'draft':
        draftCount += 1
        break
      case 'sent':
        sentCount += 1
        break
      case 'approved':
        approvedCount += 1
        approvedValuePaise += quotation.totalPaise
        break
      case 'rejected':
        rejectedCount += 1
        break
      case 'expired':
        expiredCount += 1
        break
    }
    if (OPEN_VENDOR_QUOTATION_STATUSES.includes(quotation.status)) openValuePaise += quotation.totalPaise
  }

  return {
    totalCount: quotations.length,
    draftCount,
    sentCount,
    approvedCount,
    rejectedCount,
    expiredCount,
    openValuePaise,
    approvedValuePaise,
    totalValuePaise,
  }
}
