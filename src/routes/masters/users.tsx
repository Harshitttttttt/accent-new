import { createFileRoute, redirect } from '@tanstack/react-router'
import { getUserMasterPageData } from '~/lib/auth.functions'
import UserMaster from '~/components/crm/UserMaster'
import UserMasterSkeleton from '~/components/crm/UserMasterSkeleton'

export const Route = createFileRoute('/masters/users')({
  ssr: true,
  // Cache 60s on client — matches Cache-Control: private, max-age=60 in getUserMasterPageData
  staleTime: 60_000,
  gcTime: 300_000,
  pendingComponent: UserMasterSkeleton,
  loader: async () => {
    const data = await getUserMasterPageData()

    if (!data.authorized) {
      throw redirect({ to: '/login' })
    }

    // Preserve existing UserMaster prop shape to avoid UI changes
    const usersData = {
      authorized: true as const,
      users: data.users,
      roles: data.roles,
      currentAdmin: data.currentAdmin,
    }
    const permissionsData = {
      authorized: true as const,
      permissions: data.permissions,
      roles: data.rolesWithPerms,
      currentAdmin: data.currentAdmin,
    }

    return {
      usersData,
      permissionsData,
    }
  },
  head: () => ({
    meta: [
      { title: 'User Master & RBAC | AccentCRM' },
      {
        name: 'description',
        content: 'Administrator user management and permissions matrix.',
      },
    ],
  }),
  component: UserMasterRoute,
})

function UserMasterRoute() {
  const { usersData, permissionsData } = Route.useLoaderData()

  return (
    <div className="h-full" data-route="user-master">
      <UserMaster
        initialUsers={usersData.users}
        roles={usersData.roles}
        permissionsData={permissionsData}
        currentAdminEmail={usersData.currentAdmin?.email}
      />
    </div>
  )
}
