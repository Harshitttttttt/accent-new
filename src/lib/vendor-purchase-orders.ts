import { z } from 'zod'
import { Decimal } from './money'

// ── Vocabulary & Statuses ──────────────────────────────────────────────────
/**
 * Vendor purchase orders — orders issued by Accent Techno to suppliers / subcontractors.
 * Workflow stages:
 * - draft: initial preparation by engineer/procurement
 * - pending_approval: internal management/PM authorization needed
 * - approved: authorized internally, ready to transmit
 * - issued: dispatched to vendor
 * - partially_received: partial delivery/service milestone received
 * - fulfilled: all items/services completely delivered & verified
 * - cancelled: voided order
 */
export const VENDOR_PURCHASE_ORDER_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'issued',
  'partially_received',
  'fulfilled',
  'cancelled',
] as const

export type VendorPurchaseOrderStatus = (typeof VENDOR_PURCHASE_ORDER_STATUSES)[number]

export const VENDOR_PURCHASE_ORDER_STATUS_LABELS: Record<VendorPurchaseOrderStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  issued: 'Issued to Vendor',
  partially_received: 'Partially Received',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
}

export const VENDOR_PURCHASE_ORDER_STATUS_BADGES: Record<VendorPurchaseOrderStatus, string> = {
  draft: 'badge-neutral',
  pending_approval: 'badge-warning',
  approved: 'badge-cyan',
  issued: 'badge-primary',
  partially_received: 'badge-purple',
  fulfilled: 'badge-success',
  cancelled: 'badge-danger',
}

export const OPEN_VENDOR_PO_STATUSES: readonly VendorPurchaseOrderStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'issued',
  'partially_received',
]

/** Statutory GST default — 1800 basis points = 18.00%. */
export const VENDOR_PURCHASE_ORDER_DEFAULT_TAX_BPS = 1800

// ── Validators shared across client and server ─────────────────────────────
const emptyToNull = (value: unknown) =>
  value === '' || value === undefined ? null : typeof value === 'string' ? value.trim() || null : value

const optionalShortText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().default(null))
const optionalDate = z.preprocess(emptyToNull, z.string().date().nullable().default(null))
const optionalUuid = z.preprocess(emptyToNull, z.string().uuid().nullable().default(null))
const optionalEmail = z.preprocess(emptyToNull, z.string().trim().max(255).email().nullable().default(null))

export const vendorPurchaseOrderItemInputSchema = z.object({
  itemCode: optionalShortText(100),
  description: z.string().trim().min(1, 'Item description is required').max(500),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(1_000_000).default(1),
  unit: z.string().trim().min(1).max(50).default('nos'),
  unitPricePaise: z.number().int().min(0, 'Unit price cannot be negative').max(Number.MAX_SAFE_INTEGER).default(0),
  taxRateBps: z.number().int().min(0).max(10_000).default(VENDOR_PURCHASE_ORDER_DEFAULT_TAX_BPS),
})

export type VendorPurchaseOrderItemInput = z.infer<typeof vendorPurchaseOrderItemInputSchema>

export const vendorPurchaseOrderInputSchema = z.object({
  vendorId: optionalUuid,
  vendorName: z.string().trim().min(1, 'Vendor name is required').max(255),
  vendorEmail: optionalEmail,
  vendorPhone: optionalShortText(50),
  vendorAddress: optionalShortText(10_000),
  vendorGstin: optionalShortText(20),
  vendorPan: optionalShortText(20),
  vendorQuotationId: optionalUuid,
  projectId: optionalUuid,
  subject: optionalShortText(500),
  poDate: optionalDate,
  expectedDeliveryDate: optionalDate,
  status: z.enum(VENDOR_PURCHASE_ORDER_STATUSES).default('draft'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  taxRateBps: z.number().int().min(0).max(10_000).default(VENDOR_PURCHASE_ORDER_DEFAULT_TAX_BPS),
  discountPaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  deliveryTerms: optionalShortText(5000),
  paymentTerms: optionalShortText(5000),
  shippingAddress: optionalShortText(10_000),
  modeOfDelivery: optionalShortText(100),
  attachmentUrl: optionalShortText(500),
  notes: optionalShortText(10_000),
  terms: optionalShortText(10_000),
  items: z.array(vendorPurchaseOrderItemInputSchema).max(500).default([]),
})

export type VendorPurchaseOrderInput = z.infer<typeof vendorPurchaseOrderInputSchema>

export const vendorPurchaseOrderUpdateSchema = vendorPurchaseOrderInputSchema.extend({
  id: z.string().uuid(),
})

export type VendorPurchaseOrderUpdate = z.infer<typeof vendorPurchaseOrderUpdateSchema>

export const vendorPurchaseOrderStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(VENDOR_PURCHASE_ORDER_STATUSES),
})

export const vendorPurchaseOrderIdSchema = z.object({
  id: z.string().uuid(),
})

// ── Financial Math (Strict Decimal.js & Paise Integers) ─────────────────────
export type VendorPurchaseOrderTotals = {
  subtotalPaise: number
  taxAmountPaise: number
  cgstAmountPaise: number
  sgstAmountPaise: number
  igstAmountPaise: number
  discountPaise: number
  totalPaise: number
}

export function computeVendorPurchaseOrderTotals(
  items: readonly { quantity: number; unitPricePaise: number }[],
  discountPaise: number = 0,
  taxRateBps: number = VENDOR_PURCHASE_ORDER_DEFAULT_TAX_BPS,
): VendorPurchaseOrderTotals {
  let subtotal = new Decimal(0)
  for (const item of items) {
    const qty = new Decimal(item.quantity)
    const unitPrice = new Decimal(item.unitPricePaise)
    subtotal = subtotal.plus(qty.times(unitPrice))
  }

  const safeDiscount = Decimal.min(new Decimal(discountPaise), subtotal)
  const taxable = Decimal.max(new Decimal(0), subtotal.minus(safeDiscount))

  // Tax rate BPS (1800 = 18.00% => divide by 10000)
  const rateMultiplier = new Decimal(taxRateBps).dividedBy(10000)
  const tax = taxable.times(rateMultiplier).round()

  // Default CGST + SGST split (9% + 9%)
  const halfTax = tax.dividedBy(2).round()
  const otherHalfTax = tax.minus(halfTax)

  const total = taxable.plus(tax)

  return {
    subtotalPaise: subtotal.toNumber(),
    discountPaise: safeDiscount.toNumber(),
    taxAmountPaise: tax.toNumber(),
    cgstAmountPaise: halfTax.toNumber(),
    sgstAmountPaise: otherHalfTax.toNumber(),
    igstAmountPaise: 0,
    totalPaise: total.toNumber(),
  }
}

// ── DTOs & Page Payloads ───────────────────────────────────────────────────
export type VendorPurchaseOrderListItem = {
  id: string
  poNumber: string
  vendorId: string | null
  vendorName: string
  subject: string | null
  poDate: string | null
  expectedDeliveryDate: string | null
  status: VendorPurchaseOrderStatus
  priority: 'low' | 'medium' | 'high'
  subtotalPaise: number
  taxAmountPaise: number
  totalPaise: number
  billedAmountPaise: number
  balanceAmountPaise: number
  approvedAt: string | null
  createdAt: string
}

export type VendorPurchaseOrderItemView = {
  id: string
  itemCode: string | null
  description: string
  quantity: number
  unit: string
  unitPricePaise: number
  taxRateBps: number
  amountPaise: number
  position: number
}

export type VendorPurchaseOrderActivityView = {
  id: string
  actorUserId: string | null
  actorName: string
  action: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export type VendorPurchaseOrderDetail = VendorPurchaseOrderListItem & {
  vendorEmail: string | null
  vendorPhone: string | null
  vendorAddress: string | null
  vendorGstin: string | null
  vendorPan: string | null
  vendorQuotationId: string | null
  quotationNumber?: string | null
  projectId: string | null
  projectName?: string | null
  taxRateBps: number
  discountPaise: number
  cgstAmountPaise: number
  sgstAmountPaise: number
  igstAmountPaise: number
  deliveryTerms: string | null
  paymentTerms: string | null
  shippingAddress: string | null
  modeOfDelivery: string | null
  attachmentUrl: string | null
  notes: string | null
  terms: string | null
  items: VendorPurchaseOrderItemView[]
  activities: VendorPurchaseOrderActivityView[]
}

export type VendorPurchaseOrderStats = {
  totalCount: number
  totalValuePaise: number
  pendingApprovalCount: number
  pendingApprovalValuePaise: number
  issuedCount: number
  issuedValuePaise: number
  fulfilledCount: number
  fulfilledValuePaise: number
  billedValuePaise: number
  balanceValuePaise: number
}

export function computeVendorPurchaseOrderStats(
  pos: readonly VendorPurchaseOrderListItem[],
): VendorPurchaseOrderStats {
  let totalValue = new Decimal(0)
  let pendingApprovalCount = 0
  let pendingApprovalValue = new Decimal(0)
  let issuedCount = 0
  let issuedValue = new Decimal(0)
  let fulfilledCount = 0
  let fulfilledValue = new Decimal(0)
  let billedValue = new Decimal(0)
  let balanceValue = new Decimal(0)

  for (const po of pos) {
    const val = new Decimal(po.totalPaise)
    totalValue = totalValue.plus(val)
    billedValue = billedValue.plus(new Decimal(po.billedAmountPaise))
    balanceValue = balanceValue.plus(new Decimal(po.balanceAmountPaise || Math.max(0, po.totalPaise - po.billedAmountPaise)))

    if (po.status === 'pending_approval' || po.status === 'draft') {
      pendingApprovalCount++
      pendingApprovalValue = pendingApprovalValue.plus(val)
    } else if (po.status === 'issued' || po.status === 'approved' || po.status === 'partially_received') {
      issuedCount++
      issuedValue = issuedValue.plus(val)
    } else if (po.status === 'fulfilled') {
      fulfilledCount++
      fulfilledValue = fulfilledValue.plus(val)
    }
  }

  return {
    totalCount: pos.length,
    totalValuePaise: totalValue.toNumber(),
    pendingApprovalCount,
    pendingApprovalValuePaise: pendingApprovalValue.toNumber(),
    issuedCount,
    issuedValuePaise: issuedValue.toNumber(),
    fulfilledCount,
    fulfilledValuePaise: fulfilledValue.toNumber(),
    billedValuePaise: billedValue.toNumber(),
    balanceValuePaise: balanceValue.toNumber(),
  }
}

export type VendorPurchaseOrderFormOptions = {
  vendors: { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null; gstin?: string | null; pan?: string | null }[]
  vendorQuotations: { id: string; quotationNumber: string; vendorId?: string | null; vendorName: string; subject?: string | null; totalPaise: number }[]
  projects: { id: string; projectNumber: string; name: string; companyName?: string }[]
}

export type VendorPurchaseOrdersPagePayload = {
  authorized: boolean
  canWrite: boolean
  orders: VendorPurchaseOrderListItem[]
  options: VendorPurchaseOrderFormOptions
}
