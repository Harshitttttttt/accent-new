import { createFileRoute } from '@tanstack/react-router'
import VendorQuotationForm from '~/crm/pages/VendorQuotationForm'
import { getVendorQuotationDetailData } from '~/lib/vendor-quotations.functions'

export const Route = createFileRoute('/admin/vendor-quotations/$quotationId')({
  ssr: true,
  loader: ({ params }) => getVendorQuotationDetailData({ data: { id: params.quotationId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.quotation ? `${loaderData.quotation.quotationNumber} | AccentCRM` : 'Vendor Quotation | AccentCRM' }],
  }),
  component: EditRoute,
})

function EditRoute() {
  const data = Route.useLoaderData()
  if (!data.authorized || !data.quotation) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>{!data.authorized ? 'Sign in required' : 'Quotation not found'}</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{!data.authorized ? 'You need proposals.read.' : 'It may have been deleted.'}</p>
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
    <div className="h-full" data-route="vendor-quotations-edit">
      <VendorQuotationForm initial={data.quotation} options={data.options} />
    </div>
  )
}
