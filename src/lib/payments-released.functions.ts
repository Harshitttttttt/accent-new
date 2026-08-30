import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import {
  paymentReleasedIdSchema,
  paymentReleasedInputSchema,
  paymentReleasedStatusUpdateSchema,
  paymentReleasedUpdateSchema,
  type PaymentReleasedDetail,
  type PaymentsReleasedPagePayload,
} from './payments-released'
import {
  approvePaymentReleased,
  createPaymentReleased,
  deletePaymentReleased,
  loadPaymentReleasedDetailData,
  loadPaymentsReleasedPageData,
  resolvePaymentsReleasedSession,
  updatePaymentReleased,
  updatePaymentReleasedStatus,
} from './payments-released.server'

export const getPaymentsReleasedPageData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PaymentsReleasedPagePayload> => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const cookie = getRequestHeader('cookie')
    return loadPaymentsReleasedPageData(cookie)
  },
)

export const getPaymentReleasedDetailData = createServerFn({ method: 'POST' })
  .validator((data: unknown) => paymentReleasedIdSchema.parse(data))
  .handler(async ({ data }): Promise<{ payment: PaymentReleasedDetail | null }> => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return loadPaymentReleasedDetailData(data.id)
  })

export const createPaymentReleasedAction = createServerFn({ method: 'POST' })
  .validator((data: unknown) => paymentReleasedInputSchema.parse(data))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const cookie = getRequestHeader('cookie')
    const { user, canWrite } = await resolvePaymentsReleasedSession(cookie)

    if (!canWrite) {
      return { ok: false, message: 'You do not have permission to release payments.' }
    }

    return createPaymentReleased(data, user)
  })

export const approvePaymentReleasedAction = createServerFn({ method: 'POST' })
  .validator((data: unknown) => paymentReleasedIdSchema.parse(data))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const cookie = getRequestHeader('cookie')
    const { user, canWrite, isAdmin } = await resolvePaymentsReleasedSession(cookie)

    if (!canWrite && !isAdmin) {
      return { ok: false, message: 'You do not have permission to approve payment releases.' }
    }

    return approvePaymentReleased(data.id, user)
  })

export const updatePaymentReleasedAction = createServerFn({ method: 'POST' })
  .validator((data: unknown) => paymentReleasedUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const cookie = getRequestHeader('cookie')
    const { user, canWrite } = await resolvePaymentsReleasedSession(cookie)

    if (!canWrite) {
      return { ok: false, message: 'You do not have permission to edit payment releases.' }
    }

    return updatePaymentReleased(data, user)
  })

export const updatePaymentReleasedStatusAction = createServerFn({ method: 'POST' })
  .validator((data: unknown) => paymentReleasedStatusUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const cookie = getRequestHeader('cookie')
    const { user, canWrite } = await resolvePaymentsReleasedSession(cookie)

    if (!canWrite) {
      return { ok: false, message: 'You do not have permission to update payment release status.' }
    }

    return updatePaymentReleasedStatus(data.id, data.status, user)
  })

export const deletePaymentReleasedAction = createServerFn({ method: 'POST' })
  .validator((data: unknown) => paymentReleasedIdSchema.parse(data))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const cookie = getRequestHeader('cookie')
    const { user, canWrite } = await resolvePaymentsReleasedSession(cookie)

    if (!canWrite) {
      return { ok: false, message: 'You do not have permission to delete payment releases.' }
    }

    return deletePaymentReleased(data.id, user)
  })
