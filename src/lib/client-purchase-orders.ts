import { z } from 'zod'
import { Decimal } from './money'

// ── Vocabulary & Statuses ──────────────────────────────────────────────────
/**
 * Client purchase orders — orders received from customers/clients.
 * Pipeline stages:
 * - draft: initial entry / extracting PO PDF
 * - acknowledged: confirmed with client, queued for execution
 * - in_progress: project milestones actively executing
 * - fulfilled: all deliverables completed & fully invoiced
 * - on_hold: client put work on hold
 * - cancelled: terminated by client
 */
export const CLIENT_PURCHASE_ORDER_STATUSES = [
  'draft',
  'acknowledged',
  'in_progress',
  'fulfilled',
  'on_hold',
  'cancelled',
] as const

export type ClientPurchaseOrderStatus = (typeof CLIENT_PURCHASE_ORDER_STATUSES)[number]

export const CLIENT_PURCHASE_ORDER_STATUS_LABELS: Record<ClientPurchaseOrderStatus, string> = {
  draft: 'Draft',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  fulfilled: 'Fulfilled',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
}

export const CLIENT_PURCHASE_ORDER_STATUS_BADGES: Record<ClientPurchaseOrderStatus, string> = {
  draft: 'badge-neutral',
  acknowledged: 'badge-cyan',
  in_progress: 'badge-primary',
  fulfilled: 'badge-success',
  on_hold: 'badge-warning',
  cancelled: 'badge-danger',
}

export const OPEN_CLIENT_PO_STATUSES: readonly ClientPurchaseOrderStatus[] = [
  'draft',
  'acknowledged',
  'in_progress',
]

/** Statutory GST default — 1800 basis points = 18.00%. */
export const CLIENT_PURCHASE_ORDER_DEFAULT_TAX_BPS = 1800

// ── Validators shared across client and server ─────────────────────────────
const emptyToNull = (value: unknown) =>
  value === '' || value === undefined ? null : typeof value === 'string' ? value.trim() || null : value

const optionalShortText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().default(null))
const optionalDate = z.preprocess(emptyToNull, z.string().date().nullable().default(null))
const optionalUuid = z.preprocess(emptyToNull, z.string().uuid().nullable().default(null))
const optionalEmail = z.preprocess(emptyToNull, z.string().trim().max(255).email().nullable().default(null))

export const clientPurchaseOrderItemInputSchema = z.object({
  itemCode: optionalShortText(100),
  description: z.string().trim().min(1, 'Item description is required').max(500),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(1_000_000).default(1),
  unit: z.string().trim().min(1).max(50).default('nos'),
  unitPricePaise: z.number().int().min(0, 'Unit price cannot be negative').max(Number.MAX_SAFE_INTEGER).default(0),
  taxRateBps: z.number().int().min(0).max(10_000).default(CLIENT_PURCHASE_ORDER_DEFAULT_TAX_BPS),
})

export type ClientPurchaseOrderItemInput = z.infer<typeof clientPurchaseOrderItemInputSchema>

export const clientPurchaseOrderInputSchema = z.object({
  clientPoNumber: z.string().trim().min(1, 'Client PO reference is required').max(100),
  companyId: optionalUuid,
  companyName: z.string().trim().min(1, 'Client/Company name is required').max(255),
  clientContactName: optionalShortText(255),
  clientContactEmail: optionalEmail,
  clientContactPhone: optionalShortText(50),
  billingAddress: optionalShortText(10_000),
  shippingAddress: optionalShortText(10_000),
  clientGstin: optionalShortText(20),
  clientPan: optionalShortText(20),
  proposalId: optionalUuid,
  projectId: optionalUuid,
  subject: optionalShortText(500),
  poDate: optionalDate,
  receivedDate: optionalDate,
  deliveryDueDate: optionalDate,
  status: z.enum(CLIENT_PURCHASE_ORDER_STATUSES).default('draft'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  taxRateBps: z.number().int().min(0).max(10_000).default(CLIENT_PURCHASE_ORDER_DEFAULT_TAX_BPS),
  discountPaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  paymentTerms: optionalShortText(5000),
  deliveryTerms: optionalShortText(5000),
  scopeOfWork: optionalShortText(10_000),
  specialInstructions: optionalShortText(5000),
  attachmentUrl: optionalShortText(500),
  notes: optionalShortText(10_000),
  items: z.array(clientPurchaseOrderItemInputSchema).max(500).default([]),
})

export type ClientPurchaseOrderInput = z.infer<typeof clientPurchaseOrderInputSchema>

export const clientPurchaseOrderUpdateSchema = clientPurchaseOrderInputSchema.extend({
  id: z.string().uuid(),
})

export type ClientPurchaseOrderUpdate = z.infer<typeof clientPurchaseOrderUpdateSchema>

export const clientPurchaseOrderStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(CLIENT_PURCHASE_ORDER_STATUSES),
})

export const clientPurchaseOrderIdSchema = z.object({
  id: z.string().uuid(),
})

// ── Financial Math (Strict Decimal.js & Paise Integers) ─────────────────────
export type ClientPurchaseOrderTotals = {
  subtotalPaise: number
  taxAmountPaise: number
  cgstAmountPaise: number
  sgstAmountPaise: number
  igstAmountPaise: number
  discountPaise: number
  totalPaise: number
}

export function computeClientPurchaseOrderTotals(
  items: readonly { quantity: number; unitPricePaise: number }[],
  discountPaise: number = 0,
  taxRateBps: number = CLIENT_PURCHASE_ORDER_DEFAULT_TAX_BPS,
): ClientPurchaseOrderTotals {
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
export type ClientPurchaseOrderListItem = {
  id: string
  orderNumber: string
  clientPoNumber: string
  companyId: string | null
  companyName: string
  clientContactName: string | null
  subject: string | null
  poDate: string | null
  deliveryDueDate: string | null
  status: ClientPurchaseOrderStatus
  priority: 'low' | 'medium' | 'high'
  subtotalPaise: number
  taxAmountPaise: number
  totalPaise: number
  invoicedAmountPaise: number
  remainingAmountPaise: number
  createdAt: string
}

export type ClientPurchaseOrderItemView = {
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

export type ClientPurchaseOrderActivityView = {
  id: string
  actorUserId: string | null
  actorName: string
  action: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export type ClientPurchaseOrderDetail = ClientPurchaseOrderListItem & {
  clientContactEmail: string | null
  clientContactPhone: string | null
  billingAddress: string | null
  shippingAddress: string | null
  clientGstin: string | null
  clientPan: string | null
  proposalId: string | null
  proposalNumber?: string | null
  projectId: string | null
  projectName?: string | null
  receivedDate: string | null
  taxRateBps: number
  discountPaise: number
  cgstAmountPaise: number
  sgstAmountPaise: number
  igstAmountPaise: number
  paymentTerms: string | null
  deliveryTerms: string | null
  scopeOfWork: string | null
  specialInstructions: string | null
  attachmentUrl: string | null
  notes: string | null
  items: ClientPurchaseOrderItemView[]
  activities: ClientPurchaseOrderActivityView[]
}

export type ClientPurchaseOrderStats = {
  totalCount: number
  totalValuePaise: number
  openCount: number
  openValuePaise: number
  inProgressCount: number
  inProgressValuePaise: number
  fulfilledCount: number
  fulfilledValuePaise: number
  invoicedValuePaise: number
  remainingValuePaise: number
}

export function computeClientPurchaseOrderStats(
  orders: readonly ClientPurchaseOrderListItem[],
): ClientPurchaseOrderStats {
  let totalValue = new Decimal(0)
  let openCount = 0
  let openValue = new Decimal(0)
  let inProgressCount = 0
  let inProgressValue = new Decimal(0)
  let fulfilledCount = 0
  let fulfilledValue = new Decimal(0)
  let invoicedValue = new Decimal(0)
  let remainingValue = new Decimal(0)

  for (const order of orders) {
    const val = new Decimal(order.totalPaise)
    totalValue = totalValue.plus(val)
    invoicedValue = invoicedValue.plus(new Decimal(order.invoicedAmountPaise))
    remainingValue = remainingValue.plus(new Decimal(order.remainingAmountPaise || Math.max(0, order.totalPaise - order.invoicedAmountPaise)))

    if (order.status === 'draft' || order.status === 'acknowledged') {
      openCount++
      openValue = openValue.plus(val)
    } else if (order.status === 'in_progress') {
      inProgressCount++
      inProgressValue = inProgressValue.plus(val)
    } else if (order.status === 'fulfilled') {
      fulfilledCount++
      fulfilledValue = fulfilledValue.plus(val)
    }
  }

  return {
    totalCount: orders.length,
    totalValuePaise: totalValue.toNumber(),
    openCount,
    openValuePaise: openValue.toNumber(),
    inProgressCount,
    inProgressValuePaise: inProgressValue.toNumber(),
    fulfilledCount,
    fulfilledValuePaise: fulfilledValue.toNumber(),
    invoicedValuePaise: invoicedValue.toNumber(),
    remainingValuePaise: remainingValue.toNumber(),
  }
}

export type ClientPurchaseOrderFormOptions = {
  companies: { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null; gstin?: string | null }[]
  proposals: { id: string; proposalNumber: string; title: string; companyId?: string | null; companyName: string }[]
  projects: { id: string; projectNumber: string; name: string; companyId?: string | null; companyName: string }[]
}

export type ClientPurchaseOrdersPagePayload = {
  authorized: boolean
  canWrite: boolean
  orders: ClientPurchaseOrderListItem[]
  options: ClientPurchaseOrderFormOptions
}
