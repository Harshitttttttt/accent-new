import { createFileRoute } from '@tanstack/react-router'
import Tasks from '~/crm/pages/Tasks'

export const Route = createFileRoute('/tasks')({
  ssr: true,
  component: TasksRoute,
})

function TasksRoute() {
  return (
    <div className="h-full" data-route="tasks">
      <Tasks />
    </div>
  )
}
