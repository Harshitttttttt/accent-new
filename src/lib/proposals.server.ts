import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  companiesTable,
  leadsTable,
  leadStageHistoryTable,
  proposalCommentsTable,
  proposalDeliverablesTable,
  proposalExclusionsTable,
  proposalFollowUpsTable,
  proposalInputDocumentsTable,
  proposalQuotationLinesTable,
  proposalSoftwareTable,
  proposalStatusHistoryTable,
  proposalsTable,
  softwareMastersTable,
  usersTable,
  type ProposalRecord,
} from '~/db/schema'
import { employeesTable } from '~/db/schema/employees'
import { findSessionById, parseSessionCookie, userHasPermission } from './auth.server'
import {
  DEFAULT_OTHER_TERMS,
  DEFAULT_PAYMENT_TERMS,
  EMPTY_PROPOSAL_STATS,
  OPEN_PROPOSAL_STATUSES,
  PROPOSAL_STATUSES,
  computeProposalStats,
  quotationLinesTotalPaise,
  type ProposalComment,
  type ProposalDetail,
  type ProposalDetailPayload,
  type ProposalFollowUp,
  type ProposalFormOptions,
  type ProposalInput,
  type ProposalListItem,
  type ProposalStatus,
  type ProposalTimelineItem,
  type ProposalUpdate,
  type ProposalsPagePayload,
} from './proposals'

// ── Constants ────────────────────────────────────────────────────────────
/** Upper bound for the single-snapshot page fetch; the list UI works client-side. */
const MAX_PROPOSALS = 500

export type ProposalPermission = 'proposals.read' | 'proposals.write'

// ── Reads ────────────────────────────────────────────────────────────────
export async function listProposals(): Promise<ProposalListItem[]> {
  const rows = await db
    .select({
      proposal: proposalsTable,
      leadNumber: leadsTable.leadNumber,
    })
    .from(proposalsTable)
    .leftJoin(leadsTable, eq(proposalsTable.leadId, leadsTable.id))
    .where(isNull(proposalsTable.deletedAt))
    .orderBy(desc(proposalsTable.createdAt))
    .limit(MAX_PROPOSALS)

  return rows.map(({ proposal, leadNumber }) => ({
    id: proposal.id,
    proposalNumber: proposal.proposalNumber,
    title: proposal.title,
    companyName: proposal.companyName,
    status: proposal.status,
    priority: proposal.priority,
    contractType: proposal.contractType,
    valuePaise: proposal.valuePaise,
    dueDate: proposal.dueDate,
    leadId: proposal.leadId,
    leadNumber: leadNumber ?? null,
    createdAt: proposal.createdAt.toISOString(),
  }))
}

async function getProposalFormOptions(): Promise<ProposalFormOptions> {
  const [companies, software] = await Promise.all([
    db
      .select({ id: companiesTable.id, code: companiesTable.code, name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.status, 'active'))
      .orderBy(companiesTable.name),
    db
      .select({ id: softwareMastersTable.id, name: softwareMastersTable.name, version: softwareMastersTable.version })
      .from(softwareMastersTable)
      .orderBy(softwareMastersTable.name),
  ])
  return { companies, software }
}

async function loadProposalChildren(proposalId: string) {
  const [inputDocuments, deliverables, exclusions, software, quotationLines, followUps, comments, statusHistory] =
    await Promise.all([
      db
        .select({ description: proposalInputDocumentsTable.description })
        .from(proposalInputDocumentsTable)
        .where(eq(proposalInputDocumentsTable.proposalId, proposalId))
        .orderBy(proposalInputDocumentsTable.position),
      db
        .select({ description: proposalDeliverablesTable.description })
        .from(proposalDeliverablesTable)
        .where(eq(proposalDeliverablesTable.proposalId, proposalId))
        .orderBy(proposalDeliverablesTable.position),
      db
        .select({ description: proposalExclusionsTable.description })
        .from(proposalExclusionsTable)
        .where(eq(proposalExclusionsTable.proposalId, proposalId))
        .orderBy(proposalExclusionsTable.position),
      db
        .select({
          id: proposalSoftwareTable.id,
          softwareId: proposalSoftwareTable.softwareId,
          name: proposalSoftwareTable.name,
          notes: proposalSoftwareTable.notes,
        })
        .from(proposalSoftwareTable)
        .where(eq(proposalSoftwareTable.proposalId, proposalId))
        .orderBy(proposalSoftwareTable.position),
      db
        .select({
          id: proposalQuotationLinesTable.id,
          description: proposalQuotationLinesTable.description,
          quantity: proposalQuotationLinesTable.quantity,
          unitPricePaise: proposalQuotationLinesTable.unitPricePaise,
          amountPaise: proposalQuotationLinesTable.amountPaise,
        })
        .from(proposalQuotationLinesTable)
        .where(eq(proposalQuotationLinesTable.proposalId, proposalId))
        .orderBy(proposalQuotationLinesTable.position),
      db
        .select({
          id: proposalFollowUpsTable.id,
          dueDate: proposalFollowUpsTable.dueDate,
          note: proposalFollowUpsTable.note,
          doneAt: proposalFollowUpsTable.doneAt,
        })
        .from(proposalFollowUpsTable)
        .where(eq(proposalFollowUpsTable.proposalId, proposalId))
        .orderBy(proposalFollowUpsTable.dueDate),
      db
        .select({
          id: proposalCommentsTable.id,
          body: proposalCommentsTable.body,
          createdAt: proposalCommentsTable.createdAt,
          authorFirstName: employeesTable.firstName,
          authorLastName: employeesTable.lastName,
          userEmail: usersTable.email,
        })
        .from(proposalCommentsTable)
        .leftJoin(usersTable, eq(proposalCommentsTable.authorId, usersTable.id))
        .leftJoin(employeesTable, eq(usersTable.id, employeesTable.userId))
        .where(eq(proposalCommentsTable.proposalId, proposalId))
        .orderBy(desc(proposalCommentsTable.createdAt)),
      db
        .select({
          id: proposalStatusHistoryTable.id,
          fromStatus: proposalStatusHistoryTable.fromStatus,
          toStatus: proposalStatusHistoryTable.toStatus,
          note: proposalStatusHistoryTable.note,
          changedAt: proposalStatusHistoryTable.changedAt,
          actorFirstName: employeesTable.firstName,
          actorLastName: employeesTable.lastName,
          actorEmail: usersTable.email,
        })
        .from(proposalStatusHistoryTable)
        .leftJoin(usersTable, eq(proposalStatusHistoryTable.changedBy, usersTable.id))
        .leftJoin(employeesTable, eq(usersTable.id, employeesTable.userId))
        .where(eq(proposalStatusHistoryTable.proposalId, proposalId))
        .orderBy(desc(proposalStatusHistoryTable.changedAt)),
    ])

  const serializedComments: ProposalComment[] = comments.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    authorName:
      row.authorFirstName !== null
        ? [row.authorFirstName, row.authorLastName].filter(Boolean).join(' ')
        : (row.userEmail ?? null),
  }))

  const serializedFollowUps: ProposalFollowUp[] = followUps.map((row) => ({
    id: row.id,
    dueDate: row.dueDate,
    note: row.note,
    doneAt: row.doneAt ? row.doneAt.toISOString() : null,
  }))

  const timeline: ProposalTimelineItem[] = [
    ...statusHistory.map((row): ProposalTimelineItem => ({
      id: row.id,
      kind: 'status' as const,
      at: row.changedAt.toISOString(),
      authorName: row.actorFirstName !== null
        ? [row.actorFirstName, row.actorLastName].filter(Boolean).join(' ')
        : (row.actorEmail ?? null),
      body: null,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      note: row.note,
    })),
    ...comments.map((row): ProposalTimelineItem => ({
      id: row.id,
      kind: 'comment' as const,
      at: row.createdAt.toISOString(),
      authorName: row.authorFirstName !== null
        ? [row.authorFirstName, row.authorLastName].filter(Boolean).join(' ')
        : (row.userEmail ?? null),
      body: row.body,
      fromStatus: null,
      toStatus: null,
      note: null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return { inputDocuments, deliverables, exclusions, software, quotationLines, followUps: serializedFollowUps, comments: serializedComments, timeline }
}

export async function getProposalDetail(id: string): Promise<ProposalDetail | null> {
  const [row] = await db
    .select({ proposal: proposalsTable, leadNumber: leadsTable.leadNumber })
    .from(proposalsTable)
    .leftJoin(leadsTable, eq(proposalsTable.leadId, leadsTable.id))
    .where(and(eq(proposalsTable.id, id), isNull(proposalsTable.deletedAt)))
    .limit(1)

  if (!row) return null
  const { proposal, leadNumber } = row
  const children = await loadProposalChildren(proposal.id)

  return {
    id: proposal.id,
    proposalNumber: proposal.proposalNumber,
    leadId: proposal.leadId,
    leadNumber: leadNumber ?? null,
    companyId: proposal.companyId,
    companyName: proposal.companyName,
    title: proposal.title,
    description: proposal.description,
    status: proposal.status,
    priority: proposal.priority,
    contractType: proposal.contractType,
    valuePaise: proposal.valuePaise,
    currency: proposal.currency,
    contactName: proposal.contactName,
    contactEmail: proposal.contactEmail,
    contactPhone: proposal.contactPhone,
    designation: proposal.designation,
    city: proposal.city,
    siteLocation: proposal.siteLocation,
    scopeOfWork: proposal.scopeOfWork,
    plannedStartDate: proposal.plannedStartDate,
    plannedEndDate: proposal.plannedEndDate,
    dueDate: proposal.dueDate,
    modeOfDelivery: proposal.modeOfDelivery,
    revisionsIncluded: proposal.revisionsIncluded,
    siteVisits: proposal.siteVisits,
    siteVisitNotes: proposal.siteVisitNotes,
    validityDays: proposal.validityDays,
    estimatedCostPaise: proposal.estimatedCostPaise,
    commercialNotes: proposal.commercialNotes,
    paymentTerms: proposal.paymentTerms,
    otherTerms: proposal.otherTerms,
    inputDocuments: children.inputDocuments.map((r) => r.description),
    deliverables: children.deliverables.map((r) => r.description),
    exclusions: children.exclusions.map((r) => r.description),
    software: children.software,
    quotationLines: children.quotationLines,
    followUps: children.followUps,
    comments: children.comments,
    timeline: children.timeline,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
  }
}

// ── Mutations ────────────────────────────────────────────────────────────
/**
 * Human reference `P-NNN-MM-YYYY` (serial-month-year), e.g. `P-001-08-2026`.
 * Serial restarts each month; the unique constraint guards races and callers
 * retry once on conflict (same strategy as lead numbers).
 */
async function nextProposalNumber(now = new Date()): Promise<string> {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const suffix = `-${mm}-${yyyy}`

  const [row] = await db
    .select({
      maxSerial: sql<number>`coalesce(max(split_part(${proposalsTable.proposalNumber}, '-', 2)::int), 0)`,
    })
    .from(proposalsTable)
    .where(sql`${proposalsTable.proposalNumber} like ${'%' + suffix}`)

  const serial = String(Number(row?.maxSerial ?? 0) + 1).padStart(3, '0')
  return `P-${serial}${suffix}`
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  return error.code === '23505'
}

async function recordStatusTransition(
  proposalId: string,
  fromStatus: ProposalStatus | null,
  toStatus: ProposalStatus,
  actorUserId: string | null,
  note?: string | null,
) {
  await db.insert(proposalStatusHistoryTable).values({
    proposalId,
    fromStatus,
    toStatus,
    note: note ?? null,
    changedBy: actorUserId,
  })
}

async function assertCompanyExists(companyId: string): Promise<void> {
  const [row] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1)
  if (!row) throw new Error('Linked company no longer exists.')
}

function childRowsFor(proposalId: string, values: ProposalInput) {
  const inputs = values.inputDocuments.map((description, position) => ({ proposalId, description, position }))
  const deliverables = values.deliverables.map((description, position) => ({ proposalId, description, position }))
  const exclusions = values.exclusions.map((description, position) => ({ proposalId, description, position }))
  const software = values.software.map((line, position) => ({
    proposalId,
    softwareId: line.softwareId,
    name: line.name,
    notes: line.notes,
    position,
  }))
  // Amount is always derived server-side: quantity × unit price, integer paise.
  const quotationLines = values.quotationLines.map((line, position) => ({
    proposalId,
    description: line.description,
    quantity: line.quantity,
    unitPricePaise: line.unitPricePaise,
    amountPaise: line.quantity * line.unitPricePaise,
    position,
  }))
  return { inputs, deliverables, exclusions, software, quotationLines }
}

export async function createProposal(
  values: Pick<ProposalInput, 'title' | 'companyName'> & Partial<ProposalInput>,
  actorUserId: string,
): Promise<ProposalRecord> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [row] = await db
        .insert(proposalsTable)
        .values({
          proposalNumber: await nextProposalNumber(),
          title: values.title,
          companyName: values.companyName,
          paymentTerms: DEFAULT_PAYMENT_TERMS,
          otherTerms: DEFAULT_OTHER_TERMS,
          createdBy: actorUserId,
        })
        .returning()
      await recordStatusTransition(row.id, null, 'draft', actorUserId)
      return row
    } catch (error) {
      if (isUniqueViolation(error) && attempt === 0) continue
      throw error
    }
  }
  throw new Error('Proposal number conflict — please retry.')
}

/**
 * Convert a lead into a draft proposal: snapshots company/contact/description/
 * value from the lead, links provenance, and advances open leads to
 * `proposal_sent` (with stage history). Children start empty.
 */
export async function convertLeadToProposal(
  leadId: string,
  actorUserId: string,
): Promise<{ id: string; proposalNumber: string }> {
  const [lead] = await db
    .select()
    .from(leadsTable)
    .where(and(eq(leadsTable.id, leadId), isNull(leadsTable.deletedAt)))
    .limit(1)
  if (!lead) throw new Error('Lead not found.')

  const description = lead.projectDescription?.trim() ?? ''
  const title = (description || `${lead.companyName} — services proposal`).slice(0, 255)

  for (let attempt = 0; attempt < 2; attempt++) {
    let created: ProposalRecord | undefined
    try {
      ;[created] = await db
        .insert(proposalsTable)
        .values({
          proposalNumber: await nextProposalNumber(),
          leadId: lead.id,
          companyId: lead.companyId,
          companyName: lead.companyName,
          title,
          description: description || null,
          priority: lead.priority,
          valuePaise: lead.valuePaise,
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          contactPhone: lead.contactPhone,
          designation: lead.designation,
          city: lead.city,
          dueDate: lead.expectedCloseDate,
          paymentTerms: DEFAULT_PAYMENT_TERMS,
          otherTerms: DEFAULT_OTHER_TERMS,
          createdBy: actorUserId,
        })
        .returning()
    } catch (error) {
      if (isUniqueViolation(error) && attempt === 0) continue
      throw error
    }

    // Advance the source lead to proposal_sent when it hasn't gone out yet.
    const preProposalStages = ['prospecting', 'qualified'] as const
    const shouldAdvance = preProposalStages.includes(lead.stage as (typeof preProposalStages)[number])

    const statements = [
      db.insert(proposalStatusHistoryTable).values({
        proposalId: created.id,
        fromStatus: null,
        toStatus: 'draft',
        changedBy: actorUserId,
      }),
    ] as const
    if (shouldAdvance) {
      await db.batch([
        ...statements,
        db
          .update(leadsTable)
          .set({ stage: 'proposal_sent', updatedAt: new Date(), updatedBy: actorUserId })
          .where(eq(leadsTable.id, lead.id)),
        db.insert(leadStageHistoryTable).values({
          leadId: lead.id,
          fromStage: lead.stage as (typeof preProposalStages)[number],
          toStage: 'proposal_sent',
          changedBy: actorUserId,
        }),
      ])
    } else {
      await db.batch(statements)
    }

    return { id: created.id, proposalNumber: created.proposalNumber }
  }
  throw new Error('Proposal number conflict — please retry.')
}

export async function updateProposal(values: ProposalUpdate, actorUserId: string): Promise<void> {
  if (values.companyId) await assertCompanyExists(values.companyId)

  const [existing] = await db
    .select({ id: proposalsTable.id })
    .from(proposalsTable)
    .where(and(eq(proposalsTable.id, values.id), isNull(proposalsTable.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Proposal not found.')

  const children = childRowsFor(values.id, values)
  // Quoted value follows the quotation lines when lines exist; otherwise the
  // manually entered value stands.
  const valuePaise =
    children.quotationLines.length > 0
      ? quotationLinesTotalPaise(values.quotationLines)
      : (values.valuePaise ?? null)

  // Single batch = one HTTP round trip and one server-side transaction:
  // main row update, full child replacement (delete + reinsert by position).
  await db.batch([
    db
      .update(proposalsTable)
      .set({
        title: values.title,
        description: values.description ?? null,
        companyId: values.companyId ?? null,
        companyName: values.companyName,
        contactName: values.contactName ?? null,
        contactEmail: values.contactEmail ?? null,
        contactPhone: values.contactPhone ?? null,
        designation: values.designation ?? null,
        city: values.city ?? null,
        siteLocation: values.siteLocation ?? null,
        scopeOfWork: values.scopeOfWork ?? null,
        priority: values.priority,
        contractType: values.contractType,
        valuePaise,
        plannedStartDate: values.plannedStartDate ?? null,
        plannedEndDate: values.plannedEndDate ?? null,
        dueDate: values.dueDate ?? null,
        modeOfDelivery: values.modeOfDelivery ?? null,
        revisionsIncluded: values.revisionsIncluded,
        siteVisits: values.siteVisits,
        siteVisitNotes: values.siteVisitNotes ?? null,
        validityDays: values.validityDays ?? null,
        estimatedCostPaise: values.estimatedCostPaise ?? null,
        commercialNotes: values.commercialNotes ?? null,
        paymentTerms: values.paymentTerms ?? null,
        otherTerms: values.otherTerms ?? null,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(proposalsTable.id, values.id)),
    db.delete(proposalInputDocumentsTable).where(eq(proposalInputDocumentsTable.proposalId, values.id)),
    db.delete(proposalDeliverablesTable).where(eq(proposalDeliverablesTable.proposalId, values.id)),
    db.delete(proposalExclusionsTable).where(eq(proposalExclusionsTable.proposalId, values.id)),
    db.delete(proposalSoftwareTable).where(eq(proposalSoftwareTable.proposalId, values.id)),
    db.delete(proposalQuotationLinesTable).where(eq(proposalQuotationLinesTable.proposalId, values.id)),
    ...(children.inputs.length > 0 ? [db.insert(proposalInputDocumentsTable).values(children.inputs)] : []),
    ...(children.deliverables.length > 0 ? [db.insert(proposalDeliverablesTable).values(children.deliverables)] : []),
    ...(children.exclusions.length > 0 ? [db.insert(proposalExclusionsTable).values(children.exclusions)] : []),
    ...(children.software.length > 0 ? [db.insert(proposalSoftwareTable).values(children.software)] : []),
    ...(children.quotationLines.length > 0 ? [db.insert(proposalQuotationLinesTable).values(children.quotationLines)] : []),
  ])
}

export async function updateProposalStatus(
  id: string,
  status: ProposalStatus,
  note: string | null,
  actorUserId: string,
): Promise<void> {
  const [existing] = await db
    .select({ status: proposalsTable.status })
    .from(proposalsTable)
    .where(and(eq(proposalsTable.id, id), isNull(proposalsTable.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Proposal not found.')
  if (existing.status === status) return

  await db.batch([
    db
      .update(proposalsTable)
      .set({ status, updatedBy: actorUserId, updatedAt: new Date() })
      .where(eq(proposalsTable.id, id)),
    db.insert(proposalStatusHistoryTable).values({
      proposalId: id,
      fromStatus: existing.status,
      toStatus: status,
      note,
      changedBy: actorUserId,
    }),
  ])
}

export async function addProposalFollowUp(
  proposalId: string,
  dueDate: string,
  note: string,
  actorUserId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: proposalsTable.id })
    .from(proposalsTable)
    .where(and(eq(proposalsTable.id, proposalId), isNull(proposalsTable.deletedAt)))
    .limit(1)
  if (!row) throw new Error('Proposal not found.')

  await db.insert(proposalFollowUpsTable).values({ proposalId, dueDate, note, createdBy: actorUserId })
}

export async function setProposalFollowUpDone(id: string, done: boolean): Promise<void> {
  await db
    .update(proposalFollowUpsTable)
    .set({ doneAt: done ? new Date() : null })
    .where(eq(proposalFollowUpsTable.id, id))
}

export async function addProposalComment(
  proposalId: string,
  body: string,
  actorUserId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: proposalsTable.id })
    .from(proposalsTable)
    .where(and(eq(proposalsTable.id, proposalId), isNull(proposalsTable.deletedAt)))
    .limit(1)
  if (!row) throw new Error('Proposal not found.')

  await db.insert(proposalCommentsTable).values({ proposalId, body, authorId: actorUserId })
}

export async function softDeleteProposal(id: string, actorUserId: string | null): Promise<void> {
  const [row] = await db
    .update(proposalsTable)
    .set({ deletedAt: new Date(), deletedBy: actorUserId, updatedAt: new Date() })
    .where(and(eq(proposalsTable.id, id), isNull(proposalsTable.deletedAt)))
    .returning({ id: proposalsTable.id })
  if (!row) throw new Error('Proposal not found.')
}

// ── Cookie-bound wrappers (called from server functions) ─────────────────
async function requirePermission(
  cookieHeader: string | undefined,
  permission: ProposalPermission,
): Promise<string | null> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return null
  if (!(await userHasPermission(session.user.id, permission))) return null
  return session.user.id
}

export async function getProposalsPageDataForCookie(
  cookieHeader: string | undefined,
): Promise<ProposalsPagePayload> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) {
    return { authorized: false, proposals: [], options: { companies: [], software: [] } }
  }
  if (!(await userHasPermission(session.user.id, 'proposals.read'))) {
    return { authorized: false, proposals: [], options: { companies: [], software: [] } }
  }

  const [proposals, options] = await Promise.all([listProposals(), getProposalFormOptions()])
  return { authorized: true, proposals, options }
}

export async function getProposalDetailForCookie(
  id: string,
  cookieHeader: string | undefined,
): Promise<ProposalDetailPayload> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  const options: ProposalFormOptions = session
    ? await getProposalFormOptions()
    : { companies: [], software: [] }
  if (!session || !(await userHasPermission(session.user.id, 'proposals.read'))) {
    return { authorized: false, proposal: null, options }
  }

  const proposal = await getProposalDetail(id)
  return { authorized: true, proposal, options }
}

export async function createProposalForCookie(
  values: Pick<ProposalInput, 'title' | 'companyName'> & Partial<ProposalInput>,
  cookieHeader: string | undefined,
): Promise<ProposalRecord> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to create proposals.')
  return createProposal(values, userId)
}

export async function convertLeadToProposalForCookie(
  leadId: string,
  cookieHeader: string | undefined,
): Promise<{ id: string; proposalNumber: string }> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to create proposals.')
  return convertLeadToProposal(leadId, userId)
}

export async function updateProposalForCookie(
  values: ProposalUpdate,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to modify proposals.')
  return updateProposal(values, userId)
}

export async function updateProposalStatusForCookie(
  id: string,
  status: ProposalStatus,
  note: string | null,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to modify proposals.')
  return updateProposalStatus(id, status, note, userId)
}

export async function addProposalFollowUpForCookie(
  proposalId: string,
  dueDate: string,
  note: string,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to modify proposals.')
  return addProposalFollowUp(proposalId, dueDate, note, userId)
}

export async function setProposalFollowUpDoneForCookie(
  id: string,
  done: boolean,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to modify proposals.')
  return setProposalFollowUpDone(id, done)
}

export async function addProposalCommentForCookie(
  proposalId: string,
  body: string,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to modify proposals.')
  return addProposalComment(proposalId, body, userId)
}

export async function deleteProposalForCookie(
  id: string,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'proposals.write')
  if (!userId) throw new Error('Not authorized to delete proposals.')
  return softDeleteProposal(id, userId)
}
