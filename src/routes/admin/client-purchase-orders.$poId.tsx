import { createFileRoute } from '@tanstack/react-router'
import ClientPurchaseOrderForm from '~/crm/pages/ClientPurchaseOrderForm'
import { getClientPurchaseOrderDetailData } from '~/lib/client-purchase-orders.functions'

export const Route = createFileRoute('/admin/client-purchase-orders/$poId')({
  ssr: true,
  loader: ({ params }) => getClientPurchaseOrderDetailData({ data: { id: params.poId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.order
          ? `${loaderData.order.orderNumber} | AccentCRM`
          : 'Client Purchase Order | AccentCRM',
      },
    ],
  }),
  component: EditClientPoRoute,
})

function EditClientPoRoute() {
  const data = Route.useLoaderData()

  if (!data.order) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Order Not Found</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            The requested client purchase order could not be found or you may not have access.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full" data-route="client-purchase-orders-edit">
      <ClientPurchaseOrderForm initial={data.order} options={data.options} />
    </div>
  )
}
