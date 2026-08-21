import { createFileRoute } from '@tanstack/react-router'
import EmployeeDirectory from '~/crm/pages/EmployeeDirectory'
import { useCrmNavigation } from '~/crm/navigation'
import { getEmployeeSnapshot } from '~/lib/crm.functions'
import { employeeSearchSchema } from '~/lib/crm'

export const Route = createFileRoute('/employees/')({
  ssr: true,
  validateSearch: employeeSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getEmployeeSnapshot({ data: deps }),
  head: () => ({
    meta: [
      { title: 'Employee Master | AccentCRM' },
      {
        name: 'description',
        content:
          'Staff directory, engineering designations, and department allocation.',
      },
    ],
  }),
  component: EmployeesRoute,
})

function EmployeesRoute() {
  const navigate = useCrmNavigation()
  const snapshot = Route.useLoaderData()

  return (
    <div
      className="h-full"
      data-route="employees"
      data-total-employees={snapshot.total}
    >
      <EmployeeDirectory onNavigate={navigate} />
    </div>
  )
}
