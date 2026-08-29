import { createFileRoute } from '@tanstack/react-router'
import PurchaseInvoiceForm from '~/crm/pages/PurchaseInvoiceForm'
import { getInvoicesPageData } from '~/lib/invoices.functions'

export const Route = createFileRoute('/finance/purchase/new')({
  ssr: 'data-only',
  loader: () => getInvoicesPageData(),
  component: PurchaseNewRoute,
})

function PurchaseNewRoute() {
  const data = Route.useLoaderData()
  if (!data.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>You need <strong>proposals.read</strong> to create invoices.</p>
        </div>
      </div>
    )
  }
  if (!data.canWrite) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>No write access</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>You need <strong>proposals.write</strong>.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="h-full" data-route="finance-purchase-new">
      <PurchaseInvoiceForm initial={null} options={data.options} />
    </div>
  )
}
