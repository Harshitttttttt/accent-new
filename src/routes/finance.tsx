import { createFileRoute } from '@tanstack/react-router'
import FinancialDashboard from '~/crm/pages/FinancialDashboard'
import { getCrmSnapshot } from '~/lib/crm.functions'

export const Route = createFileRoute('/finance')({
  ssr: 'data-only',
  loader: () => getCrmSnapshot(),
  pendingComponent: FinancePending,
  component: FinanceRoute,
})

function FinanceRoute() {
  const snapshot = Route.useLoaderData()

  return (
    <div className="h-full" data-route="finance" data-balance={snapshot.outstandingBalance}>
      <FinancialDashboard />
    </div>
  )
}

function FinancePending() {
  return (
    <div className="grid h-full place-items-center bg-[var(--bg)] text-sm text-[var(--text-muted)]">
      Preparing the finance dashboard…
    </div>
  )
}
