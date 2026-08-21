import { createFileRoute } from '@tanstack/react-router'
import Messages from '~/crm/pages/Messages'

export const Route = createFileRoute('/messages')({
  ssr: true,
  component: MessagesRoute,
})

function MessagesRoute() {
  return (
    <div className="h-full" data-route="messages">
      <Messages />
    </div>
  )
}
