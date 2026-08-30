import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  banksTable,
  companiesTable,
  paymentActivitiesTable,
  paymentsReleasedTable,
  projectsTable,
  saleInvoicesTable,
  type PaymentReleasedRecord,
} from '~/db/schema'
import {
  findSessionById,
  isUserAdmin,
  parseSessionCookie,
  userHasPermission,
} from './auth.server'
import {
  computePaymentReleasedNet,
  type PaymentReleasedDetail,
  type PaymentReleasedFormOptions,
  type PaymentReleasedInput,
  type PaymentReleasedListItem,
  type PaymentReleaseStatus,
  type PaymentsReleasedPagePayload,
  type PaymentReleasedUpdate,
} from './payments-released'

// ── Auth & Permissions ─────────────────────────────────────────────────────
export async function resolvePaymentsReleasedSession(cookieHeader?: string | null) {
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

// ── Release Sequence Generator ─────────────────────────────────────────────
export async function nextReleaseNumber(now = new Date()): Promise<string> {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const suffix = `-${mm}-${yyyy}`
  const prefix = `REL-`

  const rows = await db
    .select({ paymentNumber: paymentsReleasedTable.paymentNumber })
    .from(paymentsReleasedTable)
    .where(sql`${paymentsReleasedTable.paymentNumber} like ${'REL-%' + suffix}`)

  let maxSerial = 0
  for (const r of rows) {
    const match = r.paymentNumber.match(/^REL-(\d{3})-\d{2}-\d{4}$/)
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
export async function loadPaymentReleasedFormOptions(): Promise<PaymentReleasedFormOptions> {
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

function mapPaymentReleasedRecordToListItem(r: PaymentReleasedRecord): PaymentReleasedListItem {
  return {
    id: r.id,
    paymentNumber: r.paymentNumber,
    companyId: r.companyId,
    companyName: r.companyName,
    projectId: r.projectId,
    projectName: r.projectName,
    saleInvoiceId: r.saleInvoiceId,
    invoiceNumber: r.invoiceNumber,
    disbursingBankId: r.disbursingBankId,
    disbursingBankName: r.disbursingBankName,
    clientBankName: r.clientBankName,
    clientAccountNumber: r.clientAccountNumber,
    clientIfscCode: r.clientIfscCode,
    releaseDate: r.releaseDate,
    releaseType: r.releaseType,
    paymentMode: r.paymentMode,
    transactionReference: r.transactionReference,
    amountPaise: Number(r.amountPaise),
    deductionPaise: Number(r.deductionPaise),
    netAmountPaise: Number(r.netAmountPaise),
    status: r.status,
    reason: r.reason,
    notes: r.notes,
    attachmentUrl: r.attachmentUrl,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

// ── Page Data ──────────────────────────────────────────────────────────────
export async function loadPaymentsReleasedPageData(cookieHeader?: string | null): Promise<PaymentsReleasedPagePayload> {
  const { canWrite, isAdmin } = await resolvePaymentsReleasedSession(cookieHeader)

  const rows = await db
    .select()
    .from(paymentsReleasedTable)
    .where(isNull(paymentsReleasedTable.deletedAt))
    .orderBy(desc(paymentsReleasedTable.releaseDate), desc(paymentsReleasedTable.createdAt))

  const payments = rows.map(mapPaymentReleasedRecordToListItem)
  const options = await loadPaymentReleasedFormOptions()

  return { payments, options, canWrite, isAdmin }
}

// ── Detail Data ────────────────────────────────────────────────────────────
export async function loadPaymentReleasedDetailData(id: string): Promise<{ payment: PaymentReleasedDetail | null }> {
  const [paymentRow] = await db
    .select()
    .from(paymentsReleasedTable)
    .where(and(eq(paymentsReleasedTable.id, id), isNull(paymentsReleasedTable.deletedAt)))
    .limit(1)

  if (!paymentRow) return { payment: null }

  const actRows = await db
    .select()
    .from(paymentActivitiesTable)
    .where(and(eq(paymentActivitiesTable.entityType, 'released'), eq(paymentActivitiesTable.entityId, id)))
    .orderBy(desc(paymentActivitiesTable.createdAt))

  const item = mapPaymentReleasedRecordToListItem(paymentRow)

  const detail: PaymentReleasedDetail = {
    ...item,
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
export async function createPaymentReleased(
  input: PaymentReleasedInput,
  actorUser: { id: string; fullName: string } | null,
) {
  const paymentNumber = await nextReleaseNumber(new Date(input.releaseDate))
  const netAmountPaise = computePaymentReleasedNet(input.amountPaise, input.deductionPaise)

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
  if (input.saleInvoiceId) {
    const [inv] = await db
      .select({ invoiceNumber: saleInvoicesTable.invoiceNumber })
      .from(saleInvoicesTable)
      .where(eq(saleInvoicesTable.id, input.saleInvoiceId))
      .limit(1)
    if (inv) invoiceNumber = inv.invoiceNumber
  }

  let disbursingBankName: string | null = input.disbursingBankName ?? null
  if (input.disbursingBankId) {
    const [b] = await db
      .select({ bankName: banksTable.bankName })
      .from(banksTable)
      .where(eq(banksTable.id, input.disbursingBankId))
      .limit(1)
    if (b) disbursingBankName = b.bankName
  }

  const [inserted] = await db
    .insert(paymentsReleasedTable)
    .values({
      paymentNumber,
      companyId: input.companyId ?? null,
      companyName,
      projectId: input.projectId ?? null,
      projectName,
      saleInvoiceId: input.saleInvoiceId ?? null,
      invoiceNumber,
      disbursingBankId: input.disbursingBankId ?? null,
      disbursingBankName,
      clientBankName: input.clientBankName ?? null,
      clientAccountNumber: input.clientAccountNumber ?? null,
      clientIfscCode: input.clientIfscCode ?? null,
      releaseDate: input.releaseDate,
      releaseType: input.releaseType,
      paymentMode: input.paymentMode,
      transactionReference: input.transactionReference ?? null,
      amountPaise: input.amountPaise,
      deductionPaise: input.deductionPaise,
      netAmountPaise,
      status: input.status,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      attachmentUrl: input.attachmentUrl ?? null,
      createdBy: actorUser?.id ?? null,
      updatedBy: actorUser?.id ?? null,
    })
    .returning()

  await recordPaymentActivity(
    'released',
    inserted.id,
    actorUser?.id ?? null,
    actorUser?.fullName ?? 'System User',
    'created',
    null,
    `Created payment release ${paymentNumber} for ₹${(input.amountPaise / 100).toLocaleString('en-IN')}`,
  )

  return { ok: true as const, id: inserted.id, paymentNumber }
}

export async function approvePaymentReleased(
  id: string,
  actorUser: { id: string; fullName: string } | null,
) {
  const [existing] = await db
    .select()
    .from(paymentsReleasedTable)
    .where(and(eq(paymentsReleasedTable.id, id), isNull(paymentsReleasedTable.deletedAt)))
    .limit(1)

  if (!existing) {
    return { ok: false as const, message: 'Payment release record not found' }
  }

  await db
    .update(paymentsReleasedTable)
    .set({
      status: 'approved',
      approvedBy: actorUser?.id ?? null,
      approvedAt: new Date(),
      updatedBy: actorUser?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(paymentsReleasedTable.id, id))

  await recordPaymentActivity(
    'released',
    id,
    actorUser?.id ?? null,
    actorUser?.fullName ?? 'System User',
    'approved',
    existing.status,
    'approved',
  )

  return { ok: true as const, id, status: 'approved' }
}

export async function updatePaymentReleased(
  input: PaymentReleasedUpdate,
  actorUser: { id: string; fullName: string } | null,
) {
  const [existing] = await db
    .select()
    .from(paymentsReleasedTable)
    .where(and(eq(paymentsReleasedTable.id, input.id), isNull(paymentsReleasedTable.deletedAt)))
    .limit(1)

  if (!existing) {
    return { ok: false as const, message: 'Payment release record not found' }
  }

  const netAmountPaise = computePaymentReleasedNet(input.amountPaise, input.deductionPaise)

  await db
    .update(paymentsReleasedTable)
    .set({
      companyId: input.companyId ?? null,
      companyName: input.companyName,
      projectId: input.projectId ?? null,
      projectName: input.projectName ?? null,
      saleInvoiceId: input.saleInvoiceId ?? null,
      invoiceNumber: input.invoiceNumber ?? null,
      disbursingBankId: input.disbursingBankId ?? null,
      disbursingBankName: input.disbursingBankName ?? null,
      clientBankName: input.clientBankName ?? null,
      clientAccountNumber: input.clientAccountNumber ?? null,
      clientIfscCode: input.clientIfscCode ?? null,
      releaseDate: input.releaseDate,
      releaseType: input.releaseType,
      paymentMode: input.paymentMode,
      transactionReference: input.transactionReference ?? null,
      amountPaise: input.amountPaise,
      deductionPaise: input.deductionPaise,
      netAmountPaise,
      status: input.status,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      attachmentUrl: input.attachmentUrl ?? null,
      updatedBy: actorUser?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(paymentsReleasedTable.id, input.id))

  await recordPaymentActivity(
    'released',
    input.id,
    actorUser?.id ?? null,
    actorUser?.fullName ?? 'System User',
    'updated',
    null,
    `Updated release details (${existing.paymentNumber})`,
  )

  return { ok: true as const, id: input.id, paymentNumber: existing.paymentNumber }
}

export async function updatePaymentReleasedStatus(
  id: string,
  status: PaymentReleaseStatus,
  actorUser: { id: string; fullName: string } | null,
) {
  const [existing] = await db
    .select()
    .from(paymentsReleasedTable)
    .where(and(eq(paymentsReleasedTable.id, id), isNull(paymentsReleasedTable.deletedAt)))
    .limit(1)

  if (!existing) {
    return { ok: false as const, message: 'Payment release record not found' }
  }

  await db
    .update(paymentsReleasedTable)
    .set({
      status,
      updatedBy: actorUser?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(paymentsReleasedTable.id, id))

  await recordPaymentActivity(
    'released',
    id,
    actorUser?.id ?? null,
    actorUser?.fullName ?? 'System User',
    'status_changed',
    existing.status,
    status,
  )

  return { ok: true as const, id, status }
}

export async function deletePaymentReleased(
  id: string,
  actorUser: { id: string; fullName: string } | null,
) {
  const [existing] = await db
    .select()
    .from(paymentsReleasedTable)
    .where(and(eq(paymentsReleasedTable.id, id), isNull(paymentsReleasedTable.deletedAt)))
    .limit(1)

  if (!existing) {
    return { ok: false as const, message: 'Payment release record not found' }
  }

  await db
    .update(paymentsReleasedTable)
    .set({
      deletedAt: new Date(),
      deletedBy: actorUser?.id ?? null,
    })
    .where(eq(paymentsReleasedTable.id, id))

  await recordPaymentActivity(
    'released',
    id,
    actorUser?.id ?? null,
    actorUser?.fullName ?? 'System User',
    'deleted',
    null,
    `Deleted payment release ${existing.paymentNumber}`,
  )

  return { ok: true as const, id }
}
