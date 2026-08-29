import { z } from 'zod'
import { Decimal } from './money'

// ── Vocabularies ──────────────────────────────────────────────────────────
// Sale = you SEND to client (receivable). Purchase = you RECEIVE from vendor (payable).
// Distinct status vocabularies mirror the old MySQL enums but now strongly typed
// and per-direction (a sale is 'sent'/'paid', a purchase is 'pending'/'approved').

export const SALE_INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const
export type SaleInvoiceStatus = (typeof SALE_INVOICE_STATUSES)[number]
export const SALE_INVOICE_STATUS_LABELS: Record<SaleInvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}
export const SALE_INVOICE_STATUS_BADGES: Record<SaleInvoiceStatus, string> = {
  draft: 'badge-neutral',
  sent: 'badge-cyan',
  paid: 'badge-success',
  overdue: 'badge-danger',
  cancelled: 'badge-muted',
}

export const PURCHASE_INVOICE_STATUSES = ['draft', 'pending', 'approved', 'paid', 'overdue', 'cancelled'] as const
export type PurchaseInvoiceStatus = (typeof PURCHASE_INVOICE_STATUSES)[number]
export const PURCHASE_INVOICE_STATUS_LABELS: Record<PurchaseInvoiceStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}
export const PURCHASE_INVOICE_STATUS_BADGES: Record<PurchaseInvoiceStatus, string> = {
  draft: 'badge-neutral',
  pending: 'badge-warning',
  approved: 'badge-cyan',
  paid: 'badge-success',
  overdue: 'badge-danger',
  cancelled: 'badge-muted',
}

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'overdue'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
}

export const GST_TYPES = ['cgst_sgst', 'igst'] as const
export type GstType = (typeof GST_TYPES)[number]

// ── Validators ───────────────────────────────────────────────────────────
const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)
const optText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable())
const optDate = z.preprocess(emptyToNull, z.string().date().nullable())
const paise = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const bps = z.number().int().min(0).max(10_000)

export const invoiceLineInputSchema = z.object({
  description: z.string().trim().min(1, 'Description required').max(500),
  quantity: z.number().int().min(1).max(100_000),
  unitPricePaise: paise,
})

export const saleInvoiceInputSchema = z.object({
  companyId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  clientName: z.string().trim().min(1, 'Client name required').max(255),
  clientEmail: z.preprocess(emptyToNull, z.string().trim().max(255).email().nullable()),
  clientPhone: optText(50),
  clientAddress: optText(10_000),
  clientGstin: optText(20),
  clientPan: optText(20),
  clientState: optText(100),
  clientStateCode: optText(10),
  kindAttn: optText(255),
  projectId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  poNumber: optText(100),
  poDate: optDate,
  originalPoValuePaise: z.preprocess((v) => (v === '' || v == null ? null : v), paise.nullable()),
  description: optText(500),
  gstNumber: optText(20),
  panNumber: optText(20),
  tanNumber: optText(20),
  serviceCategory: optText(500),
  bankAddress: optText(500),
  invoiceDate: optDate,
  dueDate: optDate,
  gstType: z.enum(GST_TYPES),
  cgstRateBps: bps,
  sgstRateBps: bps,
  igstRateBps: bps,
  discountPaise: paise,
  amountPaidPaise: paise,
  notes: optText(10_000),
  terms: optText(10_000),
  status: z.enum(SALE_INVOICE_STATUSES),
  items: z.array(invoiceLineInputSchema).max(200),
})

export const purchaseInvoiceInputSchema = z.object({
  vendorId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  vendorName: z.string().trim().min(1, 'Vendor name required').max(255),
  vendorEmail: z.preprocess(emptyToNull, z.string().trim().max(255).email().nullable()),
  vendorPhone: optText(50),
  vendorAddress: optText(10_000),
  vendorGstin: optText(20),
  vendorPan: optText(20),
  projectId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  poNumber: optText(100),
  poDate: optDate,
  description: optText(500),
  invoiceDate: optDate,
  dueDate: optDate,
  taxRateBps: bps,
  discountPaise: paise,
  amountPaidPaise: paise,
  notes: optText(10_000),
  terms: optText(10_000),
  attachmentUrl: optText(500),
  status: z.enum(PURCHASE_INVOICE_STATUSES),
  items: z.array(invoiceLineInputSchema).max(200),
})

export type SaleInvoiceInput = z.infer<typeof saleInvoiceInputSchema>
export type PurchaseInvoiceInput = z.infer<typeof purchaseInvoiceInputSchema>
export type SaleInvoiceUpdate = SaleInvoiceInput & { id: string }
export type PurchaseInvoiceUpdate = PurchaseInvoiceInput & { id: string }

// ── Serialized shapes ────────────────────────────────────────────────────
export type InvoiceLine = { id: string; description: string; quantity: number; unitPricePaise: number; amountPaise: number }

export type SaleInvoiceListItem = {
  id: string; invoiceNumber: string; invoiceDate: string | null; dueDate: string | null
  companyId: string | null; clientName: string; projectId: string | null
  subtotalPaise: number; discountPaise: number; taxAmountPaise: number; totalPaise: number
  amountPaidPaise: number; balanceDuePaise: number; status: SaleInvoiceStatus; createdAt: string
}
export type PurchaseInvoiceListItem = {
  id: string; invoiceNumber: string; invoiceDate: string | null; dueDate: string | null
  vendorId: string | null; vendorName: string; projectId: string | null
  subtotalPaise: number; discountPaise: number; taxAmountPaise: number; totalPaise: number
  amountPaidPaise: number; balanceDuePaise: number; paymentStatus: PaymentStatus; status: PurchaseInvoiceStatus; createdAt: string
}
export type SaleInvoiceDetail = SaleInvoiceListItem & {
  clientEmail: string | null; clientPhone: string | null; clientAddress: string | null; clientGstin: string | null; clientPan: string | null; clientState: string | null; clientStateCode: string | null; kindAttn: string | null
  poNumber: string | null; poDate: string | null; originalPoValuePaise: number | null; balancePoValuePaise: number | null
  description: string | null; gstNumber: string | null; panNumber: string | null; tanNumber: string | null; serviceCategory: string | null; bankAddress: string | null
  gstType: GstType; cgstRateBps: number; sgstRateBps: number; igstRateBps: number; notes: string | null; terms: string | null; projectName: string | null; companyName: string | null; items: InvoiceLine[]; updatedAt: string
}
export type PurchaseInvoiceDetail = PurchaseInvoiceListItem & {
  vendorEmail: string | null; vendorPhone: string | null; vendorAddress: string | null; vendorGstin: string | null; vendorPan: string | null
  poNumber: string | null; poDate: string | null; description: string | null; taxRateBps: number; cgstAmountPaise: number; sgstAmountPaise: number; igstAmountPaise: number; notes: string | null; terms: string | null; attachmentUrl: string | null; projectName: string | null; items: InvoiceLine[]; updatedAt: string
}
export type InvoiceFormOptions = {
  companies: { id: string; name: string }[]
  vendors: { id: string; code: string; name: string }[]
  projects: { id: string; name: string }[]
}
export type InvoicesPagePayload = {
  authorized: boolean; canWrite: boolean
  saleInvoices: SaleInvoiceListItem[]; purchaseInvoices: PurchaseInvoiceListItem[]
  options: InvoiceFormOptions
}
export type SaleInvoiceDetailPayload = { authorized: boolean; canWrite: boolean; invoice: SaleInvoiceDetail | null; options: InvoiceFormOptions }
export type PurchaseInvoiceDetailPayload = { authorized: boolean; canWrite: boolean; invoice: PurchaseInvoiceDetail | null; options: InvoiceFormOptions }

// ── Money helpers ────────────────────────────────────────────────────────
export function lineAmountPaise(qty: number, unitPaise: number): number { return qty * unitPaise }

export function invoiceLinesTotalPaise(items: readonly { quantity: number; unitPricePaise: number }[]): number {
  return items.reduce((s, i) => s + i.quantity * i.unitPricePaise, 0)
}

export type SaleTotals = { subtotalPaise: number; discountPaise: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; taxPaise: number; totalPaise: number; balanceDuePaise: number }
export function computeSaleTotals(input: { items: readonly { quantity: number; unitPricePaise: number }[]; discountPaise: number; gstType: GstType; cgstRateBps: number; sgstRateBps: number; igstRateBps: number; amountPaidPaise: number }): SaleTotals {
  const subtotalPaise = invoiceLinesTotalPaise(input.items)
  const discountPaise = Math.min(Math.max(0, input.discountPaise), subtotalPaise)
  const taxablePaise = subtotalPaise - discountPaise
  const cgstPaise = input.gstType === 'cgst_sgst' ? new Decimal(taxablePaise).times(input.cgstRateBps).dividedBy(10_000).toDecimalPlaces(0).toNumber() : 0
  const sgstPaise = input.gstType === 'cgst_sgst' ? new Decimal(taxablePaise).times(input.sgstRateBps).dividedBy(10_000).toDecimalPlaces(0).toNumber() : 0
  const igstPaise = input.gstType === 'igst' ? new Decimal(taxablePaise).times(input.igstRateBps).dividedBy(10_000).toDecimalPlaces(0).toNumber() : 0
  const taxPaise = cgstPaise + sgstPaise + igstPaise
  const totalPaise = taxablePaise + taxPaise
  const balanceDuePaise = Math.max(0, totalPaise - Math.min(input.amountPaidPaise, totalPaise))
  return { subtotalPaise, discountPaise, taxablePaise, cgstPaise, sgstPaise, igstPaise, taxPaise, totalPaise, balanceDuePaise }
}

export type PurchaseTotals = { subtotalPaise: number; discountPaise: number; taxablePaise: number; taxPaise: number; totalPaise: number; balanceDuePaise: number; paymentStatus: PaymentStatus }
export function computePurchaseTotals(input: { items: readonly { quantity: number; unitPricePaise: number }[]; discountPaise: number; taxRateBps: number; amountPaidPaise: number }): PurchaseTotals {
  const subtotalPaise = invoiceLinesTotalPaise(input.items)
  const discountPaise = Math.min(Math.max(0, input.discountPaise), subtotalPaise)
  const taxablePaise = subtotalPaise - discountPaise
  const taxPaise = new Decimal(taxablePaise).times(input.taxRateBps).dividedBy(10_000).toDecimalPlaces(0).toNumber()
  const totalPaise = taxablePaise + taxPaise
  const paid = Math.min(input.amountPaidPaise, totalPaise)
  const balanceDuePaise = Math.max(0, totalPaise - paid)
  const paymentStatus: PaymentStatus = totalPaise === 0 ? 'unpaid' : paid >= totalPaise ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  return { subtotalPaise, discountPaise, taxablePaise, taxPaise, totalPaise, balanceDuePaise, paymentStatus }
}

// ── Overdue / aging (Twenty-style derived state, not stored) ─────────────
export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate) return false
  if (status === 'paid' || status === 'cancelled') return false
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return false
  const today = new Date(); today.setHours(0,0,0,0)
  due.setHours(0,0,0,0)
  return due < today
}
export function overdueDays(dueDate: string | null): number {
  if (!dueDate) return 0
  const due = new Date(dueDate); const today = new Date(); today.setHours(0,0,0,0); due.setHours(0,0,0,0)
  const diff = Math.floor((today.getTime() - due.getTime())/86400000)
  return diff > 0 ? diff : 0
}
export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'
export function agingBucket(dueDate: string | null): AgingBucket {
  const d = overdueDays(dueDate)
  if (d <= 0) return 'current'
  if (d <= 30) return '1-30'
  if (d <= 60) return '31-60'
  if (d <= 90) return '61-90'
  return '90+'
}

// ── Stats ────────────────────────────────────────────────────────────────
export function computeSaleStats(list: readonly SaleInvoiceListItem[]) {
  let totalCount=0, draftCount=0, sentCount=0, paidCount=0, overdueCount=0, cancelledCount=0, totalValuePaise=0, paidValuePaise=0, overdueValuePaise=0, balanceDuePaise=0
  for (const r of list) {
    totalCount++; totalValuePaise += r.totalPaise; balanceDuePaise += r.balanceDuePaise
    if (r.status==='draft') draftCount++
    else if (r.status==='sent') sentCount++
    else if (r.status==='paid') { paidCount++; paidValuePaise += r.totalPaise }
    else if (r.status==='overdue') overdueCount++
    else if (r.status==='cancelled') cancelledCount++
    if (isOverdue(r.dueDate, r.status)) { overdueValuePaise += r.balanceDuePaise }
  }
  // count overdue as derived too
  const derivedOverdue = list.filter(r => isOverdue(r.dueDate, r.status)).length
  overdueCount = Math.max(overdueCount, derivedOverdue)
  return { totalCount, draftCount, sentCount, paidCount, overdueCount, cancelledCount, totalValuePaise, paidValuePaise, overdueValuePaise, balanceDuePaise }
}
export function computePurchaseStats(list: readonly PurchaseInvoiceListItem[]) {
  let totalCount=0, draftCount=0, pendingCount=0, approvedCount=0, paidCount=0, overdueCount=0, totalValuePaise=0, paidValuePaise=0, balanceDuePaise=0
  for (const r of list) {
    totalCount++; totalValuePaise += r.totalPaise; balanceDuePaise += r.balanceDuePaise
    if (r.status==='draft') draftCount++
    else if (r.status==='pending') pendingCount++
    else if (r.status==='approved') approvedCount++
    else if (r.status==='paid') { paidCount++; paidValuePaise += r.totalPaise }
    else if (r.status==='overdue') overdueCount++
  }
  const derivedOverdue = list.filter(r => isOverdue(r.dueDate, r.status)).length
  overdueCount = Math.max(overdueCount, derivedOverdue)
  return { totalCount, draftCount, pendingCount, approvedCount, paidCount, overdueCount, totalValuePaise, paidValuePaise, balanceDuePaise }
}

export const saleInvoiceIdSchema = z.object({ id: z.string().uuid() })
export const purchaseInvoiceIdSchema = z.object({ id: z.string().uuid() })
export const saleStatusUpdateSchema = z.object({ id: z.string().uuid(), status: z.enum(SALE_INVOICE_STATUSES) })
export const purchaseStatusUpdateSchema = z.object({ id: z.string().uuid(), status: z.enum(PURCHASE_INVOICE_STATUSES) })
