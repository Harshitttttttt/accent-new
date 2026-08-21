import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import {
  createCompanyEmailForCookie,
  createCompanyForCookie,
  createContactForCookie,
  deleteCompanyEmailForCookie,
  deleteCompanyForCookie,
  deleteContactForCookie,
  getCompanyMasterDataForCookie,
  setPrimaryContactForCookie,
  updateCompanyEmailForCookie,
  updateCompanyForCookie,
  updateContactForCookie,
} from './server'

// ── Read ───────────────────────────────────────────────────────────────
export const getCompanyMasterPageData = createServerFn({ method: 'GET' }).handler(async () => {
  const cookie = getRequestHeader('cookie')
  const data = await getCompanyMasterDataForCookie(cookie)
  if (!data.authorized) {
    setResponseHeader('Cache-Control', 'private, no-store')
    return { authorized: false as const, companies: [], stats: { total: 0, active: 0, inactive: 0, totalContacts: 0, totalEmails: 0, industries: 0 } }
  }
  setResponseHeader('Cache-Control', 'private, max-age=60, must-revalidate')
  return { authorized: true as const, companies: data.companies, stats: data.stats, currentUserId: data.currentUserId }
})

// ── Company validation ─────────────────────────────────────────────────
const companySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with -/_')
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(255),
  legalName: z.string().trim().max(255).optional().nullable(),
  website: z.string().trim().max(255).optional().nullable(),
  industry: z.string().trim().max(100).optional().nullable(),
  gstin: z.string().trim().max(15).optional().nullable(),
  pan: z.string().trim().max(10).optional().nullable(),
  addressLine1: z.string().trim().max(500).optional().nullable(),
  addressLine2: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  inquiryEmail: z.string().trim().max(255).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  accountManagerId: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
})

export const createCompanyAction = createServerFn({ method: 'POST' })
  .validator(companySchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await createCompanyForCookie(
        {
          code: data.code,
          name: data.name,
          legalName: data.legalName ?? null,
          website: data.website ?? null,
          industry: data.industry ?? null,
          gstin: data.gstin ?? null,
          pan: data.pan ?? null,
          addressLine1: data.addressLine1 ?? null,
          addressLine2: data.addressLine2 ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          country: data.country ?? null,
          postalCode: data.postalCode ?? null,
          inquiryEmail: data.inquiryEmail ?? null,
          notes: data.notes ?? null,
          accountManagerId: data.accountManagerId ?? null,
          status: data.status,
        },
        getRequestHeader('cookie'),
      )
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create company.' }
    }
  })

export const updateCompanyAction = createServerFn({ method: 'POST' })
  .validator(companySchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await updateCompanyForCookie(
        {
          id: data.id,
          code: data.code,
          name: data.name,
          legalName: data.legalName ?? null,
          website: data.website ?? null,
          industry: data.industry ?? null,
          gstin: data.gstin ?? null,
          pan: data.pan ?? null,
          addressLine1: data.addressLine1 ?? null,
          addressLine2: data.addressLine2 ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          country: data.country ?? null,
          postalCode: data.postalCode ?? null,
          inquiryEmail: data.inquiryEmail ?? null,
          notes: data.notes ?? null,
          accountManagerId: data.accountManagerId ?? null,
          status: data.status,
        },
        getRequestHeader('cookie'),
      )
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update company.' }
    }
  })

export const deleteCompanyAction = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteCompanyForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete company.' }
    }
  })

// ── Contacts ───────────────────────────────────────────────────────────
const contactSchema = z.object({
  companyId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().max(255).optional().nullable().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Invalid email' }),
  phone: z.string().trim().max(50).optional().nullable(),
  designation: z.string().trim().max(100).optional().nullable(),
  isPrimary: z.boolean().default(false),
})

export const createContactAction = createServerFn({ method: 'POST' })
  .validator(contactSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await createContactForCookie(
        {
          companyId: data.companyId,
          firstName: data.firstName,
          lastName: data.lastName ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          designation: data.designation ?? null,
          isPrimary: data.isPrimary ?? false,
        },
        getRequestHeader('cookie'),
      )
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create contact.' }
    }
  })

export const updateContactAction = createServerFn({ method: 'POST' })
  .validator(contactSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await updateContactForCookie(
        {
          id: data.id,
          companyId: data.companyId,
          firstName: data.firstName,
          lastName: data.lastName ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          designation: data.designation ?? null,
          isPrimary: data.isPrimary ?? false,
        },
        getRequestHeader('cookie'),
      )
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update contact.' }
    }
  })

export const deleteContactAction = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteContactForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete contact.' }
    }
  })

export const setPrimaryContactAction = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await setPrimaryContactForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to set primary contact.' }
    }
  })

// ── Company Emails ─────────────────────────────────────────────────────
const companyEmailSchema = z.object({
  companyId: z.string().uuid(),
  email: z.string().trim().min(1).max(255).email(),
  type: z.string().trim().max(50).optional().nullable(),
})

export const createCompanyEmailAction = createServerFn({ method: 'POST' })
  .validator(companyEmailSchema)
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await createCompanyEmailForCookie(
        { companyId: data.companyId, email: data.email, type: data.type ?? null },
        getRequestHeader('cookie'),
      )
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create company email.' }
    }
  })

export const updateCompanyEmailAction = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid(), email: z.string().trim().min(1).max(255).email(), type: z.string().trim().max(50).optional().nullable() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      const row = await updateCompanyEmailForCookie({ id: data.id, email: data.email, type: data.type ?? null }, getRequestHeader('cookie'))
      return { ok: true as const, data: row }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update company email.' }
    }
  })

export const deleteCompanyEmailAction = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    try {
      await deleteCompanyEmailForCookie(data, getRequestHeader('cookie'))
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete company email.' }
    }
  })

