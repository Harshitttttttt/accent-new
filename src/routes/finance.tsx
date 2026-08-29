import { createFileRoute } from '@tanstack/react-router'
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
