import { createFileRoute } from '@tanstack/react-router'
import ProjectsPage from '~/crm/pages/Projects'
import { getProjectsPageData } from '~/lib/projects.functions'

export const Route = createFileRoute('/projects/')({
  ssr: true,
  loader: () => getProjectsPageData(),
  head: () => ({
    meta: [{ title: 'Projects Portfolio | AccentCRM' }],
  }),
  component: ProjectsRoute,
})

function ProjectsRoute() {
  const initialData = Route.useLoaderData()
  return (
    <div className="h-full" data-route="projects">
      <ProjectsPage initialData={initialData} />
    </div>
  )
}
