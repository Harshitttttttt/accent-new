import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/quotation-outgoing')({
  ssr: true,
  loader: () => {
    throw redirect({ to: '/admin/vendor-quotations' })
  },
})
