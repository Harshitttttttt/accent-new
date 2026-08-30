import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import {
  paymentReceivedIdSchema,
  paymentReceivedInputSchema,
  paymentReceivedStatusUpdateSchema,
  paymentReceivedUpdateSchema,
  type PaymentReceivedDetail,
  type PaymentsReceivedPagePayload,
} from './payments-received'
import {
  createPaymentReceived,
  deletePaymentReceived,
  loadPaymentReceivedDetailData,
  loadPaymentsReceivedPageData,
  resolvePaymentsReceivedSession,
  updatePaymentReceived,
  updatePaymentReceivedStatus,
} from './payments-received.server'

export const getPaymentsReceivedPageData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PaymentsReceivedPagePayload> => {
    setResponseHeader('Cache-Control', 'private, no-store')
    const cookie = getRequestHeader('cookie')
    return loadPaymentsReceivedPageData(cookie)
  },
)

export const getPaymentReceivedDetailData = createServerFn({ method: 'POST' })
  .validator((data: unknown) => paymentReceivedIdSchema.parse(data))
  .handler(async ({ data }): Promise<{ payment: PaymentReceivedDetail | null }> => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return loadPaymentReceivedDetailData(data.id)
  })

export const createPaymentReceivedAction = createServerFn({ method: 'POST' })
  .validator((data: unknown) => paymentReceivedInputSchema.parse(data))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const cookie = getRequestHeader('cookie')
    const { user, canWrite } = await resolvePaymentsReceivedSession(cookie)

    if (!canWrite) {
      return { ok: false, message: 'You do not have permission to record payments.' }
    }

    return createPaymentReceived(data, user)
  })

export const updatePaymentReceivedAction = createServerFn({ method: 'POST' })
  .validator((data: unknown) => paymentReceivedUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const cookie = getRequestHeader('cookie')
    const { user, canWrite } = await resolvePaymentsReceivedSession(cookie)

    if (!canWrite) {
      return { ok: false, message: 'You do not have permission to edit payments.' }
    }

    return updatePaymentReceived(data, user)
  })

export const updatePaymentReceivedStatusAction = createServerFn({ method: 'POST' })
  .validator((data: unknown) => paymentReceivedStatusUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const cookie = getRequestHeader('cookie')
    const { user, canWrite } = await resolvePaymentsReceivedSession(cookie)

    if (!canWrite) {
      return { ok: false, message: 'You do not have permission to update payment status.' }
    }

    return updatePaymentReceivedStatus(data.id, data.status, user)
  })

export const deletePaymentReceivedAction = createServerFn({ method: 'POST' })
  .validator((data: unknown) => paymentReceivedIdSchema.parse(data))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const cookie = getRequestHeader('cookie')
    const { user, canWrite } = await resolvePaymentsReceivedSession(cookie)

    if (!canWrite) {
      return { ok: false, message: 'You do not have permission to delete payments.' }
    }

    return deletePaymentReceived(data.id, user)
  })
