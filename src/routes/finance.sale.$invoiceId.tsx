import { createFileRoute } from '@tanstack/react-router'
import SaleInvoiceForm from '~/crm/pages/SaleInvoiceForm'
import { getSaleInvoiceDetailData } from '~/lib/invoices.functions'

export const Route = createFileRoute('/finance/sale/$invoiceId')({
  ssr: 'data-only',
  loader: ({ params }) => getSaleInvoiceDetailData({ data: { id: params.invoiceId } }),
  component: SaleEditRoute,
})

function SaleEditRoute() {
  const data = Route.useLoaderData()
  if (!data.authorized || !data.invoice) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>{!data.authorized ? 'Sign in required' : 'Invoice not found'}</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{!data.authorized ? 'You need proposals.read.' : 'The invoice may have been deleted.'}</p>
        </div>
      </div>
    )
  }
  if (!data.canWrite) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>No write access</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>You need proposals.write to edit.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="h-full" data-route="finance-sale-edit">
      <SaleInvoiceForm initial={data.invoice} options={data.options} />
    </div>
  )
}
