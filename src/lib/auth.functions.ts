import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import {
  authenticateUser,
  countUsers,
  createPermission,
  createSession,
  createUserWithRole,
  deletePermission,
  deleteSession,
  deleteUser,
  findSessionById,
  getCombinedUserMasterData,
  getUserRoles,
  isUserAdmin,
  listPermissionsWithRoles,
  listRoles,
  listUsersWithDetails,
  normalizeIpAddress,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
  type AuthUser,
  type PermissionWithRoles,
  type UserWithDetails,
  toAuthUser,
  updateLastLogin,
  updatePermission,
  updateRolePermissions,
  updateUser,
  writeAuditLog,
} from './auth.server'

const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(256),
})

const secureCookieAttribute =
  process.env.NODE_ENV === 'production' ? '; Secure' : ''

function createSessionCookie(sessionId: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureCookieAttribute}`
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieAttribute}`
}

function requestSessionMetadata() {
  const forwardedIp =
    getRequestHeader('x-forwarded-for') ??
    getRequestHeader('x-real-ip') ??
    getRequestHeader('cf-connecting-ip')

  return {
    ipAddress: normalizeIpAddress(forwardedIp),
    userAgent: getRequestHeader('user-agent') ?? null,
  }
}

export const loginUser = createServerFn({ method: 'POST' })
  .validator(loginInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')

    const user = await authenticateUser(data.email, data.password)
    if (!user) {
      return {
        ok: false,
        message: 'Invalid email or password.',
      }
    }

    const session = await createSession(user.id, requestSessionMetadata())
    await updateLastLogin(user.id)
    await writeAuditLog({
      userId: user.id,
      action: 'auth.login',
      resource: 'users',
      resourceId: user.id,
    })

    setResponseHeader(
      'Set-Cookie',
      createSessionCookie(
        session.id,
        Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)),
      ),
    )

    return {
      ok: true,
      user: toAuthUser(user),
      expiresAt: session.expiresAt.toISOString(),
    }
  })

export type CurrentUserPayload = {
  user: AuthUser
  roles: Array<{ code: string; name: string }>
}

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CurrentUserPayload | null> => {
    setResponseHeader('Cache-Control', 'private, no-store')

    const sessionId = parseSessionCookie(getRequestHeader('cookie'))
    if (!sessionId) {
      return null
    }

    const session = await findSessionById(sessionId)
    if (!session) {
      await deleteSession(sessionId)
      setResponseHeader('Set-Cookie', clearSessionCookie())
      return null
    }

    const roles = await getUserRoles(session.user.id)

    return {
      user: session.user,
      roles: roles.map((role) => ({ code: role.code, name: role.name })),
    }
  },
)

export const logoutUser = createServerFn({ method: 'POST' }).handler(async () => {
  setResponseHeader('Cache-Control', 'no-store')

  const sessionId = parseSessionCookie(getRequestHeader('cookie'))
  const session = sessionId ? await findSessionById(sessionId) : null

  if (sessionId) {
    await deleteSession(sessionId)
  }

  setResponseHeader('Set-Cookie', clearSessionCookie())

  if (session) {
    await writeAuditLog({
      userId: session.user.id,
      action: 'auth.logout',
      resource: 'users',
      resourceId: session.user.id,
    })
  }

  return { ok: true }
})

const registerInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(255),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(100)
    .regex(
      /^[a-z0-9_.-]+$/,
      'Username can only contain letters, numbers, dashes, dots, and underscores',
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address')
    .max(255),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(256),
  roleCode: z.string().optional(),
})


export type RegistrationStatus = {
  canRegister: boolean
  isInitialAdminSetup: boolean
  totalUsers: number
  currentUser: AuthUser | null
  roles: Array<{
    code: string
    name: string
    description: string | null
  }>
}
export const getRegistrationStatus = createServerFn({ method: 'GET' }).handler(
  async () => {
    setResponseHeader('Cache-Control', 'private, no-store')

    const totalUsers = await countUsers()
    if (totalUsers === 0) {
      const roles = await listRoles()
      return {
        canRegister: true,
        isInitialAdminSetup: true,
        totalUsers: 0,
        currentUser: null,
        roles: roles.map((r) => ({
          code: r.code,
          name: r.name,
          description: r.description,
        })),
      }
    }

    const sessionId = parseSessionCookie(getRequestHeader('cookie'))
    const session = sessionId ? await findSessionById(sessionId) : null

    if (session && (await isUserAdmin(session.user.id))) {
      const roles = await listRoles()
      return {
        canRegister: true,
        isInitialAdminSetup: false,
        totalUsers,
        currentUser: session.user,
        roles: roles.map((r) => ({
          code: r.code,
          name: r.name,
          description: r.description,
        })),
      }
    }

    return {
      canRegister: false,
      isInitialAdminSetup: false,
      totalUsers,
      currentUser: session?.user ?? null,
      roles: [],
    }
  },
)

export const registerUser = createServerFn({ method: 'POST' })
  .validator(registerInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')

    const totalUsers = await countUsers()
    const isInitial = totalUsers === 0

    let creatorUserId: string | null = null

    if (!isInitial) {
      const sessionId = parseSessionCookie(getRequestHeader('cookie'))
      const session = sessionId ? await findSessionById(sessionId) : null

      if (!session || !(await isUserAdmin(session.user.id))) {
        return {
          ok: false,
          message:
            'Administrator privileges are required to register new accounts.',
        }
      }

      creatorUserId = session.user.id
    }

    try {
      const { user, role } = await createUserWithRole({
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        password: data.password,
        roleCode: isInitial ? 'admin' : data.roleCode || 'engineer',
        creatorUserId,
      })

      if (isInitial) {
        const session = await createSession(user.id, requestSessionMetadata())
        await updateLastLogin(user.id)
        setResponseHeader(
          'Set-Cookie',
          createSessionCookie(
            session.id,
            Math.max(
              0,
              Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
            ),
          ),
        )
      }

      return {
        ok: true,
        user: toAuthUser(user),
        role: role.code,
        isInitialAdmin: isInitial,
        message: isInitial
          ? 'Initial administrator account created and signed in.'
          : `User "${user.username}" registered successfully with role "${role.name}".`,
      }
    } catch (error) {
      console.error('User registration failed', error)
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create user account.',
      }
    }
  })

export const getUsersMasterData = createServerFn({ method: 'GET' }).handler(
  async () => {
    setResponseHeader('Cache-Control', 'private, no-store')

    const sessionId = parseSessionCookie(getRequestHeader('cookie'))
    const session = sessionId ? await findSessionById(sessionId) : null

    if (!session || !(await isUserAdmin(session.user.id))) {
      return {
        authorized: false,
        users: [],
        roles: [],
        currentAdmin: null,
      }
    }

    const users = await listUsersWithDetails()
    const roles = await listRoles()

    return {
      authorized: true,
      users,
      roles: roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
      })),
      currentAdmin: session.user,
    }
  },
)

export const getPermissionsMasterData = createServerFn({
  method: 'GET',
}).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')

  const sessionId = parseSessionCookie(getRequestHeader('cookie'))
  const session = sessionId ? await findSessionById(sessionId) : null

  if (!session || !(await isUserAdmin(session.user.id))) {
    return {
      authorized: false,
      permissions: [],
      roles: [],
      currentAdmin: null,
    }
  }

  const data = await listPermissionsWithRoles()

  return {
    authorized: true,
    permissions: data.permissions,
    roles: data.roles,
    currentAdmin: session.user,
  }
})

// Combined fetch — single auth + migration-seeded reads (6 parallel SELECTs, no INSERTs)
export const getUserMasterPageData = createServerFn({ method: 'GET' }).handler(
  async () => {
    setResponseHeader('Cache-Control', 'private, max-age=60, must-revalidate')

    const sessionId = parseSessionCookie(getRequestHeader('cookie'))
    const session = sessionId ? await findSessionById(sessionId) : null

    if (!session || !(await isUserAdmin(session.user.id))) {
      return {
        authorized: false as const,
        users: [] as UserWithDetails[],
        roles: [] as Array<{ id: string; code: string; name: string; description: string | null }>,
        permissions: [] as PermissionWithRoles[],
        rolesWithPerms: [] as Array<{
          id: string
          code: string
          name: string
          description: string | null
          permissionIds: string[]
        }>,
        currentAdmin: null as AuthUser | null,
      }
    }

    const { users, roles, permissionsData } = await getCombinedUserMasterData()

    return {
      authorized: true as const,
      users,
      roles,
      permissions: permissionsData.permissions,
      rolesWithPerms: permissionsData.roles,
      currentAdmin: session.user,
    }
  },
)

const createUserSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(255),
  username: z.string().trim().toLowerCase().min(3, 'Username must be at least 3 characters').max(100).regex(/^[a-z0-9_.-]+$/, 'Username format is invalid'),
  email: z.string().trim().toLowerCase().email('Invalid email address').max(255),
  password: z.string().min(12, 'Password must be at least 12 characters').max(256),
  roleCodes: z.array(z.string()).min(1, 'Select at least one role'),
  isActive: z.boolean().default(true),
})

export const createUserAction = createServerFn({ method: 'POST' })
  .validator(createUserSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')

    const sessionId = parseSessionCookie(getRequestHeader('cookie'))
    const session = sessionId ? await findSessionById(sessionId) : null

    if (!session || !(await isUserAdmin(session.user.id))) {
      return { ok: false, message: 'Administrator authorization required.' }
    }

    try {
      const primaryRole = data.roleCodes[0] || 'engineer'
      const { user } = await createUserWithRole({
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        password: data.password,
        roleCode: primaryRole,
        creatorUserId: session.user.id,
      })

      if (data.roleCodes.length > 1 || !data.isActive) {
        await updateUser({
          id: user.id,
          fullName: data.fullName,
          username: data.username,
          email: data.email,
          isActive: data.isActive,
          roleCodes: data.roleCodes,
          editorUserId: session.user.id,
        })
      }

      return { ok: true, message: `User "${user.username}" created successfully.` }
    } catch (error) {
      console.error('createUserAction error', error)
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to create user.' }
    }
  })

const updateUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(255),
  username: z.string().trim().toLowerCase().min(3, 'Username must be at least 3 characters').max(100).regex(/^[a-z0-9_.-]+$/, 'Username format is invalid'),
  email: z.string().trim().toLowerCase().email('Invalid email address').max(255),
  password: z.string().optional(),
  roleCodes: z.array(z.string()).min(1, 'Select at least one role'),
  isActive: z.boolean().default(true),
})

export const updateUserAction = createServerFn({ method: 'POST' })
  .validator(updateUserSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')

    const sessionId = parseSessionCookie(getRequestHeader('cookie'))
    const session = sessionId ? await findSessionById(sessionId) : null

    if (!session || !(await isUserAdmin(session.user.id))) {
      return { ok: false, message: 'Administrator authorization required.' }
    }

    try {
      await updateUser({
        id: data.id,
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        password: data.password && data.password.trim() ? data.password : undefined,
        roleCodes: data.roleCodes,
        isActive: data.isActive,
        editorUserId: session.user.id,
      })

      return { ok: true, message: 'User updated successfully.' }
    } catch (error) {
      console.error('updateUserAction error', error)
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to update user.' }
    }
  })

const deleteUserSchema = z.object({
  id: z.string().uuid(),
})

export const deleteUserAction = createServerFn({ method: 'POST' })
  .validator(deleteUserSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')

    const sessionId = parseSessionCookie(getRequestHeader('cookie'))
    const session = sessionId ? await findSessionById(sessionId) : null

    if (!session || !(await isUserAdmin(session.user.id))) {
      return { ok: false, message: 'Administrator authorization required.' }
    }

    try {
      await deleteUser({ id: data.id, currentUserId: session.user.id })
      return { ok: true, message: 'User account removed.' }
    } catch (error) {
      console.error('deleteUserAction error', error)
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to delete user.' }
    }
  })

const createPermissionSchema = z.object({
  code: z.string().trim().toLowerCase().min(3, 'Code must be at least 3 characters').max(100).regex(/^[a-z0-9_.-]+$/, 'Permission code can only use lowercase letters, numbers, dots, and dashes'),
  description: z.string().trim().max(255).default(''),
  roleCodes: z.array(z.string()).default([]),
})

export const createPermissionAction = createServerFn({ method: 'POST' })
  .validator(createPermissionSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')

    const sessionId = parseSessionCookie(getRequestHeader('cookie'))
    const session = sessionId ? await findSessionById(sessionId) : null

    if (!session || !(await isUserAdmin(session.user.id))) {
      return { ok: false, message: 'Administrator authorization required.' }
    }

    try {
      const perm = await createPermission({
        code: data.code,
        description: data.description,
        roleCodes: data.roleCodes,
        creatorUserId: session.user.id,
      })
      return { ok: true, message: `Permission "${perm.code}" created.` }
    } catch (error) {
      console.error('createPermissionAction error', error)
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to create permission.' }
    }
  })

const updatePermissionSchema = z.object({
  id: z.string().uuid(),
  code: z.string().trim().toLowerCase().min(3).max(100).regex(/^[a-z0-9_.-]+$/),
  description: z.string().trim().max(255).default(''),
})

export const updatePermissionAction = createServerFn({ method: 'POST' })
  .validator(updatePermissionSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')

    const sessionId = parseSessionCookie(getRequestHeader('cookie'))
    const session = sessionId ? await findSessionById(sessionId) : null

    if (!session || !(await isUserAdmin(session.user.id))) {
      return { ok: false, message: 'Administrator authorization required.' }
    }

    try {
      await updatePermission({
        id: data.id,
        code: data.code,
        description: data.description,
        editorUserId: session.user.id,
      })
      return { ok: true, message: 'Permission updated.' }
    } catch (error) {
      console.error('updatePermissionAction error', error)
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to update permission.' }
    }
  })

const deletePermissionSchema = z.object({
  id: z.string().uuid(),
})

export const deletePermissionAction = createServerFn({ method: 'POST' })
  .validator(deletePermissionSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')

    const sessionId = parseSessionCookie(getRequestHeader('cookie'))
    const session = sessionId ? await findSessionById(sessionId) : null

    if (!session || !(await isUserAdmin(session.user.id))) {
      return { ok: false, message: 'Administrator authorization required.' }
    }

    try {
      await deletePermission({ id: data.id, currentUserId: session.user.id })
      return { ok: true, message: 'Permission deleted.' }
    } catch (error) {
      console.error('deletePermissionAction error', error)
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to delete permission.' }
    }
  })

const updateRolePermissionsSchema = z.object({
  roleId: z.string().uuid(),
  permissionIds: z.array(z.string().uuid()),
})

export const updateRolePermissionsAction = createServerFn({ method: 'POST' })
  .validator(updateRolePermissionsSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')

    const sessionId = parseSessionCookie(getRequestHeader('cookie'))
    const session = sessionId ? await findSessionById(sessionId) : null

    if (!session || !(await isUserAdmin(session.user.id))) {
      return { ok: false, message: 'Administrator authorization required.' }
    }

    try {
      await updateRolePermissions({
        roleId: data.roleId,
        permissionIds: data.permissionIds,
        editorUserId: session.user.id,
      })
      return { ok: true, message: 'Role permissions updated.' }
    } catch (error) {
      console.error('updateRolePermissionsAction error', error)
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to update role permissions.' }
    }
  })
