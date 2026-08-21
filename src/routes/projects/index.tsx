import { createFileRoute } from '@tanstack/react-router'
import Projects from '~/crm/pages/Projects'
import { useCrmNavigation } from '~/crm/navigation'
import { getCrmSnapshot } from '~/lib/crm.functions'

export const Route = createFileRoute('/projects/')({
  ssr: true,
  loader: () => getCrmSnapshot(),
  head: () => ({
    meta: [
      { title: 'Projects Portfolio | AccentCRM' },
      {
        name: 'description',
        content: 'Engineering projects portfolio and schedules.',
      },
    ],
  }),
  component: ProjectsRoute,
})

function ProjectsRoute() {
  const navigate = useCrmNavigation()
  const snapshot = Route.useLoaderData()

  return (
    <div
      className="h-full"
      data-route="projects"
      data-active-projects={snapshot.activeProjects}
    >
      <Projects onNavigate={navigate} />
    </div>
  )
}
