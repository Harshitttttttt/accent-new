import { createFileRoute } from '@tanstack/react-router'
import VendorQuotationForm from '~/crm/pages/VendorQuotationForm'
import { getVendorQuotationsPageData } from '~/lib/vendor-quotations.functions'

export const Route = createFileRoute('/admin/vendor-quotations/new')({
  ssr: true,
  loader: () => getVendorQuotationsPageData(),
  head: () => ({ meta: [{ title: 'New Vendor Quotation | AccentCRM' }] }),
  component: NewRoute,
})

function NewRoute() {
  const data = Route.useLoaderData()
  if (!data.authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>Sign in required</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>You need proposals.read to create quotations.</p>
        </div>
      </div>
    )
  }
  if (!data.canWrite) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 420 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700 }}>No write access</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>You need proposals.write.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="h-full" data-route="vendor-quotations-new">
      <VendorQuotationForm initial={null} options={data.options} />
    </div>
  )
}
