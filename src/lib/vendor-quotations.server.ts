import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { projectsTable, vendorsTable, vendorQuotationItemsTable, vendorQuotationsTable } from '~/db/schema'
import { findSessionById, parseSessionCookie, userHasPermission } from './auth.server'
import {
  computeVendorQuotationTotals,
  type VendorQuotationDetail,
  type VendorQuotationDetailPayload,
  type VendorQuotationFormOptions,
  type VendorQuotationInput,
  type VendorQuotationListItem,
  type VendorQuotationsPagePayload,
  type VendorQuotationStatus,
  type VendorQuotationUpdate,
} from './vendor-quotations'

type VendorQuotationPermission = 'proposals.read' | 'proposals.write'

/** Upper bound for the single-snapshot page fetch; the list UI filters client-side. */
const MAX_VENDOR_QUOTATIONS = 500

// ── Reads ────────────────────────────────────────────────────────────────
export async function listVendorQuotations(): Promise<VendorQuotationListItem[]> {
  const rows = await db
    .select({
      id: vendorQuotationsTable.id,
      quotationNumber: vendorQuotationsTable.quotationNumber,
      quotationDate: vendorQuotationsTable.quotationDate,
      vendorId: vendorQuotationsTable.vendorId,
      vendorName: vendorQuotationsTable.vendorName,
      subject: vendorQuotationsTable.subject,
      status: vendorQuotationsTable.status,
      totalPaise: vendorQuotationsTable.totalPaise,
      validUntil: vendorQuotationsTable.validUntil,
      createdAt: vendorQuotationsTable.createdAt,
    })
    .from(vendorQuotationsTable)
    .where(isNull(vendorQuotationsTable.deletedAt))
    .orderBy(desc(vendorQuotationsTable.createdAt))
    .limit(MAX_VENDOR_QUOTATIONS)

  return rows.map((row) => ({
    id: row.id,
    quotationNumber: row.quotationNumber,
    quotationDate: row.quotationDate,
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    subject: row.subject,
    status: row.status,
    totalPaise: row.totalPaise,
    validUntil: row.validUntil,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function getVendorQuotationDetail(id: string): Promise<VendorQuotationDetail | null> {
  const [row] = await db
    .select({
      quotation: vendorQuotationsTable,
      projectName: projectsTable.name,
    })
    .from(vendorQuotationsTable)
    .leftJoin(projectsTable, eq(vendorQuotationsTable.projectId, projectsTable.id))
    .where(and(eq(vendorQuotationsTable.id, id), isNull(vendorQuotationsTable.deletedAt)))
    .limit(1)
  if (!row) return null

  const items = await db
    .select({
      id: vendorQuotationItemsTable.id,
      description: vendorQuotationItemsTable.description,
      quantity: vendorQuotationItemsTable.quantity,
      unitPricePaise: vendorQuotationItemsTable.unitPricePaise,
      amountPaise: vendorQuotationItemsTable.amountPaise,
    })
    .from(vendorQuotationItemsTable)
    .where(eq(vendorQuotationItemsTable.quotationId, id))
    .orderBy(asc(vendorQuotationItemsTable.position))

  const q = row.quotation
  return {
    id: q.id,
    quotationNumber: q.quotationNumber,
    quotationDate: q.quotationDate,
    vendorId: q.vendorId,
    vendorName: q.vendorName,
    vendorEmail: q.vendorEmail,
    vendorPhone: q.vendorPhone,
    vendorAddress: q.vendorAddress,
    subject: q.subject,
    projectId: q.projectId,
    projectName: row.projectName,
    taxRateBps: q.taxRateBps,
    manualSubtotalPaise: q.manualSubtotalPaise,
    discountPaise: q.discountPaise,
    taxAmountPaise: q.taxAmountPaise,
    totalPaise: q.totalPaise,
    validUntil: q.validUntil,
    notes: q.notes,
    terms: q.terms,
    status: q.status,
    items,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  }
}

export async function getVendorQuotationFormOptions(): Promise<VendorQuotationFormOptions> {
  const [vendors, projects] = await Promise.all([
    db
      .select({ id: vendorsTable.id, code: vendorsTable.code, name: vendorsTable.name })
      .from(vendorsTable)
      .where(eq(vendorsTable.status, 'active'))
      .orderBy(asc(vendorsTable.name)),
    db
      .select({ id: projectsTable.id, name: projectsTable.name })
      .from(projectsTable)
      .where(isNull(projectsTable.deletedAt))
      .orderBy(asc(projectsTable.name)),
  ])
  return { vendors, projects }
}

// ── Numbering ────────────────────────────────────────────────────────────
/**
 * VQ-NNN-MM-YYYY (serial resets each month), same max-serial-per-suffix +
 * retry once on conflict strategy as proposal/lead numbers.
 */
async function nextVendorQuotationNumber(now = new Date()): Promise<string> {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const suffix = `-${mm}-${yyyy}`

  const [row] = await db
    .select({
      maxSerial: sql<number>`coalesce(max(split_part(${vendorQuotationsTable.quotationNumber}, '-', 2)::int), 0)`,
    })
    .from(vendorQuotationsTable)
    .where(sql`${vendorQuotationsTable.quotationNumber} like ${'%' + suffix}`)

  const serial = String(Number(row?.maxSerial ?? 0) + 1).padStart(3, '0')
  return `VQ-${serial}${suffix}`
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  return (error as { code: unknown }).code === '23505'
}

// ── Mutations ────────────────────────────────────────────────────────────
function itemRowsFor(quotationId: string, values: VendorQuotationInput) {
  // Amount is always derived server-side: quantity × unit price, integer paise.
  return values.items.map((item, position) => ({
    quotationId,
    description: item.description,
    quantity: item.quantity,
    unitPricePaise: item.unitPricePaise,
    amountPaise: item.quantity * item.unitPricePaise,
    position,
  }))
}

export async function createVendorQuotation(
  values: VendorQuotationInput,
  actorUserId: string,
): Promise<{ id: string; quotationNumber: string }> {
  const totals = computeVendorQuotationTotals({
    items: values.items,
    manualSubtotalPaise: values.manualSubtotalPaise,
    taxRateBps: values.taxRateBps,
    discountPaise: values.discountPaise,
  })

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [row] = await db
        .insert(vendorQuotationsTable)
        .values({
          quotationNumber: await nextVendorQuotationNumber(),
          quotationDate: values.quotationDate,
          vendorId: values.vendorId,
          vendorName: values.vendorName,
          vendorEmail: values.vendorEmail,
          vendorPhone: values.vendorPhone,
          vendorAddress: values.vendorAddress,
          subject: values.subject,
          projectId: values.projectId,
          taxRateBps: values.taxRateBps,
          manualSubtotalPaise: values.manualSubtotalPaise,
          discountPaise: values.discountPaise,
          taxAmountPaise: totals.taxPaise,
          totalPaise: totals.totalPaise,
          validUntil: values.validUntil,
          notes: values.notes,
          terms: values.terms,
          status: values.status,
          createdBy: actorUserId,
        })
        .returning()

      const items = itemRowsFor(row.id, values)
      if (items.length > 0) await db.insert(vendorQuotationItemsTable).values(items)
      return { id: row.id, quotationNumber: row.quotationNumber }
    } catch (error) {
      if (isUniqueViolation(error) && attempt === 0) continue
      throw error
    }
  }
  throw new Error('Quotation number conflict — please retry.')
}

export async function updateVendorQuotation(values: VendorQuotationUpdate, actorUserId: string): Promise<void> {
  const [existing] = await db
    .select({ id: vendorQuotationsTable.id })
    .from(vendorQuotationsTable)
    .where(and(eq(vendorQuotationsTable.id, values.id), isNull(vendorQuotationsTable.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Vendor quotation not found.')

  const totals = computeVendorQuotationTotals({
    items: values.items,
    manualSubtotalPaise: values.manualSubtotalPaise,
    taxRateBps: values.taxRateBps,
    discountPaise: values.discountPaise,
  })

  await db
    .update(vendorQuotationsTable)
    .set({
      quotationDate: values.quotationDate,
      vendorId: values.vendorId,
      vendorName: values.vendorName,
      vendorEmail: values.vendorEmail,
      vendorPhone: values.vendorPhone,
      vendorAddress: values.vendorAddress,
      subject: values.subject,
      projectId: values.projectId,
      taxRateBps: values.taxRateBps,
      manualSubtotalPaise: values.manualSubtotalPaise,
      discountPaise: values.discountPaise,
      taxAmountPaise: totals.taxPaise,
      totalPaise: totals.totalPaise,
      validUntil: values.validUntil,
      notes: values.notes,
      terms: values.terms,
      status: values.status,
      updatedAt: new Date(),
    })
    .where(eq(vendorQuotationsTable.id, values.id))

  // Lines are replaced wholesale — they carry no independent identity.
  await db.delete(vendorQuotationItemsTable).where(eq(vendorQuotationItemsTable.quotationId, values.id))
  const items = itemRowsFor(values.id, values)
  if (items.length > 0) await db.insert(vendorQuotationItemsTable).values(items)
  void actorUserId
}

export async function updateVendorQuotationStatus(
  id: string,
  status: VendorQuotationStatus,
  actorUserId: string,
): Promise<void> {
  const [row] = await db
    .update(vendorQuotationsTable)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(vendorQuotationsTable.id, id), isNull(vendorQuotationsTable.deletedAt)))
    .returning({ id: vendorQuotationsTable.id })
  if (!row) throw new Error('Vendor quotation not found.')
  void actorUserId
}

export async function softDeleteVendorQuotation(id: string, actorUserId: string): Promise<void> {
  const [row] = await db
    .update(vendorQuotationsTable)
    .set({ deletedAt: new Date(), deletedBy: actorUserId, updatedAt: new Date() })
    .where(and(eq(vendorQuotationsTable.id, id), isNull(vendorQuotationsTable.deletedAt)))
    .returning({ id: vendorQuotationsTable.id })
  if (!row) throw new Error('Vendor quotation not found.')
}

// ── Cookie-bound wrappers (called from server functions) ─────────────────
async function requirePermission(
  cookieHeader: string | undefined,
  permission: VendorQuotationPermission,
): Promise<string | null> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return null
  if (!(await userHasPermission(session.user.id, permission))) return null
  return session.user.id
}

async function resolveSessionUserId(cookieHeader: string | undefined): Promise<string | null> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  return session?.user.id ?? null
}

const EMPTY_OPTIONS: VendorQuotationFormOptions = { vendors: [], projects: [] }

export async function getVendorQuotationsPageDataForCookie(
  cookieHeader: string | undefined,
): Promise<VendorQuotationsPagePayload> {
  const userId = await resolveSessionUserId(cookieHeader)
  if (!userId || !(await userHasPermission(userId, 'proposals.read'))) {
    return { authorized: false, canWrite: false, quotations: [], options: EMPTY_OPTIONS }
  }

  const [quotations, options, canWrite] = await Promise.all([
    listVendorQuotations(),
    getVendorQuotationFormOptions(),
    userHasPermission(userId, 'proposals.write'),
  ])
  return { authorized: true, canWrite, quotations, options }
}

export async function getVendorQuotationDetailForCookie(
  id: string,
  cookieHeader: string | undefined,
): Promise<VendorQuotationDetailPayload> {
  const userId = await resolveSessionUserId(cookieHeader)
  if (!userId || !(await userHasPermission(userId, 'proposals.read'))) {
    return { authorized: false, canWrite: false, quotation: null, options: EMPTY_OPTIONS }
  }

  const [quotation, options, canWrite] = await Promise.all([
    getVendorQuotationDetail(id),
    getVendorQuotationFormOptions(),
    userHasPermission(userId, 'proposals.write'),
  ])
  return { authorized: true, canWrite, quotation, options }
}

export async function createVendorQuotationForCookie(
  values: VendorQuotationInput,
  cookieHeader: string | undefined,
): Promise<{ id: string; quotationNumber: string }> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to create vendor quotations.')
  return createVendorQuotation(values, userId)
}

export async function updateVendorQuotationForCookie(
  values: VendorQuotationUpdate,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to modify vendor quotations.')
  return updateVendorQuotation(values, userId)
}

export async function updateVendorQuotationStatusForCookie(
  id: string,
  status: VendorQuotationStatus,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to modify vendor quotations.')
  return updateVendorQuotationStatus(id, status, userId)
}

export async function deleteVendorQuotationForCookie(
  id: string,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to delete vendor quotations.')
  return softDeleteVendorQuotation(id, userId)
}
