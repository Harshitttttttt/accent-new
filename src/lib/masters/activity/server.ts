import { and, asc, count, eq, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  disciplineActivitiesTable,
  disciplinesTable,
  disciplineSubActivitiesTable,
  type DisciplineActivityRecord,
  type DisciplineRecord,
  type DisciplineSubActivityRecord,
} from '~/db/schema/masters/discipline'
import { findSessionById, isUserAdmin, parseSessionCookie, writeAuditLog } from '~/lib/auth.server'

export type DisciplineWithStats = DisciplineRecord & {
  activitiesCount: number
  subActivitiesCount: number
}

export type ActivityWithDiscipline = DisciplineActivityRecord & {
  disciplineName: string
  disciplineCode: string
  subActivitiesCount: number
}

export type SubActivityWithParents = DisciplineSubActivityRecord & {
  activityName: string
  activityCode: string
  disciplineId: string
  disciplineName: string
  disciplineCode: string
}

export async function listDisciplinesWithStats(): Promise<DisciplineWithStats[]> {
  const rows = await db.select().from(disciplinesTable).orderBy(asc(disciplinesTable.name))

  const counts = await db
    .select({
      disciplineId: disciplineActivitiesTable.disciplineId,
      count: count(),
    })
    .from(disciplineActivitiesTable)
    .groupBy(disciplineActivitiesTable.disciplineId)

  const subCounts = await db
    .select({
      disciplineId: disciplineActivitiesTable.disciplineId,
      count: count(),
    })
    .from(disciplineSubActivitiesTable)
    .innerJoin(
      disciplineActivitiesTable,
      eq(disciplineSubActivitiesTable.activityId, disciplineActivitiesTable.id),
    )
    .groupBy(disciplineActivitiesTable.disciplineId)

  const countMap = new Map(counts.map((c) => [c.disciplineId, c.count]))
  const subMap = new Map(subCounts.map((c) => [c.disciplineId, c.count]))

  return rows.map((d) => ({
    ...d,
    activitiesCount: countMap.get(d.id) ?? 0,
    subActivitiesCount: subMap.get(d.id) ?? 0,
  }))
}

export async function listActivitiesWithDiscipline(): Promise<ActivityWithDiscipline[]> {
  const rows = await db
    .select({
      activity: disciplineActivitiesTable,
      disciplineName: disciplinesTable.name,
      disciplineCode: disciplinesTable.code,
    })
    .from(disciplineActivitiesTable)
    .innerJoin(disciplinesTable, eq(disciplineActivitiesTable.disciplineId, disciplinesTable.id))
    .orderBy(asc(disciplinesTable.name), asc(disciplineActivitiesTable.name))

  const subCounts = await db
    .select({ activityId: disciplineSubActivitiesTable.activityId, count: count() })
    .from(disciplineSubActivitiesTable)
    .groupBy(disciplineSubActivitiesTable.activityId)
  const subMap = new Map(subCounts.map((c) => [c.activityId, c.count]))

  return rows.map((r) => ({
    ...r.activity,
    disciplineName: r.disciplineName,
    disciplineCode: r.disciplineCode,
    subActivitiesCount: subMap.get(r.activity.id) ?? 0,
  }))
}

export async function listSubActivitiesWithParents(): Promise<SubActivityWithParents[]> {
  const rows = await db
    .select({
      sub: disciplineSubActivitiesTable,
      activityName: disciplineActivitiesTable.name,
      activityCode: disciplineActivitiesTable.code,
      disciplineId: disciplinesTable.id,
      disciplineName: disciplinesTable.name,
      disciplineCode: disciplinesTable.code,
    })
    .from(disciplineSubActivitiesTable)
    .innerJoin(
      disciplineActivitiesTable,
      eq(disciplineSubActivitiesTable.activityId, disciplineActivitiesTable.id),
    )
    .innerJoin(disciplinesTable, eq(disciplineActivitiesTable.disciplineId, disciplinesTable.id))
    .orderBy(asc(disciplinesTable.name), asc(disciplineActivitiesTable.name), asc(disciplineSubActivitiesTable.name))

  return rows.map((r) => ({
    ...r.sub,
    activityName: r.activityName,
    activityCode: r.activityCode,
    disciplineId: r.disciplineId,
    disciplineName: r.disciplineName,
    disciplineCode: r.disciplineCode,
  }))
}

export async function getActivityMasterData() {
  const [disciplines, activities, subActivities] = await Promise.all([
    listDisciplinesWithStats(),
    listActivitiesWithDiscipline(),
    listSubActivitiesWithParents(),
  ])
  return { disciplines, activities, subActivities }
}

// ── Disciplines CRUD ──────────────────────────────────────────────
export async function createDiscipline(values: {
  code: string
  name: string
  description?: string | null
  isActive?: boolean
  actorUserId: string
}): Promise<DisciplineRecord> {
  const inserted = await db
    .insert(disciplinesTable)
    .values({
      code: values.code,
      name: values.name,
      description: values.description ?? null,
      isActive: values.isActive ?? true,
    })
    .returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create discipline.')
  await writeAuditLog({
    userId: values.actorUserId,
    action: 'master.discipline_created',
    resource: 'disciplines',
    resourceId: row.id,
    newValue: row,
  })
  return row
}

export async function updateDiscipline(values: {
  id: string
  code: string
  name: string
  description?: string | null
  isActive?: boolean
  actorUserId: string
}): Promise<DisciplineRecord> {
  const existing = await db.select().from(disciplinesTable).where(eq(disciplinesTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Discipline not found.')
  const updated = await db
    .update(disciplinesTable)
    .set({
      code: values.code,
      name: values.name,
      description: values.description ?? null,
      isActive: values.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(disciplinesTable.id, values.id))
    .returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update discipline.')
  await writeAuditLog({
    userId: values.actorUserId,
    action: 'master.discipline_updated',
    resource: 'disciplines',
    resourceId: row.id,
    oldValue: prev,
    newValue: row,
  })
  return row
}

export async function deleteDiscipline(values: { id: string; actorUserId: string }): Promise<void> {
  const existing = await db.select().from(disciplinesTable).where(eq(disciplinesTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Discipline not found.')
  const child = await db
    .select({ cnt: count() })
    .from(disciplineActivitiesTable)
    .where(eq(disciplineActivitiesTable.disciplineId, values.id))
  if ((child[0]?.cnt ?? 0) > 0) {
    throw new Error('Cannot delete discipline with linked activities. Remove or reassign activities first.')
  }
  await db.delete(disciplinesTable).where(eq(disciplinesTable.id, values.id))
  await writeAuditLog({
    userId: values.actorUserId,
    action: 'master.discipline_deleted',
    resource: 'disciplines',
    resourceId: values.id,
    oldValue: prev,
  })
}

// ── Activities CRUD ───────────────────────────────────────────────
export async function createActivity(values: {
  code: string
  name: string
  description?: string | null
  disciplineId: string
  unit?: string | null
  isActive?: boolean
  actorUserId: string
}): Promise<DisciplineActivityRecord> {
  const disc = await db.select().from(disciplinesTable).where(eq(disciplinesTable.id, values.disciplineId)).limit(1)
  if (!disc[0]) throw new Error('Selected discipline does not exist.')
  const inserted = await db
    .insert(disciplineActivitiesTable)
    .values({
      code: values.code,
      name: values.name,
      description: values.description ?? null,
      disciplineId: values.disciplineId,
      unit: values.unit ?? null,
      isActive: values.isActive ?? true,
    })
    .returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create activity.')
  await writeAuditLog({
    userId: values.actorUserId,
    action: 'master.activity_created',
    resource: 'discipline_activities',
    resourceId: row.id,
    newValue: row,
  })
  return row
}

export async function updateActivity(values: {
  id: string
  code: string
  name: string
  description?: string | null
  disciplineId: string
  unit?: string | null
  isActive?: boolean
  actorUserId: string
}): Promise<DisciplineActivityRecord> {
  const existing = await db.select().from(disciplineActivitiesTable).where(eq(disciplineActivitiesTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Activity not found.')
  const disc = await db.select().from(disciplinesTable).where(eq(disciplinesTable.id, values.disciplineId)).limit(1)
  if (!disc[0]) throw new Error('Selected discipline does not exist.')
  const updated = await db
    .update(disciplineActivitiesTable)
    .set({
      code: values.code,
      name: values.name,
      description: values.description ?? null,
      disciplineId: values.disciplineId,
      unit: values.unit ?? null,
      isActive: values.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(disciplineActivitiesTable.id, values.id))
    .returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update activity.')
  await writeAuditLog({
    userId: values.actorUserId,
    action: 'master.activity_updated',
    resource: 'discipline_activities',
    resourceId: row.id,
    oldValue: prev,
    newValue: row,
  })
  return row
}

export async function deleteActivity(values: { id: string; actorUserId: string }): Promise<void> {
  const existing = await db.select().from(disciplineActivitiesTable).where(eq(disciplineActivitiesTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Activity not found.')
  // sub-activities cascade via DB, but audit count
  await db.delete(disciplineActivitiesTable).where(eq(disciplineActivitiesTable.id, values.id))
  await writeAuditLog({
    userId: values.actorUserId,
    action: 'master.activity_deleted',
    resource: 'discipline_activities',
    resourceId: values.id,
    oldValue: prev,
  })
}

// ── Sub-Activities CRUD ───────────────────────────────────────────
export async function createSubActivity(values: {
  code: string
  name: string
  description?: string | null
  activityId: string
  unit?: string | null
  isActive?: boolean
  actorUserId: string
}): Promise<DisciplineSubActivityRecord> {
  const act = await db
    .select()
    .from(disciplineActivitiesTable)
    .where(eq(disciplineActivitiesTable.id, values.activityId))
    .limit(1)
  if (!act[0]) throw new Error('Selected activity does not exist.')
  const inserted = await db
    .insert(disciplineSubActivitiesTable)
    .values({
      code: values.code,
      name: values.name,
      description: values.description ?? null,
      activityId: values.activityId,
      unit: values.unit ?? null,
      isActive: values.isActive ?? true,
    })
    .returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create sub-activity.')
  await writeAuditLog({
    userId: values.actorUserId,
    action: 'master.sub_activity_created',
    resource: 'discipline_sub_activities',
    resourceId: row.id,
    newValue: row,
  })
  return row
}

export async function updateSubActivity(values: {
  id: string
  code: string
  name: string
  description?: string | null
  activityId: string
  unit?: string | null
  isActive?: boolean
  actorUserId: string
}): Promise<DisciplineSubActivityRecord> {
  const existing = await db
    .select()
    .from(disciplineSubActivitiesTable)
    .where(eq(disciplineSubActivitiesTable.id, values.id))
    .limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Sub-activity not found.')
  const act = await db
    .select()
    .from(disciplineActivitiesTable)
    .where(eq(disciplineActivitiesTable.id, values.activityId))
    .limit(1)
  if (!act[0]) throw new Error('Selected activity does not exist.')
  const updated = await db
    .update(disciplineSubActivitiesTable)
    .set({
      code: values.code,
      name: values.name,
      description: values.description ?? null,
      activityId: values.activityId,
      unit: values.unit ?? null,
      isActive: values.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(disciplineSubActivitiesTable.id, values.id))
    .returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update sub-activity.')
  await writeAuditLog({
    userId: values.actorUserId,
    action: 'master.sub_activity_updated',
    resource: 'discipline_sub_activities',
    resourceId: row.id,
    oldValue: prev,
    newValue: row,
  })
  return row
}

export async function deleteSubActivity(values: { id: string; actorUserId: string }): Promise<void> {
  const existing = await db
    .select()
    .from(disciplineSubActivitiesTable)
    .where(eq(disciplineSubActivitiesTable.id, values.id))
    .limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Sub-activity not found.')
  await db.delete(disciplineSubActivitiesTable).where(eq(disciplineSubActivitiesTable.id, values.id))
  await writeAuditLog({
    userId: values.actorUserId,
    action: 'master.sub_activity_deleted',
    resource: 'discipline_sub_activities',
    resourceId: values.id,
    oldValue: prev,
  })
}

// ── Auth wrappers (cookieHeader → actorUserId) ─────────────────────
async function requireAdminByCookie(cookieHeader: string | undefined) {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) throw new Error('Authentication required.')
  if (!(await isUserAdmin(session.user.id))) throw new Error('Administrator privileges required.')
  return session.user.id
}

async function requireAuthByCookie(cookieHeader: string | undefined) {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) throw new Error('Authentication required.')
  return session.user.id
}

export async function getActivityMasterDataForCookie(
  cookieHeader: string | undefined,
): Promise<{ authorized: boolean; disciplines: DisciplineWithStats[]; activities: ActivityWithDiscipline[]; subActivities: SubActivityWithParents[]; currentUserId?: string }> {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return { authorized: false, disciplines: [], activities: [], subActivities: [] }
  const data = await getActivityMasterData()
  return { authorized: true, ...data, currentUserId: session.user.id }
}

export async function createDisciplineForCookie(
  values: { code: string; name: string; description?: string | null; isActive?: boolean },
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createDiscipline({ ...values, actorUserId })
}
export async function updateDisciplineForCookie(
  values: { id: string; code: string; name: string; description?: string | null; isActive?: boolean },
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateDiscipline({ ...values, actorUserId })
}
export async function deleteDisciplineForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteDiscipline({ ...values, actorUserId })
}
export async function createActivityForCookie(
  values: { code: string; name: string; description?: string | null; disciplineId: string; unit?: string | null; isActive?: boolean },
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createActivity({ ...values, actorUserId })
}
export async function updateActivityForCookie(
  values: { id: string; code: string; name: string; description?: string | null; disciplineId: string; unit?: string | null; isActive?: boolean },
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateActivity({ ...values, actorUserId })
}
export async function deleteActivityForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteActivity({ ...values, actorUserId })
}
export async function createSubActivityForCookie(
  values: { code: string; name: string; description?: string | null; activityId: string; unit?: string | null; isActive?: boolean },
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createSubActivity({ ...values, actorUserId })
}
export async function updateSubActivityForCookie(
  values: { id: string; code: string; name: string; description?: string | null; activityId: string; unit?: string | null; isActive?: boolean },
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateSubActivity({ ...values, actorUserId })
}
export async function deleteSubActivityForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteSubActivity({ ...values, actorUserId })
}

