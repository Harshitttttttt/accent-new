import { asc, count, eq, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { softwareMastersTable, type SoftwareMasterRecord } from '~/db/schema/masters/software'
import { findSessionById, isUserAdmin, parseSessionCookie, writeAuditLog } from '~/lib/auth.server'

export type SoftwareMasterWithMeta = SoftwareMasterRecord & {
  daysUntilExpiry: number | null
  utilizationPct: number
}

function enrich(row: SoftwareMasterRecord): SoftwareMasterWithMeta {
  const now = new Date()
  let daysUntilExpiry: number | null = null
  if (row.expiryDate) {
    const expiry = new Date(row.expiryDate)
    daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }
  const utilizationPct = row.totalLicenses > 0 ? Math.round((row.usedLicenses / row.totalLicenses) * 100) : 0
  return { ...row, daysUntilExpiry, utilizationPct }
}

export async function listSoftwareMasters(): Promise<SoftwareMasterWithMeta[]> {
  const rows = await db.select().from(softwareMastersTable).orderBy(asc(softwareMastersTable.name))
  return rows.map(enrich)
}

export async function getSoftwareMasterStats() {
  const rows = await db.select().from(softwareMastersTable)
  const total = rows.length
  const active = rows.filter((r) => r.isActive).length
  const expiringSoon = rows.filter((r) => {
    if (!r.expiryDate) return false
    const d = new Date(r.expiryDate)
    const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 30
  }).length
  const totalCostPaise = rows.reduce((sum, r) => sum + r.costPaise, 0)
  const totalLicenses = rows.reduce((sum, r) => sum + r.totalLicenses, 0)
  return { total, active, expiringSoon, totalCostPaise, totalLicenses }
}

export async function createSoftwareMaster(values: {
  code: string
  name: string
  vendor?: string | null
  version?: string | null
  licenseType?: string | null
  totalLicenses: number
  usedLicenses?: number
  costPaise: number
  currency?: string
  purchaseDate?: string | null
  expiryDate?: string | null
  description?: string | null
  isActive?: boolean
  actorUserId: string
}): Promise<SoftwareMasterRecord> {
  if (values.usedLicenses !== undefined && values.usedLicenses > values.totalLicenses) {
    throw new Error('Used licenses cannot exceed total licenses.')
  }
  if (values.expiryDate && values.purchaseDate && new Date(values.expiryDate) <= new Date(values.purchaseDate)) {
    throw new Error('Expiry date must be after purchase date.')
  }
  const inserted = await db
    .insert(softwareMastersTable)
    .values({
      code: values.code,
      name: values.name,
      vendor: values.vendor ?? null,
      version: values.version ?? null,
      licenseType: values.licenseType ?? null,
      totalLicenses: values.totalLicenses,
      usedLicenses: values.usedLicenses ?? 0,
      costPaise: values.costPaise,
      currency: values.currency ?? 'INR',
      purchaseDate: values.purchaseDate ?? null,
      expiryDate: values.expiryDate ?? null,
      description: values.description ?? null,
      isActive: values.isActive ?? true,
    })
    .returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create software master.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.software_created', resource: 'software_masters', resourceId: row.id, newValue: row })
  return row
}

export async function updateSoftwareMaster(values: {
  id: string
  code: string
  name: string
  vendor?: string | null
  version?: string | null
  licenseType?: string | null
  totalLicenses: number
  usedLicenses?: number
  costPaise: number
  currency?: string
  purchaseDate?: string | null
  expiryDate?: string | null
  description?: string | null
  isActive?: boolean
  actorUserId: string
}): Promise<SoftwareMasterRecord> {
  const existing = await db.select().from(softwareMastersTable).where(eq(softwareMastersTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Software not found.')
  if ((values.usedLicenses ?? 0) > values.totalLicenses) throw new Error('Used licenses cannot exceed total.')
  if (values.expiryDate && values.purchaseDate && new Date(values.expiryDate) <= new Date(values.purchaseDate)) throw new Error('Expiry must be after purchase.')
  const updated = await db
    .update(softwareMastersTable)
    .set({
      code: values.code,
      name: values.name,
      vendor: values.vendor ?? null,
      version: values.version ?? null,
      licenseType: values.licenseType ?? null,
      totalLicenses: values.totalLicenses,
      usedLicenses: values.usedLicenses ?? 0,
      costPaise: values.costPaise,
      currency: values.currency ?? 'INR',
      purchaseDate: values.purchaseDate ?? null,
      expiryDate: values.expiryDate ?? null,
      description: values.description ?? null,
      isActive: values.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(eq(softwareMastersTable.id, values.id))
    .returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.software_updated', resource: 'software_masters', resourceId: row.id, oldValue: prev, newValue: row })
  return row
}

export async function deleteSoftwareMaster(values: { id: string; actorUserId: string }): Promise<void> {
  const existing = await db.select().from(softwareMastersTable).where(eq(softwareMastersTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Software not found.')
  await db.delete(softwareMastersTable).where(eq(softwareMastersTable.id, values.id))
  await writeAuditLog({ userId: values.actorUserId, action: 'master.software_deleted', resource: 'software_masters', resourceId: values.id, oldValue: prev })
}

// ── Auth wrappers ─────────────────
async function requireAdminByCookie(cookieHeader: string | undefined) {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) throw new Error('Authentication required.')
  if (!(await isUserAdmin(session.user.id))) throw new Error('Administrator privileges required.')
  return session.user.id
}

export async function getSoftwareMastersForCookie(cookieHeader: string | undefined) {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return { authorized: false as const, data: [] as SoftwareMasterWithMeta[], stats: { total: 0, active: 0, expiringSoon: 0, totalCostPaise: 0, totalLicenses: 0 } }
  const [data, stats] = await Promise.all([listSoftwareMasters(), getSoftwareMasterStats()])
  return { authorized: true as const, data, stats, currentUserId: session.user.id }
}

export async function createSoftwareForCookie(values: Omit<Parameters<typeof createSoftwareMaster>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createSoftwareMaster({ ...values, actorUserId })
}
export async function updateSoftwareForCookie(values: Omit<Parameters<typeof updateSoftwareMaster>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateSoftwareMaster({ ...values, actorUserId })
}
export async function deleteSoftwareForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteSoftwareMaster({ ...values, actorUserId })
}

