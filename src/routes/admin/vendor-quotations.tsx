import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
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
  const { location } = useRouterState()
  const isChild = location.pathname.startsWith('/admin/vendor-quotations/new') || (location.pathname.startsWith('/admin/vendor-quotations/') && location.pathname !== '/admin/vendor-quotations')
  if (isChild) return <Outlet />
  return (
    <div className="h-full" data-route="admin-vendor-quotations">
      <VendorQuotationsPage initialData={initialData} />
    </div>
  )
}
