import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import {
  createActivityForCookie,
  createDisciplineForCookie,
  createSubActivityForCookie,
  deleteActivityForCookie,
  deleteDisciplineForCookie,
  deleteSubActivityForCookie,
  getActivityMasterDataForCookie,
  updateActivityForCookie,
  updateDisciplineForCookie,
  updateSubActivityForCookie,
} from './server'

// ── Read ──────────────────────────────────────────────────────────
export const getActivityMasterPageData = createServerFn({ method: 'GET' }).handler(async () => {
  const cookie = getRequestHeader('cookie')
  const data = await getActivityMasterDataForCookie(cookie)
  if (!data.authorized) {
    setResponseHeader('Cache-Control', 'private, no-store')
    return { authorized: false as const, disciplines: [], activities: [], subActivities: [] }
  }
  setResponseHeader('Cache-Control', 'private, max-age=60, must-revalidate')
  return { authorized: true as const, disciplines: data.disciplines, activities: data.activities, subActivities: data.subActivities, currentUserId: data.currentUserId }
})

// ── Disciplines ───────────────────────────────────────────────────
const disciplineSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with -/_')
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const createDisciplineAction = createServerFn({ method: 'POST' })
  .validator(disciplineSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await createDisciplineForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create discipline.' }
    }
  })

export const updateDisciplineAction = createServerFn({ method: 'POST' })
  .validator(disciplineSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await updateDisciplineForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update discipline.' }
    }
  })

export const deleteDisciplineAction = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteDisciplineForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete discipline.' }
    }
  })

// ── Activities ────────────────────────────────────────────────────
const activitySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with -/_')
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).optional().nullable(),
  disciplineId: z.string().uuid(),
  unit: z.string().trim().max(50).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const createActivityAction = createServerFn({ method: 'POST' })
  .validator(activitySchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await createActivityForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create activity.' }
    }
  })

export const updateActivityAction = createServerFn({ method: 'POST' })
  .validator(activitySchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await updateActivityForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update activity.' }
    }
  })

export const deleteActivityAction = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteActivityForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete activity.' }
    }
  })

// ── Sub-Activities ────────────────────────────────────────────────
const subActivitySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with -/_')
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).optional().nullable(),
  activityId: z.string().uuid(),
  unit: z.string().trim().max(50).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const createSubActivityAction = createServerFn({ method: 'POST' })
  .validator(subActivitySchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await createSubActivityForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create sub-activity.' }
    }
  })

export const updateSubActivityAction = createServerFn({ method: 'POST' })
  .validator(subActivitySchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await updateSubActivityForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update sub-activity.' }
    }
  })

export const deleteSubActivityAction = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteSubActivityForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete sub-activity.' }
    }
  })

