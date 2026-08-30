import { createFileRoute } from '@tanstack/react-router'
import PaymentsReceivedPage from '~/crm/pages/PaymentsReceived'
import { getPaymentsReceivedPageData } from '~/lib/payments-received.functions'

export const Route = createFileRoute('/admin/payment-received')({
  ssr: true,
  loader: () => getPaymentsReceivedPageData(),
  head: () => ({ meta: [{ title: 'Payment Received from Client | AccentCRM' }] }),
  component: PaymentReceivedRoute,
})

function PaymentReceivedRoute() {
  const initialData = Route.useLoaderData()

  return (
    <div className="h-full" data-route="admin-payment-received">
      <PaymentsReceivedPage initialData={initialData} />
    </div>
  )
}
