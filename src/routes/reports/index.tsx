import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import Reports from '~/crm/pages/Reports'
import { getCrmSnapshot } from '~/lib/crm.functions'

const reportSearchSchema = z.object({
  view: z
    .enum([
      'overview',
      'employee',
      'timesheet',
      'manhours',
      'balances',
      'project-status',
      'attendance',
    ])
    .catch('overview')
    .default('overview'),
})

export const Route = createFileRoute('/reports/')({
  ssr: true,
  validateSearch: reportSearchSchema,
  loader: () => getCrmSnapshot(),
  head: () => ({
    meta: [
      { title: 'Reporting Center | AccentCRM' },
      {
        name: 'description',
        content: 'Enterprise engineering analytics and reporting dashboards.',
      },
    ],
  }),
  component: ReportsRoute,
})

function ReportsRoute() {
  const snapshot = Route.useLoaderData()
  return (
    <div
      className="h-full"
      data-route="reports"
      data-runtime={snapshot.environment}
    >
      <Reports />
    </div>
  )
}
