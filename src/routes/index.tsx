import { Await, createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import Dashboard from '~/crm/pages/Dashboard'
import { useCrmNavigation } from '~/crm/navigation'
import { getCrmActivity, getCrmSnapshot, getDatabaseHealth } from '~/lib/crm.functions'

export const Route = createFileRoute('/')({
  ssr: true,
  loader: async () => ({
    snapshot: await getCrmSnapshot(),
    activity: getCrmActivity({ data: { limit: 4 } }),
    database: getDatabaseHealth(),
  }),
  component: DashboardRoute,
})

function DashboardRoute() {
  const navigate = useCrmNavigation()
  const { snapshot, activity, database } = Route.useLoaderData()

  // eslint-disable-next-line no-console -- temporary debug logging
  console.log('[DashboardRoute] CRM snapshot', { generatedAt: snapshot.generatedAt })

  return (
    <div
      className="relative h-full"
      data-route="dashboard"
      data-snapshot-generated-at={snapshot.generatedAt}
    >
      <Dashboard onNavigate={navigate} />
      <div className="pointer-events-none absolute bottom-4 right-5 z-10 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--text-muted)] shadow-sm">
        <Suspense fallback={<span>checking database…</span>}>
          <Await promise={database}>
            {(health) => (
              <>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${health.connected ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`}
                  aria-hidden="true"
                />
                <span>{health.connected ? 'Neon connected' : 'Neon unavailable'}</span>
              </>
            )}
          </Await>
        </Suspense>
        <span className="text-[var(--border)]" aria-hidden="true">·</span>
        <span>{snapshot.activeProjects} active projects</span>
        <span className="text-[var(--border)]" aria-hidden="true">·</span>
        <Suspense fallback={<span>syncing activity…</span>}>
          <Await promise={activity}>
            {(items) => <span>{items.length} live events streamed</span>}
          </Await>
        </Suspense>
      </div>
    </div>
  )
}
