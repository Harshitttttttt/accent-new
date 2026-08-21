import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { companySearchSchema, employeeSearchSchema } from './crm'
import { pingDatabase } from '../db/index.server'
import {
  listCompaniesFromDb,
  loadCompanySnapshot,
  loadCrmActivity,
  loadCrmSnapshot,
  loadEmployeeSnapshot,
  loadProjectSnapshot,
} from './crm.server'

const activityInput = z.object({
  limit: z.number().int().min(1).max(10).catch(4),
})

const projectInput = z.object({
  id: z.string().min(1).max(80),
})

export const getCrmSnapshot = createServerFn({ method: 'GET' }).handler(() =>
  loadCrmSnapshot(),
)

export const getDatabaseHealth = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    await pingDatabase()
    return { connected: true, checkedAt: new Date().toISOString() }
  } catch (error) {
    console.error('Database health check failed', error)
    return { connected: false, checkedAt: new Date().toISOString() }
  }
})

export const getCrmActivity = createServerFn({ method: 'GET' })
  .validator(activityInput)
  .handler(({ data }) => loadCrmActivity(data.limit))

export const getProjectSnapshot = createServerFn({ method: 'GET' })
  .validator(projectInput)
  .handler(({ data }) => loadProjectSnapshot(data.id))

export const getEmployeeSnapshot = createServerFn({ method: 'GET' })
  .validator(employeeSearchSchema)
  .handler(({ data }) => loadEmployeeSnapshot(data))

export const getCompanySnapshot = createServerFn({ method: 'GET' })
  .validator(companySearchSchema)
  .handler(({ data }) => loadCompanySnapshot(data))

export const getCompanyList = createServerFn({ method: 'GET' }).handler(() =>
  listCompaniesFromDb(),
)
