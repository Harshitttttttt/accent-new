import { createFileRoute } from '@tanstack/react-router'
import Reports from '~/crm/pages/Reports'
import { getCrmSnapshot } from '~/lib/crm.functions'

const REPORT_TITLES: Record<string, string> = {
  'reports-employee': 'Employee Report',
  'reports-timesheet': 'Timesheet Report',
  'reports-manhours': 'Manhours Billing',
  'reports-balances': 'Outstanding Balances',
  'reports-project-status': 'Project Status Report',
  'reports-attendance': 'Attendance Report',
}

export const Route = createFileRoute('/reports/$report')({
  ssr: true,
  loader: () => getCrmSnapshot(),
  head: ({ params }) => {
    const title =
      REPORT_TITLES[params.report] ??
      `${params.report.replaceAll('-', ' ')} Report`
    return {
      meta: [{ title: `${title} | AccentCRM` }],
    }
  },
  component: ReportDetailRoute,
})

function ReportDetailRoute() {
  const { report } = Route.useParams()
  const snapshot = Route.useLoaderData()

  return (
    <div
      className="h-full"
      data-route="report-detail"
      data-report={report}
      data-runtime={snapshot.environment}
    >
      <Reports />
    </div>
  )
}
