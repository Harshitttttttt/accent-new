import { and, eq, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  companiesTable,
  companyEmailsTable,
  contactsTable,
  type CompanyRecord,
  type ContactRecord,
  type CompanyEmailRecord,
} from '~/db/schema/masters/company'
import { findSessionById, isUserAdmin, parseSessionCookie, writeAuditLog } from '~/lib/auth.server'
import { listCompaniesFromDb } from '~/lib/crm.server'
import type { CompanyWithContacts } from '~/lib/crm'

// ── Helpers ───────────────────────────────────────────────────────────────
function companyCodeNormalize(code: string): string {
  return code.trim().toUpperCase()
}

async function assertCompanyExists(companyId: string) {
  const rows = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1)
  if (!rows[0]) throw new Error('Company not found.')
  return rows[0]
}

async function assertContactExists(contactId: string) {
  const rows = await db.select().from(contactsTable).where(eq(contactsTable.id, contactId)).limit(1)
  if (!rows[0]) throw new Error('Contact not found.')
  return rows[0]
}

async function assertCompanyEmailExists(id: string) {
  const rows = await db.select().from(companyEmailsTable).where(eq(companyEmailsTable.id, id)).limit(1)
  if (!rows[0]) throw new Error('Company email not found.')
  return rows[0]
}

async function unsetPrimaryForCompany(companyId: string) {
  await db
    .update(contactsTable)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(eq(contactsTable.companyId, companyId))
}

// ── Read ─────────────────────────────────────────────────────────────────
export async function listCompaniesMaster(): Promise<CompanyWithContacts[]> {
  return listCompaniesFromDb()
}

export async function getCompanyMasterData() {
  const companies = await listCompaniesMaster()
  const total = companies.length
  const active = companies.filter((c) => c.status === 'active').length
  const inactive = total - active
  const totalContacts = companies.reduce((s, c) => s + c.contacts.length, 0)
  const totalEmails = companies.reduce((s, c) => s + c.emails.length, 0)
  const industries = new Set(companies.map((c) => c.industry).filter(Boolean) as string[]).size
  return {
    companies,
    stats: { total, active, inactive, totalContacts, totalEmails, industries },
  }
}

// ── Companies CRUD ───────────────────────────────────────────────────────
export async function createCompany(values: {
  code: string
  name: string
  legalName?: string | null
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
  status?: 'active' | 'inactive'
  actorUserId: string
}): Promise<CompanyRecord> {
  const code = companyCodeNormalize(values.code)
  if (!code || !values.name.trim()) throw new Error('Company code and name are required.')

  const inserted = await db
    .insert(companiesTable)
    .values({
      code,
      name: values.name.trim(),
      legalName: values.legalName?.trim() || null,
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
    })
    .returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create company.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.company_created', resource: 'companies', resourceId: row.id, newValue: row })
  return row
}

export async function updateCompany(values: {
  id: string
  code: string
  name: string
  legalName?: string | null
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
  status?: 'active' | 'inactive'
  actorUserId: string
}): Promise<CompanyRecord> {
  const existing = await db.select().from(companiesTable).where(eq(companiesTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Company not found.')
  const code = companyCodeNormalize(values.code)
  if (!code || !values.name.trim()) throw new Error('Company code and name are required.')

  const updated = await db
    .update(companiesTable)
    .set({
      code,
      name: values.name.trim(),
      legalName: values.legalName?.trim() || null,
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
      updatedAt: new Date(),
    })
    .where(eq(companiesTable.id, values.id))
    .returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update company.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.company_updated', resource: 'companies', resourceId: row.id, oldValue: prev, newValue: row })
  return row
}

export async function deleteCompany(values: { id: string; actorUserId: string }): Promise<void> {
  const existing = await db.select().from(companiesTable).where(eq(companiesTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Company not found.')
  await db.delete(companiesTable).where(eq(companiesTable.id, values.id))
  await writeAuditLog({ userId: values.actorUserId, action: 'master.company_deleted', resource: 'companies', resourceId: values.id, oldValue: prev })
}

// ── Contacts CRUD ────────────────────────────────────────────────────────
export async function createContact(values: {
  companyId: string
  firstName: string
  lastName?: string | null
  email?: string | null
  phone?: string | null
  designation?: string | null
  isPrimary?: boolean
  actorUserId: string
}): Promise<ContactRecord> {
  await assertCompanyExists(values.companyId)
  if (!values.firstName.trim()) throw new Error('Contact first name is required.')
  const email = values.email?.trim() ? values.email.trim().toLowerCase() : null
  if (email) {
    const dup = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(and(eq(contactsTable.companyId, values.companyId), eq(contactsTable.email, email)))
      .limit(1)
    if (dup[0]) throw new Error('A contact with this email already exists for this company.')
  }
  const isPrimary = values.isPrimary ?? false
  if (isPrimary) {
    await unsetPrimaryForCompany(values.companyId)
  }

  const inserted = await db
    .insert(contactsTable)
    .values({
      companyId: values.companyId,
      firstName: values.firstName.trim(),
      lastName: values.lastName?.trim() || null,
      email,
      phone: values.phone?.trim() || null,
      designation: values.designation?.trim() || null,
      isPrimary,
    })
    .returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create contact.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.contact_created', resource: 'contacts', resourceId: row.id, newValue: row })
  return row
}

export async function updateContact(values: {
  id: string
  companyId?: string
  firstName: string
  lastName?: string | null
  email?: string | null
  phone?: string | null
  designation?: string | null
  isPrimary?: boolean
  actorUserId: string
}): Promise<ContactRecord> {
  const prev = await assertContactExists(values.id)
  const companyId = values.companyId ?? prev.companyId
  await assertCompanyExists(companyId)
  if (!values.firstName.trim()) throw new Error('Contact first name is required.')
  const email = values.email?.trim() ? values.email.trim().toLowerCase() : null
  if (email && email !== prev.email?.toLowerCase()) {
    const dup = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(and(eq(contactsTable.companyId, companyId), eq(contactsTable.email, email)))
      .limit(1)
    if (dup[0] && dup[0].id !== values.id) throw new Error('A contact with this email already exists for this company.')
  }
  const isPrimary = values.isPrimary ?? prev.isPrimary ?? false
  if (isPrimary && !prev.isPrimary) {
    await unsetPrimaryForCompany(companyId)
  } else if (isPrimary) {
    // if already primary, ensure others are not primary (idempotent)
    await db
      .update(contactsTable)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(and(eq(contactsTable.companyId, companyId), sql`${contactsTable.id} != ${values.id}`))
  }

  const updated = await db
    .update(contactsTable)
    .set({
      companyId,
      firstName: values.firstName.trim(),
      lastName: values.lastName?.trim() || null,
      email,
      phone: values.phone?.trim() || null,
      designation: values.designation?.trim() || null,
      isPrimary,
      updatedAt: new Date(),
    })
    .where(eq(contactsTable.id, values.id))
    .returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update contact.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.contact_updated', resource: 'contacts', resourceId: row.id, oldValue: prev, newValue: row })
  return row
}

export async function deleteContact(values: { id: string; actorUserId: string }): Promise<void> {
  const prev = await assertContactExists(values.id)
  await db.delete(contactsTable).where(eq(contactsTable.id, values.id))
  await writeAuditLog({ userId: values.actorUserId, action: 'master.contact_deleted', resource: 'contacts', resourceId: values.id, oldValue: prev })
}

export async function setPrimaryContact(values: { id: string; actorUserId: string }): Promise<ContactRecord> {
  const contact = await assertContactExists(values.id)
  await unsetPrimaryForCompany(contact.companyId)
  const updated = await db
    .update(contactsTable)
    .set({ isPrimary: true, updatedAt: new Date() })
    .where(eq(contactsTable.id, values.id))
    .returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to set primary contact.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.contact_primary_set', resource: 'contacts', resourceId: row.id, newValue: row })
  return row
}

// ── Company Emails CRUD ──────────────────────────────────────────────────
export async function createCompanyEmail(values: {
  companyId: string
  email: string
  type?: string | null
  actorUserId: string
}): Promise<CompanyEmailRecord> {
  await assertCompanyExists(values.companyId)
  const email = values.email.trim().toLowerCase()
  if (!email) throw new Error('Email is required.')
  const inserted = await db
    .insert(companyEmailsTable)
    .values({
      companyId: values.companyId,
      email,
      type: values.type?.trim() || null,
    })
    .returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create company email.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.company_email_created', resource: 'company_emails', resourceId: row.id, newValue: row })
  return row
}

export async function updateCompanyEmail(values: {
  id: string
  email: string
  type?: string | null
  actorUserId: string
}): Promise<CompanyEmailRecord> {
  const prev = await assertCompanyEmailExists(values.id)
  const email = values.email.trim().toLowerCase()
  if (!email) throw new Error('Email is required.')
  const updated = await db
    .update(companyEmailsTable)
    .set({ email, type: values.type?.trim() || null })
    .where(eq(companyEmailsTable.id, values.id))
    .returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update company email.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.company_email_updated', resource: 'company_emails', resourceId: row.id, oldValue: prev, newValue: row })
  return row
}

export async function deleteCompanyEmail(values: { id: string; actorUserId: string }): Promise<void> {
  const prev = await assertCompanyEmailExists(values.id)
  await db.delete(companyEmailsTable).where(eq(companyEmailsTable.id, values.id))
  await writeAuditLog({ userId: values.actorUserId, action: 'master.company_email_deleted', resource: 'company_emails', resourceId: values.id, oldValue: prev })
}

// ── Auth wrappers ────────────────────────────────────────────────────────
async function requireAdminByCookie(cookieHeader: string | undefined) {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) throw new Error('Authentication required.')
  if (!(await isUserAdmin(session.user.id))) throw new Error('Administrator privileges required.')
  return session.user.id
}

export async function getCompanyMasterDataForCookie(cookieHeader: string | undefined) {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return { authorized: false as const, companies: [] as CompanyWithContacts[], stats: { total: 0, active: 0, inactive: 0, totalContacts: 0, totalEmails: 0, industries: 0 } }
  const data = await getCompanyMasterData()
  return { authorized: true as const, ...data, currentUserId: session.user.id }
}

export async function createCompanyForCookie(
  values: Omit<Parameters<typeof createCompany>[0], 'actorUserId'>,
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createCompany({ ...values, actorUserId })
}
export async function updateCompanyForCookie(
  values: Omit<Parameters<typeof updateCompany>[0], 'actorUserId'>,
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateCompany({ ...values, actorUserId })
}
export async function deleteCompanyForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteCompany({ ...values, actorUserId })
}

export async function createContactForCookie(
  values: Omit<Parameters<typeof createContact>[0], 'actorUserId'>,
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createContact({ ...values, actorUserId })
}
export async function updateContactForCookie(
  values: Omit<Parameters<typeof updateContact>[0], 'actorUserId'>,
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateContact({ ...values, actorUserId })
}
export async function deleteContactForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteContact({ ...values, actorUserId })
}
export async function setPrimaryContactForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return setPrimaryContact({ ...values, actorUserId })
}

export async function createCompanyEmailForCookie(
  values: Omit<Parameters<typeof createCompanyEmail>[0], 'actorUserId'>,
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createCompanyEmail({ ...values, actorUserId })
}
export async function updateCompanyEmailForCookie(
  values: Omit<Parameters<typeof updateCompanyEmail>[0], 'actorUserId'>,
  cookieHeader: string | undefined,
) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateCompanyEmail({ ...values, actorUserId })
}
export async function deleteCompanyEmailForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteCompanyEmail({ ...values, actorUserId })
}



