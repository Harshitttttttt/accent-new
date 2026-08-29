import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import {
  createVendorQuotationForCookie,
  deleteVendorQuotationForCookie,
  getVendorQuotationDetailForCookie,
  getVendorQuotationsPageDataForCookie,
  updateVendorQuotationForCookie,
  updateVendorQuotationStatusForCookie,
} from './vendor-quotations.server'
import {
  vendorQuotationIdSchema,
  vendorQuotationInputSchema,
  vendorQuotationStatusUpdateSchema,
  vendorQuotationUpdateSchema,
} from './vendor-quotations'

// ── Reads ────────────────────────────────────────────────────────────────
export const getVendorQuotationsPageData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return getVendorQuotationsPageDataForCookie(getRequestHeader('cookie'))
})

export const getVendorQuotationDetailData = createServerFn({ method: 'GET' })
  .validator(vendorQuotationIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return getVendorQuotationDetailForCookie(data.id, getRequestHeader('cookie'))
  })

// ── Mutations ────────────────────────────────────────────────────────────
export const createVendorQuotationAction = createServerFn({ method: 'POST' })
  .validator(vendorQuotationInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await createVendorQuotationForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create quotation.' }
    }
  })

export const updateVendorQuotationAction = createServerFn({ method: 'POST' })
  .validator(vendorQuotationUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await updateVendorQuotationForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to save quotation.' }
    }
  })

export const updateVendorQuotationStatusAction = createServerFn({ method: 'POST' })
  .validator(vendorQuotationStatusUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await updateVendorQuotationStatusForCookie(data.id, data.status, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update status.' }
    }
  })

export const deleteVendorQuotationAction = createServerFn({ method: 'POST' })
  .validator(vendorQuotationIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteVendorQuotationForCookie(data.id, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete quotation.' }
    }
  })
