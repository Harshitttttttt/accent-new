import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import {
  createPurchaseInvoice,
  createSaleInvoice,
  getInvoicesPageDataForCookie,
  getPurchaseInvoiceDetailForCookie,
  getSaleInvoiceDetailForCookie,
  softDeletePurchaseInvoice,
  softDeleteSaleInvoice,
  updatePurchaseInvoice,
  updatePurchaseInvoiceStatus,
  updateSaleInvoice,
  updateSaleInvoiceStatus,
} from './invoices.server'
import {
  purchaseInvoiceInputSchema,
  purchaseStatusUpdateSchema,
  saleInvoiceInputSchema,
  saleStatusUpdateSchema,
  saleInvoiceIdSchema,
  purchaseInvoiceIdSchema,
} from './invoices'
import { findSessionById, parseSessionCookie, userHasPermission } from './auth.server'

async function requireWriteUserId(): Promise<string> {
  const sid = parseSessionCookie(getRequestHeader('cookie'))
  const session = sid ? await findSessionById(sid) : null
  if (!session) throw new Error('Not authenticated.')
  if (!(await userHasPermission(session.user.id, 'proposals.write'))) throw new Error('Missing proposals.write permission.')
  return session.user.id
}

export const getInvoicesPageData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return getInvoicesPageDataForCookie(getRequestHeader('cookie'))
})

export const getSaleInvoiceDetailData = createServerFn({ method: 'GET' })
  .validator(saleInvoiceIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return getSaleInvoiceDetailForCookie(data.id, getRequestHeader('cookie'))
  })

export const getPurchaseInvoiceDetailData = createServerFn({ method: 'GET' })
  .validator(purchaseInvoiceIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return getPurchaseInvoiceDetailForCookie(data.id, getRequestHeader('cookie'))
  })

export const createSaleInvoiceAction = createServerFn({ method: 'POST' })
  .validator(saleInvoiceInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const userId = await requireWriteUserId()
    const result = await createSaleInvoice(data, userId)
    return { ok: true as const, ...result }
  })

export const updateSaleInvoiceAction = createServerFn({ method: 'POST' })
  .validator(saleInvoiceInputSchema.extend({ id: saleInvoiceIdSchema.shape.id }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const userId = await requireWriteUserId()
    await updateSaleInvoice(data, userId)
    return { ok: true as const }
  })

export const createPurchaseInvoiceAction = createServerFn({ method: 'POST' })
  .validator(purchaseInvoiceInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const userId = await requireWriteUserId()
    const result = await createPurchaseInvoice(data, userId)
    return { ok: true as const, ...result }
  })

export const updatePurchaseInvoiceAction = createServerFn({ method: 'POST' })
  .validator(purchaseInvoiceInputSchema.extend({ id: purchaseInvoiceIdSchema.shape.id }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const userId = await requireWriteUserId()
    await updatePurchaseInvoice(data, userId)
    return { ok: true as const }
  })

export const updateSaleStatusAction = createServerFn({ method: 'POST' })
  .validator(saleStatusUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    await requireWriteUserId()
    await updateSaleInvoiceStatus(data.id, data.status)
    return { ok: true as const }
  })

export const updatePurchaseStatusAction = createServerFn({ method: 'POST' })
  .validator(purchaseStatusUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    await requireWriteUserId()
    await updatePurchaseInvoiceStatus(data.id, data.status)
    return { ok: true as const }
  })

export const deleteSaleInvoiceAction = createServerFn({ method: 'POST' })
  .validator(saleInvoiceIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const userId = await requireWriteUserId()
    await softDeleteSaleInvoice(data.id, userId)
    return { ok: true as const }
  })

export const deletePurchaseInvoiceAction = createServerFn({ method: 'POST' })
  .validator(purchaseInvoiceIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const userId = await requireWriteUserId()
    await softDeletePurchaseInvoice(data.id, userId)
    return { ok: true as const }
  })
