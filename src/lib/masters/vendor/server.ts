import { and, eq, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { employeesTable } from '~/db/schema/employees'
import {
  vendorContactsTable,
  vendorEmailsTable,
  vendorsTable,
  type VendorContactRecord,
  type VendorEmailRecord,
  type VendorRecord,
} from '~/db/schema/masters/vendor'
import { findSessionById, isUserAdmin, parseSessionCookie, writeAuditLog } from '~/lib/auth.server'

// ── Types ───────────────────────────────────────────────────────────────
export type VendorWithContacts = {
  id: string
  code: string
  name: string
  legalName: string | null
  vendorCategory: 'supplier' | 'subcontractor' | 'service_provider' | 'contractor' | 'manufacturer' | 'trader' | 'consultant' | 'oem' | 'distributor'
  website: string | null
  industry: string | null
  gstin: string | null
  pan: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  country: string | null
  postalCode: string | null
  inquiryEmail: string | null
  notes: string | null
  accountManagerId: string | null
  accountManagerName: string | null
  status: 'active' | 'inactive' | 'blacklisted' | 'on_hold'
  rating: number | null
  paymentTerms: string | null
  msmeNumber: string | null
  createdAt: string
  updatedAt: string
  contacts: {
    id: string
    firstName: string
    lastName: string | null
    email: string | null
    phone: string | null
    designation: string | null
    isPrimary: boolean
  }[]
  emails: { id: string; email: string; type: string | null }[]
}

// ── Defaults ────────────────────────────────────────────────────────────
const DEFAULT_VENDORS = [
  { code: 'VEND-2026-0001', name: 'SteelTech Suppliers Pvt Ltd', legalName: 'SteelTech Suppliers Private Limited', vendorCategory: 'supplier' as const, industry: 'Steel & Raw Materials', city: 'Mumbai', state: 'Maharashtra', gstin: '27AAACT1234E1ZA', rating: 4, paymentTerms: 'Net 30' },
  { code: 'VEND-2026-0002', name: 'Apex Civil Contractors', legalName: 'Apex Civil Contractors LLP', vendorCategory: 'subcontractor' as const, industry: 'Civil & Structural', city: 'New Delhi', state: 'Delhi', gstin: '07AAACA5678E1ZB', rating: 5, paymentTerms: 'Net 45' },
  { code: 'VEND-2026-0003', name: 'PowerFlow Services', legalName: 'PowerFlow Engineering Services', vendorCategory: 'service_provider' as const, industry: 'Electrical & Power', city: 'Pune', state: 'Maharashtra', gstin: '27AAAPF9012E1ZC', rating: 4, paymentTerms: 'Net 15' },
  { code: 'VEND-2026-0004', name: 'Precise Fabricators', legalName: 'Precise Fabricators & Engineers', vendorCategory: 'manufacturer' as const, industry: 'Mechanical & Fabrication', city: 'Ahmedabad', state: 'Gujarat', gstin: '24AAPFP2345E1ZD', rating: 3, paymentTerms: 'Advance 50%' },
  { code: 'VEND-2026-0005', name: 'Global Logistics Partners', legalName: 'Global Logistics Partners Ltd', vendorCategory: 'trader' as const, industry: 'Logistics & Supply Chain', city: 'Chennai', state: 'Tamil Nadu', gstin: '33AABCG6789E1ZE', rating: 4, paymentTerms: 'Net 60' },
  { code: 'VEND-2026-0006', name: 'Innovate Consultants LLP', legalName: 'Innovate Engineering Consultants LLP', vendorCategory: 'consultant' as const, industry: 'Engineering Consultancy', city: 'Bengaluru', state: 'Karnataka', gstin: '29AACCI3456E1ZF', rating: 5, paymentTerms: 'Net 30' },
  { code: 'VEND-2026-0007', name: 'Bharat Heavy Equipments', legalName: 'Bharat Heavy Equipments OEM', vendorCategory: 'oem' as const, industry: 'Heavy Machinery', city: 'Kolkata', state: 'West Bengal', gstin: '19AABCB7890E1ZG', rating: 4, paymentTerms: 'Net 45' },
] as const

const DEFAULT_VENDOR_CONTACTS = [
  { vendorCode: 'VEND-2026-0001', firstName: 'Suresh', lastName: 'Patel', email: 'suresh.patel@steeltech.in', phone: '+91 98765 00001', designation: 'Sales Head', isPrimary: true },
  { vendorCode: 'VEND-2026-0001', firstName: 'Anita', lastName: 'Desai', email: 'anita.desai@steeltech.in', phone: '+91 98765 00002', designation: 'Accounts Manager', isPrimary: false },
  { vendorCode: 'VEND-2026-0002', firstName: 'Ramesh', lastName: 'Kumar', email: 'ramesh.kumar@apexcontractors.com', phone: '+91 95678 00003', designation: 'Project Manager', isPrimary: true },
  { vendorCode: 'VEND-2026-0003', firstName: 'Kavita', lastName: 'Nair', email: 'kavita.nair@powerflow.co.in', phone: '+91 91234 00004', designation: 'Service Lead', isPrimary: true },
  { vendorCode: 'VEND-2026-0004', firstName: 'Mohan', lastName: 'Shah', email: 'mohan.shah@precisefab.com', phone: '+91 98765 00005', designation: 'Works Manager', isPrimary: true },
  { vendorCode: 'VEND-2026-0005', firstName: 'Priya', lastName: 'Menon', email: 'priya.menon@globallogistics.in', phone: '+91 96543 00006', designation: 'Operations Head', isPrimary: true },
  { vendorCode: 'VEND-2026-0006', firstName: 'Arjun', lastName: 'Reddy', email: 'arjun.reddy@innovateconsult.in', phone: '+91 98123 00007', designation: 'Principal Consultant', isPrimary: true },
  { vendorCode: 'VEND-2026-0007', firstName: 'Sanjay', lastName: 'Gupta', email: 'sanjay.gupta@bhequipments.in', phone: '+91 97654 00008', designation: 'GM Sales', isPrimary: true },
] as const

// ── Helpers ─────────────────────────────────────────────────────────────
function vendorCodeNormalize(code: string): string { return code.trim().toUpperCase() }

async function assertVendorExists(vendorId: string) {
  const rows = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId)).limit(1)
  if (!rows[0]) throw new Error('Vendor not found.')
  return rows[0]
}
async function assertVendorContactExists(contactId: string) {
  const rows = await db.select().from(vendorContactsTable).where(eq(vendorContactsTable.id, contactId)).limit(1)
  if (!rows[0]) throw new Error('Vendor contact not found.')
  return rows[0]
}
async function assertVendorEmailExists(id: string) {
  const rows = await db.select().from(vendorEmailsTable).where(eq(vendorEmailsTable.id, id)).limit(1)
  if (!rows[0]) throw new Error('Vendor email not found.')
  return rows[0]
}
async function unsetPrimaryForVendor(vendorId: string) {
  await db.update(vendorContactsTable).set({ isPrimary: false, updatedAt: new Date() }).where(eq(vendorContactsTable.vendorId, vendorId))
}

async function ensureDefaultVendorsAndContacts() {
  for (const v of DEFAULT_VENDORS) {
    try {
      await db.insert(vendorsTable).values({
        code: v.code,
        name: v.name,
        legalName: v.legalName,
        vendorCategory: v.vendorCategory,
        industry: v.industry,
        city: v.city,
        state: v.state,
        country: 'India',
        gstin: v.gstin,
        status: 'active',
        rating: v.rating,
        paymentTerms: v.paymentTerms,
      }).onConflictDoNothing()
    } catch (e) {
      if (e instanceof Error && /relation.*does not exist|no such table/i.test(e.message)) {
        console.warn('[vendor-master] vendors table missing, skipping seed:', e.message)
        return
      }
      throw e
    }
  }
  const vendors = await db.select().from(vendorsTable).orderBy(vendorsTable.code)
  const codeToId = new Map(vendors.map((c) => [c.code, c.id]))
  for (const ct of DEFAULT_VENDOR_CONTACTS) {
    const vendorId = codeToId.get(ct.vendorCode)
    if (!vendorId) continue
    const existing = await db.select({ id: vendorContactsTable.id }).from(vendorContactsTable).where(eq(vendorContactsTable.email, ct.email))
    if (existing.length > 0) continue
    await db.insert(vendorContactsTable).values({
      vendorId,
      firstName: ct.firstName,
      lastName: ct.lastName,
      email: ct.email,
      phone: ct.phone,
      designation: ct.designation,
      isPrimary: ct.isPrimary,
    })
  }
}

// ── Read ─────────────────────────────────────────────────────────────────
export async function listVendorsFromDb(): Promise<VendorWithContacts[]> {
  try {
    await ensureDefaultVendorsAndContacts()
  } catch (e) {
    if (e instanceof Error && /relation.*does not exist|no such table/i.test(e.message)) {
      console.warn('[vendor-master] vendors table missing, returning empty:', e.message)
      return []
    }
    throw e
  }
  try {
    const vendors = await db
      .select({
      id: vendorsTable.id,
      code: vendorsTable.code,
      name: vendorsTable.name,
      legalName: vendorsTable.legalName,
      vendorCategory: vendorsTable.vendorCategory,
      website: vendorsTable.website,
      industry: vendorsTable.industry,
      gstin: vendorsTable.gstin,
      pan: vendorsTable.pan,
      addressLine1: vendorsTable.addressLine1,
      addressLine2: vendorsTable.addressLine2,
      city: vendorsTable.city,
      state: vendorsTable.state,
      country: vendorsTable.country,
      postalCode: vendorsTable.postalCode,
      inquiryEmail: vendorsTable.inquiryEmail,
      notes: vendorsTable.notes,
      accountManagerId: vendorsTable.accountManagerId,
      accountManagerFirstName: employeesTable.firstName,
      accountManagerLastName: employeesTable.lastName,
      status: vendorsTable.status,
      rating: vendorsTable.rating,
      paymentTerms: vendorsTable.paymentTerms,
      msmeNumber: vendorsTable.msmeNumber,
      createdAt: vendorsTable.createdAt,
      updatedAt: vendorsTable.updatedAt,
    })
    .from(vendorsTable)
    .leftJoin(employeesTable, eq(vendorsTable.accountManagerId, employeesTable.id))
    .orderBy(vendorsTable.code)

  const allContacts = await db.select().from(vendorContactsTable).orderBy(vendorContactsTable.firstName)
  const allEmails = await db.select().from(vendorEmailsTable).orderBy(vendorEmailsTable.email)

  const contactsByVendor = new Map<string, typeof allContacts>()
  for (const c of allContacts) {
    const list = contactsByVendor.get(c.vendorId) ?? []
    list.push(c)
    contactsByVendor.set(c.vendorId, list)
  }
  const emailsByVendor = new Map<string, typeof allEmails>()
  for (const e of allEmails) {
    const list = emailsByVendor.get(e.vendorId) ?? []
    list.push(e)
    emailsByVendor.set(e.vendorId, list)
  }

  return vendors.map((v) => {
    const accountManagerName = v.accountManagerFirstName ? `${v.accountManagerFirstName} ${v.accountManagerLastName || ''}`.trim() : null
    return {
      id: v.id,
      code: v.code,
      name: v.name,
      legalName: v.legalName,
      vendorCategory: v.vendorCategory as VendorWithContacts['vendorCategory'],
      website: v.website,
      industry: v.industry,
      gstin: v.gstin,
      pan: v.pan,
      addressLine1: v.addressLine1,
      addressLine2: v.addressLine2,
      city: v.city,
      state: v.state,
      country: v.country,
      postalCode: v.postalCode,
      inquiryEmail: v.inquiryEmail,
      notes: v.notes,
      accountManagerId: v.accountManagerId,
      accountManagerName,
      status: v.status as VendorWithContacts['status'],
      rating: v.rating,
      paymentTerms: v.paymentTerms,
      msmeNumber: v.msmeNumber,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      contacts: (contactsByVendor.get(v.id) ?? []).map((ct) => ({
        id: ct.id,
        firstName: ct.firstName,
        lastName: ct.lastName,
        email: ct.email,
        phone: ct.phone,
        designation: ct.designation,
        isPrimary: ct.isPrimary ?? false,
      })),
      emails: (emailsByVendor.get(v.id) ?? []).map((e) => ({
        id: e.id,
        email: e.email,
        type: e.type,
      })),
    }
  })
  } catch (e) {
    if (e instanceof Error && /relation.*does not exist|no such table/i.test(e.message)) {
      console.warn('[vendor-master] vendors table missing, returning empty:', e.message)
      return []
    }
    throw e
  }
}

export async function getVendorMasterData() {
  const vendors = await listVendorsFromDb()
  const total = vendors.length
  const active = vendors.filter((v) => v.status === 'active').length
  const inactive = vendors.filter((v) => v.status === 'inactive').length
  const blacklisted = vendors.filter((v) => v.status === 'blacklisted').length
  const totalContacts = vendors.reduce((s, v) => s + v.contacts.length, 0)
  const totalEmails = vendors.reduce((s, v) => s + v.emails.length, 0)
  const categories = new Set(vendors.map((v) => v.vendorCategory)).size
  return { vendors, stats: { total, active, inactive, blacklisted, totalContacts, totalEmails, categories } }
}

// ── Vendors CRUD ────────────────────────────────────────────────────────
export async function createVendor(values: {
  code: string
  name: string
  legalName?: string | null
  vendorCategory?: string | null
  website?: string | null
  industry?: string | null
  gstin?: string | null
  pan?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  inquiryEmail?: string | null
  notes?: string | null
  accountManagerId?: string | null
  status?: 'active' | 'inactive' | 'blacklisted' | 'on_hold'
  rating?: number | null
  paymentTerms?: string | null
  msmeNumber?: string | null
  actorUserId: string
}): Promise<VendorRecord> {
  const code = vendorCodeNormalize(values.code)
  if (!code || !values.name.trim()) throw new Error('Vendor code and name are required.')
  const inserted = await db.insert(vendorsTable).values({
    code,
    name: values.name.trim(),
    legalName: values.legalName?.trim() || null,
    vendorCategory: (values.vendorCategory?.trim() as VendorRecord['vendorCategory']) || 'supplier',
    website: values.website?.trim() || null,
    industry: values.industry?.trim() || null,
    gstin: values.gstin?.trim() ? values.gstin.trim().toUpperCase() : null,
    pan: values.pan?.trim() ? values.pan.trim().toUpperCase() : null,
    addressLine1: values.addressLine1?.trim() || null,
    addressLine2: values.addressLine2?.trim() || null,
    city: values.city?.trim() || null,
    state: values.state?.trim() || null,
    country: values.country?.trim() || 'India',
    postalCode: values.postalCode?.trim() || null,
    inquiryEmail: values.inquiryEmail?.trim() || null,
    notes: values.notes?.trim() || null,
    accountManagerId: values.accountManagerId || null,
    status: values.status ?? 'active',
    rating: values.rating ?? null,
    paymentTerms: values.paymentTerms?.trim() || null,
    msmeNumber: values.msmeNumber?.trim() || null,
  }).returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create vendor.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.vendor_created', resource: 'vendors', resourceId: row.id, newValue: row })
  return row
}

export async function updateVendor(values: {
  id: string
  code: string
  name: string
  legalName?: string | null
  vendorCategory?: string | null
  website?: string | null
  industry?: string | null
  gstin?: string | null
  pan?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  inquiryEmail?: string | null
  notes?: string | null
  accountManagerId?: string | null
  status?: 'active' | 'inactive' | 'blacklisted' | 'on_hold'
  rating?: number | null
  paymentTerms?: string | null
  msmeNumber?: string | null
  actorUserId: string
}): Promise<VendorRecord> {
  const existing = await db.select().from(vendorsTable).where(eq(vendorsTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Vendor not found.')
  const code = vendorCodeNormalize(values.code)
  if (!code || !values.name.trim()) throw new Error('Vendor code and name are required.')
  const updated = await db.update(vendorsTable).set({
    code,
    name: values.name.trim(),
    legalName: values.legalName?.trim() || null,
    vendorCategory: (values.vendorCategory?.trim() as VendorRecord['vendorCategory']) || 'supplier',
    website: values.website?.trim() || null,
    industry: values.industry?.trim() || null,
    gstin: values.gstin?.trim() ? values.gstin.trim().toUpperCase() : null,
    pan: values.pan?.trim() ? values.pan.trim().toUpperCase() : null,
    addressLine1: values.addressLine1?.trim() || null,
    addressLine2: values.addressLine2?.trim() || null,
    city: values.city?.trim() || null,
    state: values.state?.trim() || null,
    country: values.country?.trim() || 'India',
    postalCode: values.postalCode?.trim() || null,
    inquiryEmail: values.inquiryEmail?.trim() || null,
    notes: values.notes?.trim() || null,
    accountManagerId: values.accountManagerId || null,
    status: values.status ?? 'active',
    rating: values.rating ?? null,
    paymentTerms: values.paymentTerms?.trim() || null,
    msmeNumber: values.msmeNumber?.trim() || null,
    updatedAt: new Date(),
  }).where(eq(vendorsTable.id, values.id)).returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update vendor.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.vendor_updated', resource: 'vendors', resourceId: row.id, oldValue: prev, newValue: row })
  return row
}

export async function deleteVendor(values: { id: string; actorUserId: string }): Promise<void> {
  const existing = await db.select().from(vendorsTable).where(eq(vendorsTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Vendor not found.')
  await db.delete(vendorsTable).where(eq(vendorsTable.id, values.id))
  await writeAuditLog({ userId: values.actorUserId, action: 'master.vendor_deleted', resource: 'vendors', resourceId: values.id, oldValue: prev })
}

// ── Vendor Contacts CRUD ──────────────────────────────────────────────
export async function createVendorContact(values: {
  vendorId: string
  firstName: string
  lastName?: string | null
  email?: string | null
  phone?: string | null
  designation?: string | null
  isPrimary?: boolean
  actorUserId: string
}): Promise<VendorContactRecord> {
  await assertVendorExists(values.vendorId)
  if (!values.firstName.trim()) throw new Error('Contact first name is required.')
  const email = values.email?.trim() ? values.email.trim().toLowerCase() : null
  if (email) {
    const dup = await db.select({ id: vendorContactsTable.id }).from(vendorContactsTable).where(and(eq(vendorContactsTable.vendorId, values.vendorId), eq(vendorContactsTable.email, email))).limit(1)
    if (dup[0]) throw new Error('A contact with this email already exists for this vendor.')
  }
  const isPrimary = values.isPrimary ?? false
  if (isPrimary) await unsetPrimaryForVendor(values.vendorId)
  const inserted = await db.insert(vendorContactsTable).values({
    vendorId: values.vendorId,
    firstName: values.firstName.trim(),
    lastName: values.lastName?.trim() || null,
    email,
    phone: values.phone?.trim() || null,
    designation: values.designation?.trim() || null,
    isPrimary,
  }).returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create vendor contact.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.vendor_contact_created', resource: 'vendor_contacts', resourceId: row.id, newValue: row })
  return row
}

export async function updateVendorContact(values: {
  id: string
  vendorId?: string
  firstName: string
  lastName?: string | null
  email?: string | null
  phone?: string | null
  designation?: string | null
  isPrimary?: boolean
  actorUserId: string
}): Promise<VendorContactRecord> {
  const prev = await assertVendorContactExists(values.id)
  const vendorId = values.vendorId ?? prev.vendorId
  await assertVendorExists(vendorId)
  if (!values.firstName.trim()) throw new Error('Contact first name is required.')
  const email = values.email?.trim() ? values.email.trim().toLowerCase() : null
  if (email && email !== prev.email?.toLowerCase()) {
    const dup = await db.select({ id: vendorContactsTable.id }).from(vendorContactsTable).where(and(eq(vendorContactsTable.vendorId, vendorId), eq(vendorContactsTable.email, email))).limit(1)
    if (dup[0] && dup[0].id !== values.id) throw new Error('A contact with this email already exists for this vendor.')
  }
  const isPrimary = values.isPrimary ?? prev.isPrimary ?? false
  if (isPrimary && !prev.isPrimary) {
    await unsetPrimaryForVendor(vendorId)
  } else if (isPrimary) {
    await db.update(vendorContactsTable).set({ isPrimary: false, updatedAt: new Date() }).where(and(eq(vendorContactsTable.vendorId, vendorId), sql`${vendorContactsTable.id} != ${values.id}`))
  }
  const updated = await db.update(vendorContactsTable).set({
    vendorId,
    firstName: values.firstName.trim(),
    lastName: values.lastName?.trim() || null,
    email,
    phone: values.phone?.trim() || null,
    designation: values.designation?.trim() || null,
    isPrimary,
    updatedAt: new Date(),
  }).where(eq(vendorContactsTable.id, values.id)).returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update vendor contact.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.vendor_contact_updated', resource: 'vendor_contacts', resourceId: row.id, oldValue: prev, newValue: row })
  return row
}

export async function deleteVendorContact(values: { id: string; actorUserId: string }): Promise<void> {
  const prev = await assertVendorContactExists(values.id)
  await db.delete(vendorContactsTable).where(eq(vendorContactsTable.id, values.id))
  await writeAuditLog({ userId: values.actorUserId, action: 'master.vendor_contact_deleted', resource: 'vendor_contacts', resourceId: values.id, oldValue: prev })
}

export async function setPrimaryVendorContact(values: { id: string; actorUserId: string }): Promise<VendorContactRecord> {
  const contact = await assertVendorContactExists(values.id)
  await unsetPrimaryForVendor(contact.vendorId)
  const updated = await db.update(vendorContactsTable).set({ isPrimary: true, updatedAt: new Date() }).where(eq(vendorContactsTable.id, values.id)).returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to set primary vendor contact.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.vendor_contact_primary_set', resource: 'vendor_contacts', resourceId: row.id, newValue: row })
  return row
}

// ── Vendor Emails CRUD ────────────────────────────────────────────────
export async function createVendorEmail(values: { vendorId: string; email: string; type?: string | null; actorUserId: string }): Promise<VendorEmailRecord> {
  await assertVendorExists(values.vendorId)
  const email = values.email.trim().toLowerCase()
  if (!email) throw new Error('Email is required.')
  const inserted = await db.insert(vendorEmailsTable).values({ vendorId: values.vendorId, email, type: values.type?.trim() || null }).returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create vendor email.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.vendor_email_created', resource: 'vendor_emails', resourceId: row.id, newValue: row })
  return row
}
export async function updateVendorEmail(values: { id: string; email: string; type?: string | null; actorUserId: string }): Promise<VendorEmailRecord> {
  const prev = await assertVendorEmailExists(values.id)
  const email = values.email.trim().toLowerCase()
  if (!email) throw new Error('Email is required.')
  const updated = await db.update(vendorEmailsTable).set({ email, type: values.type?.trim() || null }).where(eq(vendorEmailsTable.id, values.id)).returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update vendor email.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.vendor_email_updated', resource: 'vendor_emails', resourceId: row.id, oldValue: prev, newValue: row })
  return row
}
export async function deleteVendorEmail(values: { id: string; actorUserId: string }): Promise<void> {
  const prev = await assertVendorEmailExists(values.id)
  await db.delete(vendorEmailsTable).where(eq(vendorEmailsTable.id, values.id))
  await writeAuditLog({ userId: values.actorUserId, action: 'master.vendor_email_deleted', resource: 'vendor_emails', resourceId: values.id, oldValue: prev })
}

// ── Auth wrappers ──────────────────────────────────────────────────────
async function requireAdminByCookie(cookieHeader: string | undefined) {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) throw new Error('Authentication required.')
  if (!(await isUserAdmin(session.user.id))) throw new Error('Administrator privileges required.')
  return session.user.id
}
export async function getVendorMasterDataForCookie(cookieHeader: string | undefined) {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return { authorized: false as const, vendors: [] as VendorWithContacts[], stats: { total: 0, active: 0, inactive: 0, blacklisted: 0, totalContacts: 0, totalEmails: 0, categories: 0 } }
  const data = await getVendorMasterData()
  return { authorized: true as const, ...data, currentUserId: session.user.id }
}
export async function createVendorForCookie(values: Omit<Parameters<typeof createVendor>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createVendor({ ...values, actorUserId })
}
export async function updateVendorForCookie(values: Omit<Parameters<typeof updateVendor>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateVendor({ ...values, actorUserId })
}
export async function deleteVendorForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteVendor({ ...values, actorUserId })
}
export async function createVendorContactForCookie(values: Omit<Parameters<typeof createVendorContact>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createVendorContact({ ...values, actorUserId })
}
export async function updateVendorContactForCookie(values: Omit<Parameters<typeof updateVendorContact>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateVendorContact({ ...values, actorUserId })
}
export async function deleteVendorContactForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteVendorContact({ ...values, actorUserId })
}
export async function setPrimaryVendorContactForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return setPrimaryVendorContact({ ...values, actorUserId })
}
export async function createVendorEmailForCookie(values: Omit<Parameters<typeof createVendorEmail>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createVendorEmail({ ...values, actorUserId })
}
export async function updateVendorEmailForCookie(values: Omit<Parameters<typeof updateVendorEmail>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateVendorEmail({ ...values, actorUserId })
}
export async function deleteVendorEmailForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteVendorEmail({ ...values, actorUserId })
}



