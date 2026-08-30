import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import {
  createClientPurchaseOrderForCookie,
  deleteClientPurchaseOrderForCookie,
  getClientPurchaseOrderDetailForCookie,
  getClientPurchaseOrdersPageDataForCookie,
  updateClientPurchaseOrderForCookie,
  updateClientPurchaseOrderStatusForCookie,
} from './client-purchase-orders.server'
import {
  clientPurchaseOrderIdSchema,
  clientPurchaseOrderInputSchema,
  clientPurchaseOrderStatusUpdateSchema,
  clientPurchaseOrderUpdateSchema,
} from './client-purchase-orders'

// ── Reads ──────────────────────────────────────────────────────────────────
export const getClientPurchaseOrdersPageData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return getClientPurchaseOrdersPageDataForCookie(getRequestHeader('cookie'))
})

export const getClientPurchaseOrderDetailData = createServerFn({ method: 'GET' })
  .validator(clientPurchaseOrderIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return getClientPurchaseOrderDetailForCookie(data.id, getRequestHeader('cookie'))
  })

// ── Mutations ──────────────────────────────────────────────────────────────
export const createClientPurchaseOrderAction = createServerFn({ method: 'POST' })
  .validator(clientPurchaseOrderInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await createClientPurchaseOrderForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create purchase order.' }
    }
  })

export const updateClientPurchaseOrderAction = createServerFn({ method: 'POST' })
  .validator(clientPurchaseOrderUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await updateClientPurchaseOrderForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to save purchase order.' }
    }
  })

export const updateClientPurchaseOrderStatusAction = createServerFn({ method: 'POST' })
  .validator(clientPurchaseOrderStatusUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await updateClientPurchaseOrderStatusForCookie(data.id, data.status, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update status.' }
    }
  })

export const deleteClientPurchaseOrderAction = createServerFn({ method: 'POST' })
  .validator(clientPurchaseOrderIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteClientPurchaseOrderForCookie(data.id, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete purchase order.' }
    }
  })
