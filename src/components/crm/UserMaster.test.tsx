import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import UserMaster from './UserMaster'

vi.mock('~/lib/auth.functions', () => ({
  createUserAction: vi.fn(),
  updateUserAction: vi.fn(),
  deleteUserAction: vi.fn(),
  createPermissionAction: vi.fn(),
  updatePermissionAction: vi.fn(),
  deletePermissionAction: vi.fn(),
  updateRolePermissionsAction: vi.fn(),
}))
const mockRoles = [
  { id: 'r1', code: 'admin', name: 'Administrator', description: 'Full access' },
  { id: 'r2', code: 'engineer', name: 'Engineer', description: 'Delivery' },
]

const mockUsers = [
  {
    id: 'u1',
    email: 'admin@accent.com',
    username: 'admin',
    fullName: 'System Admin',
    isActive: true,
    lastLoginAt: '2026-08-18T10:00:00Z',
    createdAt: '2026-08-18T09:00:00Z',
    updatedAt: '2026-08-18T09:00:00Z',
    roles: [{ id: 'r1', code: 'admin', name: 'Administrator' }],
    permissions: ['users.manage', 'projects.read'],
  },
]

const mockPermissionsData = {
  permissions: [
    {
      id: 'p1',
      code: 'users.manage',
      description: 'Manage users',
      assignedRoleCodes: ['admin'],
    },
    {
      id: 'p2',
      code: 'projects.read',
      description: 'Read projects',
      assignedRoleCodes: ['admin', 'engineer'],
    },
  ],
  roles: [
    { id: 'r1', code: 'admin', name: 'Administrator', description: 'Full access', permissionIds: ['p1', 'p2'] },
    { id: 'r2', code: 'engineer', name: 'Engineer', description: 'Delivery', permissionIds: ['p2'] },
  ],
}

describe('UserMaster Component', () => {
  it('renders users table and header action controls', () => {
    render(
      <UserMaster
        initialUsers={mockUsers}
        roles={mockRoles}
        permissionsData={mockPermissionsData}
        currentAdminEmail="admin@accent.com"
      />,
    )

    expect(screen.getByRole('heading', { name: /user & permission master/i })).toBeInTheDocument()
    expect(screen.getByText('System Admin')).toBeInTheDocument()
    expect(screen.getByText('admin@accent.com')).toBeInTheDocument()
    expect(screen.getAllByText('Administrator').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new permission/i })).toBeInTheDocument()
  })

  it('switches to Permissions Catalog and Role Permissions Matrix tabs', async () => {
    const user = userEvent.setup()

    render(
      <UserMaster
        initialUsers={mockUsers}
        roles={mockRoles}
        permissionsData={mockPermissionsData}
        currentAdminEmail="admin@accent.com"
      />,
    )

    const permsTab = screen.getByRole('button', { name: /permissions catalog/i })
    await user.click(permsTab)

    expect(await screen.findByText('users.manage')).toBeInTheDocument()
    expect(screen.getByText('projects.read')).toBeInTheDocument()

    const matrixTab = screen.getByRole('button', { name: /role permissions matrix/i })
    await user.click(matrixTab)

    expect(await screen.findByText(/select role to edit/i)).toBeInTheDocument()
  })
})
