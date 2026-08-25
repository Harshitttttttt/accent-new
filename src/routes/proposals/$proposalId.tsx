import { createFileRoute } from '@tanstack/react-router'
import ProposalDetailPage from '~/crm/pages/ProposalDetail'
import { getProposalDetailData } from '~/lib/proposals.functions'

export const Route = createFileRoute('/proposals/$proposalId')({
  ssr: true,
  loader: ({ params }) => getProposalDetailData({ data: { id: params.proposalId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.proposal
          ? `${loaderData.proposal.proposalNumber} ${loaderData.proposal.title} | AccentCRM`
          : 'Proposal | AccentCRM',
      },
    ],
  }),
  component: ProposalDetailRoute,
})

function ProposalDetailRoute() {
  const initialData = Route.useLoaderData()
  return (
    <div className="h-full" data-route="proposal-detail">
      <ProposalDetailPage initialData={initialData} />
    </div>
  )
}
