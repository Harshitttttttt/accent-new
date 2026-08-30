import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  projectsTable,
  vendorPurchaseOrderActivitiesTable,
  vendorPurchaseOrderItemsTable,
  vendorPurchaseOrdersTable,
  vendorQuotationsTable,
  vendorsTable,
  type VendorPurchaseOrderRecord,
} from '~/db/schema'
import {
  findSessionById,
  isUserAdmin,
  parseSessionCookie,
  userHasPermission,
} from './auth.server'
import {
  computeVendorPurchaseOrderTotals,
  type VendorPurchaseOrderDetail,
  type VendorPurchaseOrderFormOptions,
  type VendorPurchaseOrderInput,
  type VendorPurchaseOrderListItem,
  type VendorPurchaseOrdersPagePayload,
  type VendorPurchaseOrderStatus,
  type VendorPurchaseOrderUpdate,
} from './vendor-purchase-orders'

// ── Auth & Permissions ─────────────────────────────────────────────────────
export async function resolveVendorPoSession(cookieHeader?: string | null) {
  const sessionId = parseSessionCookie(cookieHeader ?? undefined)
  if (!sessionId) return { user: null, canRead: false, canWrite: false }

  const session = await findSessionById(sessionId)
  if (!session) return { user: null, canRead: false, canWrite: false }

  const isAdmin = await isUserAdmin(session.userId)
  const canRead =
    isAdmin ||
    (await userHasPermission(session.userId, 'proposals.read')) ||
    (await userHasPermission(session.userId, 'finance.read')) ||
    (await userHasPermission(session.userId, 'projects.read'))

  const canWrite =
    isAdmin ||
    (await userHasPermission(session.userId, 'proposals.write')) ||
    (await userHasPermission(session.userId, 'finance.write')) ||
    (await userHasPermission(session.userId, 'projects.write'))

  return { user: session.user, canRead, canWrite }
}

// ── Sequence Number Generator ──────────────────────────────────────────────
export async function nextVendorPoNumber(now = new Date()): Promise<string> {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const suffix = `-${mm}-${yyyy}`
  const prefix = `VPO-`

  const rows = await db
    .select({ poNumber: vendorPurchaseOrdersTable.poNumber })
    .from(vendorPurchaseOrdersTable)
    .where(sql`${vendorPurchaseOrdersTable.poNumber} like ${'VPO-%' + suffix}`)

  let maxSerial = 0
  for (const r of rows) {
    const match = r.poNumber.match(/^VPO-(\d{3})-\d{2}-\d{4}$/)
    if (match?.[1]) {
      const n = Number.parseInt(match[1], 10)
      if (n > maxSerial) maxSerial = n
    }
  }

  const nextSerial = String(maxSerial + 1).padStart(3, '0')
  return `${prefix}${nextSerial}${suffix}`
}

// ── Activity Recorder ──────────────────────────────────────────────────────
async function recordActivity(
  poId: string,
  actorUserId: string | null,
  actorName: string,
  action: string,
  oldValue?: string | null,
  newValue?: string | null,
) {
  await db.insert(vendorPurchaseOrderActivitiesTable).values({
    poId,
    actorUserId,
    actorName,
    action,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
  })
}

// ── Option Loaders ─────────────────────────────────────────────────────────
export async function loadVendorPoFormOptions(): Promise<VendorPurchaseOrderFormOptions> {
  const [vendors, vendorQuotations, projects] = await Promise.all([
    db
      .select({
        id: vendorsTable.id,
        name: vendorsTable.name,
        email: vendorsTable.inquiryEmail,
        address: vendorsTable.addressLine1,
        gstin: vendorsTable.gstin,
        pan: vendorsTable.pan,
      })
      .from(vendorsTable)
      .where(eq(vendorsTable.status, 'active'))
      .orderBy(vendorsTable.name),

    db
      .select({
        id: vendorQuotationsTable.id,
        quotationNumber: vendorQuotationsTable.quotationNumber,
        vendorId: vendorQuotationsTable.vendorId,
        vendorName: vendorQuotationsTable.vendorName,
        subject: vendorQuotationsTable.subject,
        totalPaise: vendorQuotationsTable.totalPaise,
      })
      .from(vendorQuotationsTable)
      .where(isNull(vendorQuotationsTable.deletedAt))
      .orderBy(desc(vendorQuotationsTable.createdAt))
      .limit(100),

    db
      .select({
        id: projectsTable.id,
        projectNumber: projectsTable.projectNumber,
        name: projectsTable.name,
        companyName: projectsTable.companyName,
      })
      .from(projectsTable)
      .where(isNull(projectsTable.deletedAt))
      .orderBy(desc(projectsTable.createdAt))
      .limit(100),
  ])

  return {
    vendors,
    vendorQuotations: vendorQuotations.map((vq) => ({
      ...vq,
      totalPaise: Number(vq.totalPaise ?? 0),
    })),
    projects,
  }
}

// ── Serializer ─────────────────────────────────────────────────────────────
function serializeVendorPoListItem(row: VendorPurchaseOrderRecord): VendorPurchaseOrderListItem {
  return {
    id: row.id,
    poNumber: row.poNumber,
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    subject: row.subject,
    poDate: row.poDate,
    expectedDeliveryDate: row.expectedDeliveryDate,
    status: row.status as VendorPurchaseOrderStatus,
    priority: row.priority as 'low' | 'medium' | 'high',
    subtotalPaise: Number(row.subtotalPaise ?? 0),
    taxAmountPaise: Number(row.taxAmountPaise ?? 0),
    totalPaise: Number(row.totalPaise ?? 0),
    billedAmountPaise: Number(row.billedAmountPaise ?? 0),
    balanceAmountPaise: Number(row.balanceAmountPaise ?? 0),
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

// ── Queries ────────────────────────────────────────────────────────────────
export async function getVendorPurchaseOrdersPageDataForCookie(
  cookieHeader?: string | null,
): Promise<VendorPurchaseOrdersPagePayload> {
  const { canRead, canWrite } = await resolveVendorPoSession(cookieHeader)
  if (!canRead) {
    return {
      authorized: false,
      canWrite: false,
      orders: [],
      options: { vendors: [], vendorQuotations: [], projects: [] },
    }
  }

  const [rows, options] = await Promise.all([
    db
      .select()
      .from(vendorPurchaseOrdersTable)
      .where(isNull(vendorPurchaseOrdersTable.deletedAt))
      .orderBy(desc(vendorPurchaseOrdersTable.createdAt)),
    loadVendorPoFormOptions(),
  ])

  return {
    authorized: true,
    canWrite,
    orders: rows.map(serializeVendorPoListItem),
    options,
  }
}

export async function getVendorPurchaseOrderDetailForCookie(
  id: string,
  cookieHeader?: string | null,
): Promise<{ order: VendorPurchaseOrderDetail | null; options: VendorPurchaseOrderFormOptions }> {
  const { canRead } = await resolveVendorPoSession(cookieHeader)
  if (!canRead) {
    return { order: null, options: { vendors: [], vendorQuotations: [], projects: [] } }
  }

  const [orders, options] = await Promise.all([
    db
      .select()
      .from(vendorPurchaseOrdersTable)
      .where(and(eq(vendorPurchaseOrdersTable.id, id), isNull(vendorPurchaseOrdersTable.deletedAt)))
      .limit(1),
    loadVendorPoFormOptions(),
  ])

  const orderRow = orders[0]
  if (!orderRow) return { order: null, options }

  const [items, activities, quotationRows, projectRows] = await Promise.all([
    db
      .select()
      .from(vendorPurchaseOrderItemsTable)
      .where(eq(vendorPurchaseOrderItemsTable.poId, id))
      .orderBy(vendorPurchaseOrderItemsTable.position),
    db
      .select()
      .from(vendorPurchaseOrderActivitiesTable)
      .where(eq(vendorPurchaseOrderActivitiesTable.poId, id))
      .orderBy(desc(vendorPurchaseOrderActivitiesTable.createdAt))
      .limit(50),
    orderRow.vendorQuotationId
      ? db
          .select({ quotationNumber: vendorQuotationsTable.quotationNumber })
          .from(vendorQuotationsTable)
          .where(eq(vendorQuotationsTable.id, orderRow.vendorQuotationId))
          .limit(1)
      : Promise.resolve([]),
    orderRow.projectId
      ? db
          .select({ name: projectsTable.name })
          .from(projectsTable)
          .where(eq(projectsTable.id, orderRow.projectId))
          .limit(1)
      : Promise.resolve([]),
  ])

  const base = serializeVendorPoListItem(orderRow)
  const detail: VendorPurchaseOrderDetail = {
    ...base,
    vendorEmail: orderRow.vendorEmail,
    vendorPhone: orderRow.vendorPhone,
    vendorAddress: orderRow.vendorAddress,
    vendorGstin: orderRow.vendorGstin,
    vendorPan: orderRow.vendorPan,
    vendorQuotationId: orderRow.vendorQuotationId,
    quotationNumber: quotationRows[0]?.quotationNumber ?? null,
    projectId: orderRow.projectId,
    projectName: projectRows[0]?.name ?? null,
    taxRateBps: orderRow.taxRateBps,
    discountPaise: Number(orderRow.discountPaise ?? 0),
    cgstAmountPaise: Number(orderRow.cgstAmountPaise ?? 0),
    sgstAmountPaise: Number(orderRow.sgstAmountPaise ?? 0),
    igstAmountPaise: Number(orderRow.igstAmountPaise ?? 0),
    deliveryTerms: orderRow.deliveryTerms,
    paymentTerms: orderRow.paymentTerms,
    shippingAddress: orderRow.shippingAddress,
    modeOfDelivery: orderRow.modeOfDelivery,
    attachmentUrl: orderRow.attachmentUrl,
    notes: orderRow.notes,
    terms: orderRow.terms,
    items: items.map((it) => ({
      id: it.id,
      itemCode: it.itemCode,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unitPricePaise: Number(it.unitPricePaise),
      taxRateBps: it.taxRateBps,
      amountPaise: Number(it.amountPaise),
      position: it.position,
    })),
    activities: activities.map((act) => ({
      id: act.id,
      actorUserId: act.actorUserId,
      actorName: act.actorName,
      action: act.action,
      oldValue: act.oldValue,
      newValue: act.newValue,
      createdAt: act.createdAt.toISOString(),
    })),
  }

  return { order: detail, options }
}

// ── Mutations ──────────────────────────────────────────────────────────────
export async function createVendorPurchaseOrderForCookie(
  input: VendorPurchaseOrderInput,
  cookieHeader?: string | null,
): Promise<{ id: string; poNumber: string }> {
  const { user, canWrite } = await resolveVendorPoSession(cookieHeader)
  if (!canWrite || !user) throw new Error('Unauthorized to create vendor purchase orders.')

  const totals = computeVendorPurchaseOrderTotals(input.items, input.discountPaise, input.taxRateBps)
  const poNumber = await nextVendorPoNumber()

  const isApproved = input.status === 'approved' || input.status === 'issued'

  const [inserted] = await db
    .insert(vendorPurchaseOrdersTable)
    .values({
      poNumber,
      vendorId: input.vendorId,
      vendorName: input.vendorName,
      vendorEmail: input.vendorEmail,
      vendorPhone: input.vendorPhone,
      vendorAddress: input.vendorAddress,
      vendorGstin: input.vendorGstin,
      vendorPan: input.vendorPan,
      vendorQuotationId: input.vendorQuotationId,
      projectId: input.projectId,
      subject: input.subject,
      poDate: input.poDate,
      expectedDeliveryDate: input.expectedDeliveryDate,
      status: input.status,
      priority: input.priority,
      subtotalPaise: totals.subtotalPaise,
      taxRateBps: input.taxRateBps,
      discountPaise: totals.discountPaise,
      cgstAmountPaise: totals.cgstAmountPaise,
      sgstAmountPaise: totals.sgstAmountPaise,
      igstAmountPaise: totals.igstAmountPaise,
      taxAmountPaise: totals.taxAmountPaise,
      totalPaise: totals.totalPaise,
      billedAmountPaise: 0,
      balanceAmountPaise: totals.totalPaise,
      deliveryTerms: input.deliveryTerms,
      paymentTerms: input.paymentTerms,
      shippingAddress: input.shippingAddress,
      modeOfDelivery: input.modeOfDelivery,
      attachmentUrl: input.attachmentUrl,
      notes: input.notes,
      terms: input.terms,
      approvedBy: isApproved ? user.id : null,
      approvedAt: isApproved ? new Date() : null,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: vendorPurchaseOrdersTable.id })

  if (!inserted) throw new Error('Failed to create vendor purchase order record.')

  if (input.items.length > 0) {
    await db.insert(vendorPurchaseOrderItemsTable).values(
      input.items.map((it, idx) => ({
        poId: inserted.id,
        itemCode: it.itemCode,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit || 'nos',
        unitPricePaise: it.unitPricePaise,
        taxRateBps: it.taxRateBps || input.taxRateBps,
        amountPaise: Math.round(it.quantity * it.unitPricePaise),
        position: idx,
      })),
    )
  }

  await recordActivity(
    inserted.id,
    user.id,
    user.fullName || user.username,
    'po_created',
    null,
    `Vendor PO ${poNumber} created for ${input.vendorName}`,
  )

  return { id: inserted.id, poNumber }
}

export async function updateVendorPurchaseOrderForCookie(
  input: VendorPurchaseOrderUpdate,
  cookieHeader?: string | null,
): Promise<void> {
  const { user, canWrite } = await resolveVendorPoSession(cookieHeader)
  if (!canWrite || !user) throw new Error('Unauthorized to update vendor purchase orders.')

  const existing = await db
    .select()
    .from(vendorPurchaseOrdersTable)
    .where(and(eq(vendorPurchaseOrdersTable.id, input.id), isNull(vendorPurchaseOrdersTable.deletedAt)))
    .limit(1)

  if (!existing[0]) throw new Error('Vendor purchase order not found.')
  const prev = existing[0]

  const totals = computeVendorPurchaseOrderTotals(input.items, input.discountPaise, input.taxRateBps)
  const prevBilled = Number(prev.billedAmountPaise ?? 0)
  const balance = Math.max(0, totals.totalPaise - prevBilled)

  const isNowApproved = (input.status === 'approved' || input.status === 'issued') && !prev.approvedAt

  await db
    .update(vendorPurchaseOrdersTable)
    .set({
      vendorId: input.vendorId,
      vendorName: input.vendorName,
      vendorEmail: input.vendorEmail,
      vendorPhone: input.vendorPhone,
      vendorAddress: input.vendorAddress,
      vendorGstin: input.vendorGstin,
      vendorPan: input.vendorPan,
      vendorQuotationId: input.vendorQuotationId,
      projectId: input.projectId,
      subject: input.subject,
      poDate: input.poDate,
      expectedDeliveryDate: input.expectedDeliveryDate,
      status: input.status,
      priority: input.priority,
      subtotalPaise: totals.subtotalPaise,
      taxRateBps: input.taxRateBps,
      discountPaise: totals.discountPaise,
      cgstAmountPaise: totals.cgstAmountPaise,
      sgstAmountPaise: totals.sgstAmountPaise,
      igstAmountPaise: totals.igstAmountPaise,
      taxAmountPaise: totals.taxAmountPaise,
      totalPaise: totals.totalPaise,
      balanceAmountPaise: balance,
      deliveryTerms: input.deliveryTerms,
      paymentTerms: input.paymentTerms,
      shippingAddress: input.shippingAddress,
      modeOfDelivery: input.modeOfDelivery,
      attachmentUrl: input.attachmentUrl,
      notes: input.notes,
      terms: input.terms,
      approvedBy: isNowApproved ? user.id : prev.approvedBy,
      approvedAt: isNowApproved ? new Date() : prev.approvedAt,
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(vendorPurchaseOrdersTable.id, input.id))

  // Replace item lines
  await db.delete(vendorPurchaseOrderItemsTable).where(eq(vendorPurchaseOrderItemsTable.poId, input.id))

  if (input.items.length > 0) {
    await db.insert(vendorPurchaseOrderItemsTable).values(
      input.items.map((it, idx) => ({
        poId: input.id,
        itemCode: it.itemCode,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit || 'nos',
        unitPricePaise: it.unitPricePaise,
        taxRateBps: it.taxRateBps || input.taxRateBps,
        amountPaise: Math.round(it.quantity * it.unitPricePaise),
        position: idx,
      })),
    )
  }

  await recordActivity(
    input.id,
    user.id,
    user.fullName || user.username,
    'po_updated',
    null,
    `Updated details and line items (Total: ₹${(totals.totalPaise / 100).toFixed(2)})`,
  )
}

export async function updateVendorPurchaseOrderStatusForCookie(
  id: string,
  status: VendorPurchaseOrderStatus,
  cookieHeader?: string | null,
): Promise<void> {
  const { user, canWrite } = await resolveVendorPoSession(cookieHeader)
  if (!canWrite || !user) throw new Error('Unauthorized to update vendor purchase order status.')

  const existing = await db
    .select()
    .from(vendorPurchaseOrdersTable)
    .where(and(eq(vendorPurchaseOrdersTable.id, id), isNull(vendorPurchaseOrdersTable.deletedAt)))
    .limit(1)

  if (!existing[0]) throw new Error('Vendor purchase order not found.')
  const prev = existing[0]

  const isNowApproved = (status === 'approved' || status === 'issued') && !prev.approvedAt

  await db
    .update(vendorPurchaseOrdersTable)
    .set({
      status,
      approvedBy: isNowApproved ? user.id : prev.approvedBy,
      approvedAt: isNowApproved ? new Date() : prev.approvedAt,
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(vendorPurchaseOrdersTable.id, id))

  await recordActivity(
    id,
    user.id,
    user.fullName || user.username,
    'status_changed',
    prev.status,
    status,
  )
}

export async function deleteVendorPurchaseOrderForCookie(
  id: string,
  cookieHeader?: string | null,
): Promise<void> {
  const { user, canWrite } = await resolveVendorPoSession(cookieHeader)
  if (!canWrite || !user) throw new Error('Unauthorized to delete vendor purchase orders.')

  const existing = await db
    .select()
    .from(vendorPurchaseOrdersTable)
    .where(and(eq(vendorPurchaseOrdersTable.id, id), isNull(vendorPurchaseOrdersTable.deletedAt)))
    .limit(1)

  if (!existing[0]) return

  const now = new Date()
  await db
    .update(vendorPurchaseOrdersTable)
    .set({
      deletedAt: now,
      deletedBy: user.id,
      updatedAt: now,
    })
    .where(eq(vendorPurchaseOrdersTable.id, id))

  await recordActivity(
    id,
    user.id,
    user.fullName || user.username,
    'po_deleted',
    existing[0].poNumber,
    'Soft deleted',
  )
}
