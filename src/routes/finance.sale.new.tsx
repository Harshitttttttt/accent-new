import { createFileRoute } from '@tanstack/react-router'
import SaleInvoiceForm from '~/crm/pages/SaleInvoiceForm'
import { getInvoicesPageData } from '~/lib/invoices.functions'

export const Route = createFileRoute('/finance/sale/new')({
  ssr: 'data-only',
  loader: () => getInvoicesPageData(),
  component: SaleNewRoute,
})

function SaleNewRoute() {
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
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>You need <strong>proposals.write</strong> to create sale invoices.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="h-full" data-route="finance-sale-new">
      <SaleInvoiceForm initial={null} options={data.options} />
    </div>
  )
}
