import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import { getQuotationDocumentForCookie, getQuotationsPageDataForCookie } from './quotations.server'
import { proposalIdSchema } from './proposals'

// ── Reads ────────────────────────────────────────────────────────────────
export const getQuotationsPageData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return getQuotationsPageDataForCookie(getRequestHeader('cookie'))
})

export const getQuotationDocumentData = createServerFn({ method: 'GET' })
  .validator(proposalIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return getQuotationDocumentForCookie(data.id, getRequestHeader('cookie'))
  })
