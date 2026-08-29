import { createFileRoute } from '@tanstack/react-router'
import QuotationDocumentPage from '~/crm/pages/QuotationDocument'
import { getClientQuotationDocumentData } from '~/lib/client-quotations.functions'

export const Route = createFileRoute('/admin/client-quotations/$quotationId')({
  ssr: true,
  loader: ({ params }) => getClientQuotationDocumentData({ data: { id: params.quotationId } }),
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
  return <QuotationDocumentPage initialData={initialData} />
}
