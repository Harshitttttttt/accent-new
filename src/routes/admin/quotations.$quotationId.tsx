import { createFileRoute } from '@tanstack/react-router'
import QuotationDocumentPage from '~/crm/pages/QuotationDocument'
import { getQuotationDocumentData } from '~/lib/quotations.functions'

export const Route = createFileRoute('/admin/quotations/$quotationId')({
  ssr: true,
  loader: ({ params }) => getQuotationDocumentData({ data: { id: params.quotationId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.quotation
          ? `Quotation ${loaderData.quotation.proposalNumber} | AccentCRM`
          : 'Quotation | AccentCRM',
      },
    ],
  }),
  component: QuotationDocumentRoute,
})

function QuotationDocumentRoute() {
  const initialData = Route.useLoaderData()
  return (
    <div className="h-full" data-route="admin-quotation-document">
      <QuotationDocumentPage initialData={initialData} />
    </div>
  )
}
