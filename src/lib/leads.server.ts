import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  companiesTable,
  employeesTable,
  leadStageHistoryTable,
  leadsTable,
  type LeadRecord,
} from '~/db/schema'
import {
  findSessionById,
  parseSessionCookie,
  userHasPermission,
} from './auth.server'
import {
  EMPTY_LEADS_PAGE,
  CLOSED_LEAD_STAGES,
  LEAD_STAGES,
  OPEN_LEAD_STAGES,
  type LeadFormOptions,
  type LeadInput,
  type LeadListItem,
  type LeadSourceCode,
  type LeadStage,
  type LeadStats,
  type LeadUpdate,
  type LeadsPagePayload,
} from './leads'

// ── Constants ────────────────────────────────────────────────────────────
/** Upper bound for the single-snapshot page fetch; the pipeline UI works client-side. */
const MAX_LEADS = 500

export type LeadPermission = 'leads.read' | 'leads.write'

// ── Serialization ────────────────────────────────────────────────────────
type LeadWithAssignee = { lead: LeadRecord; assigneeFirstName: string | null; assigneeLastName: string | null }

function serializeLead(row: LeadWithAssignee): LeadListItem {
  const { lead } = row
  const assigneeName =
    row.assigneeFirstName === null
      ? null
      : [row.assigneeFirstName, row.assigneeLastName].filter(Boolean).join(' ')

  return {
    id: lead.id,
    leadNumber: lead.leadNumber,
    companyId: lead.companyId,
    companyName: lead.companyName,
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
    contactPhone: lead.contactPhone,
    designation: lead.designation,
    inquiryEmail: lead.inquiryEmail,
    ccEmails: lead.ccEmails ?? [],
    city: lead.city,
    projectDescription: lead.projectDescription,
    enquiryType: lead.enquiryType,
    sourceCode: lead.sourceCode,
    stage: lead.stage,
    priority: lead.priority,
    valuePaise: lead.valuePaise === null ? null : Number(lead.valuePaise),
    probability: lead.probability,
    score: lead.score,
    closedAt: lead.closedAt === null ? null : lead.closedAt.toISOString(),
    lostReason: lead.lostReason,
    assignedTo: lead.assignedTo,
    assigneeName,
    enquiryDate: lead.enquiryDate,
    expectedCloseDate: lead.expectedCloseDate,
    lastActivityAt: lead.lastActivityAt.toISOString(),
    notes: lead.notes,
    createdAt: lead.createdAt.toISOString(),
  }
}

// ── Reads ────────────────────────────────────────────────────────────────
export async function listLeads(): Promise<LeadListItem[]> {
  const rows = await db
    .select({
      lead: leadsTable,
      assigneeFirstName: employeesTable.firstName,
      assigneeLastName: employeesTable.lastName,
    })
    .from(leadsTable)
    .leftJoin(employeesTable, eq(leadsTable.assignedTo, employeesTable.id))
    .where(isNull(leadsTable.deletedAt))
    .orderBy(desc(leadsTable.createdAt))
    .limit(MAX_LEADS)

  return rows.map(serializeLead)
}

export async function getLeadStats(): Promise<LeadStats> {
  const rows = await db
    .select({
      stage: leadsTable.stage,
      count: sql<number>`count(*)::int`,
      valuePaise: sql<number>`coalesce(sum(${leadsTable.valuePaise}), 0)::bigint`,
    })
    .from(leadsTable)
    .where(isNull(leadsTable.deletedAt))
    .groupBy(leadsTable.stage)

  const stats: LeadStats = {
    totalLeads: 0,
    openPipelinePaise: 0,
    wonValuePaise: 0,
    byStage: Object.fromEntries(
      LEAD_STAGES.map((stage) => [stage, { count: 0, valuePaise: 0 }]),
    ) as LeadStats['byStage'],
  }

  for (const row of rows) {
    const stage = row.stage as LeadStage
    const count = Number(row.count)
    const valuePaise = Number(row.valuePaise)
    stats.byStage[stage] = { count, valuePaise }
    stats.totalLeads += count
    if (OPEN_LEAD_STAGES.includes(stage)) stats.openPipelinePaise += valuePaise
    if (stage === 'closed_won') stats.wonValuePaise += valuePaise
  }

  return stats
}

export async function getLeadFormOptions(): Promise<LeadFormOptions> {
  const [companies, employees] = await Promise.all([
    db
      .select({ id: companiesTable.id, code: companiesTable.code, name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.status, 'active'))
      .orderBy(companiesTable.name),
    db
      .select({ id: employeesTable.id, firstName: employeesTable.firstName, lastName: employeesTable.lastName })
      .from(employeesTable)
      .where(eq(employeesTable.status, 'active'))
      .orderBy(employeesTable.firstName),
  ])

  return { companies, employees }
}

export async function findLeadById(id: string): Promise<LeadRecord | null> {
  const [row] = await db.select().from(leadsTable).where(eq(leadsTable.id, id)).limit(1)
  return row ?? null
}

// ── Mutations ────────────────────────────────────────────────────────────
/**
 * Human reference in the old system's format `NNN-MM-YYYY` (serial-month-year),
 * e.g. `001-08-2026`. Serial restarts each month. The unique constraint on
 * `lead_number` guards against races; callers retry on conflict.
 */
async function nextLeadNumber(now = new Date()): Promise<string> {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const suffix = `-${mm}-${yyyy}`

  const [row] = await db
    .select({
      maxSerial: sql<number>`coalesce(max(split_part(${leadsTable.leadNumber}, '-', 1)::int), 0)`,
    })
    .from(leadsTable)
    .where(sql`${leadsTable.leadNumber} like ${'%' + suffix}`)

  const serial = String(Number(row?.maxSerial ?? 0) + 1).padStart(3, '0')
  return `${serial}${suffix}`
}

export class LeadConflictError extends Error {
  constructor() {
    super('Lead number conflict — retrying.')
  }
}

function leadInputToColumns(values: LeadInput) {
  const isLost = values.stage === 'closed_lost'
  return {
    companyId: values.companyId ?? null,
    companyName: values.companyName,
    contactName: values.contactName ?? null,
    contactEmail: values.contactEmail ?? null,
    contactPhone: values.contactPhone ?? null,
    designation: values.designation ?? null,
    inquiryEmail: values.inquiryEmail ?? null,
    ccEmails: values.ccEmails?.length ? values.ccEmails : null,
    city: values.city ?? null,
    projectDescription: values.projectDescription ?? null,
    enquiryType: values.enquiryType,
    sourceCode: values.sourceCode,
    stage: values.stage,
    priority: values.priority,
    valuePaise: values.valuePaise ?? null,
    probability: values.probability ?? null,
    score: values.score ?? null,
    assignedTo: values.assignedTo ?? null,
    enquiryDate: values.enquiryDate ?? new Date().toISOString().slice(0, 10),
    expectedCloseDate: values.expectedCloseDate ?? null,
    // Loss reason is only meaningful while the lead sits in closed_lost.
    lostReason: isLost ? (values.lostReason ?? null) : null,
    notes: values.notes ?? null,
  }
}

/** closed_at lifecycle: stamped when a stage move enters a closed stage, cleared on exit. */
function closedAtForStage(stage: LeadStage, previous: Date | null): Date | null {
  if (!CLOSED_LEAD_STAGES.includes(stage)) return null
  return previous ?? new Date()
}

async function recordStageTransition(
  leadId: string,
  fromStage: LeadStage | null,
  toStage: LeadStage,
  actorUserId: string | null,
) {
  await db.insert(leadStageHistoryTable).values({
    leadId,
    fromStage,
    toStage,
    changedBy: actorUserId,
  })
}

export async function createLead(values: LeadInput, actorUserId: string): Promise<LeadRecord> {
  if (values.companyId) await assertCompanyExists(values.companyId)

  // Retry once on the rare concurrent-serial collision.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [row] = await db
        .insert(leadsTable)
        .values({
          leadNumber: await nextLeadNumber(),
          ...leadInputToColumns(values),
          closedAt: CLOSED_LEAD_STAGES.includes(values.stage) ? new Date() : null,
          createdBy: actorUserId,
        })
        .returning()
      await recordStageTransition(row.id, null, values.stage, actorUserId)
      return row
    } catch (error) {
      if (isUniqueViolation(error) && attempt === 0) continue
      throw error
    }
  }

  throw new LeadConflictError()
}

export async function updateLead(id: string, values: LeadUpdate, actorUserId: string): Promise<LeadRecord> {
  if (values.companyId) await assertCompanyExists(values.companyId)

  const [existing] = await db
    .select({ stage: leadsTable.stage, closedAt: leadsTable.closedAt })
    .from(leadsTable)
    .where(and(eq(leadsTable.id, id), isNull(leadsTable.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Lead not found.')

  const [row] = await db
    .update(leadsTable)
    .set({
      ...leadInputToColumns(values),
      closedAt: closedAtForStage(values.stage, existing.stage === values.stage ? existing.closedAt : null),
      updatedBy: actorUserId,
      updatedAt: new Date(),
    })
    .where(and(eq(leadsTable.id, id), isNull(leadsTable.deletedAt)))
    .returning()

  if (!row) throw new Error('Lead not found.')
  if (existing.stage !== values.stage) {
    await recordStageTransition(id, existing.stage as LeadStage, values.stage, actorUserId)
  }
  return row
}

export async function updateLeadStage(id: string, stage: LeadStage, actorUserId: string | null): Promise<LeadRecord> {
  const [existing] = await db
    .select({ stage: leadsTable.stage, closedAt: leadsTable.closedAt })
    .from(leadsTable)
    .where(and(eq(leadsTable.id, id), isNull(leadsTable.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Lead not found.')

  const [row] = await db
    .update(leadsTable)
    .set({
      stage,
      closedAt: closedAtForStage(stage, existing.closedAt),
      lostReason: stage === 'closed_lost' ? undefined : null,
      lastActivityAt: new Date(),
      updatedBy: actorUserId,
      updatedAt: new Date(),
    })
    .where(and(eq(leadsTable.id, id), isNull(leadsTable.deletedAt)))
    .returning()

  if (!row) throw new Error('Lead not found.')
  if (existing.stage !== stage) {
    await recordStageTransition(id, existing.stage as LeadStage, stage, actorUserId)
  }
  return row
}

export async function softDeleteLead(id: string, actorUserId: string | null): Promise<void> {
  const [row] = await db
    .update(leadsTable)
    .set({ deletedAt: new Date(), deletedBy: actorUserId, updatedAt: new Date() })
    .where(and(eq(leadsTable.id, id), isNull(leadsTable.deletedAt)))
    .returning({ id: leadsTable.id })

  if (!row) throw new Error('Lead not found.')
}


function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  return error.code === '23505'
}

async function assertCompanyExists(companyId: string): Promise<void> {
  const [row] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1)

  if (!row) throw new Error('Linked company no longer exists.')
}

// ── Cookie-bound wrappers (called from server functions) ─────────────────
async function requirePermission(
  cookieHeader: string | undefined,
  permission: LeadPermission,
): Promise<string | null> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return null
  if (!(await userHasPermission(session.user.id, permission))) return null
  return session.user.id
}

export async function getLeadsPageDataForCookie(
  cookieHeader: string | undefined,
): Promise<LeadsPagePayload> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return EMPTY_LEADS_PAGE
  if (!(await userHasPermission(session.user.id, 'leads.read'))) return EMPTY_LEADS_PAGE

  const [leads, stats, options] = await Promise.all([
    listLeads(),
    getLeadStats(),
    getLeadFormOptions(),
  ])

  return { authorized: true, leads, stats, options }
}

export async function createLeadForCookie(
  values: LeadInput,
  cookieHeader: string | undefined,
): Promise<LeadRecord> {
  const userId = await requirePermission(cookieHeader, 'leads.write')
  if (!userId) throw new Error('Not authorized to create leads.')
  return createLead(values, userId)
}

export async function updateLeadForCookie(
  values: LeadUpdate,
  cookieHeader: string | undefined,
): Promise<LeadRecord> {
  const userId = await requirePermission(cookieHeader, 'leads.write')
  if (!userId) throw new Error('Not authorized to modify leads.')
  return updateLead(values.id, values, userId)
}

export async function updateLeadStageForCookie(
  id: string,
  stage: LeadStage,
  cookieHeader: string | undefined,
): Promise<LeadRecord> {
  const userId = await requirePermission(cookieHeader, 'leads.write')
  if (!userId) throw new Error('Not authorized to modify leads.')
  return updateLeadStage(id, stage, userId)
}

export async function deleteLeadForCookie(
  id: string,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'leads.write')
  if (!userId) throw new Error('Not authorized to delete leads.')
  return softDeleteLead(id, userId)
}
