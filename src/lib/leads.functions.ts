import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import {
  createLeadForCookie,
  deleteLeadForCookie,
  getLeadsPageDataForCookie,
  updateLeadForCookie,
  updateLeadStageForCookie,
} from './leads.server'
import { deleteLeadSchema, leadInputSchema, updateLeadSchema, updateLeadStageSchema } from './leads'

// ── Read ─────────────────────────────────────────────────────────────────
export const getLeadsPageData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return getLeadsPageDataForCookie(getRequestHeader('cookie'))
})

// ── Mutations ────────────────────────────────────────────────────────────
export const createLeadAction = createServerFn({ method: 'POST' })
  .validator(leadInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await createLeadForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create lead.' }
    }
  })

export const updateLeadStageAction = createServerFn({ method: 'POST' })
  .validator(updateLeadStageSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await updateLeadStageForCookie(data.id, data.stage, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to move lead.' }
    }
  })

export const updateLeadAction = createServerFn({ method: 'POST' })
  .validator(updateLeadSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await updateLeadForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update lead.' }
    }
  })

export const deleteLeadAction = createServerFn({ method: 'POST' })
  .validator(deleteLeadSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteLeadForCookie(data.id, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete lead.' }
    }
  })
