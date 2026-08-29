import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
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

function cookieHeader(): string | undefined {
  try { return getRequest()?.headers.get('cookie') ?? undefined } catch { return undefined }
}
async function requireWriteUserId(): Promise<string> {
  const sid = parseSessionCookie(cookieHeader())
  const session = sid ? await findSessionById(sid) : null
  if (!session) throw new Error('Not authenticated.')
  if (!(await userHasPermission(session.user.id, 'proposals.write'))) throw new Error('Missing proposals.write permission.')
  return session.user.id
}

export const getInvoicesPageData = createServerFn({ method: 'GET' }).handler(async () => {
  return getInvoicesPageDataForCookie(cookieHeader())
})
export const getSaleInvoiceDetailData = createServerFn({ method: 'GET' }).inputValidator(saleInvoiceIdSchema).handler(async ({ data }) => {
  return getSaleInvoiceDetailForCookie(data.id, cookieHeader())
})
export const getPurchaseInvoiceDetailData = createServerFn({ method: 'GET' }).inputValidator(purchaseInvoiceIdSchema).handler(async ({ data }) => {
  return getPurchaseInvoiceDetailForCookie(data.id, cookieHeader())
})

export const createSaleInvoiceAction = createServerFn({ method: 'POST' }).inputValidator(saleInvoiceInputSchema).handler(async ({ data }) => {
  const userId = await requireWriteUserId()
  const result = await createSaleInvoice(data, userId)
  return { ok: true as const, ...result }
})
export const updateSaleInvoiceAction = createServerFn({ method: 'POST' }).inputValidator(saleInvoiceInputSchema.extend({ id: saleInvoiceIdSchema.shape.id })).handler(async ({ data }) => {
  const userId = await requireWriteUserId()
  await updateSaleInvoice(data, userId)
  return { ok: true as const }
})
export const createPurchaseInvoiceAction = createServerFn({ method: 'POST' }).inputValidator(purchaseInvoiceInputSchema).handler(async ({ data }) => {
  const userId = await requireWriteUserId()
  const result = await createPurchaseInvoice(data, userId)
  return { ok: true as const, ...result }
})
export const updatePurchaseInvoiceAction = createServerFn({ method: 'POST' }).inputValidator(purchaseInvoiceInputSchema.extend({ id: purchaseInvoiceIdSchema.shape.id })).handler(async ({ data }) => {
  const userId = await requireWriteUserId()
  await updatePurchaseInvoice(data, userId)
  return { ok: true as const }
})

export const updateSaleStatusAction = createServerFn({ method: 'POST' }).inputValidator(saleStatusUpdateSchema).handler(async ({ data }) => {
  await requireWriteUserId()
  await updateSaleInvoiceStatus(data.id, data.status)
  return { ok: true as const }
})
export const updatePurchaseStatusAction = createServerFn({ method: 'POST' }).inputValidator(purchaseStatusUpdateSchema).handler(async ({ data }) => {
  await requireWriteUserId()
  await updatePurchaseInvoiceStatus(data.id, data.status)
  return { ok: true as const }
})

export const deleteSaleInvoiceAction = createServerFn({ method: 'POST' }).inputValidator(saleInvoiceIdSchema).handler(async ({ data }) => {
  const userId = await requireWriteUserId()
  await softDeleteSaleInvoice(data.id, userId)
  return { ok: true as const }
})
export const deletePurchaseInvoiceAction = createServerFn({ method: 'POST' }).inputValidator(purchaseInvoiceIdSchema).handler(async ({ data }) => {
  const userId = await requireWriteUserId()
  await softDeletePurchaseInvoice(data.id, userId)
  return { ok: true as const }
})
