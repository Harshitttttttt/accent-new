import { eq } from 'drizzle-orm'
import { db } from '~/db/index.server'
import {
  companiesTable,
  companyEmailsTable,
  contactsTable,
  departmentsTable,
  designationsTable,
  employeesTable,
  leadSourcesTable,
  usersTable,
  type DepartmentRecord,
  type DesignationRecord,
} from '~/db/schema'
import type {
  CompanySearch,
  CompanySnapshot,
  CompanyWithContacts,
  CrmActivity,
  CrmSnapshot,
  EmployeeSearch,
  EmployeeSnapshot,
  ProjectSnapshot,
} from './crm'

export const DEFAULT_DEPARTMENTS = [
  { code: 'process', name: 'Process Engineering' },
  { code: 'instrumentation', name: 'Instrumentation & Control' },
  { code: 'mechanical', name: 'Mechanical & Piping' },
  { code: 'electrical', name: 'Electrical Engineering' },
  { code: 'civil', name: 'Civil & Structural' },
  { code: 'hse', name: 'Health, Safety & Environment' },
  { code: 'pmo', name: 'Project Management Office' },
  { code: 'admin', name: 'Administration & Operations' },
  { code: 'finance', name: 'Finance & Accounts' },
] as const

export const DEFAULT_DESIGNATIONS = [
  { code: 'lead_process_eng', name: 'Lead Process Engineer' },
  { code: 'senior_process_eng', name: 'Senior Process Engineer' },
  { code: 'project_manager', name: 'Project Manager' },
  { code: 'instrumentation_eng', name: 'Instrumentation Engineer' },
  { code: 'civil_eng', name: 'Civil Engineer' },
  { code: 'mechanical_eng', name: 'Mechanical Engineer' },
  { code: 'electrical_eng', name: 'Electrical Engineer' },
  { code: 'hse_manager', name: 'HSE Manager' },
  { code: 'document_controller', name: 'Document Controller' },
] as const

export const DEFAULT_LEAD_SOURCES = [
  { code: 'website' as const, name: 'Website' },
  { code: 'linkedin' as const, name: 'LinkedIn' },
  { code: 'referral' as const, name: 'Referral' },
  { code: 'existing_client' as const, name: 'Existing Client' },
  { code: 'cold_call' as const, name: 'Cold Call' },
  { code: 'tender_portal' as const, name: 'Tender Portal' },
  { code: 'exhibition' as const, name: 'Exhibition' },
  { code: 'other' as const, name: 'Other' },
] as const

export const DEFAULT_COMPANIES = [
  { code: 'COMP-2026-0001', name: 'Reliance Industries Ltd', legalName: 'Reliance Industries Limited', industry: 'Oil & Gas', city: 'Mumbai', state: 'Maharashtra', gstin: '27AABCR1718E1ZV' },
  { code: 'COMP-2026-0002', name: 'Tata Steel Ltd', legalName: 'Tata Steel Limited', industry: 'Steel & Mining', city: 'Jamshedpur', state: 'Jharkhand', gstin: '20AABCT1234E1ZA' },
  { code: 'COMP-2026-0003', name: 'ONGC', legalName: 'Oil and Natural Gas Corporation', industry: 'Oil & Gas', city: 'Dehradun', state: 'Uttarakhand', gstin: '05AACCO5765D1ZS' },
  { code: 'COMP-2026-0004', name: 'Larsen & Toubro', legalName: 'Larsen & Toubro Limited', industry: 'Engineering & Construction', city: 'Mumbai', state: 'Maharashtra', gstin: '27AABCL0486E1Z3' },
  { code: 'COMP-2026-0005', name: 'IOCL', legalName: 'Indian Oil Corporation Limited', industry: 'Oil & Gas', city: 'New Delhi', state: 'Delhi', gstin: '07AABCI0330A1ZD' },
  { code: 'COMP-2026-0006', name: 'NTPC Limited', legalName: 'NTPC Limited', industry: 'Power & Energy', city: 'New Delhi', state: 'Delhi', gstin: '07AABCN6553P1ZR' },
  { code: 'COMP-2026-0007', name: 'Bharat Petroleum', legalName: 'Bharat Petroleum Corporation Limited', industry: 'Oil & Gas', city: 'Mumbai', state: 'Maharashtra', gstin: '27AABCB5765D2Z5' },
] as const

const DEFAULT_CONTACTS = [
  { companyCode: 'COMP-2026-0001', firstName: 'Rajesh', lastName: 'Sharma', email: 'rajesh.sharma@ril.com', phone: '+91 98765 43210', designation: 'VP Engineering', isPrimary: true },
  { companyCode: 'COMP-2026-0001', firstName: 'Priya', lastName: 'Mehta', email: 'priya.mehta@ril.com', phone: '+91 98765 43211', designation: 'Procurement Manager', isPrimary: false },
  { companyCode: 'COMP-2026-0002', firstName: 'Amit', lastName: 'Kumar', email: 'amit.kumar@tatasteel.com', phone: '+91 95678 12345', designation: 'Project Manager', isPrimary: true },
  { companyCode: 'COMP-2026-0003', firstName: 'Deepak', lastName: 'Verma', email: 'deepak.verma@ongc.co.in', phone: '+91 91234 56789', designation: 'Chief Engineer', isPrimary: true },
  { companyCode: 'COMP-2026-0004', firstName: 'Sunita', lastName: 'Reddy', email: 'sunita.reddy@larsentoubro.com', phone: '+91 98765 11111', designation: 'Head of Projects', isPrimary: true },
  { companyCode: 'COMP-2026-0005', firstName: 'Vikram', lastName: 'Singh', email: 'vikram.singh@iocl.co.in', phone: '+91 97654 32100', designation: 'Engineering Manager', isPrimary: true },
  { companyCode: 'COMP-2026-0006', firstName: 'Neha', lastName: 'Gupta', email: 'neha.gupta@ntpc.co.in', phone: '+91 96543 21098', designation: 'Technical Lead', isPrimary: true },
  { companyCode: 'COMP-2026-0007', firstName: 'Ankit', lastName: 'Joshi', email: 'ankit.joshi@bharatpetroleum.in', phone: '+91 98123 45678', designation: 'Plant Manager', isPrimary: true },
] as const

export async function ensureDefaultCompaniesAndSources() {
  for (const src of DEFAULT_LEAD_SOURCES) {
    await db
      .insert(leadSourcesTable)
      .values({ code: src.code, name: src.name })
      .onConflictDoNothing({ target: leadSourcesTable.code })
  }

  for (const comp of DEFAULT_COMPANIES) {
    await db
      .insert(companiesTable)
      .values({
        code: comp.code,
        name: comp.name,
        legalName: comp.legalName,
        industry: comp.industry,
        city: comp.city,
        state: comp.state,
        country: 'India',
        gstin: comp.gstin,
      })
      .onConflictDoNothing({ target: companiesTable.code })
  }

  const companies = await db.select().from(companiesTable).orderBy(companiesTable.code)
  const codeToId = new Map(companies.map((c) => [c.code, c.id]))

  for (const ct of DEFAULT_CONTACTS) {
    const companyId = codeToId.get(ct.companyCode)
    if (!companyId) continue
    const existing = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(eq(contactsTable.email, ct.email))
    if (existing.length > 0) continue
    await db.insert(contactsTable).values({
      companyId,
      firstName: ct.firstName,
      lastName: ct.lastName,
      email: ct.email,
      phone: ct.phone,
      designation: ct.designation,
      isPrimary: ct.isPrimary,
    })
  }
}

export async function listCompaniesFromDb(): Promise<CompanyWithContacts[]> {
  await ensureDefaultCompaniesAndSources()

  const companies = await db
    .select({
      id: companiesTable.id,
      code: companiesTable.code,
      name: companiesTable.name,
      legalName: companiesTable.legalName,
      website: companiesTable.website,
      industry: companiesTable.industry,
      gstin: companiesTable.gstin,
      pan: companiesTable.pan,
      addressLine1: companiesTable.addressLine1,
      addressLine2: companiesTable.addressLine2,
      city: companiesTable.city,
      state: companiesTable.state,
      country: companiesTable.country,
      postalCode: companiesTable.postalCode,
      inquiryEmail: companiesTable.inquiryEmail,
      notes: companiesTable.notes,
      accountManagerId: companiesTable.accountManagerId,
      accountManagerFirstName: employeesTable.firstName,
      accountManagerLastName: employeesTable.lastName,
      status: companiesTable.status,
      createdAt: companiesTable.createdAt,
      updatedAt: companiesTable.updatedAt,
    })
    .from(companiesTable)
    .leftJoin(employeesTable, eq(companiesTable.accountManagerId, employeesTable.id))
    .orderBy(companiesTable.code)

  const allContacts = await db.select().from(contactsTable).orderBy(contactsTable.firstName)
  const allEmails = await db.select().from(companyEmailsTable).orderBy(companyEmailsTable.email)

  const contactsByCompany = new Map<string, typeof allContacts>()
  for (const c of allContacts) {
    const list = contactsByCompany.get(c.companyId) ?? []
    list.push(c)
    contactsByCompany.set(c.companyId, list)
  }

  const emailsByCompany = new Map<string, typeof allEmails>()
  for (const e of allEmails) {
    const list = emailsByCompany.get(e.companyId) ?? []
    list.push(e)
    emailsByCompany.set(e.companyId, list)
  }

  return companies.map((c) => {
    const accountManagerName = c.accountManagerFirstName
      ? `${c.accountManagerFirstName} ${c.accountManagerLastName || ''}`.trim()
      : null

    return {
      id: c.id,
      code: c.code,
      name: c.name,
      legalName: c.legalName,
      website: c.website,
      industry: c.industry,
      gstin: c.gstin,
      pan: c.pan,
      addressLine1: c.addressLine1,
      addressLine2: c.addressLine2,
      city: c.city,
      state: c.state,
      country: c.country,
      postalCode: c.postalCode,
      inquiryEmail: c.inquiryEmail,
      notes: c.notes,
      accountManagerId: c.accountManagerId,
      accountManagerName,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      contacts: (contactsByCompany.get(c.id) ?? []).map((ct) => ({
        id: ct.id,
        firstName: ct.firstName,
        lastName: ct.lastName,
        email: ct.email,
        phone: ct.phone,
        designation: ct.designation,
        isPrimary: ct.isPrimary ?? false,
      })),
      emails: (emailsByCompany.get(c.id) ?? []).map((e) => ({
        id: e.id,
        email: e.email,
        type: e.type,
      })),
    }
  })
}

export async function loadCompanySnapshot(
  search: CompanySearch,
): Promise<CompanySnapshot> {
  const companies = await listCompaniesFromDb()
  const query = search.q.toLocaleLowerCase()
  const filtered = companies.filter((c) => {
    const matchesQuery =
      !query ||
      c.name.toLocaleLowerCase().includes(query) ||
      (c.code?.toLocaleLowerCase().includes(query) ?? false) ||
      (c.city?.toLocaleLowerCase().includes(query) ?? false) ||
      (c.industry?.toLocaleLowerCase().includes(query) ?? false)
    const matchesStatus = search.status === 'all' || c.status === search.status
    return matchesQuery && matchesStatus
  })

  return {
    total: companies.length,
    matches: filtered.length,
    active: companies.filter((c) => c.status === 'active').length,
    query: search.q,
    status: search.status,
  }
}

export async function ensureDefaultDepartmentsAndDesignations(): Promise<{
  departments: DepartmentRecord[]
  designations: DesignationRecord[]
}> {
  for (const dept of DEFAULT_DEPARTMENTS) {
    await db
      .insert(departmentsTable)
      .values({ code: dept.code, name: dept.name })
      .onConflictDoNothing({ target: departmentsTable.code })
  }

  for (const desig of DEFAULT_DESIGNATIONS) {
    await db
      .insert(designationsTable)
      .values({ code: desig.code, name: desig.name })
      .onConflictDoNothing({ target: designationsTable.code })
  }

  const [departments, designations] = await Promise.all([
    db.select().from(departmentsTable).orderBy(departmentsTable.name),
    db.select().from(designationsTable).orderBy(designationsTable.name),
  ])

  return { departments, designations }
}

export type EmployeeWithDetails = {
  id: string
  employeeCode: string
  userId: string | null
  userEmail: string | null
  firstName: string
  lastName: string | null
  fullName: string
  email: string | null
  phone: string | null
  departmentId: string | null
  departmentCode: string | null
  departmentName: string | null
  designationId: string | null
  designationCode: string | null
  designationName: string | null
  managerId: string | null
  managerName: string | null
  employmentType: 'full_time' | 'contract' | 'intern' | 'consultant'
  status: 'active' | 'notice_period' | 'inactive' | 'terminated'
  joiningDate: string
  leavingDate: string | null
  skills: string[]
  avatar: string
  createdAt: string
  updatedAt: string
}

export async function listEmployeesFromDb(): Promise<EmployeeWithDetails[]> {
  await ensureDefaultDepartmentsAndDesignations()

  const rows = await db
    .select({
      id: employeesTable.id,
      employeeCode: employeesTable.employeeCode,
      userId: employeesTable.userId,
      userEmail: usersTable.email,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      email: employeesTable.email,
      phone: employeesTable.phone,
      departmentId: employeesTable.departmentId,
      departmentCode: departmentsTable.code,
      departmentName: departmentsTable.name,
      designationId: employeesTable.designationId,
      designationCode: designationsTable.code,
      designationName: designationsTable.name,
      managerId: employeesTable.managerId,
      employmentType: employeesTable.employmentType,
      status: employeesTable.status,
      joiningDate: employeesTable.joiningDate,
      leavingDate: employeesTable.leavingDate,
      skills: employeesTable.skills,
      createdAt: employeesTable.createdAt,
      updatedAt: employeesTable.updatedAt,
    })
    .from(employeesTable)
    .leftJoin(usersTable, eq(employeesTable.userId, usersTable.id))
    .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
    .leftJoin(designationsTable, eq(employeesTable.designationId, designationsTable.id))
    .orderBy(employeesTable.employeeCode)

  const employeeMap = new Map(rows.map((r) => [r.id, `${r.firstName} ${r.lastName || ''}`.trim()]))

  return rows.map((r) => {
    const fullName = `${r.firstName} ${r.lastName || ''}`.trim()
    const initials = `${r.firstName[0] || ''}${r.lastName?.[0] || ''}`.toUpperCase() || 'EM'

    return {
      id: r.id,
      employeeCode: r.employeeCode,
      userId: r.userId,
      userEmail: r.userEmail,
      firstName: r.firstName,
      lastName: r.lastName,
      fullName,
      email: r.email,
      phone: r.phone,
      departmentId: r.departmentId,
      departmentCode: r.departmentCode,
      departmentName: r.departmentName,
      designationId: r.designationId,
      designationCode: r.designationCode,
      designationName: r.designationName,
      managerId: r.managerId,
      managerName: r.managerId ? employeeMap.get(r.managerId) ?? null : null,
      employmentType: r.employmentType,
      status: r.status,
      joiningDate: r.joiningDate,
      leavingDate: r.leavingDate,
      skills: r.skills ?? [],
      avatar: initials,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }
  })
}

const projects: ProjectSnapshot[] = [
  { id: 'adnoc-gas-plant', name: 'ADNOC Gas Plant Expansion', status: 'active', owner: 'Sara Mohammed' },
  { id: 'masdar-campus', name: 'Masdar Campus Utilities', status: 'active', owner: 'Omar Rahman' },
  { id: 'dubai-marina', name: 'Dubai Marina Tower', status: 'at-risk', owner: 'Lina Haddad' },
]

const activity: CrmActivity[] = [
  { id: 'crm-1', title: 'Proposal P-2026-041 moved to review', detail: 'Commercial team requested one final margin check.', timestamp: '12 minutes ago', tone: 'warning' },
  { id: 'crm-2', title: 'ADNOC Gas Plant Expansion updated', detail: 'Sara Mohammed added the procurement milestone.', timestamp: '38 minutes ago', tone: 'success' },
  { id: 'crm-3', title: 'Invoice INV-2026-118 paid', detail: '₹ 28,45,000 cleared against the project account.', timestamp: '1 hour ago', tone: 'success' },
  { id: 'crm-4', title: 'New lead assigned to Omar Rahman', detail: 'Gulf Infrastructure Group entered the pipeline.', timestamp: '2 hours ago', tone: 'info' },
]

export async function loadCrmSnapshot(): Promise<CrmSnapshot> {
  return {
    activeProjects: projects.filter((project) => project.status === 'active').length,
    openLeads: 24,
    pendingProposals: 8,
    outstandingBalance: '₹ 1.84 Cr',
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    generatedAt: new Date().toISOString(),
  }
}

export async function loadCrmActivity(limit: number): Promise<CrmActivity[]> {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, 50)
  await promise
  return activity.slice(0, limit)
}

export async function loadProjectSnapshot(id: string): Promise<ProjectSnapshot | null> {
  return projects.find((project) => project.id === id) ?? null
}

export async function loadEmployeeSnapshot(search: EmployeeSearch): Promise<EmployeeSnapshot> {
  const employees = await listEmployeesFromDb()
  const query = search.q.toLocaleLowerCase()
  const matches = employees.filter((employee) => {
    const matchesQuery =
      !query ||
      employee.fullName.toLocaleLowerCase().includes(query) ||
      employee.employeeCode.toLocaleLowerCase().includes(query)
    const matchesStatus =
      search.status === 'all' || employee.status === search.status
    return matchesQuery && matchesStatus
  })

  return {
    total: employees.length,
    matches: matches.length,
    query: search.q,
    status: search.status,
  }
}
