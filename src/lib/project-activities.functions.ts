import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import {
  createAssignmentForCookie,
  createAssignmentLogForCookie,
  deleteAssignmentForCookie,
  deleteAssignmentLogForCookie,
  getActivityMasterTree,
  listProjectAssignmentsForCookie,
  listProjectWorkLogsForCookie,
  updateAssignmentForCookie,
} from './project-activities.server'
import {
  assignmentLogIdSchema,
  createAssignmentLogSchema,
  createAssignmentSchema,
  listWorkLogsSchema,
  updateAssignmentSchema,
} from './project-activities'
import { z } from 'zod'

// ── Reads ────────────────────────────────────────────────────────────────
export const getActivityMasterTreeData = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'private, max-age=300')
  return getActivityMasterTree()
})

export const getProjectAssignments = createServerFn({ method: 'GET' })
  .validator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return listProjectAssignmentsForCookie(data.projectId, getRequestHeader('cookie'))
  })

export const getProjectWorkLogs = createServerFn({ method: 'GET' })
  .validator(listWorkLogsSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'private, no-store')
    return listProjectWorkLogsForCookie(data.projectId, data.startDate, data.endDate, data.assigneeId, getRequestHeader('cookie'))
  })

// ── Mutations ────────────────────────────────────────────────────────────
export const createAssignmentAction = createServerFn({ method: 'POST' })
  .validator(createAssignmentSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await createAssignmentForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to assign activity.' }
    }
  })

export const updateAssignmentAction = createServerFn({ method: 'POST' })
  .validator(updateAssignmentSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await updateAssignmentForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update assignment.' }
    }
  })

export const deleteAssignmentAction = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteAssignmentForCookie(data.id, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to remove assignment.' }
    }
  })

export const createAssignmentLogAction = createServerFn({ method: 'POST' })
  .validator(createAssignmentLogSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const result = await createAssignmentLogForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: result }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to log work.' }
    }
  })

export const deleteAssignmentLogAction = createServerFn({ method: 'POST' })
  .validator(assignmentLogIdSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteAssignmentLogForCookie(data.id, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete work log.' }
    }
  })
