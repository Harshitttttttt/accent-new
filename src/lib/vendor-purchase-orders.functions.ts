import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import {
  createVendorPurchaseOrderForCookie,
  deleteVendorPurchaseOrderForCookie,
  getVendorPurchaseOrderDetailForCookie,
  getVendorPurchaseOrdersPageDataForCookie,
  updateVendorPurchaseOrderForCookie,
  updateVendorPurchaseOrderStatusForCookie,
} from './vendor-purchase-orders.server'
import {
  vendorPurchaseOrderIdSchema,
  vendorPurchaseOrderInputSchema,
  vendorPurchaseOrderStatusUpdateSchema,
  vendorPurchaseOrderUpdateSchema,
} from './vendor-purchase-orders'

// ── Reads ──────────────────────────────────────────────────────────────────
export const getVendorPurchaseOrdersPageData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return getVendorPurchaseOrdersPageDataForCookie(getRequestHeader('cookie'))
})

export const getVendorPurchaseOrderDetailData = createServerFn({ method: 'GET' })
  .validator(vendorPurchaseOrderIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return getVendorPurchaseOrderDetailForCookie(data.id, getRequestHeader('cookie'))
  })

// ── Mutations ──────────────────────────────────────────────────────────────
export const createVendorPurchaseOrderAction = createServerFn({ method: 'POST' })
  .validator(vendorPurchaseOrderInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await createVendorPurchaseOrderForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create vendor purchase order.' }
    }
  })

export const updateVendorPurchaseOrderAction = createServerFn({ method: 'POST' })
  .validator(vendorPurchaseOrderUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await updateVendorPurchaseOrderForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to save vendor purchase order.' }
    }
  })

export const updateVendorPurchaseOrderStatusAction = createServerFn({ method: 'POST' })
  .validator(vendorPurchaseOrderStatusUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await updateVendorPurchaseOrderStatusForCookie(data.id, data.status, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update status.' }
    }
  })

export const deleteVendorPurchaseOrderAction = createServerFn({ method: 'POST' })
  .validator(vendorPurchaseOrderIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteVendorPurchaseOrderForCookie(data.id, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete vendor purchase order.' }
    }
  })
