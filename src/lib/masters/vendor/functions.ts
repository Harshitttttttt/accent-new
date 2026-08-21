import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import {
  createVendorContactForCookie,
  createVendorEmailForCookie,
  createVendorForCookie,
  deleteVendorContactForCookie,
  deleteVendorEmailForCookie,
  deleteVendorForCookie,
  getVendorMasterDataForCookie,
  setPrimaryVendorContactForCookie,
  updateVendorContactForCookie,
  updateVendorEmailForCookie,
  updateVendorForCookie,
} from './server'

// ── Read ───────────────────────────────────────────────────────────────
export const getVendorMasterPageData = createServerFn({ method: 'GET' }).handler(async () => {
  const cookie = getRequestHeader('cookie')
  const data = await getVendorMasterDataForCookie(cookie)
  if (!data.authorized) {
    setResponseHeader('Cache-Control', 'private, no-store')
    return { authorized: false as const, vendors: [], stats: { total: 0, active: 0, inactive: 0, blacklisted: 0, totalContacts: 0, totalEmails: 0, categories: 0 } }
  }
  setResponseHeader('Cache-Control', 'private, max-age=60, must-revalidate')
  return { authorized: true as const, vendors: data.vendors, stats: data.stats, currentUserId: data.currentUserId }
})

// ── Vendor validation ──────────────────────────────────────────────────
const vendorCategoryValues = ['supplier', 'subcontractor', 'service_provider', 'contractor', 'manufacturer', 'trader', 'consultant', 'oem', 'distributor'] as const
const vendorStatusValues = ['active', 'inactive', 'blacklisted', 'on_hold'] as const

const vendorSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with -/_').transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(255),
  legalName: z.string().trim().max(255).optional().nullable(),
  vendorCategory: z.enum(vendorCategoryValues).default('supplier'),
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
  status: z.enum(vendorStatusValues).default('active'),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  paymentTerms: z.string().trim().max(100).optional().nullable(),
  msmeNumber: z.string().trim().max(30).optional().nullable(),
})

export const createVendorAction = createServerFn({ method: 'POST' }).validator(vendorSchema).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await createVendorForCookie(
      {
        code: data.code,
        name: data.name,
        legalName: data.legalName ?? null,
        vendorCategory: data.vendorCategory,
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
        rating: data.rating ?? null,
        paymentTerms: data.paymentTerms ?? null,
        msmeNumber: data.msmeNumber ?? null,
      },
      getRequestHeader('cookie'),
    )
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create vendor.' }
  }
})

export const updateVendorAction = createServerFn({ method: 'POST' }).validator(vendorSchema.extend({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await updateVendorForCookie(
      {
        id: data.id,
        code: data.code,
        name: data.name,
        legalName: data.legalName ?? null,
        vendorCategory: data.vendorCategory,
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
        rating: data.rating ?? null,
        paymentTerms: data.paymentTerms ?? null,
        msmeNumber: data.msmeNumber ?? null,
      },
      getRequestHeader('cookie'),
    )
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update vendor.' }
  }
})

export const deleteVendorAction = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    await deleteVendorForCookie(data, getRequestHeader('cookie'))
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete vendor.' }
  }
})

// ── Vendor Contacts ────────────────────────────────────────────────────
const vendorContactSchema = z.object({
  vendorId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().max(255).optional().nullable().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Invalid email' }),
  phone: z.string().trim().max(50).optional().nullable(),
  designation: z.string().trim().max(100).optional().nullable(),
  isPrimary: z.boolean().default(false),
})

export const createVendorContactAction = createServerFn({ method: 'POST' }).validator(vendorContactSchema).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await createVendorContactForCookie(
      { vendorId: data.vendorId, firstName: data.firstName, lastName: data.lastName ?? null, email: data.email ?? null, phone: data.phone ?? null, designation: data.designation ?? null, isPrimary: data.isPrimary ?? false },
      getRequestHeader('cookie'),
    )
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create vendor contact.' }
  }
})

export const updateVendorContactAction = createServerFn({ method: 'POST' }).validator(vendorContactSchema.extend({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await updateVendorContactForCookie(
      { id: data.id, vendorId: data.vendorId, firstName: data.firstName, lastName: data.lastName ?? null, email: data.email ?? null, phone: data.phone ?? null, designation: data.designation ?? null, isPrimary: data.isPrimary ?? false },
      getRequestHeader('cookie'),
    )
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update vendor contact.' }
  }
})

export const deleteVendorContactAction = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    await deleteVendorContactForCookie(data, getRequestHeader('cookie'))
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete vendor contact.' }
  }
})

export const setPrimaryVendorContactAction = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await setPrimaryVendorContactForCookie(data, getRequestHeader('cookie'))
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to set primary contact.' }
  }
})

// ── Vendor Emails ──────────────────────────────────────────────────────
const vendorEmailSchema = z.object({
  vendorId: z.string().uuid(),
  email: z.string().trim().min(1).max(255).email(),
  type: z.string().trim().max(50).optional().nullable(),
})

export const createVendorEmailAction = createServerFn({ method: 'POST' }).validator(vendorEmailSchema).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await createVendorEmailForCookie({ vendorId: data.vendorId, email: data.email, type: data.type ?? null }, getRequestHeader('cookie'))
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create vendor email.' }
  }
})

export const updateVendorEmailAction = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().uuid(), email: z.string().trim().min(1).max(255).email(), type: z.string().trim().max(50).optional().nullable() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await updateVendorEmailForCookie({ id: data.id, email: data.email, type: data.type ?? null }, getRequestHeader('cookie'))
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update vendor email.' }
  }
})

export const deleteVendorEmailAction = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    await deleteVendorEmailForCookie(data, getRequestHeader('cookie'))
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete vendor email.' }
  }
})

