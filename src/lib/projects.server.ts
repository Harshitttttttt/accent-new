import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  companiesTable,
  employeesTable,
  leadsTable,
  projectCommentsTable,
  projectDeliverablesTable,
  projectExclusionsTable,
  projectInputDocumentsTable,
  projectMilestonesTable,
  projectMembersTable,
  projectRisksTable,
  projectSoftwareTable,
  projectStatusHistoryTable,
  projectsTable,
  proposalsTable,
  proposalDeliverablesTable,
  proposalExclusionsTable,
  proposalInputDocumentsTable,
  proposalSoftwareTable,
  softwareMastersTable,
  usersTable,
  type ProjectDataRecord,
} from '~/db/schema'
import { findSessionById, parseSessionCookie, userHasPermission } from './auth.server'
import {
  type ProjectDetail,
  type ProjectDetailPayload,
  type ProjectFormOptions,
  type ProjectInput,
  type ProjectListItem,
  type ProjectStatus,
  type ProjectTimelineItem,
  type ProjectUpdate,
  type ProjectsPagePayload,
} from './projects'

// ── Constants ────────────────────────────────────────────────────────────
/** Upper bound for the single-snapshot page fetch; the list UI works client-side. */
const MAX_PROJECTS = 500

export type ProjectPermission = 'projects.read' | 'projects.write'

// ── Reads ────────────────────────────────────────────────────────────────
export async function listProjects(): Promise<ProjectListItem[]> {
  const manager = employeesTable
  const rows = await db
    .select({
      project: projectsTable,
      proposalNumber: proposalsTable.proposalNumber,
      managerFirstName: manager.firstName,
      managerLastName: manager.lastName,
    })
    .from(projectsTable)
    .leftJoin(proposalsTable, eq(projectsTable.proposalId, proposalsTable.id))
    .leftJoin(manager, eq(projectsTable.projectManagerId, manager.id))
    .where(isNull(projectsTable.deletedAt))
    .orderBy(desc(projectsTable.createdAt))
    .limit(MAX_PROJECTS)

  return rows.map(({ project, proposalNumber, managerFirstName, managerLastName }) => ({
    id: project.id,
    projectNumber: project.projectNumber,
    name: project.name,
    companyName: project.companyName,
    status: project.status,
    priority: project.priority,
    progress: project.progress,
    contractValuePaise: project.contractValuePaise,
    startDate: project.startDate,
    endDate: project.endDate,
    managerName:
      managerFirstName === null ? null : [managerFirstName, managerLastName].filter(Boolean).join(' '),
    proposalNumber: proposalNumber ?? null,
    createdAt: project.createdAt.toISOString(),
  }))
}

async function getProjectFormOptions(): Promise<ProjectFormOptions> {
  const [companies, employees, software] = await Promise.all([
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
    db
      .select({ id: softwareMastersTable.id, name: softwareMastersTable.name, version: softwareMastersTable.version })
      .from(softwareMastersTable)
      .orderBy(softwareMastersTable.name),
  ])
  return { companies, employees, software }
}

function authorName(firstName: string | null, lastName: string | null, email: string | null): string | null {
  if (firstName !== null) return [firstName, lastName].filter(Boolean).join(' ')
  return email ?? null
}

/**
 * Twenty-style unified timeline: status transitions and discussion comments
 * interleaved into one chronological feed, newest first.
 */
async function loadProjectTimeline(
  projectId: string,
): Promise<ProjectTimelineItem[]> {
  const [statusRows, commentRows] = await Promise.all([
    db
      .select({
        id: projectStatusHistoryTable.id,
        fromStatus: projectStatusHistoryTable.fromStatus,
        toStatus: projectStatusHistoryTable.toStatus,
        note: projectStatusHistoryTable.note,
        changedAt: projectStatusHistoryTable.changedAt,
        actorFirstName: employeesTable.firstName,
        actorLastName: employeesTable.lastName,
        actorEmail: usersTable.email,
      })
      .from(projectStatusHistoryTable)
      .leftJoin(usersTable, eq(projectStatusHistoryTable.changedBy, usersTable.id))
      .leftJoin(employeesTable, eq(usersTable.id, employeesTable.userId))
      .where(eq(projectStatusHistoryTable.projectId, projectId))
      .orderBy(desc(projectStatusHistoryTable.changedAt)),
    db
      .select({
        id: projectCommentsTable.id,
        body: projectCommentsTable.body,
        createdAt: projectCommentsTable.createdAt,
        actorFirstName: employeesTable.firstName,
        actorLastName: employeesTable.lastName,
        actorEmail: usersTable.email,
      })
      .from(projectCommentsTable)
      .leftJoin(usersTable, eq(projectCommentsTable.authorId, usersTable.id))
      .leftJoin(employeesTable, eq(usersTable.id, employeesTable.userId))
      .where(eq(projectCommentsTable.projectId, projectId))
      .orderBy(desc(projectCommentsTable.createdAt)),
  ])

  const statusItems: ProjectTimelineItem[] = statusRows.map((row) => ({
    id: row.id,
    kind: 'status' as const,
    at: row.changedAt.toISOString(),
    authorName: authorName(row.actorFirstName, row.actorLastName, row.actorEmail),
    body: null,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    note: row.note,
  }))
  const commentItems: ProjectTimelineItem[] = commentRows.map((row) => ({
    id: row.id,
    kind: 'comment' as const,
    at: row.createdAt.toISOString(),
    authorName: authorName(row.actorFirstName, row.actorLastName, row.actorEmail),
    body: row.body,
    fromStatus: null,
    toStatus: null,
    note: null,
  }))

  return [...statusItems, ...commentItems].sort((a, b) => b.at.localeCompare(a.at))
}

export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  const [row] = await db
    .select({
      project: projectsTable,
      proposalNumber: proposalsTable.proposalNumber,
      leadNumber: leadsTable.leadNumber,
      managerFirstName: employeesTable.firstName,
      managerLastName: employeesTable.lastName,
    })
    .from(projectsTable)
    .leftJoin(proposalsTable, eq(projectsTable.proposalId, proposalsTable.id))
    .leftJoin(leadsTable, eq(projectsTable.leadId, leadsTable.id))
    .leftJoin(employeesTable, eq(projectsTable.projectManagerId, employeesTable.id))
    .where(and(eq(projectsTable.id, id), isNull(projectsTable.deletedAt)))
    .limit(1)

  if (!row) return null
  const { project, proposalNumber, leadNumber, managerFirstName, managerLastName } = row

  const [inputDocuments, deliverables, exclusions, software, members, milestones, risks, timeline] =
    await Promise.all([
      db
        .select({ description: projectInputDocumentsTable.description })
        .from(projectInputDocumentsTable)
        .where(eq(projectInputDocumentsTable.projectId, project.id))
        .orderBy(projectInputDocumentsTable.position),
      db
        .select({ description: projectDeliverablesTable.description })
        .from(projectDeliverablesTable)
        .where(eq(projectDeliverablesTable.projectId, project.id))
        .orderBy(projectDeliverablesTable.position),
      db
        .select({ description: projectExclusionsTable.description })
        .from(projectExclusionsTable)
        .where(eq(projectExclusionsTable.projectId, project.id))
        .orderBy(projectExclusionsTable.position),
      db
        .select({
          id: projectSoftwareTable.id,
          softwareId: projectSoftwareTable.softwareId,
          name: projectSoftwareTable.name,
          notes: projectSoftwareTable.notes,
        })
        .from(projectSoftwareTable)
        .where(eq(projectSoftwareTable.projectId, project.id))
        .orderBy(projectSoftwareTable.position),
      db
        .select({
          id: projectMembersTable.id,
          employeeId: projectMembersTable.employeeId,
          role: projectMembersTable.role,
          firstName: employeesTable.firstName,
          lastName: employeesTable.lastName,
        })
        .from(projectMembersTable)
        .innerJoin(employeesTable, eq(projectMembersTable.employeeId, employeesTable.id))
        .where(eq(projectMembersTable.projectId, project.id))
        .orderBy(projectMembersTable.position),
      db
        .select()
        .from(projectMilestonesTable)
        .where(eq(projectMilestonesTable.projectId, project.id))
        .orderBy(projectMilestonesTable.position),
      db
        .select()
        .from(projectRisksTable)
        .where(eq(projectRisksTable.projectId, project.id))
        .orderBy(desc(projectRisksTable.createdAt)),
      loadProjectTimeline(project.id),
    ])

  return {
    id: project.id,
    projectNumber: project.projectNumber,
    proposalId: project.proposalId,
    proposalNumber: proposalNumber ?? null,
    leadNumber: leadNumber ?? null,
    companyId: project.companyId,
    companyName: project.companyName,
    name: project.name,
    description: project.description,
    status: project.status,
    priority: project.priority,
    contractType: project.contractType,
    progress: project.progress,
    contractValuePaise: project.contractValuePaise,
    estimatedCostPaise: project.estimatedCostPaise,
    currency: project.currency,
    contactName: project.contactName,
    contactEmail: project.contactEmail,
    contactPhone: project.contactPhone,
    designation: project.designation,
    city: project.city,
    siteLocation: project.siteLocation,
    startDate: project.startDate,
    endDate: project.endDate,
    kickoffMeetingDate: project.kickoffMeetingDate,
    modeOfDelivery: project.modeOfDelivery,
    paymentTerms: project.paymentTerms,
    otherTerms: project.otherTerms,
    notes: project.notes,
    projectManagerId: project.projectManagerId,
    managerName:
      managerFirstName === null ? null : [managerFirstName, managerLastName].filter(Boolean).join(' '),
    scopeOfWork: project.scopeOfWork,
    inputDocuments: inputDocuments.map((r) => r.description),
    deliverables: deliverables.map((r) => r.description),
    exclusions: exclusions.map((r) => r.description),
    software,
    members: members.map((m) => ({
      id: m.id,
      employeeId: m.employeeId,
      employeeName: [m.firstName, m.lastName].filter(Boolean).join(' '),
      role: m.role,
    })),
    milestones: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      dueDate: m.dueDate,
      status: m.status,
      completedAt: m.completedAt ? m.completedAt.toISOString() : null,
    })),
    risks,
    timeline,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
}

// ── Mutations ────────────────────────────────────────────────────────────
/**
 * Human reference `PRJ-NNN-MM-YYYY` (serial-month-year), e.g. `PRJ-001-08-2026`.
 * Serial restarts each month; unique constraint guards races, callers retry once.
 */
async function nextProjectNumber(now = new Date()): Promise<string> {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  const suffix = `-${mm}-${yyyy}`

  const [row] = await db
    .select({
      maxSerial: sql<number>`coalesce(max(split_part(${projectsTable.projectNumber}, '-', 2)::int), 0)`,
    })
    .from(projectsTable)
    .where(sql`${projectsTable.projectNumber} like ${'%' + suffix}`)

  const serial = String(Number(row?.maxSerial ?? 0) + 1).padStart(3, '0')
  return `PRJ-${serial}${suffix}`
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  return error.code === '23505'
}

async function recordProjectStatusTransition(
  projectId: string,
  fromStatus: ProjectStatus | null,
  toStatus: ProjectStatus,
  actorUserId: string | null,
  note?: string | null,
) {
  await db.insert(projectStatusHistoryTable).values({
    projectId,
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

function projectChildRowsFor(
  projectId: string,
  values: ProjectInput,
  milestoneCompletedAtByName: Map<string, Date | null> = new Map(),
) {
  return {
    inputs: values.inputDocuments.map((description, position) => ({ projectId, description, position })),
    deliverables: values.deliverables.map((description, position) => ({ projectId, description, position })),
    exclusions: values.exclusions.map((description, position) => ({ projectId, description, position })),
    software: values.software.map((line, position) => ({
      projectId,
      softwareId: line.softwareId,
      name: line.name,
      notes: line.notes,
      position,
    })),
    members: values.members.map((member, position) => ({
      projectId,
      employeeId: member.employeeId,
      role: member.role,
      position,
    })),
    milestones: values.milestones.map((milestone, position) => ({
      projectId,
      name: milestone.name,
      dueDate: milestone.dueDate,
      status: milestone.status,
      // Stamp a completion date when a milestone first reaches 'done'; keep the
      // original stamp on later saves (looked up by the caller).
      completedAt: milestoneCompletedAtByName.get(milestone.name) ?? (milestone.status === 'done' ? new Date() : null),
      position,
    })),
    risks: values.risks.map((risk) => ({
      projectId,
      description: risk.description,
      severity: risk.severity,
      mitigation: risk.mitigation,
      status: risk.status,
    })),
  }
}

export async function createProject(
  values: Pick<ProjectInput, 'name' | 'companyName'> & Partial<ProjectInput>,
  actorUserId: string,
): Promise<ProjectDataRecord> {
  if (values.companyId) await assertCompanyExists(values.companyId)

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [row] = await db
        .insert(projectsTable)
        .values({
          projectNumber: await nextProjectNumber(),
          name: values.name,
          companyName: values.companyName,
          createdBy: actorUserId,
        })
        .returning()
      await recordProjectStatusTransition(row.id, null, 'planning', actorUserId)
      return row
    } catch (error) {
      if (isUniqueViolation(error) && attempt === 0) continue
      throw error
    }
  }
  throw new Error('Project number conflict — please retry.')
}

/**
 * Convert a proposal into a delivery project: snapshots the commercial anchors,
 * copies the scope annexure children (input documents, deliverables,
 * exclusions, software), links the lead → proposal → project provenance chain,
 * and seeds the lifecycle history. The proposal itself is left untouched.
 */
export async function convertProposalToProject(
  proposalId: string,
  actorUserId: string,
): Promise<{ id: string; projectNumber: string }> {
  const [proposal] = await db
    .select()
    .from(proposalsTable)
    .where(and(eq(proposalsTable.id, proposalId), isNull(proposalsTable.deletedAt)))
    .limit(1)
  if (!proposal) throw new Error('Proposal not found.')

  for (let attempt = 0; attempt < 2; attempt++) {
    let created: ProjectDataRecord | undefined
    try {
      ;[created] = await db
        .insert(projectsTable)
        .values({
          projectNumber: await nextProjectNumber(),
          proposalId: proposal.id,
          leadId: proposal.leadId,
          companyId: proposal.companyId,
          companyName: proposal.companyName,
          name: proposal.title,
          description: proposal.description,
          priority: proposal.priority,
          contractType: proposal.contractType,
          contractValuePaise: proposal.valuePaise,
          estimatedCostPaise: proposal.estimatedCostPaise,
          contactName: proposal.contactName,
          contactEmail: proposal.contactEmail,
          contactPhone: proposal.contactPhone,
          designation: proposal.designation,
          city: proposal.city,
          siteLocation: proposal.siteLocation,
          scopeOfWork: proposal.scopeOfWork,
          startDate: proposal.plannedStartDate,
          endDate: proposal.plannedEndDate,
          modeOfDelivery: proposal.modeOfDelivery,
          paymentTerms: proposal.paymentTerms,
          otherTerms: proposal.otherTerms,
          createdBy: actorUserId,
        })
        .returning()
    } catch (error) {
      if (isUniqueViolation(error) && attempt === 0) continue
      throw error
    }

    // Copy the scope annexure children from the proposal in one batch.
    const [inputs, deliverables, exclusions, software] = await Promise.all([
      db
        .select({ description: proposalInputDocumentsTable.description })
        .from(proposalInputDocumentsTable)
        .where(eq(proposalInputDocumentsTable.proposalId, proposal.id))
        .orderBy(proposalInputDocumentsTable.position),
      db
        .select({ description: proposalDeliverablesTable.description })
        .from(proposalDeliverablesTable)
        .where(eq(proposalDeliverablesTable.proposalId, proposal.id))
        .orderBy(proposalDeliverablesTable.position),
      db
        .select({ description: proposalExclusionsTable.description })
        .from(proposalExclusionsTable)
        .where(eq(proposalExclusionsTable.proposalId, proposal.id))
        .orderBy(proposalExclusionsTable.position),
      db
        .select({
          softwareId: proposalSoftwareTable.softwareId,
          name: proposalSoftwareTable.name,
          notes: proposalSoftwareTable.notes,
        })
        .from(proposalSoftwareTable)
        .where(eq(proposalSoftwareTable.proposalId, proposal.id))
        .orderBy(proposalSoftwareTable.position),
    ])

    await db.batch([
      db.insert(projectStatusHistoryTable).values({
        projectId: created.id,
        fromStatus: null,
        toStatus: 'planning',
        changedBy: actorUserId,
      }),
      ...(inputs.length > 0
        ? [db.insert(projectInputDocumentsTable).values(inputs.map((r, position) => ({ projectId: created!.id, ...r, position })))]
        : []),
      ...(deliverables.length > 0
        ? [db.insert(projectDeliverablesTable).values(deliverables.map((r, position) => ({ projectId: created!.id, ...r, position })))]
        : []),
      ...(exclusions.length > 0
        ? [db.insert(projectExclusionsTable).values(exclusions.map((r, position) => ({ projectId: created!.id, ...r, position })))]
        : []),
      ...(software.length > 0
        ? [db.insert(projectSoftwareTable).values(software.map((r, position) => ({ projectId: created!.id, ...r, position })))]
        : []),
    ])

    return { id: created.id, projectNumber: created.projectNumber }
  }
  throw new Error('Project number conflict — please retry.')
}

export async function updateProject(values: ProjectUpdate, actorUserId: string): Promise<void> {
  if (values.companyId) await assertCompanyExists(values.companyId)

  const [existing] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, values.id), isNull(projectsTable.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Project not found.')

  // Preserve original completion stamps: a milestone that is already 'done'
  // keeps its completedAt even across renames of other rows.
  const existingMilestones = await db
    .select({ name: projectMilestonesTable.name, completedAt: projectMilestonesTable.completedAt })
    .from(projectMilestonesTable)
    .where(and(eq(projectMilestonesTable.projectId, values.id), eq(projectMilestonesTable.status, 'done')))
  const milestoneCompletedAtByName = new Map(existingMilestones.map((m) => [m.name, m.completedAt]))

  const children = projectChildRowsFor(values.id, values, milestoneCompletedAtByName)

  // Single batch = one HTTP round trip and one server-side transaction:
  // main row update, full child replacement (delete + reinsert by position).
  await db.batch([
    db
      .update(projectsTable)
      .set({
        name: values.name,
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
        progress: values.progress,
        contractValuePaise: values.contractValuePaise ?? null,
        estimatedCostPaise: values.estimatedCostPaise ?? null,
        startDate: values.startDate ?? null,
        endDate: values.endDate ?? null,
        kickoffMeetingDate: values.kickoffMeetingDate ?? null,
        modeOfDelivery: values.modeOfDelivery ?? null,
        paymentTerms: values.paymentTerms ?? null,
        otherTerms: values.otherTerms ?? null,
        notes: values.notes ?? null,
        projectManagerId: values.projectManagerId ?? null,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, values.id)),
    db.delete(projectInputDocumentsTable).where(eq(projectInputDocumentsTable.projectId, values.id)),
    db.delete(projectDeliverablesTable).where(eq(projectDeliverablesTable.projectId, values.id)),
    db.delete(projectExclusionsTable).where(eq(projectExclusionsTable.projectId, values.id)),
    db.delete(projectSoftwareTable).where(eq(projectSoftwareTable.projectId, values.id)),
    db.delete(projectMembersTable).where(eq(projectMembersTable.projectId, values.id)),
    db.delete(projectMilestonesTable).where(eq(projectMilestonesTable.projectId, values.id)),
    db.delete(projectRisksTable).where(eq(projectRisksTable.projectId, values.id)),
    ...(children.inputs.length > 0 ? [db.insert(projectInputDocumentsTable).values(children.inputs)] : []),
    ...(children.deliverables.length > 0 ? [db.insert(projectDeliverablesTable).values(children.deliverables)] : []),
    ...(children.exclusions.length > 0 ? [db.insert(projectExclusionsTable).values(children.exclusions)] : []),
    ...(children.software.length > 0 ? [db.insert(projectSoftwareTable).values(children.software)] : []),
    ...(children.members.length > 0 ? [db.insert(projectMembersTable).values(children.members)] : []),
    ...(children.milestones.length > 0 ? [db.insert(projectMilestonesTable).values(children.milestones)] : []),
    ...(children.risks.length > 0 ? [db.insert(projectRisksTable).values(children.risks)] : []),
  ])
}

export async function updateProjectStatus(
  id: string,
  status: ProjectStatus,
  note: string | null,
  actorUserId: string,
): Promise<void> {
  const [existing] = await db
    .select({ status: projectsTable.status })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), isNull(projectsTable.deletedAt)))
    .limit(1)
  if (!existing) throw new Error('Project not found.')
  if (existing.status === status) return

  await db.batch([
    db
      .update(projectsTable)
      .set({ status, updatedBy: actorUserId, updatedAt: new Date() })
      .where(eq(projectsTable.id, id)),
    db.insert(projectStatusHistoryTable).values({
      projectId: id,
      fromStatus: existing.status,
      toStatus: status,
      note,
      changedBy: actorUserId,
    }),
  ])
}

export async function addProjectComment(
  projectId: string,
  body: string,
  actorUserId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), isNull(projectsTable.deletedAt)))
    .limit(1)
  if (!row) throw new Error('Project not found.')

  await db.insert(projectCommentsTable).values({ projectId, body, authorId: actorUserId })
}

export async function softDeleteProject(id: string, actorUserId: string | null): Promise<void> {
  const [row] = await db
    .update(projectsTable)
    .set({ deletedAt: new Date(), deletedBy: actorUserId, updatedAt: new Date() })
    .where(and(eq(projectsTable.id, id), isNull(projectsTable.deletedAt)))
    .returning({ id: projectsTable.id })
  if (!row) throw new Error('Project not found.')
}

// ── Cookie-bound wrappers (called from server functions) ─────────────────
async function requirePermission(
  cookieHeader: string | undefined,
  permission: ProjectPermission,
): Promise<string | null> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return null
  if (!(await userHasPermission(session.user.id, permission))) return null
  return session.user.id
}

const EMPTY_OPTIONS: ProjectFormOptions = { companies: [], employees: [], software: [] }

export async function getProjectsPageDataForCookie(
  cookieHeader: string | undefined,
): Promise<ProjectsPagePayload> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session || !(await userHasPermission(session.user.id, 'projects.read'))) {
    return { authorized: false, projects: [], options: EMPTY_OPTIONS }
  }

  const [projects, options] = await Promise.all([listProjects(), getProjectFormOptions()])
  return { authorized: true, projects, options }
}

export async function getProjectDetailForCookie(
  id: string,
  cookieHeader: string | undefined,
): Promise<ProjectDetailPayload> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  const options = session ? await getProjectFormOptions() : EMPTY_OPTIONS
  if (!session || !(await userHasPermission(session.user.id, 'projects.read'))) {
    return { authorized: false, project: null, options }
  }

  const project = await getProjectDetail(id)
  return { authorized: true, project, options }
}

export async function createProjectForCookie(
  values: Pick<ProjectInput, 'name' | 'companyName'> & Partial<ProjectInput>,
  cookieHeader: string | undefined,
): Promise<ProjectDataRecord> {
  const userId = await requirePermission(cookieHeader, 'projects.write')
  if (!userId) throw new Error('Not authorized to create projects.')
  return createProject(values, userId)
}

export async function convertProposalToProjectForCookie(
  proposalId: string,
  cookieHeader: string | undefined,
): Promise<{ id: string; projectNumber: string }> {
  const userId = await requirePermission(cookieHeader, 'projects.write')
  if (!userId) throw new Error('Not authorized to create projects.')
  return convertProposalToProject(proposalId, userId)
}

export async function updateProjectForCookie(
  values: ProjectUpdate,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'projects.write')
  if (!userId) throw new Error('Not authorized to modify projects.')
  return updateProject(values, userId)
}

export async function updateProjectStatusForCookie(
  id: string,
  status: ProjectStatus,
  note: string | null,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'projects.write')
  if (!userId) throw new Error('Not authorized to modify projects.')
  return updateProjectStatus(id, status, note, userId)
}

export async function addProjectCommentForCookie(
  projectId: string,
  body: string,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'projects.write')
  if (!userId) throw new Error('Not authorized to modify projects.')
  return addProjectComment(projectId, body, userId)
}

export async function deleteProjectForCookie(
  id: string,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requirePermission(cookieHeader, 'projects.write')
  if (!userId) throw new Error('Not authorized to delete projects.')
  return softDeleteProject(id, userId)
}
