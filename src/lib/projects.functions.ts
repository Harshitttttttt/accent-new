import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import {
  addProjectCommentForCookie,
  convertProposalToProjectForCookie,
  createProjectForCookie,
  deleteProjectForCookie,
  getProjectDetailForCookie,
  getProjectsPageDataForCookie,
  updateProjectForCookie,
  updateProjectStatusForCookie,
} from './projects.server'
import {
  convertProposalToProjectSchema,
  projectCommentInputSchema,
  projectIdSchema,
  projectStatusUpdateSchema,
  projectUpdateSchema,
} from './projects'

// ── Reads ────────────────────────────────────────────────────────────────
export const getProjectsPageData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return getProjectsPageDataForCookie(getRequestHeader('cookie'))
})

export const getProjectDetailData = createServerFn({ method: 'GET' })
  .validator(projectIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return getProjectDetailForCookie(data.id, getRequestHeader('cookie'))
  })

// ── Mutations ────────────────────────────────────────────────────────────
export const createProjectAction = createServerFn({ method: 'POST' }).handler(async () => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await createProjectForCookie(
      { name: 'Untitled project', companyName: 'Unnamed client' },
      getRequestHeader('cookie'),
    )
    return { ok: true as const, data: { id: row.id, projectNumber: row.projectNumber } }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create project.' }
  }
})

export const convertProposalToProjectAction = createServerFn({ method: 'POST' })
  .validator(convertProposalToProjectSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await convertProposalToProjectForCookie(data.proposalId, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to convert proposal.' }
    }
  })

export const updateProjectAction = createServerFn({ method: 'POST' })
  .validator(projectUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await updateProjectForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to save project.' }
    }
  })

export const updateProjectStatusAction = createServerFn({ method: 'POST' })
  .validator(projectStatusUpdateSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await updateProjectStatusForCookie(data.id, data.status, data.note ?? null, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update status.' }
    }
  })

export const addProjectCommentAction = createServerFn({ method: 'POST' })
  .validator(projectCommentInputSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await addProjectCommentForCookie(data.projectId, data.body, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to add comment.' }
    }
  })

export const deleteProjectAction = createServerFn({ method: 'POST' })
  .validator(projectIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteProjectForCookie(data.id, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete project.' }
    }
  })
