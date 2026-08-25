import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import {
  addProposalCommentForCookie,
  addProposalFollowUpForCookie,
  convertLeadToProposalForCookie,
  createProposalForCookie,
  deleteProposalForCookie,
  getProposalDetailForCookie,
  getProposalsPageDataForCookie,
  setProposalFollowUpDoneForCookie,
  updateProposalForCookie,
  updateProposalStatusForCookie,
} from './proposals.server'
import { convertProposalToProjectForCookie } from './projects.server'
import {
  convertLeadToProposalSchema,
  proposalCommentInputSchema,
  proposalFollowUpInputSchema,
  proposalFollowUpToggleSchema,
  proposalIdSchema,
  proposalStatusUpdateSchema,
  proposalUpdateSchema,
} from './proposals'

// ── Reads ────────────────────────────────────────────────────────────────
export const getProposalsPageData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return getProposalsPageDataForCookie(getRequestHeader('cookie'))
})

export const getProposalDetailData = createServerFn({ method: 'GET' })
  .validator(proposalIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return getProposalDetailForCookie(data.id, getRequestHeader('cookie'))
  })

// ── Mutations ────────────────────────────────────────────────────────────
export const createProposalAction = createServerFn({ method: 'POST' }).handler(async () => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await createProposalForCookie(
      { title: 'Untitled proposal', companyName: 'Unnamed company' },
      getRequestHeader('cookie'),
    )
    return { ok: true as const, data: { id: row.id, proposalNumber: row.proposalNumber } }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create proposal.' }
  }
})

export const convertLeadToProposalAction = createServerFn({ method: 'POST' })
  .validator(convertLeadToProposalSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await convertLeadToProposalForCookie(data.leadId, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to convert lead.' }
    }
  })

export const convertProposalToProjectAction = createServerFn({ method: 'POST' })
  .validator(proposalIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await convertProposalToProjectForCookie(data.id, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to convert proposal.' }
    }
  })

export const updateProposalAction = createServerFn({ method: 'POST' })
  .validator(proposalUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await updateProposalForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to save proposal.' }
    }
  })

export const updateProposalStatusAction = createServerFn({ method: 'POST' })
  .validator(proposalStatusUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await updateProposalStatusForCookie(data.id, data.status, data.note ?? null, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update status.' }
    }
  })

export const addProposalFollowUpAction = createServerFn({ method: 'POST' })
  .validator(proposalFollowUpInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await addProposalFollowUpForCookie(data.proposalId, data.dueDate, data.note, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to add follow-up.' }
    }
  })

export const toggleProposalFollowUpAction = createServerFn({ method: 'POST' })
  .validator(proposalFollowUpToggleSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await setProposalFollowUpDoneForCookie(data.id, data.done, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update follow-up.' }
    }
  })

export const addProposalCommentAction = createServerFn({ method: 'POST' })
  .validator(proposalCommentInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await addProposalCommentForCookie(data.proposalId, data.body, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to add comment.' }
    }
  })

export const deleteProposalAction = createServerFn({ method: 'POST' })
  .validator(proposalIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteProposalForCookie(data.id, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete proposal.' }
    }
  })
