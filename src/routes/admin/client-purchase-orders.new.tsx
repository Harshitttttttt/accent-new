import { createFileRoute } from '@tanstack/react-router'
import ClientPurchaseOrderForm from '~/crm/pages/ClientPurchaseOrderForm'
import { getClientPurchaseOrdersPageData } from '~/lib/client-purchase-orders.functions'

export const Route = createFileRoute('/admin/client-purchase-orders/new')({
  ssr: true,
  loader: () => getClientPurchaseOrdersPageData(),
  head: () => ({ meta: [{ title: 'New Client Purchase Order | AccentCRM' }] }),
  component: NewClientPoRoute,
})

function NewClientPoRoute() {
  const data = Route.useLoaderData()

  if (!data.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            You need permissions to create client purchase orders.
          </p>
        </div>
      </div>
    )
  }

  if (!data.canWrite) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>No write access</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            You need write permissions to create a client purchase order.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full" data-route="client-purchase-orders-new">
      <ClientPurchaseOrderForm initial={null} options={data.options} />
    </div>
  )
}
