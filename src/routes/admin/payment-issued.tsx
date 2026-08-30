import { createFileRoute } from '@tanstack/react-router'
import PaymentsReleasedPage from '~/crm/pages/PaymentsReleased'
import { getPaymentsReleasedPageData } from '~/lib/payments-released.functions'

export const Route = createFileRoute('/admin/payment-issued')({
  ssr: true,
  loader: () => getPaymentsReleasedPageData(),
  head: () => ({ meta: [{ title: 'Payment Released to Client | AccentCRM' }] }),
  component: PaymentIssuedRoute,
})

function PaymentIssuedRoute() {
  const initialData = Route.useLoaderData()

  return (
    <div className="h-full" data-route="admin-payment-issued">
      <PaymentsReleasedPage initialData={initialData} />
    </div>
  )
}
