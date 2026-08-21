import { z } from 'zod'

export const employeeSearchSchema = z.object({
  q: z.string().trim().max(80).catch('').default(''),
  status: z.enum(['all', 'active', 'on-leave']).catch('all').default('all'),
})

export type EmployeeSearch = z.infer<typeof employeeSearchSchema>

export type CrmSnapshot = {
  activeProjects: number
  openLeads: number
  pendingProposals: number
  outstandingBalance: string
  environment: 'development' | 'production'
  generatedAt: string
}

export type CrmActivity = {
  id: string
  title: string
  detail: string
  timestamp: string
  tone: 'success' | 'warning' | 'info'
}

export type ProjectSnapshot = {
  id: string
  name: string
  status: 'active' | 'completed' | 'at-risk'
  owner: string
}

export type EmployeeSnapshot = {
  total: number
  matches: number
  query: string
  status: EmployeeSearch['status']
}

export const companySearchSchema = z.object({
  q: z.string().trim().max(120).catch('').default(''),
  status: z.enum(['all', 'active', 'inactive']).catch('all').default('all'),
})

export type CompanySearch = z.infer<typeof companySearchSchema>

export type CompanyWithContacts = {
  id: string
  code: string
  name: string
  legalName: string | null
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
  status: 'active' | 'inactive'
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
  emails: {
    id: string
    email: string
    type: string | null
  }[]
}

export type CompanySnapshot = {
  total: number
  matches: number
  active: number
  query: string
  status: CompanySearch['status']
}
