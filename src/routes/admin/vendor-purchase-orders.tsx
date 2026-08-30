import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import VendorPurchaseOrdersPage from '~/crm/pages/VendorPurchaseOrders'
import { getVendorPurchaseOrdersPageData } from '~/lib/vendor-purchase-orders.functions'

export const Route = createFileRoute('/admin/vendor-purchase-orders')({
  ssr: true,
  loader: () => getVendorPurchaseOrdersPageData(),
  head: () => ({ meta: [{ title: 'Vendor Purchase Orders | AccentCRM' }] }),
  component: VendorPurchaseOrdersRoute,
})

function VendorPurchaseOrdersRoute() {
  const initialData = Route.useLoaderData()
  const { location } = useRouterState()
  const isChild =
    location.pathname.startsWith('/admin/vendor-purchase-orders/new') ||
    (location.pathname.startsWith('/admin/vendor-purchase-orders/') &&
      location.pathname !== '/admin/vendor-purchase-orders')

  if (isChild) return <Outlet />

  return (
    <div className="h-full" data-route="admin-vendor-purchase-orders">
      <VendorPurchaseOrdersPage initialData={initialData} />
    </div>
  )
}
