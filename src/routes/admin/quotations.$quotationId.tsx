import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/quotations/$quotationId')({
  ssr: true,
  loader: ({ params }) => {
    throw redirect({ to: '/admin/client-quotations/$quotationId', params: { quotationId: params.quotationId } })
  },
})
