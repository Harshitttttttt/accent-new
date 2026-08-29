import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  companiesTable,
  projectsTable,
  purchaseInvoiceLinesTable,
  purchaseInvoicesTable,
  saleInvoiceLinesTable,
  saleInvoicesTable,
  vendorsTable,
} from '~/db/schema'
import { findSessionById, parseSessionCookie, userHasPermission } from './auth.server'
import {
  computePurchaseTotals,
  computeSaleTotals,
  type InvoiceFormOptions,
  type InvoicesPagePayload,
  type PurchaseInvoiceDetail,
  type PurchaseInvoiceInput,
  type PurchaseInvoiceListItem,
  type PurchaseInvoiceUpdate,
  type PurchaseInvoiceStatus,
  type SaleInvoiceDetail,
  type SaleInvoiceInput,
  type SaleInvoiceListItem,
  type SaleInvoiceStatus,
  type SaleInvoiceUpdate,
} from './invoices'

const MAX_INVOICES = 500

// ── Reads ────────────────────────────────────────────────────────────────
export async function listSaleInvoices(): Promise<SaleInvoiceListItem[]> {
  const rows = await db
    .select({
      id: saleInvoicesTable.id,
      invoiceNumber: saleInvoicesTable.invoiceNumber,
      invoiceDate: saleInvoicesTable.invoiceDate,
      dueDate: saleInvoicesTable.dueDate,
      companyId: saleInvoicesTable.companyId,
      clientName: saleInvoicesTable.clientName,
      projectId: saleInvoicesTable.projectId,
      subtotalPaise: saleInvoicesTable.subtotalPaise,
      discountPaise: saleInvoicesTable.discountPaise,
      taxAmountPaise: saleInvoicesTable.taxAmountPaise,
      totalPaise: saleInvoicesTable.totalPaise,
      amountPaidPaise: saleInvoicesTable.amountPaidPaise,
      balanceDuePaise: saleInvoicesTable.balanceDuePaise,
      status: saleInvoicesTable.status,
      createdAt: saleInvoicesTable.createdAt,
    })
    .from(saleInvoicesTable)
    .where(isNull(saleInvoicesTable.deletedAt))
    .orderBy(desc(saleInvoicesTable.createdAt))
    .limit(MAX_INVOICES)
  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate,
    dueDate: r.dueDate,
    companyId: r.companyId,
    clientName: r.clientName,
    projectId: r.projectId,
    subtotalPaise: r.subtotalPaise,
    discountPaise: r.discountPaise,
    taxAmountPaise: r.taxAmountPaise,
    totalPaise: r.totalPaise,
    amountPaidPaise: r.amountPaidPaise,
    balanceDuePaise: r.balanceDuePaise,
    status: r.status as SaleInvoiceStatus,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function listPurchaseInvoices(): Promise<PurchaseInvoiceListItem[]> {
  const rows = await db
    .select({
      id: purchaseInvoicesTable.id,
      invoiceNumber: purchaseInvoicesTable.invoiceNumber,
      invoiceDate: purchaseInvoicesTable.invoiceDate,
      dueDate: purchaseInvoicesTable.dueDate,
      vendorId: purchaseInvoicesTable.vendorId,
      vendorName: purchaseInvoicesTable.vendorName,
      projectId: purchaseInvoicesTable.projectId,
      subtotalPaise: purchaseInvoicesTable.subtotalPaise,
      discountPaise: purchaseInvoicesTable.discountPaise,
      taxAmountPaise: purchaseInvoicesTable.taxAmountPaise,
      totalPaise: purchaseInvoicesTable.totalPaise,
      amountPaidPaise: purchaseInvoicesTable.amountPaidPaise,
      balanceDuePaise: purchaseInvoicesTable.balanceDuePaise,
      paymentStatus: purchaseInvoicesTable.paymentStatus,
      status: purchaseInvoicesTable.status,
      createdAt: purchaseInvoicesTable.createdAt,
    })
    .from(purchaseInvoicesTable)
    .where(isNull(purchaseInvoicesTable.deletedAt))
    .orderBy(desc(purchaseInvoicesTable.createdAt))
    .limit(MAX_INVOICES)
  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate,
    dueDate: r.dueDate,
    vendorId: r.vendorId,
    vendorName: r.vendorName,
    projectId: r.projectId,
    subtotalPaise: r.subtotalPaise,
    discountPaise: r.discountPaise,
    taxAmountPaise: r.taxAmountPaise,
    totalPaise: r.totalPaise,
    amountPaidPaise: r.amountPaidPaise,
    balanceDuePaise: r.balanceDuePaise,
    paymentStatus: r.paymentStatus as PurchaseInvoiceListItem['paymentStatus'],
    status: r.status as PurchaseInvoiceStatus,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function getSaleInvoiceDetail(id: string): Promise<SaleInvoiceDetail | null> {
  const [row] = await db
    .select({ invoice: saleInvoicesTable, projectName: projectsTable.name, companyName: companiesTable.name })
    .from(saleInvoicesTable)
    .leftJoin(projectsTable, eq(saleInvoicesTable.projectId, projectsTable.id))
    .leftJoin(companiesTable, eq(saleInvoicesTable.companyId, companiesTable.id))
    .where(and(eq(saleInvoicesTable.id, id), isNull(saleInvoicesTable.deletedAt)))
    .limit(1)
  if (!row) return null
  const items = await db
    .select({ id: saleInvoiceLinesTable.id, description: saleInvoiceLinesTable.description, quantity: saleInvoiceLinesTable.quantity, unitPricePaise: saleInvoiceLinesTable.unitPricePaise, amountPaise: saleInvoiceLinesTable.amountPaise })
    .from(saleInvoiceLinesTable)
    .where(eq(saleInvoiceLinesTable.invoiceId, id))
    .orderBy(asc(saleInvoiceLinesTable.position))
  const q = row.invoice
  return {
    id: q.id, invoiceNumber: q.invoiceNumber, invoiceDate: q.invoiceDate, dueDate: q.dueDate,
    companyId: q.companyId, clientName: q.clientName, projectId: q.projectId,
    subtotalPaise: q.subtotalPaise, discountPaise: q.discountPaise, taxAmountPaise: q.taxAmountPaise, totalPaise: q.totalPaise,
    amountPaidPaise: q.amountPaidPaise, balanceDuePaise: q.balanceDuePaise, status: q.status as SaleInvoiceStatus, createdAt: q.createdAt.toISOString(),
    clientEmail: q.clientEmail, clientPhone: q.clientPhone, clientAddress: q.clientAddress, clientGstin: q.clientGstin, clientPan: q.clientPan, clientState: q.clientState, clientStateCode: q.clientStateCode, kindAttn: q.kindAttn,
    poNumber: q.poNumber, poDate: q.poDate, originalPoValuePaise: q.originalPoValuePaise, balancePoValuePaise: q.balancePoValuePaise,
    description: q.description, gstNumber: q.gstNumber, panNumber: q.panNumber, tanNumber: q.tanNumber, serviceCategory: q.serviceCategory, bankAddress: q.bankAddress,
    gstType: q.gstType as SaleInvoiceDetail['gstType'], cgstRateBps: q.cgstRateBps, sgstRateBps: q.sgstRateBps, igstRateBps: q.igstRateBps, notes: q.notes, terms: q.terms,
    projectName: row.projectName, companyName: row.companyName, items, updatedAt: q.updatedAt.toISOString(),
  }
}

export async function getPurchaseInvoiceDetail(id: string): Promise<PurchaseInvoiceDetail | null> {
  const [row] = await db
    .select({ invoice: purchaseInvoicesTable, projectName: projectsTable.name })
    .from(purchaseInvoicesTable)
    .leftJoin(projectsTable, eq(purchaseInvoicesTable.projectId, projectsTable.id))
    .where(and(eq(purchaseInvoicesTable.id, id), isNull(purchaseInvoicesTable.deletedAt)))
    .limit(1)
  if (!row) return null
  const items = await db
    .select({ id: purchaseInvoiceLinesTable.id, description: purchaseInvoiceLinesTable.description, quantity: purchaseInvoiceLinesTable.quantity, unitPricePaise: purchaseInvoiceLinesTable.unitPricePaise, amountPaise: purchaseInvoiceLinesTable.amountPaise })
    .from(purchaseInvoiceLinesTable)
    .where(eq(purchaseInvoiceLinesTable.invoiceId, id))
    .orderBy(asc(purchaseInvoiceLinesTable.position))
  const q = row.invoice
  return {
    id: q.id, invoiceNumber: q.invoiceNumber, invoiceDate: q.invoiceDate, dueDate: q.dueDate,
    vendorId: q.vendorId, vendorName: q.vendorName, projectId: q.projectId,
    subtotalPaise: q.subtotalPaise, discountPaise: q.discountPaise, taxAmountPaise: q.taxAmountPaise, totalPaise: q.totalPaise,
    amountPaidPaise: q.amountPaidPaise, balanceDuePaise: q.balanceDuePaise, paymentStatus: q.paymentStatus as PurchaseInvoiceDetail['paymentStatus'], status: q.status as PurchaseInvoiceStatus, createdAt: q.createdAt.toISOString(),
    vendorEmail: q.vendorEmail, vendorPhone: q.vendorPhone, vendorAddress: q.vendorAddress, vendorGstin: q.vendorGstin, vendorPan: q.vendorPan,
    poNumber: q.poNumber, poDate: q.poDate, description: q.description, taxRateBps: q.taxRateBps, cgstAmountPaise: q.cgstAmountPaise, sgstAmountPaise: q.sgstAmountPaise, igstAmountPaise: q.igstAmountPaise,
    notes: q.notes, terms: q.terms, attachmentUrl: q.attachmentUrl, projectName: row.projectName, items, updatedAt: q.updatedAt.toISOString(),
  }
}

export async function getInvoiceFormOptions(): Promise<InvoiceFormOptions> {
  const [companies, vendors, projects] = await Promise.all([
    db.select({ id: companiesTable.id, name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.status, 'active')).orderBy(asc(companiesTable.name)),
    db.select({ id: vendorsTable.id, code: vendorsTable.code, name: vendorsTable.name }).from(vendorsTable).where(eq(vendorsTable.status, 'active')).orderBy(asc(vendorsTable.name)),
    db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(isNull(projectsTable.deletedAt)).orderBy(asc(projectsTable.name)),
  ])
  return { companies, vendors, projects }
}

// ── Numbering ────────────────────────────────────────────────────────────
async function nextSaleNumber(now = new Date()): Promise<string> {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const suffix = `-${mm}-${yyyy}`
  const [row] = await db.select({ maxSerial: sql<number>`coalesce(max(split_part(${saleInvoicesTable.invoiceNumber}, '-', 2)::int),0)` }).from(saleInvoicesTable).where(sql`${saleInvoicesTable.invoiceNumber} like ${'%' + suffix}`)
  const serial = String(Number(row?.maxSerial ?? 0) + 1).padStart(3, '0')
  return `SI-${serial}${suffix}`
}
async function nextPurchaseNumber(now = new Date()): Promise<string> {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const suffix = `-${mm}-${yyyy}`
  const [row] = await db.select({ maxSerial: sql<number>`coalesce(max(split_part(${purchaseInvoicesTable.invoiceNumber}, '-', 2)::int),0)` }).from(purchaseInvoicesTable).where(sql`${purchaseInvoicesTable.invoiceNumber} like ${'%' + suffix}`)
  const serial = String(Number(row?.maxSerial ?? 0) + 1).padStart(3, '0')
  return `PI-${serial}${suffix}`
}
function isUniqueViolation(e: unknown): boolean { return typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === '23505' }

// ── Mutations ────────────────────────────────────────────────────────────
function saleLineRows(invoiceId: string, values: SaleInvoiceInput) {
  return values.items.map((it, pos) => ({ invoiceId, description: it.description, quantity: it.quantity, unitPricePaise: it.unitPricePaise, amountPaise: it.quantity * it.unitPricePaise, position: pos }))
}
function purchaseLineRows(invoiceId: string, values: PurchaseInvoiceInput) {
  return values.items.map((it, pos) => ({ invoiceId, description: it.description, quantity: it.quantity, unitPricePaise: it.unitPricePaise, amountPaise: it.quantity * it.unitPricePaise, position: pos }))
}

export async function createSaleInvoice(values: SaleInvoiceInput, actorUserId: string): Promise<{ id: string; invoiceNumber: string }> {
  const totals = computeSaleTotals({ items: values.items, discountPaise: values.discountPaise, gstType: values.gstType, cgstRateBps: values.cgstRateBps, sgstRateBps: values.sgstRateBps, igstRateBps: values.igstRateBps, amountPaidPaise: values.amountPaidPaise })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [row] = await db.insert(saleInvoicesTable).values({
        invoiceNumber: await nextSaleNumber(),
        invoiceDate: values.invoiceDate, dueDate: values.dueDate,
        companyId: values.companyId, clientName: values.clientName, clientEmail: values.clientEmail, clientPhone: values.clientPhone, clientAddress: values.clientAddress, clientGstin: values.clientGstin, clientPan: values.clientPan, clientState: values.clientState, clientStateCode: values.clientStateCode, kindAttn: values.kindAttn,
        projectId: values.projectId, poNumber: values.poNumber, poDate: values.poDate, originalPoValuePaise: values.originalPoValuePaise, balancePoValuePaise: values.originalPoValuePaise != null ? Math.max(0, values.originalPoValuePaise - totals.totalPaise) : null,
        description: values.description, gstNumber: values.gstNumber, panNumber: values.panNumber, tanNumber: values.tanNumber, serviceCategory: values.serviceCategory, bankAddress: values.bankAddress,
        subtotalPaise: totals.subtotalPaise, discountPaise: totals.discountPaise, gstType: values.gstType, cgstRateBps: values.cgstRateBps, sgstRateBps: values.sgstRateBps, igstRateBps: values.igstRateBps, taxAmountPaise: totals.taxPaise, totalPaise: totals.totalPaise, amountPaidPaise: Math.min(values.amountPaidPaise, totals.totalPaise), balanceDuePaise: totals.balanceDuePaise,
        notes: values.notes, terms: values.terms, status: values.status, createdBy: actorUserId,
      }).returning()
      const lines = saleLineRows(row.id, values)
      if (lines.length) await db.insert(saleInvoiceLinesTable).values(lines)
      return { id: row.id, invoiceNumber: row.invoiceNumber }
    } catch (e) { if (isUniqueViolation(e) && attempt === 0) continue; throw e }
  }
  throw new Error('Invoice number conflict — please retry.')
}

export async function updateSaleInvoice(values: SaleInvoiceUpdate, actorUserId: string): Promise<void> {
  const [existing] = await db.select({ id: saleInvoicesTable.id }).from(saleInvoicesTable).where(and(eq(saleInvoicesTable.id, values.id), isNull(saleInvoicesTable.deletedAt))).limit(1)
  if (!existing) throw new Error('Sale invoice not found.')
  const totals = computeSaleTotals({ items: values.items, discountPaise: values.discountPaise, gstType: values.gstType, cgstRateBps: values.cgstRateBps, sgstRateBps: values.sgstRateBps, igstRateBps: values.igstRateBps, amountPaidPaise: values.amountPaidPaise })
  await db.update(saleInvoicesTable).set({
    invoiceDate: values.invoiceDate, dueDate: values.dueDate,
    companyId: values.companyId, clientName: values.clientName, clientEmail: values.clientEmail, clientPhone: values.clientPhone, clientAddress: values.clientAddress, clientGstin: values.clientGstin, clientPan: values.clientPan, clientState: values.clientState, clientStateCode: values.clientStateCode, kindAttn: values.kindAttn,
    projectId: values.projectId, poNumber: values.poNumber, poDate: values.poDate, originalPoValuePaise: values.originalPoValuePaise, balancePoValuePaise: values.originalPoValuePaise != null ? Math.max(0, values.originalPoValuePaise - totals.totalPaise) : null,
    description: values.description, gstNumber: values.gstNumber, panNumber: values.panNumber, tanNumber: values.tanNumber, serviceCategory: values.serviceCategory, bankAddress: values.bankAddress,
    subtotalPaise: totals.subtotalPaise, discountPaise: totals.discountPaise, gstType: values.gstType, cgstRateBps: values.cgstRateBps, sgstRateBps: values.sgstRateBps, igstRateBps: values.igstRateBps, taxAmountPaise: totals.taxPaise, totalPaise: totals.totalPaise, amountPaidPaise: Math.min(values.amountPaidPaise, totals.totalPaise), balanceDuePaise: totals.balanceDuePaise,
    notes: values.notes, terms: values.terms, status: values.status, updatedAt: new Date(),
  }).where(eq(saleInvoicesTable.id, values.id))
  await db.delete(saleInvoiceLinesTable).where(eq(saleInvoiceLinesTable.invoiceId, values.id))
  const lines = saleLineRows(values.id, values)
  if (lines.length) await db.insert(saleInvoiceLinesTable).values(lines)
  void actorUserId
}

export async function createPurchaseInvoice(values: PurchaseInvoiceInput, actorUserId: string): Promise<{ id: string; invoiceNumber: string }> {
  const totals = computePurchaseTotals({ items: values.items, discountPaise: values.discountPaise, taxRateBps: values.taxRateBps, amountPaidPaise: values.amountPaidPaise })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [row] = await db.insert(purchaseInvoicesTable).values({
        invoiceNumber: await nextPurchaseNumber(),
        invoiceDate: values.invoiceDate, dueDate: values.dueDate,
        vendorId: values.vendorId, vendorName: values.vendorName, vendorEmail: values.vendorEmail, vendorPhone: values.vendorPhone, vendorAddress: values.vendorAddress, vendorGstin: values.vendorGstin, vendorPan: values.vendorPan,
        projectId: values.projectId, poNumber: values.poNumber, poDate: values.poDate, description: values.description,
        subtotalPaise: totals.subtotalPaise, discountPaise: totals.discountPaise, taxRateBps: values.taxRateBps, taxAmountPaise: totals.taxPaise, totalPaise: totals.totalPaise, amountPaidPaise: Math.min(values.amountPaidPaise, totals.totalPaise), balanceDuePaise: totals.balanceDuePaise, paymentStatus: totals.paymentStatus,
        cgstAmountPaise: 0, sgstAmountPaise: 0, igstAmountPaise: totals.taxPaise,
        notes: values.notes, terms: values.terms, attachmentUrl: values.attachmentUrl, status: values.status, createdBy: actorUserId,
      }).returning()
      const lines = purchaseLineRows(row.id, values)
      if (lines.length) await db.insert(purchaseInvoiceLinesTable).values(lines)
      return { id: row.id, invoiceNumber: row.invoiceNumber }
    } catch (e) { if (isUniqueViolation(e) && attempt === 0) continue; throw e }
  }
  throw new Error('Invoice number conflict — please retry.')
}

export async function updatePurchaseInvoice(values: PurchaseInvoiceUpdate, actorUserId: string): Promise<void> {
  const [existing] = await db.select({ id: purchaseInvoicesTable.id }).from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.id, values.id), isNull(purchaseInvoicesTable.deletedAt))).limit(1)
  if (!existing) throw new Error('Purchase invoice not found.')
  const totals = computePurchaseTotals({ items: values.items, discountPaise: values.discountPaise, taxRateBps: values.taxRateBps, amountPaidPaise: values.amountPaidPaise })
  await db.update(purchaseInvoicesTable).set({
    invoiceDate: values.invoiceDate, dueDate: values.dueDate,
    vendorId: values.vendorId, vendorName: values.vendorName, vendorEmail: values.vendorEmail, vendorPhone: values.vendorPhone, vendorAddress: values.vendorAddress, vendorGstin: values.vendorGstin, vendorPan: values.vendorPan,
    projectId: values.projectId, poNumber: values.poNumber, poDate: values.poDate, description: values.description,
    subtotalPaise: totals.subtotalPaise, discountPaise: totals.discountPaise, taxRateBps: values.taxRateBps, taxAmountPaise: totals.taxPaise, totalPaise: totals.totalPaise, amountPaidPaise: Math.min(values.amountPaidPaise, totals.totalPaise), balanceDuePaise: totals.balanceDuePaise, paymentStatus: totals.paymentStatus,
    notes: values.notes, terms: values.terms, attachmentUrl: values.attachmentUrl, status: values.status, updatedAt: new Date(),
  }).where(eq(purchaseInvoicesTable.id, values.id))
  await db.delete(purchaseInvoiceLinesTable).where(eq(purchaseInvoiceLinesTable.invoiceId, values.id))
  const lines = purchaseLineRows(values.id, values)
  if (lines.length) await db.insert(purchaseInvoiceLinesTable).values(lines)
  void actorUserId
}

export async function updateSaleInvoiceStatus(id: string, status: SaleInvoiceStatus): Promise<void> {
  const [row] = await db.update(saleInvoicesTable).set({ status, updatedAt: new Date() }).where(and(eq(saleInvoicesTable.id, id), isNull(saleInvoicesTable.deletedAt))).returning({ id: saleInvoicesTable.id })
  if (!row) throw new Error('Sale invoice not found.')
}
export async function updatePurchaseInvoiceStatus(id: string, status: PurchaseInvoiceStatus): Promise<void> {
  const [row] = await db.update(purchaseInvoicesTable).set({ status, updatedAt: new Date() }).where(and(eq(purchaseInvoicesTable.id, id), isNull(purchaseInvoicesTable.deletedAt))).returning({ id: purchaseInvoicesTable.id })
  if (!row) throw new Error('Purchase invoice not found.')
}
export async function softDeleteSaleInvoice(id: string, actorUserId: string): Promise<void> {
  const [row] = await db.update(saleInvoicesTable).set({ deletedAt: new Date(), deletedBy: actorUserId, updatedAt: new Date() }).where(and(eq(saleInvoicesTable.id, id), isNull(saleInvoicesTable.deletedAt))).returning({ id: saleInvoicesTable.id })
  if (!row) throw new Error('Sale invoice not found.')
}
export async function softDeletePurchaseInvoice(id: string, actorUserId: string): Promise<void> {
  const [row] = await db.update(purchaseInvoicesTable).set({ deletedAt: new Date(), deletedBy: actorUserId, updatedAt: new Date() }).where(and(eq(purchaseInvoicesTable.id, id), isNull(purchaseInvoicesTable.deletedAt))).returning({ id: purchaseInvoicesTable.id })
  if (!row) throw new Error('Purchase invoice not found.')
}

// ── Cookie-bound wrappers ────────────────────────────────────────────────
async function resolveSessionUserId(cookieHeader: string | undefined): Promise<string | null> {
  const sid = parseSessionCookie(cookieHeader)
  const s = sid ? await findSessionById(sid) : null
  return s?.user.id ?? null
}
const EMPTY_OPTIONS: InvoiceFormOptions = { companies: [], vendors: [], projects: [] }

export async function getInvoicesPageDataForCookie(cookieHeader: string | undefined): Promise<InvoicesPagePayload> {
  const userId = await resolveSessionUserId(cookieHeader)
  if (!userId || !(await userHasPermission(userId, 'proposals.read'))) return { authorized: false, canWrite: false, saleInvoices: [], purchaseInvoices: [], options: EMPTY_OPTIONS }
  const [saleInvoices, purchaseInvoices, options, canWrite] = await Promise.all([listSaleInvoices(), listPurchaseInvoices(), getInvoiceFormOptions(), userHasPermission(userId, 'proposals.write')])
  return { authorized: true, canWrite, saleInvoices, purchaseInvoices, options }
}
export async function getSaleInvoiceDetailForCookie(id: string, cookieHeader: string | undefined) {
  const userId = await resolveSessionUserId(cookieHeader)
  if (!userId || !(await userHasPermission(userId, 'proposals.read'))) return { authorized: false, canWrite: false, invoice: null, options: EMPTY_OPTIONS }
  const [invoice, options, canWrite] = await Promise.all([getSaleInvoiceDetail(id), getInvoiceFormOptions(), userHasPermission(userId, 'proposals.write')])
  return { authorized: true, canWrite, invoice, options }
}
export async function getPurchaseInvoiceDetailForCookie(id: string, cookieHeader: string | undefined) {
  const userId = await resolveSessionUserId(cookieHeader)
  if (!userId || !(await userHasPermission(userId, 'proposals.read'))) return { authorized: false, canWrite: false, invoice: null, options: EMPTY_OPTIONS }
  const [invoice, options, canWrite] = await Promise.all([getPurchaseInvoiceDetail(id), getInvoiceFormOptions(), userHasPermission(userId, 'proposals.write')])
  return { authorized: true, canWrite, invoice, options }
}
