import { createFileRoute } from '@tanstack/react-router'
import VendorQuotationsPage from '~/crm/pages/VendorQuotations'
import { getVendorQuotationsPageData } from '~/lib/vendor-quotations.functions'

export const Route = createFileRoute('/admin/quotation-outgoing')({
  ssr: true,
  loader: () => getVendorQuotationsPageData(),
  head: () => ({ meta: [{ title: 'Quotation (Incoming) | AccentCRM' }] }),
  component: VendorQuotationsRoute,
})

function VendorQuotationsRoute() {
  const initialData = Route.useLoaderData()
  return (
    <div className="h-full" data-route="admin-quotation-outgoing">
      <VendorQuotationsPage initialData={initialData} />
    </div>
  )
}
