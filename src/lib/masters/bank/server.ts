import { and, eq, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { employeesTable } from '~/db/schema/employees'
import { bankContactsTable, banksTable, type BankContactRecord, type BankRecord } from '~/db/schema/masters/bank'
import { findSessionById, isUserAdmin, parseSessionCookie, writeAuditLog } from '~/lib/auth.server'

export type BankWithContacts = {
  id: string
  code: string
  bankName: string
  branchName: string | null
  branchCode: string | null
  accountHolderName: string | null
  accountNumber: string
  accountType: 'savings' | 'current' | 'cc' | 'od' | 'loan' | 'nre' | 'nro'
  ifscCode: string
  swiftCode: string | null
  micrCode: string | null
  currency: string
  openingBalancePaise: number
  currentBalancePaise: number
  overdraftLimitPaise: number
  isPrimary: boolean
  bankType: string | null
  contactPerson: string | null
  contactPhone: string | null
  contactEmail: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  country: string | null
  postalCode: string | null
  website: string | null
  notes: string | null
  accountManagerId: string | null
  accountManagerName: string | null
  status: 'active' | 'inactive' | 'closed' | 'dormant' | 'frozen'
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
}

const DEFAULT_BANKS = [
  { code: 'BANK-2026-0001', bankName: 'State Bank of India', branchName: 'Fort Mumbai', branchCode: 'SBI0001', accountHolderName: 'Accent Techno Solutions Pvt Ltd', accountNumber: '0000001234567890', accountType: 'current' as const, ifscCode: 'SBIN0000001', swiftCode: 'SBININBB', micrCode: '400002001', currency: 'INR', openingBalancePaise: 50000000, currentBalancePaise: 125000000, bankType: 'public', city: 'Mumbai', state: 'Maharashtra', isPrimary: true, status: 'active' as const },
  { code: 'BANK-2026-0002', bankName: 'HDFC Bank', branchName: 'Bandra Kurla Complex', branchCode: 'HDFC0002', accountHolderName: 'Accent Techno Solutions Pvt Ltd', accountNumber: '50200012345678', accountType: 'current' as const, ifscCode: 'HDFC0000002', swiftCode: 'HDFCINBB', micrCode: '400240002', currency: 'INR', openingBalancePaise: 25000000, currentBalancePaise: 84500000, bankType: 'private', city: 'Mumbai', state: 'Maharashtra', status: 'active' as const },
  { code: 'BANK-2026-0003', bankName: 'ICICI Bank', branchName: 'Connaught Place', branchCode: 'ICIC0003', accountHolderName: 'Accent Techno Solutions Pvt Ltd', accountNumber: '000405123456', accountType: 'cc' as const, ifscCode: 'ICIC0000003', swiftCode: 'ICICINBB', micrCode: '110229003', currency: 'INR', openingBalancePaise: 0, currentBalancePaise: -15000000, overdraftLimitPaise: 50000000, bankType: 'private', city: 'New Delhi', state: 'Delhi', status: 'active' as const },
  { code: 'BANK-2026-0004', bankName: 'Axis Bank', branchName: 'MG Road', branchCode: 'AXIS0004', accountHolderName: 'Accent Techno Solutions Pvt Ltd', accountNumber: '91202001234567', accountType: 'current' as const, ifscCode: 'UTIB0000004', swiftCode: 'AXISINBB', micrCode: '560211004', currency: 'INR', openingBalancePaise: 10000000, currentBalancePaise: 42000000, bankType: 'private', city: 'Bengaluru', state: 'Karnataka', status: 'active' as const },
  { code: 'BANK-2026-0005', bankName: 'Bank of Baroda', branchName: 'Alkapuri', branchCode: 'BARB0005', accountHolderName: 'Accent Techno Solutions Pvt Ltd', accountNumber: '12345678901234', accountType: 'savings' as const, ifscCode: 'BARB0000005', swiftCode: 'BARBINBB', micrCode: '390012005', currency: 'INR', openingBalancePaise: 5000000, currentBalancePaise: 7800000, bankType: 'public', city: 'Vadodara', state: 'Gujarat', status: 'inactive' as const },
  { code: 'BANK-2026-0006', bankName: 'Citi Bank', branchName: 'Global Branch', branchCode: 'CITI0006', accountHolderName: 'Accent Techno Solutions Pvt Ltd', accountNumber: 'GB82WEST12345698765432', accountType: 'nre' as const, ifscCode: 'CITI0000006', swiftCode: 'CITIUS33', micrCode: null, currency: 'USD', openingBalancePaise: 1000000, currentBalancePaise: 2500000, bankType: 'foreign', city: 'New York', state: 'NY', status: 'active' as const },
] as const

const DEFAULT_BANK_CONTACTS = [
  { bankCode: 'BANK-2026-0001', firstName: 'Rajesh', lastName: 'Kulkarni', email: 'rajesh.kulkarni@sbi.co.in', phone: '+91 98765 10001', designation: 'Branch Manager', isPrimary: true },
  { bankCode: 'BANK-2026-0001', firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@sbi.co.in', phone: '+91 98765 10002', designation: 'Relationship Manager', isPrimary: false },
  { bankCode: 'BANK-2026-0002', firstName: 'Amit', lastName: 'Verma', email: 'amit.verma@hdfcbank.com', phone: '+91 98765 20001', designation: 'RM - Corporate', isPrimary: true },
  { bankCode: 'BANK-2026-0003', firstName: 'Neha', lastName: 'Singh', email: 'neha.singh@icicibank.com', phone: '+91 98765 30001', designation: 'Branch Manager', isPrimary: true },
  { bankCode: 'BANK-2026-0004', firstName: 'Suresh', lastName: 'Rao', email: 'suresh.rao@axisbank.com', phone: '+91 98765 40001', designation: 'Senior Manager', isPrimary: true },
  { bankCode: 'BANK-2026-0006', firstName: 'John', lastName: 'Miller', email: 'john.miller@citi.com', phone: '+1 212 555 0100', designation: 'Global RM', isPrimary: true },
] as const

function bankCodeNormalize(code: string): string { return code.trim().toUpperCase() }

async function assertBankExists(bankId: string) {
  const rows = await db.select().from(banksTable).where(eq(banksTable.id, bankId)).limit(1)
  if (!rows[0]) throw new Error('Bank not found.')
  return rows[0]
}
async function assertBankContactExists(contactId: string) {
  const rows = await db.select().from(bankContactsTable).where(eq(bankContactsTable.id, contactId)).limit(1)
  if (!rows[0]) throw new Error('Bank contact not found.')
  return rows[0]
}
async function unsetPrimaryForBank(bankId: string) {
  await db.update(bankContactsTable).set({ isPrimary: false, updatedAt: new Date() }).where(eq(bankContactsTable.bankId, bankId))
}
async function unsetPrimaryBanks() {
  await db.update(banksTable).set({ isPrimary: false, updatedAt: new Date() })
}

async function ensureDefaultBanksAndContacts() {
  for (const b of DEFAULT_BANKS) {
    try {
      await db.insert(banksTable).values({
        code: b.code,
        bankName: b.bankName,
        branchName: b.branchName,
        branchCode: b.branchCode,
        accountHolderName: b.accountHolderName,
        accountNumber: b.accountNumber,
        accountType: b.accountType,
        ifscCode: b.ifscCode.toUpperCase(),
        swiftCode: b.swiftCode ? b.swiftCode.toUpperCase() : null,
        micrCode: b.micrCode,
        currency: b.currency,
        openingBalancePaise: b.openingBalancePaise,
        currentBalancePaise: b.currentBalancePaise,
        overdraftLimitPaise: (b as { overdraftLimitPaise?: number }).overdraftLimitPaise ?? 0,
        isPrimary: (b as { isPrimary?: boolean }).isPrimary ?? false,
        bankType: b.bankType,
        city: b.city,
        state: b.state,
        country: 'India',
        status: b.status,
      }).onConflictDoNothing()
    } catch (e) {
      // If table doesn't exist yet (migration pending), skip seeding — will be retried after migration
      if (e instanceof Error && /relation.*does not exist|no such table/i.test(e.message)) {
        console.warn('[bank-master] banks table missing, skipping seed:', e.message)
        return
      }
      throw e
    }
    // ensure unique account handling — if conflict on accountNumber+ifsc, ignore
    // drizzle onConflictDoNothing target code already handles code; account duplicate will throw, so we catch silently via try?
  }
  const banks = await db.select().from(banksTable).orderBy(banksTable.code)
  const codeToId = new Map(banks.map((b) => [b.code, b.id]))
  for (const ct of DEFAULT_BANK_CONTACTS) {
    const bankId = codeToId.get(ct.bankCode)
    if (!bankId) continue
    const existing = await db.select({ id: bankContactsTable.id }).from(bankContactsTable).where(eq(bankContactsTable.email, ct.email))
    if (existing.length > 0) continue
    await db.insert(bankContactsTable).values({
      bankId,
      firstName: ct.firstName,
      lastName: ct.lastName,
      email: ct.email,
      phone: ct.phone,
      designation: ct.designation,
      isPrimary: ct.isPrimary,
    }).onConflictDoNothing()
  }
  // ensure at most one primary bank — if multiple, keep first
  const allBanks = await db.select().from(banksTable)
  const primaries = allBanks.filter((b) => b.isPrimary)
  if (primaries.length > 1) {
    const keepId = primaries[0]?.id
    for (const p of primaries.slice(1)) {
      await db.update(banksTable).set({ isPrimary: false, updatedAt: new Date() }).where(eq(banksTable.id, p.id))
    }
    // ensure keepId stays primary
    if (keepId) await db.update(banksTable).set({ isPrimary: true }).where(eq(banksTable.id, keepId))
  }
}

// ── Read ─────────────────────────────────────────────────────────────────
export async function listBanksFromDb(): Promise<BankWithContacts[]> {
  try {
    await ensureDefaultBanksAndContacts()
  } catch (e) {
    if (e instanceof Error && /relation.*does not exist|no such table/i.test(e.message)) {
      console.warn('[bank-master] banks table missing, returning empty:', e.message)
      return []
    }
    throw e
  }
  try {
    const banks = await db
      .select({
      id: banksTable.id,
      code: banksTable.code,
      bankName: banksTable.bankName,
      branchName: banksTable.branchName,
      branchCode: banksTable.branchCode,
      accountHolderName: banksTable.accountHolderName,
      accountNumber: banksTable.accountNumber,
      accountType: banksTable.accountType,
      ifscCode: banksTable.ifscCode,
      swiftCode: banksTable.swiftCode,
      micrCode: banksTable.micrCode,
      currency: banksTable.currency,
      openingBalancePaise: banksTable.openingBalancePaise,
      currentBalancePaise: banksTable.currentBalancePaise,
      overdraftLimitPaise: banksTable.overdraftLimitPaise,
      isPrimary: banksTable.isPrimary,
      bankType: banksTable.bankType,
      contactPerson: banksTable.contactPerson,
      contactPhone: banksTable.contactPhone,
      contactEmail: banksTable.contactEmail,
      addressLine1: banksTable.addressLine1,
      addressLine2: banksTable.addressLine2,
      city: banksTable.city,
      state: banksTable.state,
      country: banksTable.country,
      postalCode: banksTable.postalCode,
      website: banksTable.website,
      notes: banksTable.notes,
      accountManagerId: banksTable.accountManagerId,
      accountManagerFirstName: employeesTable.firstName,
      accountManagerLastName: employeesTable.lastName,
      status: banksTable.status,
      createdAt: banksTable.createdAt,
      updatedAt: banksTable.updatedAt,
    })
    .from(banksTable)
    .leftJoin(employeesTable, eq(banksTable.accountManagerId, employeesTable.id))
    .orderBy(banksTable.code)

  const allContacts = await db.select().from(bankContactsTable).orderBy(bankContactsTable.firstName)
  const contactsByBank = new Map<string, typeof allContacts>()
  for (const c of allContacts) {
    const list = contactsByBank.get(c.bankId) ?? []
    list.push(c)
    contactsByBank.set(c.bankId, list)
  }

  return banks.map((b) => {
    const accountManagerName = b.accountManagerFirstName ? `${b.accountManagerFirstName} ${b.accountManagerLastName || ''}`.trim() : null
    return {
      id: b.id,
      code: b.code,
      bankName: b.bankName,
      branchName: b.branchName,
      branchCode: b.branchCode,
      accountHolderName: b.accountHolderName,
      accountNumber: b.accountNumber,
      accountType: b.accountType as BankWithContacts['accountType'],
      ifscCode: b.ifscCode,
      swiftCode: b.swiftCode,
      micrCode: b.micrCode,
      currency: b.currency,
      openingBalancePaise: b.openingBalancePaise,
      currentBalancePaise: b.currentBalancePaise,
      overdraftLimitPaise: b.overdraftLimitPaise,
      isPrimary: b.isPrimary ?? false,
      bankType: b.bankType,
      contactPerson: b.contactPerson,
      contactPhone: b.contactPhone,
      contactEmail: b.contactEmail,
      addressLine1: b.addressLine1,
      addressLine2: b.addressLine2,
      city: b.city,
      state: b.state,
      country: b.country,
      postalCode: b.postalCode,
      website: b.website,
      notes: b.notes,
      accountManagerId: b.accountManagerId,
      accountManagerName,
      status: b.status as BankWithContacts['status'],
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      contacts: (contactsByBank.get(b.id) ?? []).map((ct) => ({
        id: ct.id,
        firstName: ct.firstName,
        lastName: ct.lastName,
        email: ct.email,
        phone: ct.phone,
        designation: ct.designation,
        isPrimary: ct.isPrimary ?? false,
      })),
    }
  })
  } catch (e) {
    if (e instanceof Error && /relation.*does not exist|no such table/i.test(e.message)) {
      console.warn('[bank-master] banks table missing, returning empty:', e.message)
      return []
    }
    throw e
  }
}

export async function getBankMasterData() {
  const banks = await listBanksFromDb()
  const total = banks.length
  const active = banks.filter((b) => b.status === 'active').length
  const inactive = banks.filter((b) => b.status === 'inactive').length
  const closed = banks.filter((b) => b.status === 'closed').length
  const totalContacts = banks.reduce((s, b) => s + b.contacts.length, 0)
  const totalBalancePaise = banks.reduce((s, b) => s + (b.currentBalancePaise ?? 0), 0)
  const currencies = new Set(banks.map((b) => b.currency)).size
  const primary = banks.find((b) => b.isPrimary) ?? null
  return { banks, stats: { total, active, inactive, closed, totalContacts, totalBalancePaise, currencies, primaryBankCode: primary?.code ?? null } }
}

// ── Banks CRUD ──────────────────────────────────────────────────────────
export async function createBank(values: {
  code: string
  bankName: string
  branchName?: string | null
  branchCode?: string | null
  accountHolderName?: string | null
  accountNumber: string
  accountType?: string | null
  ifscCode: string
  swiftCode?: string | null
  micrCode?: string | null
  currency?: string | null
  openingBalancePaise?: number | null
  currentBalancePaise?: number | null
  overdraftLimitPaise?: number | null
  isPrimary?: boolean | null
  bankType?: string | null
  contactPerson?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  website?: string | null
  notes?: string | null
  accountManagerId?: string | null
  status?: 'active' | 'inactive' | 'closed' | 'dormant' | 'frozen'
  actorUserId: string
}): Promise<BankRecord> {
  const code = bankCodeNormalize(values.code)
  if (!code || !values.bankName.trim()) throw new Error('Bank code and bank name are required.')
  if (!values.accountNumber.trim()) throw new Error('Account number is required.')
  if (!values.ifscCode.trim()) throw new Error('IFSC code is required.')
  const ifsc = values.ifscCode.trim().toUpperCase()
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc) && ifsc.length !== 11) {
    // allow non-IN IFSC like SWIFT? but enforce 11 for IN, else just upper
  }
  const isPrimary = values.isPrimary ?? false
  if (isPrimary) await unsetPrimaryBanks()

  const inserted = await db.insert(banksTable).values({
    code,
    bankName: values.bankName.trim(),
    branchName: values.branchName?.trim() || null,
    branchCode: values.branchCode?.trim() || null,
    accountHolderName: values.accountHolderName?.trim() || null,
    accountNumber: values.accountNumber.trim(),
    accountType: (values.accountType?.trim() as BankRecord['accountType']) || 'current',
    ifscCode: ifsc,
    swiftCode: values.swiftCode?.trim() ? values.swiftCode.trim().toUpperCase() : null,
    micrCode: values.micrCode?.trim() || null,
    currency: values.currency?.trim() || 'INR',
    openingBalancePaise: values.openingBalancePaise ?? 0,
    currentBalancePaise: values.currentBalancePaise ?? values.openingBalancePaise ?? 0,
    overdraftLimitPaise: values.overdraftLimitPaise ?? 0,
    isPrimary,
    bankType: values.bankType?.trim() || null,
    contactPerson: values.contactPerson?.trim() || null,
    contactPhone: values.contactPhone?.trim() || null,
    contactEmail: values.contactEmail?.trim()?.toLowerCase() || null,
    addressLine1: values.addressLine1?.trim() || null,
    addressLine2: values.addressLine2?.trim() || null,
    city: values.city?.trim() || null,
    state: values.state?.trim() || null,
    country: values.country?.trim() || 'India',
    postalCode: values.postalCode?.trim() || null,
    website: values.website?.trim() || null,
    notes: values.notes?.trim() || null,
    accountManagerId: values.accountManagerId || null,
    status: values.status ?? 'active',
  }).returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create bank.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.bank_created', resource: 'banks', resourceId: row.id, newValue: row })
  return row
}

export async function updateBank(values: {
  id: string
  code: string
  bankName: string
  branchName?: string | null
  branchCode?: string | null
  accountHolderName?: string | null
  accountNumber: string
  accountType?: string | null
  ifscCode: string
  swiftCode?: string | null
  micrCode?: string | null
  currency?: string | null
  openingBalancePaise?: number | null
  currentBalancePaise?: number | null
  overdraftLimitPaise?: number | null
  isPrimary?: boolean | null
  bankType?: string | null
  contactPerson?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  postalCode?: string | null
  website?: string | null
  notes?: string | null
  accountManagerId?: string | null
  status?: 'active' | 'inactive' | 'closed' | 'dormant' | 'frozen'
  actorUserId: string
}): Promise<BankRecord> {
  const existing = await db.select().from(banksTable).where(eq(banksTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Bank not found.')
  const code = bankCodeNormalize(values.code)
  if (!code || !values.bankName.trim()) throw new Error('Bank code and bank name are required.')
  if (!values.accountNumber.trim()) throw new Error('Account number is required.')
  const ifsc = values.ifscCode.trim().toUpperCase()
  const isPrimary = values.isPrimary ?? prev.isPrimary ?? false
  if (isPrimary && !prev.isPrimary) {
    await unsetPrimaryBanks()
  } else if (isPrimary) {
    await db.update(banksTable).set({ isPrimary: false, updatedAt: new Date() }).where(sql`${banksTable.id} != ${values.id}`)
  }

  const updated = await db.update(banksTable).set({
    code,
    bankName: values.bankName.trim(),
    branchName: values.branchName?.trim() || null,
    branchCode: values.branchCode?.trim() || null,
    accountHolderName: values.accountHolderName?.trim() || null,
    accountNumber: values.accountNumber.trim(),
    accountType: (values.accountType?.trim() as BankRecord['accountType']) || 'current',
    ifscCode: ifsc,
    swiftCode: values.swiftCode?.trim() ? values.swiftCode.trim().toUpperCase() : null,
    micrCode: values.micrCode?.trim() || null,
    currency: values.currency?.trim() || 'INR',
    openingBalancePaise: values.openingBalancePaise ?? prev.openingBalancePaise ?? 0,
    currentBalancePaise: values.currentBalancePaise ?? prev.currentBalancePaise ?? 0,
    overdraftLimitPaise: values.overdraftLimitPaise ?? prev.overdraftLimitPaise ?? 0,
    isPrimary,
    bankType: values.bankType?.trim() || null,
    contactPerson: values.contactPerson?.trim() || null,
    contactPhone: values.contactPhone?.trim() || null,
    contactEmail: values.contactEmail?.trim()?.toLowerCase() || null,
    addressLine1: values.addressLine1?.trim() || null,
    addressLine2: values.addressLine2?.trim() || null,
    city: values.city?.trim() || null,
    state: values.state?.trim() || null,
    country: values.country?.trim() || 'India',
    postalCode: values.postalCode?.trim() || null,
    website: values.website?.trim() || null,
    notes: values.notes?.trim() || null,
    accountManagerId: values.accountManagerId || null,
    status: values.status ?? 'active',
    updatedAt: new Date(),
  }).where(eq(banksTable.id, values.id)).returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update bank.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.bank_updated', resource: 'banks', resourceId: row.id, oldValue: prev, newValue: row })
  return row
}

export async function deleteBank(values: { id: string; actorUserId: string }): Promise<void> {
  const existing = await db.select().from(banksTable).where(eq(banksTable.id, values.id)).limit(1)
  const prev = existing[0]
  if (!prev) throw new Error('Bank not found.')
  await db.delete(banksTable).where(eq(banksTable.id, values.id))
  await writeAuditLog({ userId: values.actorUserId, action: 'master.bank_deleted', resource: 'banks', resourceId: values.id, oldValue: prev })
}

export async function setPrimaryBank(values: { id: string; actorUserId: string }): Promise<BankRecord> {
  const bank = await assertBankExists(values.id)
  await unsetPrimaryBanks()
  const updated = await db.update(banksTable).set({ isPrimary: true, updatedAt: new Date() }).where(eq(banksTable.id, values.id)).returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to set primary bank.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.bank_primary_set', resource: 'banks', resourceId: row.id, newValue: row })
  return row
}

// ── Bank Contacts CRUD ──────────────────────────────────────────────
export async function createBankContact(values: {
  bankId: string
  firstName: string
  lastName?: string | null
  email?: string | null
  phone?: string | null
  designation?: string | null
  isPrimary?: boolean
  actorUserId: string
}): Promise<BankContactRecord> {
  await assertBankExists(values.bankId)
  if (!values.firstName.trim()) throw new Error('Contact first name is required.')
  const email = values.email?.trim() ? values.email.trim().toLowerCase() : null
  if (email) {
    const dup = await db.select({ id: bankContactsTable.id }).from(bankContactsTable).where(and(eq(bankContactsTable.bankId, values.bankId), eq(bankContactsTable.email, email))).limit(1)
    if (dup[0]) throw new Error('A contact with this email already exists for this bank.')
  }
  const isPrimary = values.isPrimary ?? false
  if (isPrimary) await unsetPrimaryForBank(values.bankId)
  const inserted = await db.insert(bankContactsTable).values({
    bankId: values.bankId,
    firstName: values.firstName.trim(),
    lastName: values.lastName?.trim() || null,
    email,
    phone: values.phone?.trim() || null,
    designation: values.designation?.trim() || null,
    isPrimary,
  }).returning()
  const row = inserted[0]
  if (!row) throw new Error('Failed to create bank contact.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.bank_contact_created', resource: 'bank_contacts', resourceId: row.id, newValue: row })
  return row
}

export async function updateBankContact(values: {
  id: string
  bankId?: string
  firstName: string
  lastName?: string | null
  email?: string | null
  phone?: string | null
  designation?: string | null
  isPrimary?: boolean
  actorUserId: string
}): Promise<BankContactRecord> {
  const prev = await assertBankContactExists(values.id)
  const bankId = values.bankId ?? prev.bankId
  await assertBankExists(bankId)
  if (!values.firstName.trim()) throw new Error('Contact first name is required.')
  const email = values.email?.trim() ? values.email.trim().toLowerCase() : null
  if (email && email !== prev.email?.toLowerCase()) {
    const dup = await db.select({ id: bankContactsTable.id }).from(bankContactsTable).where(and(eq(bankContactsTable.bankId, bankId), eq(bankContactsTable.email, email))).limit(1)
    if (dup[0] && dup[0].id !== values.id) throw new Error('A contact with this email already exists for this bank.')
  }
  const isPrimary = values.isPrimary ?? prev.isPrimary ?? false
  if (isPrimary && !prev.isPrimary) {
    await unsetPrimaryForBank(bankId)
  } else if (isPrimary) {
    await db.update(bankContactsTable).set({ isPrimary: false, updatedAt: new Date() }).where(and(eq(bankContactsTable.bankId, bankId), sql`${bankContactsTable.id} != ${values.id}`))
  }
  const updated = await db.update(bankContactsTable).set({
    bankId,
    firstName: values.firstName.trim(),
    lastName: values.lastName?.trim() || null,
    email,
    phone: values.phone?.trim() || null,
    designation: values.designation?.trim() || null,
    isPrimary,
    updatedAt: new Date(),
  }).where(eq(bankContactsTable.id, values.id)).returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to update bank contact.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.bank_contact_updated', resource: 'bank_contacts', resourceId: row.id, oldValue: prev, newValue: row })
  return row
}

export async function deleteBankContact(values: { id: string; actorUserId: string }): Promise<void> {
  const prev = await assertBankContactExists(values.id)
  await db.delete(bankContactsTable).where(eq(bankContactsTable.id, values.id))
  await writeAuditLog({ userId: values.actorUserId, action: 'master.bank_contact_deleted', resource: 'bank_contacts', resourceId: values.id, oldValue: prev })
}

export async function setPrimaryBankContact(values: { id: string; actorUserId: string }): Promise<BankContactRecord> {
  const contact = await assertBankContactExists(values.id)
  await unsetPrimaryForBank(contact.bankId)
  const updated = await db.update(bankContactsTable).set({ isPrimary: true, updatedAt: new Date() }).where(eq(bankContactsTable.id, values.id)).returning()
  const row = updated[0]
  if (!row) throw new Error('Failed to set primary bank contact.')
  await writeAuditLog({ userId: values.actorUserId, action: 'master.bank_contact_primary_set', resource: 'bank_contacts', resourceId: row.id, newValue: row })
  return row
}

// ── Auth wrappers ──────────────────────────────────────────────────────
async function requireAdminByCookie(cookieHeader: string | undefined) {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) throw new Error('Authentication required.')
  if (!(await isUserAdmin(session.user.id))) throw new Error('Administrator privileges required.')
  return session.user.id
}
export async function getBankMasterDataForCookie(cookieHeader: string | undefined) {
  const sessionId = parseSessionCookie(cookieHeader)
  const session = sessionId ? await findSessionById(sessionId) : null
  if (!session) return { authorized: false as const, banks: [] as BankWithContacts[], stats: { total: 0, active: 0, inactive: 0, closed: 0, totalContacts: 0, totalBalancePaise: 0, currencies: 0, primaryBankCode: null as string | null } }
  const data = await getBankMasterData()
  return { authorized: true as const, ...data, currentUserId: session.user.id }
}
export async function createBankForCookie(values: Omit<Parameters<typeof createBank>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createBank({ ...values, actorUserId })
}
export async function updateBankForCookie(values: Omit<Parameters<typeof updateBank>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateBank({ ...values, actorUserId })
}
export async function deleteBankForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteBank({ ...values, actorUserId })
}
export async function setPrimaryBankForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return setPrimaryBank({ ...values, actorUserId })
}
export async function createBankContactForCookie(values: Omit<Parameters<typeof createBankContact>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return createBankContact({ ...values, actorUserId })
}
export async function updateBankContactForCookie(values: Omit<Parameters<typeof updateBankContact>[0], 'actorUserId'>, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return updateBankContact({ ...values, actorUserId })
}
export async function deleteBankContactForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return deleteBankContact({ ...values, actorUserId })
}
export async function setPrimaryBankContactForCookie(values: { id: string }, cookieHeader: string | undefined) {
  const actorUserId = await requireAdminByCookie(cookieHeader)
  return setPrimaryBankContact({ ...values, actorUserId })
}
