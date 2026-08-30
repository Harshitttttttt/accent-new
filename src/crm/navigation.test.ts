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
    expect(pageFromPath('/support')).toBe('support')
    expect(pageFromPath('/masters/users')).toBe('user-master')
    expect(pageFromPath('/masters/software-master')).toBe('software-master')
    expect(pageFromPath('/reports/reports-employee')).toBe('reports-employee')
    expect(pageFromPath('/admin/client-quotations')).toBe('client-quotations')
    expect(pageFromPath('/admin/client-quotations/q-123')).toBe('client-quotations')
    expect(pageFromPath('/admin/vendor-quotations')).toBe('vendor-quotations')
    expect(pageFromPath('/admin/client-purchase-orders')).toBe('client-purchase-orders')
    expect(pageFromPath('/admin/client-purchase-orders/cpo-123')).toBe('client-purchase-orders')
    expect(pageFromPath('/admin/vendor-purchase-orders')).toBe('vendor-purchase-orders')
    expect(pageFromPath('/admin/vendor-purchase-orders/vpo-123')).toBe('vendor-purchase-orders')
    expect(pageFromPath('/admin/sale-invoices')).toBe('sale-invoices')
    expect(pageFromPath('/admin/payment-received')).toBe('payment-received')
    expect(pageFromPath('/admin/payments-received')).toBe('payment-received')
    expect(pageFromPath('/admin/payment-issued')).toBe('payment-issued')
    expect(pageFromPath('/admin/payments-released')).toBe('payment-issued')
    // Legacy aliases
    expect(pageFromPath('/admin/quotations')).toBe('client-quotations')
    expect(pageFromPath('/admin/quotation-outgoing')).toBe('vendor-quotations')
    expect(pageFromPath('/admin/purchase-orders')).toBe('client-purchase-orders')
    expect(pageFromPath('/admin/purchase-orders-incoming')).toBe('client-purchase-orders')
    expect(pageFromPath('/admin/purchase-orders-outgoing')).toBe('vendor-purchase-orders')
  })

  it('maps dynamic generic modules under /module/$module', () => {
    expect(pageFromPath('/module/support')).toBe('support')
  })

  it('falls back to dashboard for unmatched paths', () => {
    expect(pageFromPath('/unknown-path')).toBe('dashboard')
  })
})
