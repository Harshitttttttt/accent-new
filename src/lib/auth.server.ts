import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { and, count, eq, gt, lt, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  auditLogsTable,
  permissionsTable,
  rolePermissionsTable,
  rolesTable,
  sessionsTable,
  userRolesTable,
  usersTable,
  type AuditLogRecord,
  type PermissionRecord,
  type RoleRecord,
  type UserRecord,
} from '~/db/schema'

const PASSWORD_ALGORITHM = 'scrypt'
const PASSWORD_COST = 16_384
const PASSWORD_BLOCK_SIZE = 8
const PASSWORD_PARALLELISM = 1
const PASSWORD_KEY_LENGTH = 64
const PASSWORD_SALT_LENGTH = 16
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30

export const SESSION_COOKIE_NAME = 'accentcrm_session'

export type AuthUser = Pick<UserRecord, 'id' | 'email' | 'username' | 'fullName'>

export type AuthSession = {
  id: string
  userId: string
  expiresAt: Date
  user: AuthUser
}

type SessionMetadata = {
  ipAddress?: string | null
  userAgent?: string | null
}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  const { promise, resolve, reject } = Promise.withResolvers<Buffer>()

  scrypt(
    password,
    salt,
    PASSWORD_KEY_LENGTH,
    {
      N: PASSWORD_COST,
      r: PASSWORD_BLOCK_SIZE,
      p: PASSWORD_PARALLELISM,
      maxmem: 32 * 1024 * 1024,
    },
    (error, derivedKey) => {
      if (error) {
        reject(error)
        return
      }
      resolve(derivedKey)
    },
  )

  return promise
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) {
    throw new Error('Password must be between 12 and 256 characters')
  }

  const salt = randomBytes(PASSWORD_SALT_LENGTH)
  const key = await derivePasswordKey(password, salt)

  return [
    PASSWORD_ALGORITHM,
    PASSWORD_COST,
    PASSWORD_BLOCK_SIZE,
    PASSWORD_PARALLELISM,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelism, encodedSalt, encodedKey] =
    encodedHash.split('$')

  if (
    algorithm !== PASSWORD_ALGORITHM ||
    cost !== String(PASSWORD_COST) ||
    blockSize !== String(PASSWORD_BLOCK_SIZE) ||
    parallelism !== String(PASSWORD_PARALLELISM) ||
    !encodedSalt ||
    !encodedKey
  ) {
    return false
  }

  try {
    const salt = Buffer.from(encodedSalt, 'base64url')
    const expectedKey = Buffer.from(encodedKey, 'base64url')
    const actualKey = await derivePasswordKey(password, salt)

    return (
      expectedKey.length === actualKey.length &&
      timingSafeEqual(expectedKey, actualKey)
    )
  } catch {
    return false
  }
}

export function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
  }
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1)

  return rows[0] ?? null
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<UserRecord | null> {
  const user = await findUserByEmail(email)

  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return null
  }

  return user
}

export async function createSession(
  userId: string,
  metadata: SessionMetadata = {},
): Promise<{ id: string; expiresAt: Date }> {
  const id = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await db.insert(sessionsTable).values({
    id,
    userId,
    expiresAt,
    ipAddress: metadata.ipAddress ?? null,
    userAgent: metadata.userAgent ?? null,
  })

  return { id, expiresAt }
}

export async function findSessionById(id: string): Promise<AuthSession | null> {
  const rows = await db
    .select({
      sessionId: sessionsTable.id,
      sessionUserId: sessionsTable.userId,
      sessionExpiresAt: sessionsTable.expiresAt,
      userId: usersTable.id,
      email: usersTable.email,
      username: usersTable.username,
      fullName: usersTable.fullName,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(sessionsTable.id, id),
        gt(sessionsTable.expiresAt, new Date()),
        eq(usersTable.isActive, true),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) {
    return null
  }

  return {
    id: row.sessionId,
    userId: row.sessionUserId,
    expiresAt: row.sessionExpiresAt,
    user: {
      id: row.userId,
      email: row.email,
      username: row.username,
      fullName: row.fullName,
    },
  }
}

export async function deleteSession(id: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.id, id))
}

export async function deleteExpiredSessions(): Promise<void> {
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()))
}

export async function updateLastLogin(userId: string): Promise<void> {
  const now = new Date()
  await db
    .update(usersTable)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(usersTable.id, userId))
}

export async function writeAuditLog(values: {
  userId?: string | null
  action: string
  resource: string
  resourceId?: string | null
  oldValue?: unknown
  newValue?: unknown
}): Promise<void> {
  await db.insert(auditLogsTable).values({
    userId: values.userId ?? null,
    action: values.action,
    resource: values.resource,
    resourceId: values.resourceId ?? null,
    oldValue: values.oldValue,
    newValue: values.newValue,
  })
}

export function normalizeIpAddress(value: string | undefined): string | null {
  const candidate = value?.split(',')[0]?.trim() ?? ''
  if (!candidate) {
    return null
  }

  const normalized = candidate.replace(/^\[(.*)\]$/, '$1')
  // Inline IP check — `node:net.isIP` unavailable on Workers even with `nodejs_compat`
  const isIPv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(normalized)
  let isIPv6 = false
  if (!isIPv4 && normalized.includes(':')) {
    const hasDoubleColon = (normalized.match(/::/g) || []).length <= 1 && normalized.includes('::')
    const doubleColonCount = (normalized.match(/::/g) || []).length
    if (doubleColonCount <= 1 && /^[0-9a-fA-F:.]+$/.test(normalized)) {
      const parts = normalized.split(':')
      const last = parts[parts.length - 1] ?? ''
      const isMappedIPv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(last)
      const nonEmpty = parts.filter((p) => p.length > 0).length + (isMappedIPv4 ? 1 : 0)
      const colonOk = hasDoubleColon ? nonEmpty <= 7 : parts.length === (isMappedIPv4 ? 7 : 8)
      let hextetsOk = true
      for (const p of parts) {
        if (p === '') continue
        if (p.includes('.')) {
          if (!isMappedIPv4 || p !== last) hextetsOk = false
          continue
        }
        if (!/^[0-9a-fA-F]{1,4}$/.test(p)) hextetsOk = false
      }
      isIPv6 = colonOk && hextetsOk
    }
  }
  return isIPv4 || isIPv6 ? normalized : null
}

export function parseSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null
  }

  for (const part of cookieHeader.split(';')) {
    const [name, ...valueParts] = part.trim().split('=')
    if (name !== SESSION_COOKIE_NAME) {
      continue
    }

    const value = valueParts.join('=')
    if (!value) {
      return null
    }

    try {
      return decodeURIComponent(value)
    } catch {
      return null
    }
  }

  return null
}

export const DEFAULT_ROLES = [
  {
    code: 'admin',
    name: 'Administrator',
    description: 'Full system, data, and user management access',
  },
  {
    code: 'project_manager',
    name: 'Project Manager',
    description: 'Manage client delivery, schedules, and team allocation',
  },
  {
    code: 'accounts',
    name: 'Accounts & Finance',
    description: 'Manage proposals, invoices, billing, and project budgets',
  },
  {
    code: 'hr',
    name: 'Human Resources',
    description: 'Manage staff profiles, capacity, and organizational data',
  },
  {
    code: 'engineer',
    name: 'Engineer',
    description: 'Execute sprint tasks and project operations',
  },
] as const

export async function ensureDefaultRoles(): Promise<RoleRecord[]> {
  if (DEFAULT_ROLES.length > 0) {
    await db
      .insert(rolesTable)
      .values(
        DEFAULT_ROLES.map((role) => ({
          code: role.code,
          name: role.name,
          description: role.description,
        })),
      )
      .onConflictDoNothing({ target: rolesTable.code })
  }

  return db.select().from(rolesTable).orderBy(rolesTable.name)
}

export async function listRoles(): Promise<RoleRecord[]> {
  await ensureDefaultRoles()
  return db.select().from(rolesTable).orderBy(rolesTable.name)
}

export async function countUsers(): Promise<number> {
  const result = await db.select({ value: count() }).from(usersTable)
  return result[0]?.value ?? 0
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1)

  return rows[0] ?? null
}

export async function getUserRoles(userId: string): Promise<RoleRecord[]> {
  const rows = await db
    .select({
      id: rolesTable.id,
      code: rolesTable.code,
      name: rolesTable.name,
      description: rolesTable.description,
      createdAt: rolesTable.createdAt,
    })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.userId, userId))

  return rows
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId)
  return roles.some((r) => r.code === 'admin')
}

/** True when the user's roles grant the given permission code (e.g. 'leads.read'), or if the user is an admin. */
export async function userHasPermission(userId: string, permissionCode: string): Promise<boolean> {
  if (await isUserAdmin(userId)) {
    return true
  }

  const rows = await db
    .select({ permissionId: permissionsTable.id })
    .from(userRolesTable)
    .innerJoin(rolePermissionsTable, eq(userRolesTable.roleId, rolePermissionsTable.roleId))
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(and(eq(userRolesTable.userId, userId), eq(permissionsTable.code, permissionCode)))
    .limit(1)

  return rows.length > 0
}

export async function createUserWithRole(values: {
  email: string
  username: string
  fullName: string
  password: string
  roleCode?: string
  creatorUserId?: string | null
}): Promise<{ user: UserRecord; role: RoleRecord }> {
  await ensureDefaultRoles()

  const existingEmail = await findUserByEmail(values.email)
  if (existingEmail) {
    throw new Error('A user with this email address already exists.')
  }

  const existingUsername = await findUserByUsername(values.username)
  if (existingUsername) {
    throw new Error('This username is already taken.')
  }

  const targetRoleCode = values.roleCode || 'admin'
  const roles = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.code, targetRoleCode))
    .limit(1)

  const targetRole = roles[0]
  if (!targetRole) {
    throw new Error(`Role "${targetRoleCode}" was not found.`)
  }

  const passwordHash = await hashPassword(values.password)

  const insertedUsers = await db
    .insert(usersTable)
    .values({
      email: values.email,
      username: values.username,
      fullName: values.fullName,
      passwordHash,
      isActive: true,
    })
    .returning()

  const newUser = insertedUsers[0]
  if (!newUser) {
    throw new Error('Failed to create user record.')
  }

  await db.insert(userRolesTable).values({
    userId: newUser.id,
    roleId: targetRole.id,
  })

  await writeAuditLog({
    userId: values.creatorUserId ?? newUser.id,
    action: 'auth.user_registered',
    resource: 'users',
    resourceId: newUser.id,
    newValue: {
      email: newUser.email,
      username: newUser.username,
      role: targetRole.code,
      isInitialAdmin: !values.creatorUserId,
    },
  })

  return { user: newUser, role: targetRole }
}

export const DEFAULT_PERMISSIONS = [
  {
    code: 'users.manage',
    description: 'Create, update, deactivate, and delete user accounts and role assignments',
  },
  {
    code: 'permissions.manage',
    description: 'Create, update, and delete system permissions and RBAC role bindings',
  },
  {
    code: 'audit.view',
    description: 'Inspect system-wide audit logs and administrative activity history',
  },
  {
    code: 'projects.read',
    description: 'View project registers, progress, schedules, and deliverables',
  },
  {
    code: 'projects.write',
    description: 'Create and update projects, milestones, and team assignments',
  },
  {
    code: 'leads.read',
    description: 'View sales pipeline leads, valuations, and conversion stages',
  },
  {
    code: 'leads.write',
    description: 'Create leads, move stages, and modify deal parameters',
  },
  {
    code: 'proposals.read',
    description: 'View commercial proposals, cost estimates, and profit margins',
  },
  {
    code: 'proposals.write',
    description: 'Draft, submit, and manage commercial project proposals',
  },
  {
    code: 'finance.read',
    description: 'View accounts receivable, invoicing timelines, and financial summaries',
  },
  {
    code: 'finance.write',
    description: 'Issue invoices, record payments, and approve company expenses',
  },
  {
    code: 'employees.read',
    description: 'View staff directory, technical skills, and utilization statistics',
  },
  {
    code: 'employees.write',
    description: 'Add and edit employee profiles, departments, and payroll records',
  },
  {
    code: 'reports.view',
    description: 'Access the reporting center and export operational intelligence',
  },
  {
    code: 'support.read',
    description: 'View IT and operational support tickets and service requests',
  },
  {
    code: 'support.write',
    description: 'Create, update, assign, and resolve support tickets and comments',
  },
] as const

const DEFAULT_ROLE_PERMISSION_MAP: Record<string, readonly string[]> = {
  admin: [
    'users.manage',
    'permissions.manage',
    'audit.view',
    'projects.read',
    'projects.write',
    'leads.read',
    'leads.write',
    'proposals.read',
    'proposals.write',
    'finance.read',
    'finance.write',
    'employees.read',
    'employees.write',
    'reports.view',
    'support.read',
    'support.write',
  ],
  project_manager: [
    'projects.read',
    'projects.write',
    'leads.read',
    'proposals.read',
    'proposals.write',
    'employees.read',
    'reports.view',
    'support.read',
    'support.write',
  ],
  accounts: [
    'finance.read',
    'finance.write',
    'proposals.read',
    'projects.read',
    'reports.view',
    'support.read',
    'support.write',
  ],
  hr: [
    'employees.read',
    'employees.write',
    'reports.view',
    'support.read',
    'support.write',
  ],
  engineer: [
    'projects.read',
    'reports.view',
    'support.read',
    'support.write',
  ],
}

export async function ensureDefaultPermissions(): Promise<void> {
  await ensureDefaultRoles()

  if (DEFAULT_PERMISSIONS.length > 0) {
    await db
      .insert(permissionsTable)
      .values(
        DEFAULT_PERMISSIONS.map((p) => ({
          code: p.code,
          description: p.description,
        })),
      )
      .onConflictDoNothing({ target: permissionsTable.code })
  }

  const [allRoles, allPerms] = await Promise.all([
    db.select().from(rolesTable),
    db.select().from(permissionsTable),
  ])
  const permMapByCode = new Map(allPerms.map((p) => [p.code, p.id]))

  // Single query for all existing bindings instead of N per-role queries
  const existingAll = await db
    .select({
      roleId: rolePermissionsTable.roleId,
      permissionId: rolePermissionsTable.permissionId,
    })
    .from(rolePermissionsTable)

  const existingSet = new Set(
    existingAll.map((r) => `${r.roleId}:${r.permissionId}`),
  )
  const countByRole = new Map<string, number>()
  for (const row of existingAll) {
    countByRole.set(row.roleId, (countByRole.get(row.roleId) ?? 0) + 1)
  }

  const toInsert: Array<{ roleId: string; permissionId: string }> = []
  for (const role of allRoles) {
    const targetCodes = DEFAULT_ROLE_PERMISSION_MAP[role.code]
    if (!targetCodes) continue
    for (const code of targetCodes) {
      const permId = permMapByCode.get(code)
      if (!permId) continue
      const key = `${role.id}:${permId}`
      if (!existingSet.has(key)) {
        toInsert.push({ roleId: role.id, permissionId: permId })
      }
    }
  }

  if (toInsert.length > 0) {
    await db.insert(rolePermissionsTable).values(toInsert).onConflictDoNothing()
  }
}

export type UserWithDetails = {
  id: string
  email: string
  username: string
  fullName: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  roles: Array<{ id: string; code: string; name: string }>
  permissions: string[]
}

export async function listUsersWithDetails(): Promise<UserWithDetails[]> {
  // Seeding is now handled by drizzle migration 20260820090000_seed_rbac — no ensure on read path
  const [users, userRolesRows, rolePermsRows] = await Promise.all([
    db.select().from(usersTable).orderBy(usersTable.createdAt),
    db
      .select({
        userId: userRolesTable.userId,
        roleId: rolesTable.id,
        roleCode: rolesTable.code,
        roleName: rolesTable.name,
      })
      .from(userRolesTable)
      .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id)),
    db
      .select({
        roleId: rolePermissionsTable.roleId,
        permCode: permissionsTable.code,
      })
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id)),
  ])

  const rolePermMap = new Map<string, string[]>()
  for (const rp of rolePermsRows) {
    const list = rolePermMap.get(rp.roleId) ?? []
    list.push(rp.permCode)
    rolePermMap.set(rp.roleId, list)
  }

  const userRolesMap = new Map<string, Array<{ id: string; code: string; name: string }>>()
  for (const ur of userRolesRows) {
    const list = userRolesMap.get(ur.userId) ?? []
    list.push({ id: ur.roleId, code: ur.roleCode, name: ur.roleName })
    userRolesMap.set(ur.userId, list)
  }

  return users.map((u) => {
    const roles = userRolesMap.get(u.id) ?? []
    const permSet = new Set<string>()
    for (const r of roles) {
      const perms = rolePermMap.get(r.id) ?? []
      for (const p of perms) {
        permSet.add(p)
      }
    }

    return {
      id: u.id,
      email: u.email,
      username: u.username,
      fullName: u.fullName,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      roles,
      permissions: Array.from(permSet).sort(),
    }
  })
}

export type PermissionWithRoles = {
  id: string
  code: string
  description: string | null
  assignedRoleCodes: string[]
}

export async function listPermissionsWithRoles(): Promise<{
  permissions: PermissionWithRoles[]
  roles: Array<{ id: string; code: string; name: string; description: string | null; permissionIds: string[] }>
}> {
  // Seeding is now handled by drizzle migration 20260820090000_seed_rbac — no ensure on read path
  const [permissions, roles, rolePermRows] = await Promise.all([
    db.select().from(permissionsTable).orderBy(permissionsTable.code),
    db.select().from(rolesTable).orderBy(rolesTable.name),
    db
      .select({
        roleId: rolePermissionsTable.roleId,
        roleCode: rolesTable.code,
        permissionId: rolePermissionsTable.permissionId,
      })
      .from(rolePermissionsTable)
      .innerJoin(rolesTable, eq(rolePermissionsTable.roleId, rolesTable.id)),
  ])

  const permRolesMap = new Map<string, string[]>()
  const rolePermIdsMap = new Map<string, string[]>()

  for (const rp of rolePermRows) {
    const rList = permRolesMap.get(rp.permissionId) ?? []
    rList.push(rp.roleCode)
    permRolesMap.set(rp.permissionId, rList)

    const pList = rolePermIdsMap.get(rp.roleId) ?? []
    pList.push(rp.permissionId)
    rolePermIdsMap.set(rp.roleId, pList)
  }

  return {
    permissions: permissions.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      assignedRoleCodes: permRolesMap.get(p.id) ?? [],
    })),
    roles: roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      permissionIds: rolePermIdsMap.get(r.id) ?? [],
    })),
  }
}

// Raw helpers used by combined page fetch — assume ensureDefaultPermissions() already called
async function fetchUsersWithDetailsRaw(): Promise<UserWithDetails[]> {
  const [users, userRolesRows, rolePermsRows] = await Promise.all([
    db.select().from(usersTable).orderBy(usersTable.createdAt),
    db
      .select({
        userId: userRolesTable.userId,
        roleId: rolesTable.id,
        roleCode: rolesTable.code,
        roleName: rolesTable.name,
      })
      .from(userRolesTable)
      .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id)),
    db
      .select({
        roleId: rolePermissionsTable.roleId,
        permCode: permissionsTable.code,
      })
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id)),
  ])

  const rolePermMap = new Map<string, string[]>()
  for (const rp of rolePermsRows) {
    const list = rolePermMap.get(rp.roleId) ?? []
    list.push(rp.permCode)
    rolePermMap.set(rp.roleId, list)
  }

  const userRolesMap = new Map<string, Array<{ id: string; code: string; name: string }>>()
  for (const ur of userRolesRows) {
    const list = userRolesMap.get(ur.userId) ?? []
    list.push({ id: ur.roleId, code: ur.roleCode, name: ur.roleName })
    userRolesMap.set(ur.userId, list)
  }

  return users.map((u) => {
    const roles = userRolesMap.get(u.id) ?? []
    const permSet = new Set<string>()
    for (const r of roles) {
      const perms = rolePermMap.get(r.id) ?? []
      for (const p of perms) permSet.add(p)
    }
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      fullName: u.fullName,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      roles,
      permissions: Array.from(permSet).sort(),
    }
  })
}

async function fetchPermissionsWithRolesRaw(): Promise<{
  permissions: PermissionWithRoles[]
  roles: Array<{ id: string; code: string; name: string; description: string | null; permissionIds: string[] }>
}> {
  const [permissions, roles, rolePermRows] = await Promise.all([
    db.select().from(permissionsTable).orderBy(permissionsTable.code),
    db.select().from(rolesTable).orderBy(rolesTable.name),
    db
      .select({
        roleId: rolePermissionsTable.roleId,
        roleCode: rolesTable.code,
        permissionId: rolePermissionsTable.permissionId,
      })
      .from(rolePermissionsTable)
      .innerJoin(rolesTable, eq(rolePermissionsTable.roleId, rolesTable.id)),
  ])

  const permRolesMap = new Map<string, string[]>()
  const rolePermIdsMap = new Map<string, string[]>()
  for (const rp of rolePermRows) {
    const rList = permRolesMap.get(rp.permissionId) ?? []
    rList.push(rp.roleCode)
    permRolesMap.set(rp.permissionId, rList)

    const pList = rolePermIdsMap.get(rp.roleId) ?? []
    pList.push(rp.permissionId)
    rolePermIdsMap.set(rp.roleId, pList)
  }

  return {
    permissions: permissions.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      assignedRoleCodes: permRolesMap.get(p.id) ?? [],
    })),
    roles: roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      permissionIds: rolePermIdsMap.get(r.id) ?? [],
    })),
  }
}

export async function getCombinedUserMasterData(): Promise<{
  users: UserWithDetails[]
  roles: Array<{ id: string; code: string; name: string; description: string | null }>
  permissionsData: {
    permissions: PermissionWithRoles[]
    roles: Array<{ id: string; code: string; name: string; description: string | null; permissionIds: string[] }>
  }
}> {
  // Seeding handled by migration 20260820090000_seed_rbac — read path is pure SELECTs (6 parallel)
  const [users, permData] = await Promise.all([
    fetchUsersWithDetailsRaw(),
    fetchPermissionsWithRolesRaw(),
  ])
  // roles for UserMaster prop are the simple view (without permissionIds)
  const roles = permData.roles.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
  }))
  return { users, roles, permissionsData: permData }
}

export async function updateUser(values: {
  id: string
  fullName: string
  username: string
  email: string
  password?: string
  isActive?: boolean
  roleCodes?: string[]
  editorUserId: string
}): Promise<UserRecord> {
  const existingUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, values.id))
    .limit(1)

  const user = existingUser[0]
  if (!user) {
    throw new Error('User not found.')
  }

  if (values.email !== user.email) {
    const checkEmail = await findUserByEmail(values.email)
    if (checkEmail && checkEmail.id !== user.id) {
      throw new Error('This email is already taken by another account.')
    }
  }

  if (values.username !== user.username) {
    const checkUsername = await findUserByUsername(values.username)
    if (checkUsername && checkUsername.id !== user.id) {
      throw new Error('This username is already taken by another account.')
    }
  }

  const updatePayload: Partial<typeof usersTable.$inferInsert> = {
    fullName: values.fullName,
    username: values.username,
    email: values.email,
    updatedAt: new Date(),
  }

  if (typeof values.isActive === 'boolean') {
    updatePayload.isActive = values.isActive
  }

  if (values.password && values.password.trim()) {
    updatePayload.passwordHash = await hashPassword(values.password)
  }

  const updatedUsers = await db
    .update(usersTable)
    .set(updatePayload)
    .where(eq(usersTable.id, user.id))
    .returning()

  const updated = updatedUsers[0]
  if (!updated) {
    throw new Error('Failed to update user.')
  }

  if (values.roleCodes && values.roleCodes.length > 0) {
    const allRoles = await db.select().from(rolesTable)
    const targetRoleIds = allRoles
      .filter((r) => values.roleCodes?.includes(r.code))
      .map((r) => r.id)

    await db.delete(userRolesTable).where(eq(userRolesTable.userId, user.id))

    for (const roleId of targetRoleIds) {
      await db.insert(userRolesTable).values({
        userId: user.id,
        roleId,
      })
    }
  }

  await writeAuditLog({
    userId: values.editorUserId,
    action: 'auth.user_updated',
    resource: 'users',
    resourceId: user.id,
    oldValue: { email: user.email, username: user.username, isActive: user.isActive },
    newValue: { email: updated.email, username: updated.username, isActive: updated.isActive, roles: values.roleCodes },
  })

  return updated
}

export async function deleteUser(values: {
  id: string
  currentUserId: string
}): Promise<void> {
  if (values.id === values.currentUserId) {
    throw new Error('You cannot delete your own active administrator account.')
  }

  const existingUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, values.id))
    .limit(1)

  const user = existingUser[0]
  if (!user) {
    throw new Error('User not found.')
  }

  await db.delete(usersTable).where(eq(usersTable.id, user.id))

  await writeAuditLog({
    userId: values.currentUserId,
    action: 'auth.user_deleted',
    resource: 'users',
    resourceId: user.id,
    oldValue: { email: user.email, username: user.username, fullName: user.fullName },
  })
}

export async function createPermission(values: {
  code: string
  description: string
  roleCodes?: string[]
  creatorUserId: string
}): Promise<PermissionRecord> {
  const existing = await db
    .select()
    .from(permissionsTable)
    .where(eq(permissionsTable.code, values.code))
    .limit(1)

  if (existing[0]) {
    throw new Error(`Permission code "${values.code}" already exists.`)
  }

  const inserted = await db
    .insert(permissionsTable)
    .values({
      code: values.code,
      description: values.description,
    })
    .returning()

  const perm = inserted[0]
  if (!perm) {
    throw new Error('Failed to create permission.')
  }

  if (values.roleCodes && values.roleCodes.length > 0) {
    const roles = await db.select().from(rolesTable)
    const targetRoles = roles.filter((r) => values.roleCodes?.includes(r.code))
    for (const r of targetRoles) {
      await db.insert(rolePermissionsTable).values({
        roleId: r.id,
        permissionId: perm.id,
      })
    }
  }

  await writeAuditLog({
    userId: values.creatorUserId,
    action: 'auth.permission_created',
    resource: 'permissions',
    resourceId: perm.id,
    newValue: { code: perm.code, description: perm.description, roles: values.roleCodes },
  })

  return perm
}

export async function updatePermission(values: {
  id: string
  code: string
  description: string
  editorUserId: string
}): Promise<PermissionRecord> {
  const existing = await db
    .select()
    .from(permissionsTable)
    .where(eq(permissionsTable.id, values.id))
    .limit(1)

  const perm = existing[0]
  if (!perm) {
    throw new Error('Permission not found.')
  }

  if (values.code !== perm.code) {
    const check = await db
      .select()
      .from(permissionsTable)
      .where(eq(permissionsTable.code, values.code))
      .limit(1)
    if (check[0] && check[0].id !== perm.id) {
      throw new Error(`Permission code "${values.code}" is already in use.`)
    }
  }

  const updatedRows = await db
    .update(permissionsTable)
    .set({
      code: values.code,
      description: values.description,
    })
    .where(eq(permissionsTable.id, perm.id))
    .returning()

  const updated = updatedRows[0]
  if (!updated) {
    throw new Error('Failed to update permission.')
  }

  await writeAuditLog({
    userId: values.editorUserId,
    action: 'auth.permission_updated',
    resource: 'permissions',
    resourceId: perm.id,
    oldValue: { code: perm.code, description: perm.description },
    newValue: { code: updated.code, description: updated.description },
  })

  return updated
}

export async function deletePermission(values: {
  id: string
  currentUserId: string
}): Promise<void> {
  const existing = await db
    .select()
    .from(permissionsTable)
    .where(eq(permissionsTable.id, values.id))
    .limit(1)

  const perm = existing[0]
  if (!perm) {
    throw new Error('Permission not found.')
  }

  await db.delete(permissionsTable).where(eq(permissionsTable.id, perm.id))

  await writeAuditLog({
    userId: values.currentUserId,
    action: 'auth.permission_deleted',
    resource: 'permissions',
    resourceId: perm.id,
    oldValue: { code: perm.code, description: perm.description },
  })
}

export async function updateRolePermissions(values: {
  roleId: string
  permissionIds: string[]
  editorUserId: string
}): Promise<void> {
  const role = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.id, values.roleId))
    .limit(1)

  if (!role[0]) {
    throw new Error('Role not found.')
  }

  await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, values.roleId))

  for (const permId of values.permissionIds) {
    await db.insert(rolePermissionsTable).values({
      roleId: values.roleId,
      permissionId: permId,
    })
  }

  await writeAuditLog({
    userId: values.editorUserId,
    action: 'auth.role_permissions_updated',
    resource: 'roles',
    resourceId: values.roleId,
    newValue: { roleCode: role[0].code, permissionIdsCount: values.permissionIds.length },
  })
}
