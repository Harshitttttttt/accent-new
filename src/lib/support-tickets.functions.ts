import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import {
  addTicketCommentForCookie,
  assignTicketForCookie,
  createSupportTicketForCookie,
  deleteSupportTicketForCookie,
  getSupportTicketDetailForCookie,
  getSupportTicketsPageDataForCookie,
  updateSupportTicketForCookie,
  updateTicketStatusForCookie,
} from './support-tickets.server'
import {
  addTicketCommentSchema,
  assignTicketSchema,
  createTicketSchema,
  deleteTicketSchema,
  updateTicketSchema,
  updateTicketStatusSchema,
} from './support-tickets'
import { z } from 'zod'

// ── Read Endpoints ─────────────────────────────────────────────────────────
export const getSupportTicketsPageData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return getSupportTicketsPageDataForCookie(getRequestHeader('cookie'))
})

export const getSupportTicketDetailData = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return getSupportTicketDetailForCookie(data.id, getRequestHeader('cookie'))
  })

// ── Mutation Endpoints ─────────────────────────────────────────────────────
export const createSupportTicketAction = createServerFn({ method: 'POST' })
  .validator(createTicketSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await createSupportTicketForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return {
        ok: false as const,
        message: e instanceof Error ? e.message : 'Failed to create support ticket.',
      }
    }
  })

export const updateSupportTicketAction = createServerFn({ method: 'POST' })
  .validator(updateTicketSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await updateSupportTicketForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return {
        ok: false as const,
        message: e instanceof Error ? e.message : 'Failed to update support ticket.',
      }
    }
  })

export const updateTicketStatusAction = createServerFn({ method: 'POST' })
  .validator(updateTicketStatusSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await updateTicketStatusForCookie(
        data.id,
        data.status,
        data.resolutionNotes,
        getRequestHeader('cookie'),
      )
      return { ok: true as const, data: row }
    } catch (e) {
      return {
        ok: false as const,
        message: e instanceof Error ? e.message : 'Failed to update ticket status.',
      }
    }
  })

export const assignTicketAction = createServerFn({ method: 'POST' })
  .validator(assignTicketSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await assignTicketForCookie(
        data.id,
        data.assignedTo,
        getRequestHeader('cookie'),
      )
      return { ok: true as const, data: row }
    } catch (e) {
      return {
        ok: false as const,
        message: e instanceof Error ? e.message : 'Failed to assign ticket.',
      }
    }
  })

export const addTicketCommentAction = createServerFn({ method: 'POST' })
  .validator(addTicketCommentSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const comment = await addTicketCommentForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: comment }
    } catch (e) {
      return {
        ok: false as const,
        message: e instanceof Error ? e.message : 'Failed to post comment.',
      }
    }
  })

export const deleteSupportTicketAction = createServerFn({ method: 'POST' })
  .validator(deleteTicketSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteSupportTicketForCookie(data.id, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return {
        ok: false as const,
        message: e instanceof Error ? e.message : 'Failed to delete ticket.',
      }
    }
  })
