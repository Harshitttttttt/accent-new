import { createFileRoute } from '@tanstack/react-router'
import Leads from '~/crm/pages/Leads'
import { getLeadsPageData } from '~/lib/leads.functions'

export const Route = createFileRoute('/leads')({
  ssr: true,
  loader: () => getLeadsPageData(),
  component: LeadsRoute,
})

function LeadsRoute() {
  const initialData = Route.useLoaderData()
  return (
    <div className="h-full" data-route="leads">
      <Leads initialData={initialData} />
    </div>
  )
}
