import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import InvoicesPage from '~/crm/pages/Invoices'
import { getInvoicesPageData } from '~/lib/invoices.functions'

export const Route = createFileRoute('/finance')({
  ssr: 'data-only',
  loader: () => getInvoicesPageData(),
  pendingComponent: FinancePending,
  component: FinanceRoute,
})

function FinanceRoute() {
  const payload = Route.useLoaderData()
  const { location } = useRouterState()
  // When a nested finance child is active (/finance/sale/* or /finance/purchase/*), render the child's Outlet
  // instead of the list. This keeps /finance as the list while enabling dedicated full-page forms
  // without the modal anti-pattern.
  const isChild = location.pathname.startsWith('/finance/sale') || location.pathname.startsWith('/finance/purchase')
  if (isChild) return <Outlet />
  return (
    <div className="h-full" data-route="finance">
      <InvoicesPage initialData={payload} />
    </div>
  )
}

function FinancePending() {
  return (
    <div className="grid h-full place-items-center bg-[var(--bg)] text-sm text-[var(--text-muted)]">
      Preparing invoices…
    </div>
  )
}
