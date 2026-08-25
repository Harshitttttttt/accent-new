import { createFileRoute } from '@tanstack/react-router'
import ProposalsPage from '~/crm/pages/Proposals'
import { getProposalsPageData } from '~/lib/proposals.functions'

export const Route = createFileRoute('/proposals/')({
  ssr: true,
  loader: () => getProposalsPageData(),
  component: ProposalsRoute,
})

function ProposalsRoute() {
  const initialData = Route.useLoaderData()
  return (
    <div className="h-full" data-route="proposals">
      <ProposalsPage initialData={initialData} />
    </div>
  )
}
