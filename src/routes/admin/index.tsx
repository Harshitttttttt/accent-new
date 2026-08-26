import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  ssr: true,
  loader: () => {
    throw redirect({ to: '/admin/quotations' })
  },
})
