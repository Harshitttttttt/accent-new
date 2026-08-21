import { createFileRoute } from '@tanstack/react-router'
import EmployeeProfile from '~/crm/pages/EmployeeProfile'
import { useCrmNavigation } from '~/crm/navigation'
import { getCrmSnapshot } from '~/lib/crm.functions'

export const Route = createFileRoute('/employees/$employeeId')({
  ssr: true,
  loader: ({ params }) =>
    getCrmSnapshot().then((snapshot) => ({
      ...snapshot,
      employeeId: params.employeeId,
    })),
  head: ({ params }) => ({
    meta: [
      {
        title: `${params.employeeId.replaceAll('-', ' ')} Profile | AccentCRM`,
      },
    ],
  }),
  component: EmployeeProfileRoute,
})

function EmployeeProfileRoute() {
  const navigate = useCrmNavigation()
  const data = Route.useLoaderData()

  return (
    <div
      className="h-full"
      data-route="employee-profile"
      data-employee-id={data.employeeId}
    >
      <EmployeeProfile onNavigate={navigate} />
    </div>
  )
}
