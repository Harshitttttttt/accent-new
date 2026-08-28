import { createFileRoute } from '@tanstack/react-router'
import ClientQuotationsPage from '~/crm/pages/ClientQuotations'
import { getClientQuotationsPageData } from '~/lib/client-quotations.functions'

export const Route = createFileRoute('/admin/client-quotations/')({
  ssr: true,
  loader: () => getClientQuotationsPageData(),
  head: () => ({ meta: [{ title: 'Client Quotations | AccentCRM' }] }),
  component: ClientQuotationsRoute,
})

function ClientQuotationsRoute() {
  const initialData = Route.useLoaderData()
  return (
    <div className="h-full" data-route="admin-client-quotations">
      <ClientQuotationsPage initialData={initialData} />
    </div>
  )
}
