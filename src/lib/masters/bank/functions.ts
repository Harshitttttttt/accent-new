import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import {
  createBankContactForCookie,
  createBankForCookie,
  deleteBankContactForCookie,
  deleteBankForCookie,
  getBankMasterDataForCookie,
  setPrimaryBankContactForCookie,
  setPrimaryBankForCookie,
  updateBankContactForCookie,
  updateBankForCookie,
} from './server'

export const getBankMasterPageData = createServerFn({ method: 'GET' }).handler(async () => {
  const cookie = getRequestHeader('cookie')
  const data = await getBankMasterDataForCookie(cookie)
  if (!data.authorized) {
    setResponseHeader('Cache-Control', 'private, no-store')
    return { authorized: false as const, banks: [], stats: { total: 0, active: 0, inactive: 0, closed: 0, totalContacts: 0, totalBalancePaise: 0, currencies: 0, primaryBankCode: null as string | null } }
  }
  setResponseHeader('Cache-Control', 'private, max-age=60, must-revalidate')
  return { authorized: true as const, banks: data.banks, stats: data.stats, currentUserId: data.currentUserId }
})

const bankAccountTypeValues = ['savings', 'current', 'cc', 'od', 'loan', 'nre', 'nro'] as const
const bankStatusValues = ['active', 'inactive', 'closed', 'dormant', 'frozen'] as const

const bankSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric with -/_').transform((v) => v.toUpperCase()),
  bankName: z.string().trim().min(2).max(150),
  branchName: z.string().trim().max(150).optional().nullable(),
  branchCode: z.string().trim().max(50).optional().nullable(),
  accountHolderName: z.string().trim().max(255).optional().nullable(),
  accountNumber: z.string().trim().min(4).max(50),
  accountType: z.enum(bankAccountTypeValues).default('current'),
  ifscCode: z.string().trim().min(8).max(11).transform((v) => v.toUpperCase()),
  swiftCode: z.string().trim().max(11).optional().nullable().transform((v) => (v ? v.toUpperCase() : v)),
  micrCode: z.string().trim().max(9).optional().nullable(),
  currency: z.string().trim().max(10).default('INR'),
  openingBalancePaise: z.coerce.number().int().min(0).default(0),
  currentBalancePaise: z.coerce.number().int().default(0),
  overdraftLimitPaise: z.coerce.number().int().min(0).default(0),
  isPrimary: z.boolean().default(false),
  bankType: z.string().trim().max(50).optional().nullable(),
  contactPerson: z.string().trim().max(100).optional().nullable(),
  contactPhone: z.string().trim().max(50).optional().nullable(),
  contactEmail: z.string().trim().max(255).optional().nullable(),
  addressLine1: z.string().trim().max(500).optional().nullable(),
  addressLine2: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  website: z.string().trim().max(255).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  accountManagerId: z.string().uuid().optional().nullable(),
  status: z.enum(bankStatusValues).default('active'),
  // helpers for rupees input (optional string like "1,25,000.00")
  openingBalanceRupees: z.string().optional(),
  currentBalanceRupees: z.string().optional(),
})

function toPaiseFromRupees(input: unknown, fallback: number): number {
  if (typeof input === 'number') return Math.round(input * 100)
  if (typeof input === 'string' && input.trim()) {
    const n = Number(input.replace(/,/g, ''))
    if (!Number.isNaN(n)) return Math.round(n * 100)
  }
  return fallback
}

export const createBankAction = createServerFn({ method: 'POST' }).validator(bankSchema).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const openingPaise = data.openingBalancePaise ?? toPaiseFromRupees((data as unknown as { openingBalanceRupees?: string }).openingBalanceRupees, 0)
    const currentPaise = data.currentBalancePaise ?? toPaiseFromRupees((data as unknown as { currentBalanceRupees?: string }).currentBalanceRupees, openingPaise)
    const row = await createBankForCookie(
      {
        code: data.code,
        bankName: data.bankName,
        branchName: data.branchName ?? null,
        branchCode: data.branchCode ?? null,
        accountHolderName: data.accountHolderName ?? null,
        accountNumber: data.accountNumber,
        accountType: data.accountType,
        ifscCode: data.ifscCode,
        swiftCode: data.swiftCode ?? null,
        micrCode: data.micrCode ?? null,
        currency: data.currency ?? 'INR',
        openingBalancePaise: openingPaise,
        currentBalancePaise: currentPaise,
        overdraftLimitPaise: data.overdraftLimitPaise ?? 0,
        isPrimary: data.isPrimary ?? false,
        bankType: data.bankType ?? null,
        contactPerson: data.contactPerson ?? null,
        contactPhone: data.contactPhone ?? null,
        contactEmail: data.contactEmail ?? null,
        addressLine1: data.addressLine1 ?? null,
        addressLine2: data.addressLine2 ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        country: data.country ?? null,
        postalCode: data.postalCode ?? null,
        website: data.website ?? null,
        notes: data.notes ?? null,
        accountManagerId: data.accountManagerId ?? null,
        status: data.status,
      },
      getRequestHeader('cookie'),
    )
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create bank.' }
  }
})

export const updateBankAction = createServerFn({ method: 'POST' }).validator(bankSchema.extend({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const openingPaise = data.openingBalancePaise ?? toPaiseFromRupees((data as unknown as { openingBalanceRupees?: string }).openingBalanceRupees, 0)
    const currentPaise = data.currentBalancePaise ?? toPaiseFromRupees((data as unknown as { currentBalanceRupees?: string }).currentBalanceRupees, openingPaise)
    const row = await updateBankForCookie(
      {
        id: data.id,
        code: data.code,
        bankName: data.bankName,
        branchName: data.branchName ?? null,
        branchCode: data.branchCode ?? null,
        accountHolderName: data.accountHolderName ?? null,
        accountNumber: data.accountNumber,
        accountType: data.accountType,
        ifscCode: data.ifscCode,
        swiftCode: data.swiftCode ?? null,
        micrCode: data.micrCode ?? null,
        currency: data.currency ?? 'INR',
        openingBalancePaise: openingPaise,
        currentBalancePaise: currentPaise,
        overdraftLimitPaise: data.overdraftLimitPaise ?? 0,
        isPrimary: data.isPrimary ?? false,
        bankType: data.bankType ?? null,
        contactPerson: data.contactPerson ?? null,
        contactPhone: data.contactPhone ?? null,
        contactEmail: data.contactEmail ?? null,
        addressLine1: data.addressLine1 ?? null,
        addressLine2: data.addressLine2 ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        country: data.country ?? null,
        postalCode: data.postalCode ?? null,
        website: data.website ?? null,
        notes: data.notes ?? null,
        accountManagerId: data.accountManagerId ?? null,
        status: data.status,
      },
      getRequestHeader('cookie'),
    )
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update bank.' }
  }
})

export const deleteBankAction = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    await deleteBankForCookie(data, getRequestHeader('cookie'))
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete bank.' }
  }
})

export const setPrimaryBankAction = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await setPrimaryBankForCookie(data, getRequestHeader('cookie'))
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to set primary bank.' }
  }
})

// ── Bank Contacts ──────────────────────────────────────────────────────
const bankContactSchema = z.object({
  bankId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().max(255).optional().nullable().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Invalid email' }),
  phone: z.string().trim().max(50).optional().nullable(),
  designation: z.string().trim().max(100).optional().nullable(),
  isPrimary: z.boolean().default(false),
})

export const createBankContactAction = createServerFn({ method: 'POST' }).validator(bankContactSchema).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await createBankContactForCookie(
      { bankId: data.bankId, firstName: data.firstName, lastName: data.lastName ?? null, email: data.email ?? null, phone: data.phone ?? null, designation: data.designation ?? null, isPrimary: data.isPrimary ?? false },
      getRequestHeader('cookie'),
    )
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to create bank contact.' }
  }
})

export const updateBankContactAction = createServerFn({ method: 'POST' }).validator(bankContactSchema.extend({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await updateBankContactForCookie(
      { id: data.id, bankId: data.bankId, firstName: data.firstName, lastName: data.lastName ?? null, email: data.email ?? null, phone: data.phone ?? null, designation: data.designation ?? null, isPrimary: data.isPrimary ?? false },
      getRequestHeader('cookie'),
    )
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to update bank contact.' }
  }
})

export const deleteBankContactAction = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    await deleteBankContactForCookie(data, getRequestHeader('cookie'))
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to delete bank contact.' }
  }
})

export const setPrimaryBankContactAction = createServerFn({ method: 'POST' }).validator(z.object({ id: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store')
  try {
    const row = await setPrimaryBankContactForCookie(data, getRequestHeader('cookie'))
    return { ok: true as const, data: row }
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : 'Failed to set primary contact.' }
  }
})
