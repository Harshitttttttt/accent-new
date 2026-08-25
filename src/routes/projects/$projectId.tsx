import { createFileRoute } from '@tanstack/react-router'
import ProjectDetailPage from '~/crm/pages/ProjectDetail'
import { getProjectDetailData } from '~/lib/projects.functions'

export const Route = createFileRoute('/projects/$projectId')({
  ssr: true,
  loader: ({ params }) => getProjectDetailData({ data: { id: params.projectId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.project
          ? `${loaderData.project.projectNumber} ${loaderData.project.name} | AccentCRM`
          : 'Project | AccentCRM',
      },
    ],
  }),
  component: ProjectDetailRoute,
})

function ProjectDetailRoute() {
  const initialData = Route.useLoaderData()
  return (
    <div className="h-full" data-route="project-detail">
      <ProjectDetailPage initialData={initialData} />
    </div>
  )
}
