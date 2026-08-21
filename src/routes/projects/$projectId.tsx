import { createFileRoute, Link } from '@tanstack/react-router'
import ProjectDetail from '~/crm/pages/ProjectDetail'
import { useCrmNavigation } from '~/crm/navigation'
import { getProjectSnapshot } from '~/lib/crm.functions'

export const Route = createFileRoute('/projects/$projectId')({
  ssr: true,
  loader: ({ params }) =>
    getProjectSnapshot({ data: { id: params.projectId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} | AccentCRM`
          : 'Project Detail | AccentCRM',
      },
    ],
  }),
  component: ProjectDetailRoute,
})

function ProjectDetailRoute() {
  const navigate = useCrmNavigation()
  const project = Route.useLoaderData()

  if (!project) {
    return (
      <div className="grid h-full place-items-center bg-[var(--bg)] p-8 text-center">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--brand-primary)]">
            Project not found
          </p>
          <h1 className="m-0 text-2xl font-semibold text-[var(--text-primary)]">
            That project is not in the workspace.
          </h1>
          <Link className="btn-secondary mt-5" to="/projects">
            Back to projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-full"
      data-route="project-detail"
      data-project-id={project.id}
    >
      <ProjectDetail onNavigate={navigate} />
    </div>
  )
}
