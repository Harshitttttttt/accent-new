import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import ClientPurchaseOrdersPage from '~/crm/pages/ClientPurchaseOrders'
import { getClientPurchaseOrdersPageData } from '~/lib/client-purchase-orders.functions'

export const Route = createFileRoute('/admin/client-purchase-orders')({
  ssr: true,
  loader: () => getClientPurchaseOrdersPageData(),
  head: () => ({ meta: [{ title: 'Client Purchase Orders | AccentCRM' }] }),
  component: ClientPurchaseOrdersRoute,
})

function ClientPurchaseOrdersRoute() {
  const initialData = Route.useLoaderData()
  const { location } = useRouterState()
  const isChild =
    location.pathname.startsWith('/admin/client-purchase-orders/new') ||
    (location.pathname.startsWith('/admin/client-purchase-orders/') &&
      location.pathname !== '/admin/client-purchase-orders')

  if (isChild) return <Outlet />

  return (
    <div className="h-full" data-route="admin-client-purchase-orders">
      <ClientPurchaseOrdersPage initialData={initialData} />
    </div>
  )
}
