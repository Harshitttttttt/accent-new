import { createFileRoute } from '@tanstack/react-router'
import SupportTickets from '~/crm/pages/SupportTickets'
import { getSupportTicketsPageData } from '~/lib/support-tickets.functions'

export const Route = createFileRoute('/support')({
  ssr: true,
  loader: () => getSupportTicketsPageData(),
  component: SupportRoute,
})

function SupportRoute() {
  const initialData = Route.useLoaderData()
  return (
    <div className="h-full" data-route="support">
      <SupportTickets initialData={initialData} />
    </div>
  )
}
