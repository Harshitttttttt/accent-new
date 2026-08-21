import { createFileRoute } from '@tanstack/react-router'
import Proposals from '~/crm/pages/Proposals'
import { getCrmSnapshot } from '~/lib/crm.functions'

export const Route = createFileRoute('/proposals')({
  ssr: true,
  loader: () => getCrmSnapshot(),
  component: ProposalsRoute,
})

function ProposalsRoute() {
  const snapshot = Route.useLoaderData()
  return (
    <div className="h-full" data-route="proposals" data-pending-proposals={snapshot.pendingProposals}>
      <Proposals />
    </div>
  )
}
