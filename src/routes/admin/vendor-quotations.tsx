import { createFileRoute } from '@tanstack/react-router'
import VendorQuotationsPage from '~/crm/pages/VendorQuotations'
import { getVendorQuotationsPageData } from '~/lib/vendor-quotations.functions'

export const Route = createFileRoute('/admin/vendor-quotations')({
  ssr: true,
  loader: () => getVendorQuotationsPageData(),
  head: () => ({ meta: [{ title: 'Vendor Quotations | AccentCRM' }] }),
  component: VendorQuotationsRoute,
})

function VendorQuotationsRoute() {
  const initialData = Route.useLoaderData()
  return (
    <div className="h-full" data-route="admin-vendor-quotations">
      <VendorQuotationsPage initialData={initialData} />
    </div>
  )
}
