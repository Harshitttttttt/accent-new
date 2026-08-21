import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import {
  createSoftwareForCookie,
  deleteSoftwareForCookie,
  getSoftwareMastersForCookie,
  updateSoftwareForCookie,
} from './server'

export const getSoftwareMasterPageData = createServerFn({ method: 'GET' }).handler(async () => {
  const cookie = getRequestHeader('cookie')
  const data = await getSoftwareMastersForCookie(cookie)
  if (!data.authorized) {
    setResponseHeader('Cache-Control', 'private, no-store')
    return { authorized: false as const, data: [], stats: { total: 0, active: 0, expiringSoon: 0, totalCostPaise: 0, totalLicenses: 0 } }
  }
  setResponseHeader('Cache-Control', 'private, max-age=60, must-revalidate')
  return { authorized: true as const, data: data.data, stats: data.stats }
})

const softwareSchema = z
  .object({
    code: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with -/_').transform((v) => v.toUpperCase()),
    name: z.string().trim().min(2).max(150),
    vendor: z.string().trim().max(150).optional().nullable(),
    version: z.string().trim().max(50).optional().nullable(),
    licenseType: z.string().trim().max(50).optional().nullable(),
    totalLicenses: z.coerce.number().int().min(1).max(10000),
    usedLicenses: z.coerce.number().int().min(0).max(10000).default(0),
    costPaise: z.coerce.number().int().min(0),
    costRupeesInput: z.string().optional(),
    currency: z.string().trim().max(10).default('INR'),
    purchaseDate: z.string().trim().optional().nullable(),
    expiryDate: z.string().trim().optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine((d) => (d.usedLicenses ?? 0) <= d.totalLicenses, { message: 'Used cannot exceed total', path: ['usedLicenses'] })
  .refine((d) => !d.purchaseDate || !d.expiryDate || new Date(d.expiryDate) > new Date(d.purchaseDate), { message: 'Expiry must be after purchase', path: ['expiryDate'] })

function toPaiseFromInput(input: unknown, fallback: number): number {
  if (typeof input === 'number') return Math.round(input)
  if (typeof input === 'string' && input.trim()) {
    // input is rupees string like "125000.50" -> paise
    const n = Number(input.replace(/,/g, ''))
    if (!Number.isNaN(n)) return Math.round(n * 100)
  }
  return fallback
}

export const createSoftwareAction = createServerFn({ method: 'POST' })
  .validator(softwareSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const costPaise = data.costPaise ?? toPaiseFromInput(data.costRupeesInput, 0)
      const row = await createSoftwareForCookie(
        {
          code: data.code,
          name: data.name,
          vendor: data.vendor ?? null,
          version: data.version ?? null,
          licenseType: data.licenseType ?? null,
          totalLicenses: data.totalLicenses,
          usedLicenses: data.usedLicenses ?? 0,
          costPaise,
          currency: data.currency ?? 'INR',
          purchaseDate: data.purchaseDate ?? null,
          expiryDate: data.expiryDate ?? null,
          description: data.description ?? null,
          isActive: data.isActive ?? true,
        },
        getRequestHeader('cookie'),
      )
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create software.' }
    }
  })

export const updateSoftwareAction = createServerFn({ method: 'POST' })
  .validator(softwareSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const costPaise = data.costPaise ?? toPaiseFromInput(data.costRupeesInput, 0)
      const row = await updateSoftwareForCookie(
        {
          id: data.id,
          code: data.code,
          name: data.name,
          vendor: data.vendor ?? null,
          version: data.version ?? null,
          licenseType: data.licenseType ?? null,
          totalLicenses: data.totalLicenses,
          usedLicenses: data.usedLicenses ?? 0,
          costPaise,
          currency: data.currency ?? 'INR',
          purchaseDate: data.purchaseDate ?? null,
          expiryDate: data.expiryDate ?? null,
          description: data.description ?? null,
          isActive: data.isActive ?? true,
        },
        getRequestHeader('cookie'),
      )
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update software.' }
    }
  })

export const deleteSoftwareAction = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteSoftwareForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete software.' }
    }
  })

