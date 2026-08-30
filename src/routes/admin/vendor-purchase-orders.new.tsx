import { createFileRoute } from '@tanstack/react-router'
import VendorPurchaseOrderForm from '~/crm/pages/VendorPurchaseOrderForm'
import { getVendorPurchaseOrdersPageData } from '~/lib/vendor-purchase-orders.functions'

export const Route = createFileRoute('/admin/vendor-purchase-orders/new')({
  ssr: true,
  loader: () => getVendorPurchaseOrdersPageData(),
  head: () => ({ meta: [{ title: 'New Vendor Purchase Order | AccentCRM' }] }),
  component: NewVendorPoRoute,
})

function NewVendorPoRoute() {
  const data = Route.useLoaderData()

  if (!data.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            You need permissions to create vendor purchase orders.
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
            You need write permissions to create a vendor purchase order.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full" data-route="vendor-purchase-orders-new">
      <VendorPurchaseOrderForm initial={null} options={data.options} />
    </div>
  )
}
