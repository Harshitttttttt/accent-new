import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  banksTable,
  clientPaymentAllocationsTable,
  clientPaymentsTable,
  companiesTable,
  paymentActivitiesTable,
  projectsTable,
  saleInvoicesTable,
  type ClientPaymentRecord,
} from '~/db/schema'
import {
  findSessionById,
  isUserAdmin,
  parseSessionCookie,
  userHasPermission,
} from './auth.server'
import {
  computePaymentReceivedNet,
  type ClientPaymentStatus,
  type PaymentReceivedDetail,
  type PaymentReceivedFormOptions,
  type PaymentReceivedInput,
  type PaymentReceivedListItem,
  type PaymentsReceivedPagePayload,
  type PaymentReceivedUpdate,
} from './payments-received'

// ── Auth & Permissions ─────────────────────────────────────────────────────
export async function resolvePaymentsReceivedSession(cookieHeader?: string | null) {
  const sessionId = parseSessionCookie(cookieHeader ?? undefined)
  if (!sessionId) return { user: null, canRead: false, canWrite: false, isAdmin: false }

  const session = await findSessionById(sessionId)
  if (!session) return { user: null, canRead: false, canWrite: false, isAdmin: false }

  const isAdmin = await isUserAdmin(session.userId)
  const canRead =
    isAdmin ||
    (await userHasPermission(session.userId, 'finance.read')) ||
    (await userHasPermission(session.userId, 'proposals.read'))

  const canWrite =
    isAdmin ||
    (await userHasPermission(session.userId, 'finance.write'))

  return { user: session.user, canRead, canWrite, isAdmin }
}

// ── Receipt Sequence Generator ─────────────────────────────────────────────
export async function nextReceiptNumber(now = new Date()): Promise<string> {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const suffix = `-${mm}-${yyyy}`
  const prefix = `REC-`

  const rows = await db
    .select({ receiptNumber: clientPaymentsTable.receiptNumber })
    .from(clientPaymentsTable)
    .where(sql`${clientPaymentsTable.receiptNumber} like ${'REC-%' + suffix}`)

  let maxSerial = 0
  for (const r of rows) {
    const match = r.receiptNumber.match(/^REC-(\d{3})-\d{2}-\d{4}$/)
    if (match?.[1]) {
      const n = Number.parseInt(match[1], 10)
      if (n > maxSerial) maxSerial = n
    }
  }

  const nextSerial = String(maxSerial + 1).padStart(3, '0')
  return `${prefix}${nextSerial}${suffix}`
}

// ── Activity Recorder ──────────────────────────────────────────────────────
async function recordPaymentActivity(
  entityType: 'received' | 'released',
  entityId: string,
  actorUserId: string | null,
  actorName: string,
  action: string,
  oldValue?: string | null,
  newValue?: string | null,
) {
  await db.insert(paymentActivitiesTable).values({
    entityType,
    entityId,
    actorUserId,
    actorName,
    action,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
  })
}

// ── Option Loaders ─────────────────────────────────────────────────────────
export async function loadPaymentReceivedFormOptions(): Promise<PaymentReceivedFormOptions> {
  const [companies, projects, saleInvoices, banks] = await Promise.all([
    db
      .select({ id: companiesTable.id, name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.status, 'active'))
      .orderBy(companiesTable.name),
    db
      .select({
        id: projectsTable.id,
        name: projectsTable.name,
        companyId: projectsTable.companyId,
      })
      .from(projectsTable)
      .where(isNull(projectsTable.deletedAt))
      .orderBy(projectsTable.name),
    db
      .select({
        id: saleInvoicesTable.id,
        invoiceNumber: saleInvoicesTable.invoiceNumber,
        clientName: saleInvoicesTable.clientName,
        companyId: saleInvoicesTable.companyId,
        projectId: saleInvoicesTable.projectId,
        totalPaise: saleInvoicesTable.totalPaise,
        amountPaidPaise: saleInvoicesTable.amountPaidPaise,
        balanceDuePaise: saleInvoicesTable.balanceDuePaise,
      })
      .from(saleInvoicesTable)
      .where(isNull(saleInvoicesTable.deletedAt))
      .orderBy(desc(saleInvoicesTable.createdAt)),
    db
      .select({
        id: banksTable.id,
        bankName: banksTable.bankName,
        accountNumber: banksTable.accountNumber,
        ifscCode: banksTable.ifscCode,
        branchName: banksTable.branchName,
        isPrimary: banksTable.isPrimary,
      })
      .from(banksTable)
      .where(eq(banksTable.status, 'active'))
      .orderBy(desc(banksTable.isPrimary), banksTable.bankName),
  ])

  return { companies, projects, saleInvoices, banks }
}

function mapPaymentRecordToListItem(r: ClientPaymentRecord): PaymentReceivedListItem {
  return {
    id: r.id,
    receiptNumber: r.receiptNumber,
    companyId: r.companyId,
    companyName: r.companyName,
    projectId: r.projectId,
    projectName: r.projectName,
    invoiceId: r.invoiceId,
    invoiceNumber: r.invoiceNumber,
    clientPoId: r.clientPoId,
    clientPoNumber: r.clientPoNumber,
    bankId: r.bankId,
    bankName: r.bankName,
    bankAccountNumber: r.bankAccountNumber,
    paymentDate: r.paymentDate,
    paymentType: r.paymentType,
    paymentMode: r.paymentMode,
    transactionReference: r.transactionReference,
    chequeDate: r.chequeDate,
    chequeBank: r.chequeBank,
    amountPaise: Number(r.amountPaise),
    tdsDeductedPaise: Number(r.tdsDeductedPaise),
    bankChargesPaise: Number(r.bankChargesPaise),
    netAmountPaise: Number(r.netAmountPaise),
    status: r.status,
    receiptUrl: r.receiptUrl,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

// ── Page Data ──────────────────────────────────────────────────────────────
export async function loadPaymentsReceivedPageData(cookieHeader?: string | null): Promise<PaymentsReceivedPagePayload> {
  const { canWrite, isAdmin } = await resolvePaymentsReceivedSession(cookieHeader)

  const rows = await db
    .select()
    .from(clientPaymentsTable)
    .where(isNull(clientPaymentsTable.deletedAt))
    .orderBy(desc(clientPaymentsTable.paymentDate), desc(clientPaymentsTable.createdAt))

  const payments = rows.map(mapPaymentRecordToListItem)
  const options = await loadPaymentReceivedFormOptions()

  return { payments, options, canWrite, isAdmin }
}

// ── Detail Data ────────────────────────────────────────────────────────────
export async function loadPaymentReceivedDetailData(id: string): Promise<{ payment: PaymentReceivedDetail | null }> {
  const [paymentRow] = await db
    .select()
    .from(clientPaymentsTable)
    .where(and(eq(clientPaymentsTable.id, id), isNull(clientPaymentsTable.deletedAt)))
    .limit(1)

  if (!paymentRow) return { payment: null }

  const [allocRows, actRows] = await Promise.all([
    db
      .select({
        id: clientPaymentAllocationsTable.id,
        invoiceId: clientPaymentAllocationsTable.invoiceId,
        invoiceNumber: saleInvoicesTable.invoiceNumber,
        allocatedAmountPaise: clientPaymentAllocationsTable.allocatedAmountPaise,
        notes: clientPaymentAllocationsTable.notes,
      })
      .from(clientPaymentAllocationsTable)
      .leftJoin(saleInvoicesTable, eq(clientPaymentAllocationsTable.invoiceId, saleInvoicesTable.id))
      .where(eq(clientPaymentAllocationsTable.paymentId, id)),
    db
      .select()
      .from(paymentActivitiesTable)
      .where(and(eq(paymentActivitiesTable.entityType, 'received'), eq(paymentActivitiesTable.entityId, id)))
      .orderBy(desc(paymentActivitiesTable.createdAt)),
  ])

  const item = mapPaymentRecordToListItem(paymentRow)

  const detail: PaymentReceivedDetail = {
    ...item,
    allocations: allocRows.map((a) => ({
      id: a.id,
      invoiceId: a.invoiceId,
      invoiceNumber: a.invoiceNumber ?? null,
      allocatedAmountPaise: Number(a.allocatedAmountPaise),
      notes: a.notes,
    })),
    activities: actRows.map((act) => ({
      id: act.id,
      actorUserId: act.actorUserId,
      actorName: act.actorName,
      action: act.action,
      oldValue: act.oldValue,
      newValue: act.newValue,
      createdAt: act.createdAt.toISOString(),
    })),
  }

  return { payment: detail }
}

// ── Mutations ──────────────────────────────────────────────────────────────
export async function createPaymentReceived(
  input: PaymentReceivedInput,
  actorUser: { id: string; fullName: string } | null,
) {
  const receiptNumber = await nextReceiptNumber(new Date(input.paymentDate))
  const netAmountPaise = computePaymentReceivedNet(input.amountPaise, input.tdsDeductedPaise, input.bankChargesPaise)

  // Resolve denormalized labels
  let companyName = input.companyName
  if (input.companyId) {
    const [comp] = await db
      .select({ name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.id, input.companyId))
      .limit(1)
    if (comp) companyName = comp.name
  }

  let projectName: string | null = input.projectName ?? null
  if (input.projectId) {
    const [proj] = await db
      .select({ name: projectsTable.name })
      .from(projectsTable)
      .where(eq(projectsTable.id, input.projectId))
      .limit(1)
    if (proj) projectName = proj.name
  }

  let invoiceNumber: string | null = input.invoiceNumber ?? null
  if (input.invoiceId) {
    const [inv] = await db
      .select({ invoiceNumber: saleInvoicesTable.invoiceNumber })
      .from(saleInvoicesTable)
      .where(eq(saleInvoicesTable.id, input.invoiceId))
      .limit(1)
    if (inv) invoiceNumber = inv.invoiceNumber
  }

  let bankName: string | null = input.bankName ?? null
  let bankAccountNumber: string | null = input.bankAccountNumber ?? null
  if (input.bankId) {
    const [b] = await db
      .select({ bankName: banksTable.bankName, accountNumber: banksTable.accountNumber })
      .from(banksTable)
      .where(eq(banksTable.id, input.bankId))
      .limit(1)
    if (b) {
      bankName = b.bankName
      bankAccountNumber = b.accountNumber
    }
  }

  const [inserted] = await db
    .insert(clientPaymentsTable)
    .values({
      receiptNumber,
      companyId: input.companyId ?? null,
      companyName,
      projectId: input.projectId ?? null,
      projectName,
      invoiceId: input.invoiceId ?? null,
      invoiceNumber,
      clientPoId: input.clientPoId ?? null,
      clientPoNumber: input.clientPoNumber ?? null,
      bankId: input.bankId ?? null,
      bankName,
      bankAccountNumber,
      paymentDate: input.paymentDate,
      paymentType: input.paymentType,
      paymentMode: input.paymentMode,
      transactionReference: input.transactionReference ?? null,
      chequeDate: input.chequeDate ?? null,
      chequeBank: input.chequeBank ?? null,
      amountPaise: input.amountPaise,
      tdsDeductedPaise: input.tdsDeductedPaise,
      bankChargesPaise: input.bankChargesPaise,
      netAmountPaise,
      status: input.status,
      notes: input.notes ?? null,
      receiptUrl: input.receiptUrl ?? null,
      createdBy: actorUser?.id ?? null,
      updatedBy: actorUser?.id ?? null,
    })
    .returning()

  // Insert allocations if any
  if (input.allocations && input.allocations.length > 0) {
    await db.insert(clientPaymentAllocationsTable).values(
      input.allocations.map((a) => ({
        paymentId: inserted.id,
        invoiceId: a.invoiceId,
        allocatedAmountPaise: a.allocatedAmountPaise,
        notes: a.notes ?? null,
      })),
    )
  }

  // If directly linked to a sale invoice and status is cleared, update the invoice's amount paid & balance due
  if (input.invoiceId && input.status === 'cleared') {
    const [inv] = await db
      .select()
      .from(saleInvoicesTable)
      .where(eq(saleInvoicesTable.id, input.invoiceId))
      .limit(1)

    if (inv) {
      const currentPaid = Number(inv.amountPaidPaise || 0)
      const total = Number(inv.totalPaise || 0)
      const newPaid = currentPaid + input.amountPaise
      const newBalance = Math.max(0, total - newPaid)
      const newStatus = newBalance === 0 ? 'paid' : inv.status

      await db
        .update(saleInvoicesTable)
        .set({
          amountPaidPaise: newPaid,
          balanceDuePaise: newBalance,
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(saleInvoicesTable.id, input.invoiceId))
    }
  }

  // Record audit activity
  await recordPaymentActivity(
    'received',
    inserted.id,
    actorUser?.id ?? null,
    actorUser?.fullName ?? 'System User',
    'created',
    null,
    `Created receipt ${receiptNumber} for ₹${(input.amountPaise / 100).toLocaleString('en-IN')}`,
  )

  return { ok: true as const, id: inserted.id, receiptNumber }
}

export async function updatePaymentReceived(
  input: PaymentReceivedUpdate,
  actorUser: { id: string; fullName: string } | null,
) {
  const [existing] = await db
    .select()
    .from(clientPaymentsTable)
    .where(and(eq(clientPaymentsTable.id, input.id), isNull(clientPaymentsTable.deletedAt)))
    .limit(1)

  if (!existing) {
    return { ok: false as const, message: 'Payment receipt not found' }
  }

  const netAmountPaise = computePaymentReceivedNet(input.amountPaise, input.tdsDeductedPaise, input.bankChargesPaise)

  await db
    .update(clientPaymentsTable)
    .set({
      companyId: input.companyId ?? null,
      companyName: input.companyName,
      projectId: input.projectId ?? null,
      projectName: input.projectName ?? null,
      invoiceId: input.invoiceId ?? null,
      invoiceNumber: input.invoiceNumber ?? null,
      clientPoId: input.clientPoId ?? null,
      clientPoNumber: input.clientPoNumber ?? null,
      bankId: input.bankId ?? null,
      bankName: input.bankName ?? null,
      bankAccountNumber: input.bankAccountNumber ?? null,
      paymentDate: input.paymentDate,
      paymentType: input.paymentType,
      paymentMode: input.paymentMode,
      transactionReference: input.transactionReference ?? null,
      chequeDate: input.chequeDate ?? null,
      chequeBank: input.chequeBank ?? null,
      amountPaise: input.amountPaise,
      tdsDeductedPaise: input.tdsDeductedPaise,
      bankChargesPaise: input.bankChargesPaise,
      netAmountPaise,
      status: input.status,
      notes: input.notes ?? null,
      receiptUrl: input.receiptUrl ?? null,
      updatedBy: actorUser?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(clientPaymentsTable.id, input.id))

  // Update allocations
  await db.delete(clientPaymentAllocationsTable).where(eq(clientPaymentAllocationsTable.paymentId, input.id))
  if (input.allocations && input.allocations.length > 0) {
    await db.insert(clientPaymentAllocationsTable).values(
      input.allocations.map((a) => ({
        paymentId: input.id,
        invoiceId: a.invoiceId,
        allocatedAmountPaise: a.allocatedAmountPaise,
        notes: a.notes ?? null,
      })),
    )
  }

  await recordPaymentActivity(
    'received',
    input.id,
    actorUser?.id ?? null,
    actorUser?.fullName ?? 'System User',
    'updated',
    null,
    `Updated receipt details (${existing.receiptNumber})`,
  )

  return { ok: true as const, id: input.id, receiptNumber: existing.receiptNumber }
}

export async function updatePaymentReceivedStatus(
  id: string,
  status: ClientPaymentStatus,
  actorUser: { id: string; fullName: string } | null,
) {
  const [existing] = await db
    .select()
    .from(clientPaymentsTable)
    .where(and(eq(clientPaymentsTable.id, id), isNull(clientPaymentsTable.deletedAt)))
    .limit(1)

  if (!existing) {
    return { ok: false as const, message: 'Payment receipt not found' }
  }

  await db
    .update(clientPaymentsTable)
    .set({
      status,
      updatedBy: actorUser?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(clientPaymentsTable.id, id))

  await recordPaymentActivity(
    'received',
    id,
    actorUser?.id ?? null,
    actorUser?.fullName ?? 'System User',
    'status_changed',
    existing.status,
    status,
  )

  return { ok: true as const, id, status }
}

export async function deletePaymentReceived(
  id: string,
  actorUser: { id: string; fullName: string } | null,
) {
  const [existing] = await db
    .select()
    .from(clientPaymentsTable)
    .where(and(eq(clientPaymentsTable.id, id), isNull(clientPaymentsTable.deletedAt)))
    .limit(1)

  if (!existing) {
    return { ok: false as const, message: 'Payment receipt not found' }
  }

  await db
    .update(clientPaymentsTable)
    .set({
      deletedAt: new Date(),
      deletedBy: actorUser?.id ?? null,
    })
    .where(eq(clientPaymentsTable.id, id))

  await recordPaymentActivity(
    'received',
    id,
    actorUser?.id ?? null,
    actorUser?.fullName ?? 'System User',
    'deleted',
    null,
    `Deleted receipt ${existing.receiptNumber}`,
  )

  return { ok: true as const, id }
}
