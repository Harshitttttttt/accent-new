import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import { getClientQuotationDocumentForCookie, getClientQuotationsPageDataForCookie } from './client-quotations.server'
import { proposalIdSchema } from './proposals'

// ── Reads ────────────────────────────────────────────────────────────────
export const getClientQuotationsPageData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return getClientQuotationsPageDataForCookie(getRequestHeader('cookie'))
})

export const getClientQuotationDocumentData = createServerFn({ method: 'GET' })
  .validator(proposalIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return getClientQuotationDocumentForCookie(data.id, getRequestHeader('cookie'))
  })


// ── Legacy aliases ──
/** @deprecated use getClientQuotationsPageData */
export const getQuotationsPageData = getClientQuotationsPageData
/** @deprecated use getClientQuotationDocumentData */
export const getQuotationDocumentData = getClientQuotationDocumentData

