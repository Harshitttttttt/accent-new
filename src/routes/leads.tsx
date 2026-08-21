import { createFileRoute } from '@tanstack/react-router'
import Leads from '~/crm/pages/Leads'
import { getCrmSnapshot } from '~/lib/crm.functions'

export const Route = createFileRoute('/leads')({
  ssr: true,
  loader: () => getCrmSnapshot(),
  component: LeadsRoute,
})

function LeadsRoute() {
  const snapshot = Route.useLoaderData()
  return (
    <div className="h-full" data-route="leads" data-open-leads={snapshot.openLeads}>
      <Leads />
    </div>
  )
}
