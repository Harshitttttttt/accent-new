import { useMemo, useRef, useState, type FormEvent } from 'react'
import { createAppColumnHelper, flexRender, useAppTable, type AppColumnDef } from '~/lib/table'
import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useHotkey } from '@tanstack/react-hotkeys'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Edit2,
  KeyRound,
  Lock,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import {
  createUserAction,
  deleteUserAction,
  updateUserAction,
  createPermissionAction,
  updatePermissionAction,
  deletePermissionAction,
  updateRolePermissionsAction,
} from '~/lib/auth.functions'
import type { UserWithDetails, PermissionWithRoles } from '~/lib/auth.server'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'

interface RoleOption {
  id: string
  code: string
  name: string
  description: string | null
}

interface RoleWithPerms extends RoleOption {
  permissionIds: string[]
}

interface Props {
  initialUsers: UserWithDetails[]
  roles: RoleOption[]
  permissionsData?: {
    permissions: PermissionWithRoles[]
    roles: RoleWithPerms[]
  }
  currentAdminEmail?: string
  onRefresh?: () => void
}

export default function UserMaster({
  initialUsers,
  roles,
  permissionsData,
  currentAdminEmail,
}: Props) {
  const [users, setUsers] = useState<UserWithDetails[]>(initialUsers)
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'roles'>('users')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const searchRef = useRef<HTMLInputElement>(null)

  // Hotkeys: Escape closes open modals, Mod+K focuses search
  useHotkey({ key: 'Escape' }, () => {
    setIsUserModalOpen(false)
    setIsPermModalOpen(false)
    setIsDeleteUserOpen(null)
    setIsDeletePermOpen(null)
  })

  useHotkey({ key: 'k', mod: true }, (event) => {
    event.preventDefault()
    searchRef.current?.focus()
  })

  // Pacer: debounced search handler
  const handlePacedSearch = useDebouncedCallback(
    (_val: string) => {
      // debounced search trigger
    },
    { wait: 200 },
  )
  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithDetails | null>(null)
  const [isPermModalOpen, setIsPermModalOpen] = useState(false)
  const [editingPerm, setEditingPerm] = useState<PermissionWithRoles | null>(null)
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState<UserWithDetails | null>(null)
  const [isDeletePermOpen, setIsDeletePermOpen] = useState<PermissionWithRoles | null>(null)

  // Feedback alerts
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Selected role for Matrix editor
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>(roles[0]?.code || 'admin')
  const [rolePermsState, setRolePermsState] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {}
    if (permissionsData?.roles) {
      for (const r of permissionsData.roles) {
        map[r.code] = r.permissionIds
      }
    }
    return map
  })

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole =
      roleFilter === 'All' || u.roles.some((r) => r.code === roleFilter)
    const matchStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Active' ? u.isActive : !u.isActive)
    return matchSearch && matchRole && matchStatus
  })

  const allPermissions = permissionsData?.permissions || []

  const userColumnHelper = useMemo(() => createAppColumnHelper<UserWithDetails>(), [])
  const permColumnHelper = useMemo(() => createAppColumnHelper<PermissionWithRoles>(), [])

  const userColumns = useMemo(
    () => [
      userColumnHelper.accessor('fullName', {
        header: 'User',
        cell: (info) => {
          const u = info.row.original
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                className="avatar"
                style={{
                  background: u.roles.some((r) => r.code === 'admin')
                    ? 'linear-gradient(135deg,#64126D,#86288F)'
                    : '#475569',
                  width: 32,
                  height: 32,
                  fontSize: 11,
                }}
              >
                {u.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.fullName}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  @{u.username}
                </div>
              </div>
            </div>
          )
        },
      }),
      userColumnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => <span style={{ fontSize: 13 }}>{info.getValue()}</span>,
      }),
      userColumnHelper.accessor('roles', {
        header: 'Assigned Roles',
        cell: (info) => (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {info.getValue().map((r) => (
              <span
                key={r.code}
                className={`badge ${r.code === 'admin' ? 'badge-purple' : 'badge-steel'}`}
                style={{ fontSize: 10.5 }}
              >
                {r.name}
              </span>
            ))}
          </div>
        ),
      }),
      userColumnHelper.accessor('permissions', {
        header: 'Granted Permissions',
        cell: (info) => (
          <span
            className="badge badge-neutral"
            title={info.getValue().join(', ') || 'No direct permissions'}
            style={{ fontSize: 10.5 }}
          >
            {info.getValue().length} capabilities
          </span>
        ),
      }),
      userColumnHelper.accessor('lastLoginAt', {
        header: 'Last Active',
        cell: (info) => {
          const val = info.getValue()
          return (
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {val ? new Date(val).toLocaleDateString() : 'Never'}
            </span>
          )
        },
      }),
      userColumnHelper.accessor('isActive', {
        header: 'Status',
        cell: (info) => (
          <span
            className={`badge ${info.getValue() ? 'badge-success' : 'badge-danger'}`}
            style={{ fontSize: 11 }}
          >
            {info.getValue() ? 'Active' : 'Disabled'}
          </span>
        ),
      }),
      userColumnHelper.display({
        id: 'actions',
        header: () => <div style={{ textAlign: 'right' }}>Actions</div>,
        cell: (info) => {
          const u = info.row.original
          return (
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '5px 8px' }}
                  title="Edit User"
                  onClick={() => {
                    setEditingUser(u)
                    setIsUserModalOpen(true)
                  }}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    padding: '5px 8px',
                    color: u.email === currentAdminEmail ? 'var(--text-muted)' : 'var(--danger)',
                  }}
                  title="Delete User"
                  disabled={u.email === currentAdminEmail}
                  onClick={() => setIsDeleteUserOpen(u)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        },
      }),
    ],
    [currentAdminEmail, userColumnHelper],
  )

  const permColumns = useMemo(
    () => [
      permColumnHelper.accessor('code', {
        header: 'Permission Code',
        cell: (info) => (
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--brand-primary)',
            }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      permColumnHelper.accessor('description', {
        header: 'Description',
        cell: (info) => (
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {info.getValue() || '—'}
          </span>
        ),
      }),
      permColumnHelper.accessor('assignedRoleCodes', {
        header: 'Assigned Roles',
        cell: (info) => (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {info.getValue().map((rc) => (
              <span key={rc} className="badge badge-steel" style={{ fontSize: 10 }}>
                {roles.find((r) => r.code === rc)?.name || rc}
              </span>
            ))}
            {info.getValue().length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>None</span>
            )}
          </div>
        ),
      }),
      permColumnHelper.display({
        id: 'actions',
        header: () => <div style={{ textAlign: 'right' }}>Actions</div>,
        cell: (info) => {
          const p = info.row.original
          return (
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '5px 8px' }}
                  title="Edit Permission"
                  onClick={() => {
                    setEditingPerm(p)
                    setIsPermModalOpen(true)
                  }}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '5px 8px', color: 'var(--danger)' }}
                  title="Delete Permission"
                  onClick={() => setIsDeletePermOpen(p)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        },
      }),
    ],
    [permColumnHelper, roles],
  )

  const usersTableInstance = useAppTable({
    data: filteredUsers,
    columns: userColumns as unknown as AppColumnDef<UserWithDetails>[],
  })

  const permsTableInstance = useAppTable({
    data: allPermissions,
    columns: permColumns as unknown as AppColumnDef<PermissionWithRoles>[],
  })

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback(null)
    }, 4000)
  }

  // Handle User Create & Edit submit
  async function handleUserSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const formData = new FormData(e.currentTarget)
    const fullName = String(formData.get('fullName') ?? '').trim()
    const username = String(formData.get('username') ?? '').trim().toLowerCase()
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    const isActive = formData.get('isActive') === 'on'
    const selectedRoles = formData.getAll('roles').map(String)

    if (selectedRoles.length === 0) {
      showFeedback('error', 'Please assign at least one role.')
      setIsSaving(false)
      return
    }

    try {
      if (editingUser) {
        const res = await updateUserAction({
          data: {
            id: editingUser.id,
            fullName,
            username,
            email,
            password: password.trim() ? password : undefined,
            isActive,
            roleCodes: selectedRoles,
          },
        })

        if (!res.ok) {
          showFeedback('error', res.message)
          setIsSaving(false)
          return
        }

        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUser.id
              ? {
                  ...u,
                  fullName,
                  username,
                  email,
                  isActive,
                  roles: roles.filter((r) => selectedRoles.includes(r.code)),
                }
              : u,
          ),
        )
        showFeedback('success', `User "${username}" updated successfully.`)
      } else {
        if (password.length < 12) {
          showFeedback('error', 'Password must be at least 12 characters.')
          setIsSaving(false)
          return
        }

        const res = await createUserAction({
          data: {
            fullName,
            username,
            email,
            password,
            roleCodes: selectedRoles,
            isActive,
          },
        })

        if (!res.ok) {
          showFeedback('error', res.message)
          setIsSaving(false)
          return
        }

        setUsers((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            fullName,
            username,
            email,
            isActive,
            lastLoginAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            roles: roles.filter((r) => selectedRoles.includes(r.code)),
            permissions: [],
          },
        ])
        showFeedback('success', `User "${username}" created.`)
      }

      setIsUserModalOpen(false)
      setEditingUser(null)
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Operation failed. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle User Delete
  async function handleDeleteUser() {
    if (!isDeleteUserOpen) return
    setIsSaving(true)

    try {
      const res = await deleteUserAction({ data: { id: isDeleteUserOpen.id } })
      if (!res.ok) {
        showFeedback('error', res.message)
        setIsSaving(false)
        return
      }

      setUsers((prev) => prev.filter((u) => u.id !== isDeleteUserOpen.id))
      showFeedback('success', `User "${isDeleteUserOpen.username}" deleted.`)
      setIsDeleteUserOpen(null)
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Failed to delete user.')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Permission Create & Edit
  async function handlePermissionSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const formData = new FormData(e.currentTarget)
    const code = String(formData.get('code') ?? '').trim().toLowerCase()
    const description = String(formData.get('description') ?? '').trim()
    const selectedRoles = formData.getAll('roles').map(String)

    try {
      if (editingPerm) {
        const res = await updatePermissionAction({
          data: {
            id: editingPerm.id,
            code,
            description,
          },
        })

        if (!res.ok) {
          showFeedback('error', res.message)
          setIsSaving(false)
          return
        }

        showFeedback('success', `Permission "${code}" updated.`)
      } else {
        const res = await createPermissionAction({
          data: {
            code,
            description,
            roleCodes: selectedRoles,
          },
        })

        if (!res.ok) {
          showFeedback('error', res.message)
          setIsSaving(false)
          return
        }

        showFeedback('success', `Permission "${code}" created.`)
      }

      setIsPermModalOpen(false)
      setEditingPerm(null)
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Failed to save permission.')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Permission Delete
  async function handleDeletePerm() {
    if (!isDeletePermOpen) return
    setIsSaving(true)

    try {
      const res = await deletePermissionAction({ data: { id: isDeletePermOpen.id } })
      if (!res.ok) {
        showFeedback('error', res.message)
        setIsSaving(false)
        return
      }

      showFeedback('success', `Permission "${isDeletePermOpen.code}" removed.`)
      setIsDeletePermOpen(null)
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Failed to delete permission.')
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle permission in role matrix
  function toggleRolePermission(roleCode: string, permId: string) {
    setRolePermsState((prev) => {
      const current = prev[roleCode] || []
      const next = current.includes(permId)
        ? current.filter((id) => id !== permId)
        : [...current, permId]
      return { ...prev, [roleCode]: next }
    })
  }

  // Save role permissions
  async function handleSaveRolePermissions(roleCode: string) {
    const role = roles.find((r) => r.code === roleCode)
    if (!role) return
    setIsSaving(true)

    try {
      const permIds = rolePermsState[roleCode] || []
      const res = await updateRolePermissionsAction({
        data: {
          roleId: role.id,
          permissionIds: permIds,
        },
      })

      if (!res.ok) {
        showFeedback('error', res.message)
        setIsSaving(false)
        return
      }

      showFeedback('success', `Permissions updated for role "${role.name}".`)
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Failed to update role permissions.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>User & Permission Master</h2>
            <span className="badge badge-purple">Admin Mode</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {users.length} registered accounts · {roles.length} roles · {allPermissions.length} system permissions
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setEditingPerm(null)
              setIsPermModalOpen(true)
            }}
          >
            <Plus size={14} /> New Permission
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setEditingUser(null)
              setIsUserModalOpen(true)
            }}
          >
            <UserPlus size={14} /> Add User
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '10px 24px',
            background: feedback.type === 'success' ? 'var(--success-soft-bg)' : 'var(--danger-soft-bg)',
            color: feedback.type === 'success' ? 'var(--success-soft-fg)' : 'var(--danger-soft-fg)',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--border)',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Tab navigation */}
      <div
        style={{
          padding: '0 28px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div className="tab-nav" style={{ borderBottom: 'none' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={14} style={{ display: 'inline', marginRight: 6 }} />
            User Accounts ({users.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('permissions')}
          >
            <KeyRound size={14} style={{ display: 'inline', marginRight: 6 }} />
            Permissions Catalog ({allPermissions.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            <ShieldCheck size={14} style={{ display: 'inline', marginRight: 6 }} />
            Role Permissions Matrix
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
        {/* TAB 1: USERS DIRECTORY */}
        {activeTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Filter Toolbar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--surface-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '7px 12px',
                  width: 280,
                }}
              >
                <Search size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  ref={searchRef}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 13,
                    width: '100%',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="Search by name, username, email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    handlePacedSearch(e.target.value)
                  }}
                />
              </div>

              <select
                className="input-base"
                style={{ width: 'auto', fontSize: 13 }}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="All">All Roles</option>
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>

              <select
                className="input-base"
                style={{ width: 'auto', fontSize: 13 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                Showing {filteredUsers.length} of {users.length} accounts
              </span>
            </div>

            {/* Users Table with @tanstack/react-table */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  {usersTableInstance.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {usersTableInstance.getRowModel().rows.length > 0 ? (
                    usersTableInstance.getRowModel().rows.map((row) => (
                      <tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={userColumns.length} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No user accounts match your search filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PERMISSIONS CATALOG with @tanstack/react-table */}
        {activeTab === 'permissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  {permsTableInstance.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {permsTableInstance.getRowModel().rows.length > 0 ? (
                    permsTableInstance.getRowModel().rows.map((row) => (
                      <tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={permColumns.length} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No permissions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ROLE PERMISSIONS MATRIX */}
        {activeTab === 'roles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Role selector bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'var(--surface)',
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>Select Role to Edit:</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {roles.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      className={`btn-ghost ${selectedRoleCode === r.code ? 'active' : ''}`}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        background: selectedRoleCode === r.code ? 'var(--brand-primary)' : 'var(--surface-secondary)',
                        color: selectedRoleCode === r.code ? 'var(--on-brand)' : 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                      onClick={() => setSelectedRoleCode(r.code)}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                disabled={isSaving}
                className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]"
                onClick={() => void handleSaveRolePermissions(selectedRoleCode)}
              >
                <Check size={14} style={{ marginRight: 6 }} />
                Save Permissions for {roles.find((r) => r.code === selectedRoleCode)?.name}
              </Button>
            </div>

            {/* Permission Checkboxes Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: 12,
              }}
            >
              {allPermissions.map((perm) => {
                const isChecked = (rolePermsState[selectedRoleCode] || []).includes(perm.id)
                return (
                  <label
                    key={perm.id}
                    className="card"
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      cursor: 'pointer',
                      border: isChecked ? '1.5px solid var(--brand-primary)' : '1px solid var(--border)',
                      background: isChecked ? 'var(--brand-tint)' : 'var(--surface)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleRolePermission(selectedRoleCode, perm.id)}
                      style={{
                        marginTop: 3,
                        accentColor: 'var(--brand-primary)',
                        width: 16,
                        height: 16,
                        cursor: 'pointer',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--brand-primary)' }}>
                        {perm.code}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {perm.description || 'No description provided.'}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: CREATE / EDIT USER */}
      {isUserModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 520,
              padding: '24px 28px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editingUser ? `Edit User: ${editingUser.username}` : 'Add New User'}
                </h3>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setIsUserModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field>
                <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                <Input
                  id="fullName"
                  name="fullName"
                  defaultValue={editingUser?.fullName || ''}
                  placeholder="e.g. John Smith"
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  name="username"
                  defaultValue={editingUser?.username || ''}
                  placeholder="e.g. john.smith"
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Work Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={editingUser?.email || ''}
                  placeholder="e.g. john.smith@company.com"
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">
                  {editingUser ? 'Password (leave blank to keep unchanged)' : 'Initial Password'}
                </FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={editingUser ? '••••••••••••' : 'Min 12 characters'}
                  required={!editingUser}
                />
              </Field>

              <Field>
                <FieldLabel>Assigned Roles</FieldLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {roles.map((r) => {
                    const isChecked = editingUser
                      ? editingUser.roles.some((ur) => ur.code === r.code)
                      : r.code === 'engineer'
                    return (
                      <label
                        key={r.code}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 13,
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'var(--surface-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          name="roles"
                          value={r.code}
                          defaultChecked={isChecked}
                          style={{ accentColor: 'var(--brand-primary)' }}
                        />
                        <span>{r.name}</span>
                      </label>
                    )
                  })}
                </div>
              </Field>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={editingUser ? editingUser.isActive : true}
                  style={{ accentColor: 'var(--brand-primary)', width: 16, height: 16 }}
                />
                <span style={{ fontWeight: 600 }}>Active account status</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsUserModalOpen(false)}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]"
                >
                  {isSaving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT PERMISSION */}
      {isPermModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 480,
              padding: '24px 28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={18} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editingPerm ? `Edit Permission` : 'New Permission'}
                </h3>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setIsPermModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePermissionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field>
                <FieldLabel htmlFor="code">Permission Code</FieldLabel>
                <Input
                  id="code"
                  name="code"
                  defaultValue={editingPerm?.code || ''}
                  placeholder="e.g. inventory.manage"
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Input
                  id="description"
                  name="description"
                  defaultValue={editingPerm?.description || ''}
                  placeholder="Describe granted capability..."
                  required
                />
              </Field>

              {!editingPerm && (
                <Field>
                  <FieldLabel>Grant Initially to Roles</FieldLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {roles.map((r) => (
                      <label
                        key={r.code}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 13,
                          padding: '6px 12px',
                          borderRadius: 8,
                          background: 'var(--surface-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          name="roles"
                          value={r.code}
                          defaultChecked={r.code === 'admin'}
                          style={{ accentColor: 'var(--brand-primary)' }}
                        />
                        <span>{r.name}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsPermModalOpen(false)}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]"
                >
                  {isSaving ? 'Saving...' : editingPerm ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE USER CONFIRMATION */}
      {isDeleteUserOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 420,
              padding: '24px 28px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--danger-soft-bg)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Trash2 size={22} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Delete User Account</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Are you sure you want to delete user <strong>{isDeleteUserOpen.fullName}</strong> (@{isDeleteUserOpen.username})? This action removes their credentials and active sessions.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsDeleteUserOpen(null)}
              >
                Cancel
              </button>
              <Button
                type="button"
                disabled={isSaving}
                className="bg-[var(--danger)] text-white hover:bg-red-700"
                onClick={handleDeleteUser}
              >
                {isSaving ? 'Deleting...' : 'Delete Account'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE PERMISSION CONFIRMATION */}
      {isDeletePermOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 420,
              padding: '24px 28px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--danger-soft-bg)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Trash2 size={22} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Delete Permission</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Are you sure you want to remove permission <code>{isDeletePermOpen.code}</code>? This will revoke it from all assigned roles.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsDeletePermOpen(null)}
              >
                Cancel
              </button>
              <Button
                type="button"
                disabled={isSaving}
                className="bg-[var(--danger)] text-white hover:bg-red-700"
                onClick={handleDeletePerm}
              >
                {isSaving ? 'Deleting...' : 'Delete Permission'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
