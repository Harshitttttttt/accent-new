import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  disciplineActivitiesTable,
  disciplineSubActivitiesTable,
  disciplinesTable,
  employeesTable,
  projectActivityAssignmentsTable,
  projectActivityLogsTable,
  projectsTable,
} from '~/db/schema'
import { findSessionById, parseSessionCookie, userHasPermission } from './auth.server'
import {
  formatMinutes,
  type ActivityTreeDiscipline,
  type AssignmentListItem,
  type AssignmentStatus,
  type CreateAssignmentInput,
  type CreateAssignmentLogInput,
  type UpdateAssignmentInput,
  type WorkLogEntry,
} from './project-activities'

// ── Reads ────────────────────────────────────────────────────────────────
/** Discipline → Activity → Sub-Activity tree for cascading selects. */
export async function getActivityMasterTree(): Promise<ActivityTreeDiscipline[]> {
  const [disciplines, activities, subActivities] = await Promise.all([
    db
      .select({ id: disciplinesTable.id, code: disciplinesTable.code, name: disciplinesTable.name })
      .from(disciplinesTable)
      .where(eq(disciplinesTable.isActive, true))
      .orderBy(asc(disciplinesTable.name)),
    db
      .select({
        id: disciplineActivitiesTable.id,
        code: disciplineActivitiesTable.code,
        name: disciplineActivitiesTable.name,
        unit: disciplineActivitiesTable.unit,
        disciplineId: disciplineActivitiesTable.disciplineId,
      })
      .from(disciplineActivitiesTable)
      .where(eq(disciplineActivitiesTable.isActive, true))
      .orderBy(asc(disciplineActivitiesTable.name)),
    db
      .select({
        id: disciplineSubActivitiesTable.id,
        code: disciplineSubActivitiesTable.code,
        name: disciplineSubActivitiesTable.name,
        unit: disciplineSubActivitiesTable.unit,
        activityId: disciplineSubActivitiesTable.activityId,
      })
      .from(disciplineSubActivitiesTable)
      .where(eq(disciplineSubActivitiesTable.isActive, true))
      .orderBy(asc(disciplineSubActivitiesTable.name)),
  ])

  return disciplines.map((discipline) => ({
    ...discipline,
    activities: activities
      .filter((a) => a.disciplineId === discipline.id)
      .map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        unit: a.unit,
        subActivities: subActivities
          .filter((s) => s.activityId === a.id)
          .map((s) => ({ id: s.id, code: s.code, name: s.name, unit: s.unit })),
      })),
  }))
}

/** Assignments for a project with logged effort aggregated from the log rows. */
export async function listProjectAssignments(projectId: string): Promise<AssignmentListItem[]> {
  const rows = await db
    .select({
      assignment: projectActivityAssignmentsTable,
      assigneeFirstName: employeesTable.firstName,
      assigneeLastName: employeesTable.lastName,
      unit: disciplineActivitiesTable.unit,
      loggedMinutes: sql<number>`coalesce((
        select sum(${projectActivityLogsTable.minutes})::int
        from ${projectActivityLogsTable}
        where ${projectActivityLogsTable.assignmentId} = ${projectActivityAssignmentsTable.id}
      ), 0)`,
    })
    .from(projectActivityAssignmentsTable)
    .leftJoin(employeesTable, eq(projectActivityAssignmentsTable.assigneeId, employeesTable.id))
    .leftJoin(disciplineActivitiesTable, eq(projectActivityAssignmentsTable.activityId, disciplineActivitiesTable.id))
    .where(eq(projectActivityAssignmentsTable.projectId, projectId))
    .orderBy(asc(projectActivityAssignmentsTable.createdAt))

  return rows.map(({ assignment, assigneeFirstName, assigneeLastName, unit, loggedMinutes }) => ({
    id: assignment.id,
    disciplineId: assignment.disciplineId,
    activityId: assignment.activityId,
    subActivityId: assignment.subActivityId,
    disciplineName: assignment.disciplineName,
    activityName: assignment.activityName,
    subActivityName: assignment.subActivityName,
    assigneeId: assignment.assigneeId,
    assigneeName:
      assigneeFirstName === null
        ? null
        : [assigneeFirstName, assigneeLastName].filter(Boolean).join(' '),
    plannedMinutes: assignment.plannedMinutes,
    loggedMinutes: Number(loggedMinutes ?? 0),
    quantity: assignment.quantity,
    unit,
    dueDate: assignment.dueDate,
    priority: assignment.priority,
    status: assignment.status,
    remark: assignment.remark,
    createdAt: assignment.createdAt.toISOString(),
  }))
}

/** Flat work-log entries for the day-wise view, newest first. */
export async function listProjectWorkLogs(
  projectId: string,
  startDate: string | null,
  endDate: string | null,
  assigneeId: string | null,
): Promise<WorkLogEntry[]> {
  const filters = [eq(projectActivityLogsTable.projectId, projectId)]
  if (startDate) filters.push(gte(projectActivityLogsTable.logDate, startDate))
  if (endDate) filters.push(lte(projectActivityLogsTable.logDate, endDate))
  if (assigneeId) filters.push(eq(projectActivityAssignmentsTable.assigneeId, assigneeId))

  const rows = await db
    .select({
      id: projectActivityLogsTable.id,
      assignmentId: projectActivityLogsTable.assignmentId,
      logDate: projectActivityLogsTable.logDate,
      minutes: projectActivityLogsTable.minutes,
      note: projectActivityLogsTable.note,
      assigneeId: projectActivityAssignmentsTable.assigneeId,
      assigneeFirstName: employeesTable.firstName,
      assigneeLastName: employeesTable.lastName,
      disciplineName: projectActivityAssignmentsTable.disciplineName,
      activityName: projectActivityAssignmentsTable.activityName,
      subActivityName: projectActivityAssignmentsTable.subActivityName,
    })
    .from(projectActivityLogsTable)
    .innerJoin(
      projectActivityAssignmentsTable,
      eq(projectActivityLogsTable.assignmentId, projectActivityAssignmentsTable.id),
    )
    .leftJoin(employeesTable, eq(projectActivityAssignmentsTable.assigneeId, employeesTable.id))
    .where(and(...filters))
    .orderBy(desc(projectActivityLogsTable.logDate), desc(projectActivityLogsTable.createdAt))
    .limit(1_000)

  return rows.map((row) => ({
    id: row.id,
    assignmentId: row.assignmentId,
    logDate: row.logDate,
    minutes: row.minutes,
    note: row.note,
    assigneeId: row.assigneeId,
    assigneeName:
      row.assigneeFirstName === null
        ? null
        : [row.assigneeFirstName, row.assigneeLastName].filter(Boolean).join(' '),
    disciplineName: row.disciplineName,
    activityName: row.activityName,
    subActivityName: row.subActivityName,
  }))
}

// ── Mutations ────────────────────────────────────────────────────────────
async function assertProjectExists(projectId: string): Promise<void> {
  const [row] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), isNull(projectsTable.deletedAt)))
    .limit(1)
  if (!row) throw new Error('Project not found.')
}

async function assertAssignmentExists(id: string) {
  const [row] = await db
    .select({ id: projectActivityAssignmentsTable.id, projectId: projectActivityAssignmentsTable.projectId })
    .from(projectActivityAssignmentsTable)
    .where(eq(projectActivityAssignmentsTable.id, id))
    .limit(1)
  if (!row) throw new Error('Assignment not found.')
  return row
}

export async function createAssignment(values: CreateAssignmentInput, actorUserId: string): Promise<void> {
  await assertProjectExists(values.projectId)
  await db.insert(projectActivityAssignmentsTable).values({
    projectId: values.projectId,
    disciplineId: values.disciplineId,
    activityId: values.activityId,
    subActivityId: values.subActivityId,
    disciplineName: values.disciplineName,
    activityName: values.activityName,
    subActivityName: values.subActivityName,
    assigneeId: values.assigneeId,
    plannedMinutes: values.plannedMinutes,
    quantity: values.quantity,
    dueDate: values.dueDate,
    priority: values.priority,
    remark: values.remark,
    createdBy: actorUserId,
  })
}

export async function updateAssignment(values: UpdateAssignmentInput): Promise<void> {
  await assertAssignmentExists(values.id)

  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (values.assigneeId !== undefined) set.assigneeId = values.assigneeId
  if (values.plannedMinutes !== undefined) set.plannedMinutes = values.plannedMinutes
  if (values.quantity !== undefined) set.quantity = values.quantity
  if (values.dueDate !== undefined) set.dueDate = values.dueDate
  if (values.priority !== undefined) set.priority = values.priority
  if (values.status !== undefined) set.status = values.status
  if (values.remark !== undefined) set.remark = values.remark

  await db
    .update(projectActivityAssignmentsTable)
    .set(set)
    .where(eq(projectActivityAssignmentsTable.id, values.id))
}

export async function deleteAssignment(id: string): Promise<void> {
  const [row] = await db
    .delete(projectActivityAssignmentsTable)
    .where(eq(projectActivityAssignmentsTable.id, id))
    .returning({ id: projectActivityAssignmentsTable.id })
  if (!row) throw new Error('Assignment not found.')
}

export async function createAssignmentLog(
  values: CreateAssignmentLogInput,
  actorUserId: string,
): Promise<{ loggedMinutes: number }> {
  const assignment = await assertAssignmentExists(values.assignmentId)
  await db.insert(projectActivityLogsTable).values({
    assignmentId: values.assignmentId,
    projectId: assignment.projectId,
    logDate: values.logDate,
    minutes: values.minutes,
    note: values.note,
    createdBy: actorUserId,
  })

  // Auto-advance: a not-started assignment with logged work is in progress.
  const [current] = await db
    .select({ status: projectActivityAssignmentsTable.status })
    .from(projectActivityAssignmentsTable)
    .where(eq(projectActivityAssignmentsTable.id, values.assignmentId))
    .limit(1)
  if (current?.status === ('not_started' satisfies AssignmentStatus)) {
    await db
      .update(projectActivityAssignmentsTable)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(projectActivityAssignmentsTable.id, values.assignmentId))
  }

  const [totals] = await db
    .select({ logged: sql<number>`coalesce(sum(${projectActivityLogsTable.minutes}), 0)::int` })
    .from(projectActivityLogsTable)
    .where(eq(projectActivityLogsTable.assignmentId, values.assignmentId))
  return { loggedMinutes: Number(totals?.logged ?? 0) }
}

export async function deleteAssignmentLog(id: string): Promise<void> {
  const [row] = await db
    .delete(projectActivityLogsTable)
    .where(eq(projectActivityLogsTable.id, id))
    .returning({ id: projectActivityLogsTable.id })
  if (!row) throw new Error('Work log not found.')
}

// ── Cookie-bound wrappers ────────────────────────────────────────────────
/**
 * Returns the session's employee id (employees are the work-doers; users are
 * the login identities) or null when the session has no employee record.
 */
async function requireEmployeeId(
  cookieHeader: string | undefined,
): Promise<{ userId: string; employeeId: string | null } | null> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return null
  const [employee] = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(eq(employeesTable.userId, session.user.id))
    .limit(1)
  return { userId: session.user.id, employeeId: employee?.id ?? null }
}

async function requireManager(cookieHeader: string | undefined): Promise<string | null> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return null
  if (!(await userHasPermission(session.user.id, 'projects.write'))) return null
  return session.user.id
}

export async function listProjectAssignmentsForCookie(
  projectId: string,
  cookieHeader: string | undefined,
): Promise<AssignmentListItem[]> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session || !(await userHasPermission(session.user.id, 'projects.read'))) return []
  return listProjectAssignments(projectId)
}

export async function listProjectWorkLogsForCookie(
  projectId: string,
  startDate: string | null,
  endDate: string | null,
  assigneeId: string | null,
  cookieHeader: string | undefined,
): Promise<WorkLogEntry[]> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session || !(await userHasPermission(session.user.id, 'projects.read'))) return []
  return listProjectWorkLogs(projectId, startDate, endDate, assigneeId)
}

export async function createAssignmentForCookie(
  values: CreateAssignmentInput,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requireManager(cookieHeader)
  if (!userId) throw new Error('Not authorized to assign activities.')
  return createAssignment(values, userId)
}

export async function updateAssignmentForCookie(
  values: UpdateAssignmentInput,
  cookieHeader: string | undefined,
): Promise<void> {
  const userId = await requireManager(cookieHeader)
  if (!userId) throw new Error('Not authorized to modify assignments.')
  return updateAssignment(values)
}

export async function deleteAssignmentForCookie(id: string, cookieHeader: string | undefined): Promise<void> {
  const userId = await requireManager(cookieHeader)
  if (!userId) throw new Error('Not authorized to delete assignments.')
  return deleteAssignment(id)
}

/**
 * Logging rules: team members log against their own assignments; users with
 * `projects.write` may log on behalf of anyone.
 */
export async function createAssignmentLogForCookie(
  values: CreateAssignmentLogInput,
  cookieHeader: string | undefined,
): Promise<{ loggedMinutes: number }> {
  const actor = await requireEmployeeId(cookieHeader)
  if (!actor) throw new Error('Sign in to log work.')
  if (!(await userHasPermission(actor.userId, 'projects.write'))) {
    const [owner] = await db
      .select({ assigneeId: projectActivityAssignmentsTable.assigneeId })
      .from(projectActivityAssignmentsTable)
      .where(eq(projectActivityAssignmentsTable.id, values.assignmentId))
      .limit(1)
    if (!owner || owner.assigneeId !== actor.employeeId) {
      throw new Error('You can only log work on your own assignments.')
    }
  }
  return createAssignmentLog(values, actor.userId)
}

export async function deleteAssignmentLogForCookie(id: string, cookieHeader: string | undefined): Promise<void> {
  const userId = await requireManager(cookieHeader)
  if (!userId) throw new Error('Not authorized to delete work logs.')
  return deleteAssignmentLog(id)
}
