import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  clientPurchaseOrderActivitiesTable,
  clientPurchaseOrderItemsTable,
  clientPurchaseOrdersTable,
  companiesTable,
  projectsTable,
  proposalsTable,
  type ClientPurchaseOrderRecord,
} from '~/db/schema'
import {
  findSessionById,
  isUserAdmin,
  parseSessionCookie,
  userHasPermission,
} from './auth.server'
import {
  computeClientPurchaseOrderTotals,
  type ClientPurchaseOrderDetail,
  type ClientPurchaseOrderFormOptions,
  type ClientPurchaseOrderInput,
  type ClientPurchaseOrderListItem,
  type ClientPurchaseOrdersPagePayload,
  type ClientPurchaseOrderStatus,
  type ClientPurchaseOrderUpdate,
} from './client-purchase-orders'

// ── Auth & Permissions ─────────────────────────────────────────────────────
export async function resolveClientPoSession(cookieHeader?: string | null) {
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
export async function nextClientPoNumber(now = new Date()): Promise<string> {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const suffix = `-${mm}-${yyyy}`
  const prefix = `CPO-`

  const rows = await db
    .select({ orderNumber: clientPurchaseOrdersTable.orderNumber })
    .from(clientPurchaseOrdersTable)
    .where(sql`${clientPurchaseOrdersTable.orderNumber} like ${'CPO-%' + suffix}`)

  let maxSerial = 0
  for (const r of rows) {
    const match = r.orderNumber.match(/^CPO-(\d{3})-\d{2}-\d{4}$/)
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
  orderId: string,
  actorUserId: string | null,
  actorName: string,
  action: string,
  oldValue?: string | null,
  newValue?: string | null,
) {
  await db.insert(clientPurchaseOrderActivitiesTable).values({
    orderId,
    actorUserId,
    actorName,
    action,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
  })
}

// ── Option Loaders ─────────────────────────────────────────────────────────
export async function loadClientPoFormOptions(): Promise<ClientPurchaseOrderFormOptions> {
  const [companies, proposals, projects] = await Promise.all([
    db
      .select({
        id: companiesTable.id,
        name: companiesTable.name,
        email: companiesTable.inquiryEmail,
        address: companiesTable.addressLine1,
        gstin: companiesTable.gstin,
      })
      .from(companiesTable)
      .where(eq(companiesTable.status, 'active'))
      .orderBy(companiesTable.name),

    db
      .select({
        id: proposalsTable.id,
        proposalNumber: proposalsTable.proposalNumber,
        title: proposalsTable.title,
        companyId: proposalsTable.companyId,
        companyName: proposalsTable.companyName,
      })
      .from(proposalsTable)
      .where(isNull(proposalsTable.deletedAt))
      .orderBy(desc(proposalsTable.createdAt))
      .limit(100),

    db
      .select({
        id: projectsTable.id,
        projectNumber: projectsTable.projectNumber,
        name: projectsTable.name,
        companyId: projectsTable.companyId,
        companyName: projectsTable.companyName,
      })
      .from(projectsTable)
      .where(isNull(projectsTable.deletedAt))
      .orderBy(desc(projectsTable.createdAt))
      .limit(100),
  ])

  return { companies, proposals, projects }
}

// ── Serializer ─────────────────────────────────────────────────────────────
function serializeClientPoListItem(row: ClientPurchaseOrderRecord): ClientPurchaseOrderListItem {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    clientPoNumber: row.clientPoNumber,
    companyId: row.companyId,
    companyName: row.companyName,
    clientContactName: row.clientContactName,
    subject: row.subject,
    poDate: row.poDate,
    deliveryDueDate: row.deliveryDueDate,
    status: row.status as ClientPurchaseOrderStatus,
    priority: row.priority as 'low' | 'medium' | 'high',
    subtotalPaise: Number(row.subtotalPaise ?? 0),
    taxAmountPaise: Number(row.taxAmountPaise ?? 0),
    totalPaise: Number(row.totalPaise ?? 0),
    invoicedAmountPaise: Number(row.invoicedAmountPaise ?? 0),
    remainingAmountPaise: Number(row.remainingAmountPaise ?? 0),
    createdAt: row.createdAt.toISOString(),
  }
}

// ── Queries ────────────────────────────────────────────────────────────────
export async function getClientPurchaseOrdersPageDataForCookie(
  cookieHeader?: string | null,
): Promise<ClientPurchaseOrdersPagePayload> {
  const { canRead, canWrite } = await resolveClientPoSession(cookieHeader)
  if (!canRead) {
    return {
      authorized: false,
      canWrite: false,
      orders: [],
      options: { companies: [], proposals: [], projects: [] },
    }
  }

  const [rows, options] = await Promise.all([
    db
      .select()
      .from(clientPurchaseOrdersTable)
      .where(isNull(clientPurchaseOrdersTable.deletedAt))
      .orderBy(desc(clientPurchaseOrdersTable.createdAt)),
    loadClientPoFormOptions(),
  ])

  return {
    authorized: true,
    canWrite,
    orders: rows.map(serializeClientPoListItem),
    options,
  }
}

export async function getClientPurchaseOrderDetailForCookie(
  id: string,
  cookieHeader?: string | null,
): Promise<{ order: ClientPurchaseOrderDetail | null; options: ClientPurchaseOrderFormOptions }> {
  const { canRead } = await resolveClientPoSession(cookieHeader)
  if (!canRead) {
    return { order: null, options: { companies: [], proposals: [], projects: [] } }
  }

  const [orders, options] = await Promise.all([
    db
      .select()
      .from(clientPurchaseOrdersTable)
      .where(and(eq(clientPurchaseOrdersTable.id, id), isNull(clientPurchaseOrdersTable.deletedAt)))
      .limit(1),
    loadClientPoFormOptions(),
  ])

  const orderRow = orders[0]
  if (!orderRow) return { order: null, options }

  const [items, activities, proposalRows, projectRows] = await Promise.all([
    db
      .select()
      .from(clientPurchaseOrderItemsTable)
      .where(eq(clientPurchaseOrderItemsTable.orderId, id))
      .orderBy(clientPurchaseOrderItemsTable.position),
    db
      .select()
      .from(clientPurchaseOrderActivitiesTable)
      .where(eq(clientPurchaseOrderActivitiesTable.orderId, id))
      .orderBy(desc(clientPurchaseOrderActivitiesTable.createdAt))
      .limit(50),
    orderRow.proposalId
      ? db
          .select({ proposalNumber: proposalsTable.proposalNumber })
          .from(proposalsTable)
          .where(eq(proposalsTable.id, orderRow.proposalId))
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

  const base = serializeClientPoListItem(orderRow)
  const detail: ClientPurchaseOrderDetail = {
    ...base,
    clientContactEmail: orderRow.clientContactEmail,
    clientContactPhone: orderRow.clientContactPhone,
    billingAddress: orderRow.billingAddress,
    shippingAddress: orderRow.shippingAddress,
    clientGstin: orderRow.clientGstin,
    clientPan: orderRow.clientPan,
    proposalId: orderRow.proposalId,
    proposalNumber: proposalRows[0]?.proposalNumber ?? null,
    projectId: orderRow.projectId,
    projectName: projectRows[0]?.name ?? null,
    receivedDate: orderRow.receivedDate,
    taxRateBps: orderRow.taxRateBps,
    discountPaise: Number(orderRow.discountPaise ?? 0),
    cgstAmountPaise: Number(orderRow.cgstAmountPaise ?? 0),
    sgstAmountPaise: Number(orderRow.sgstAmountPaise ?? 0),
    igstAmountPaise: Number(orderRow.igstAmountPaise ?? 0),
    paymentTerms: orderRow.paymentTerms,
    deliveryTerms: orderRow.deliveryTerms,
    scopeOfWork: orderRow.scopeOfWork,
    specialInstructions: orderRow.specialInstructions,
    attachmentUrl: orderRow.attachmentUrl,
    notes: orderRow.notes,
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
export async function createClientPurchaseOrderForCookie(
  input: ClientPurchaseOrderInput,
  cookieHeader?: string | null,
): Promise<{ id: string; orderNumber: string }> {
  const { user, canWrite } = await resolveClientPoSession(cookieHeader)
  if (!canWrite || !user) throw new Error('Unauthorized to create client purchase orders.')

  const totals = computeClientPurchaseOrderTotals(input.items, input.discountPaise, input.taxRateBps)
  const orderNumber = await nextClientPoNumber()

  const [inserted] = await db
    .insert(clientPurchaseOrdersTable)
    .values({
      orderNumber,
      clientPoNumber: input.clientPoNumber,
      companyId: input.companyId,
      companyName: input.companyName,
      clientContactName: input.clientContactName,
      clientContactEmail: input.clientContactEmail,
      clientContactPhone: input.clientContactPhone,
      billingAddress: input.billingAddress,
      shippingAddress: input.shippingAddress,
      clientGstin: input.clientGstin,
      clientPan: input.clientPan,
      proposalId: input.proposalId,
      projectId: input.projectId,
      subject: input.subject,
      poDate: input.poDate,
      receivedDate: input.receivedDate,
      deliveryDueDate: input.deliveryDueDate,
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
      invoicedAmountPaise: 0,
      remainingAmountPaise: totals.totalPaise,
      paymentTerms: input.paymentTerms,
      deliveryTerms: input.deliveryTerms,
      scopeOfWork: input.scopeOfWork,
      specialInstructions: input.specialInstructions,
      attachmentUrl: input.attachmentUrl,
      notes: input.notes,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: clientPurchaseOrdersTable.id })

  if (!inserted) throw new Error('Failed to create purchase order record.')

  if (input.items.length > 0) {
    await db.insert(clientPurchaseOrderItemsTable).values(
      input.items.map((it, idx) => {
        const itemAmount = Math.round(it.quantity * it.unitPricePaise)
        return {
          orderId: inserted.id,
          itemCode: it.itemCode,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit || 'nos',
          unitPricePaise: it.unitPricePaise,
          taxRateBps: it.taxRateBps || input.taxRateBps,
          amountPaise: itemAmount,
          position: idx,
        }
      }),
    )
  }

  await recordActivity(
    inserted.id,
    user.id,
    user.fullName || user.username,
    'order_created',
    null,
    `Client PO ${orderNumber} created for ${input.companyName} (${input.clientPoNumber})`,
  )

  return { id: inserted.id, orderNumber }
}

export async function updateClientPurchaseOrderForCookie(
  input: ClientPurchaseOrderUpdate,
  cookieHeader?: string | null,
): Promise<void> {
  const { user, canWrite } = await resolveClientPoSession(cookieHeader)
  if (!canWrite || !user) throw new Error('Unauthorized to update client purchase orders.')

  const existing = await db
    .select()
    .from(clientPurchaseOrdersTable)
    .where(and(eq(clientPurchaseOrdersTable.id, input.id), isNull(clientPurchaseOrdersTable.deletedAt)))
    .limit(1)

  if (!existing[0]) throw new Error('Client purchase order not found.')
  const prev = existing[0]

  const totals = computeClientPurchaseOrderTotals(input.items, input.discountPaise, input.taxRateBps)
  const prevInvoiced = Number(prev.invoicedAmountPaise ?? 0)
  const remaining = Math.max(0, totals.totalPaise - prevInvoiced)

  await db
    .update(clientPurchaseOrdersTable)
    .set({
      clientPoNumber: input.clientPoNumber,
      companyId: input.companyId,
      companyName: input.companyName,
      clientContactName: input.clientContactName,
      clientContactEmail: input.clientContactEmail,
      clientContactPhone: input.clientContactPhone,
      billingAddress: input.billingAddress,
      shippingAddress: input.shippingAddress,
      clientGstin: input.clientGstin,
      clientPan: input.clientPan,
      proposalId: input.proposalId,
      projectId: input.projectId,
      subject: input.subject,
      poDate: input.poDate,
      receivedDate: input.receivedDate,
      deliveryDueDate: input.deliveryDueDate,
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
      remainingAmountPaise: remaining,
      paymentTerms: input.paymentTerms,
      deliveryTerms: input.deliveryTerms,
      scopeOfWork: input.scopeOfWork,
      specialInstructions: input.specialInstructions,
      attachmentUrl: input.attachmentUrl,
      notes: input.notes,
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(clientPurchaseOrdersTable.id, input.id))

  // Replace item lines
  await db.delete(clientPurchaseOrderItemsTable).where(eq(clientPurchaseOrderItemsTable.orderId, input.id))

  if (input.items.length > 0) {
    await db.insert(clientPurchaseOrderItemsTable).values(
      input.items.map((it, idx) => ({
        orderId: input.id,
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
    'order_updated',
    null,
    `Updated details and line items (Total: ₹${(totals.totalPaise / 100).toFixed(2)})`,
  )
}

export async function updateClientPurchaseOrderStatusForCookie(
  id: string,
  status: ClientPurchaseOrderStatus,
  cookieHeader?: string | null,
): Promise<void> {
  const { user, canWrite } = await resolveClientPoSession(cookieHeader)
  if (!canWrite || !user) throw new Error('Unauthorized to update client purchase order status.')

  const existing = await db
    .select()
    .from(clientPurchaseOrdersTable)
    .where(and(eq(clientPurchaseOrdersTable.id, id), isNull(clientPurchaseOrdersTable.deletedAt)))
    .limit(1)

  if (!existing[0]) throw new Error('Client purchase order not found.')
  const prevStatus = existing[0].status

  await db
    .update(clientPurchaseOrdersTable)
    .set({
      status,
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(clientPurchaseOrdersTable.id, id))

  await recordActivity(
    id,
    user.id,
    user.fullName || user.username,
    'status_changed',
    prevStatus,
    status,
  )
}

export async function deleteClientPurchaseOrderForCookie(
  id: string,
  cookieHeader?: string | null,
): Promise<void> {
  const { user, canWrite } = await resolveClientPoSession(cookieHeader)
  if (!canWrite || !user) throw new Error('Unauthorized to delete client purchase orders.')

  const existing = await db
    .select()
    .from(clientPurchaseOrdersTable)
    .where(and(eq(clientPurchaseOrdersTable.id, id), isNull(clientPurchaseOrdersTable.deletedAt)))
    .limit(1)

  if (!existing[0]) return

  const now = new Date()
  await db
    .update(clientPurchaseOrdersTable)
    .set({
      deletedAt: now,
      deletedBy: user.id,
      updatedAt: now,
    })
    .where(eq(clientPurchaseOrdersTable.id, id))

  await recordActivity(
    id,
    user.id,
    user.fullName || user.username,
    'order_deleted',
    existing[0].orderNumber,
    'Soft deleted',
  )
}
