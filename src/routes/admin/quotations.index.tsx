import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/quotations/')({
  ssr: true,
  loader: () => {
    throw redirect({ to: '/admin/client-quotations' })
  },
})
