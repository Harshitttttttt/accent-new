import { describe, expect, it } from 'vitest'
import { pageFromPath } from './navigation'

describe('CRM Navigation mapping', () => {
  it('maps standard root and feature paths to page identifiers', () => {
    expect(pageFromPath('/')).toBe('dashboard')
    expect(pageFromPath('/projects')).toBe('projects')
    expect(pageFromPath('/projects/adnoc-gas-plant')).toBe('project-detail')
    expect(pageFromPath('/leads')).toBe('leads')
    expect(pageFromPath('/proposals')).toBe('proposals')
    expect(pageFromPath('/finance')).toBe('financial-dashboard')
    expect(pageFromPath('/employees')).toBe('employee-master')
    expect(pageFromPath('/employees/sara-mohammed')).toBe('employee-profile')
    expect(pageFromPath('/reports')).toBe('reports')
    expect(pageFromPath('/tasks')).toBe('tasks')
    expect(pageFromPath('/messages')).toBe('messages')
    expect(pageFromPath('/masters/users')).toBe('user-master')
    expect(pageFromPath('/masters/software-master')).toBe('software-master')
    expect(pageFromPath('/reports/reports-employee')).toBe('reports-employee')
    expect(pageFromPath('/admin/client-quotations')).toBe('client-quotations')
    expect(pageFromPath('/admin/client-quotations/q-123')).toBe('client-quotations')
    expect(pageFromPath('/admin/sale-invoices')).toBe('sale-invoices')
    // Legacy aliases
    expect(pageFromPath('/admin/quotations')).toBe('client-quotations')
    expect(pageFromPath('/admin/quotation-outgoing')).toBe('vendor-quotations')
  })

  it('maps dynamic generic modules under /module/$module', () => {
    expect(pageFromPath('/module/support')).toBe('support')
  })

  it('falls back to dashboard for unmatched paths', () => {
    expect(pageFromPath('/unknown-path')).toBe('dashboard')
  })
})
