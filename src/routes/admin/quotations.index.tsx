import { createFileRoute } from '@tanstack/react-router'
import QuotationsPage from '~/crm/pages/Quotations'
import { getQuotationsPageData } from '~/lib/quotations.functions'

export const Route = createFileRoute('/admin/quotations/')({
  ssr: true,
  loader: () => getQuotationsPageData(),
  head: () => ({ meta: [{ title: 'Quotations | AccentCRM' }] }),
  component: QuotationsRoute,
})

function QuotationsRoute() {
  const initialData = Route.useLoaderData()
  return (
    <div className="h-full" data-route="admin-quotations">
      <QuotationsPage initialData={initialData} />
    </div>
  )
}
