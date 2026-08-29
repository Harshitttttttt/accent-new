import { createFileRoute } from '@tanstack/react-router'
import GenericPage from '~/crm/pages/GenericPage'

const MODULES: Record<string, { title: string; description: string; columns: string[] }> = {
  quotations: { title: 'Client Quotations', description: 'Manage client quotations', columns: ['ID', 'Quotation No.', 'Description', 'Amount', 'Status', 'Date'] },
  'purchase-orders': { title: 'Purchase Orders', description: 'Track procurement orders', columns: ['ID', 'PO Number', 'Vendor', 'Amount', 'Status', 'Date'] },
  'purchase-invoices': { title: 'Purchase Invoices', description: 'Vendor invoices received', columns: ['ID', 'Invoice No.', 'Vendor', 'Amount', 'Status', 'Date'] },
  expenses: { title: 'Expenses', description: 'Employee expense submissions', columns: ['ID', 'Reference', 'Description', 'Amount', 'Status', 'Date'] },
  'cash-voucher': { title: 'Cash Vouchers', description: 'Cash payment vouchers', columns: ['ID', 'Voucher No.', 'Description', 'Amount', 'Status', 'Date'] },
  'material-req': { title: 'Material Requisitions', description: 'Project material requests', columns: ['ID', 'Req No.', 'Project', 'Amount', 'Status', 'Date'] },
  'salary-sheet': { title: 'Salary Sheet', description: 'Monthly payroll summary', columns: ['ID', 'Employee', 'Month', 'Net Pay', 'Status', 'Date'] },
  'salary-slip': { title: 'Salary Slips', description: 'Individual payslips', columns: ['ID', 'Employee', 'Month', 'Net Pay', 'Status', 'Date'] },
  'activity-logs': { title: 'Activity Logs', description: 'System audit trail', columns: ['ID', 'User', 'Action', 'Module', 'IP', 'Timestamp'] },
  'live-monitoring': { title: 'Live Monitoring', description: 'Real-time project monitoring dashboard', columns: ['ID', 'Project', 'Status', 'Progress', 'Team Online', 'Last Update'] },
  'activity-master': { title: 'Activity Master', description: 'Define project activities', columns: ['ID', 'Activity Code', 'Description', 'Discipline', 'Unit', 'Status'] },
  'software-master': { title: 'Software Master', description: 'Engineering software inventory', columns: ['ID', 'Software', 'Vendor', 'Licenses', 'Cost', 'Expiry'] },
  'deliverables-master': { title: 'Deliverables Master', description: 'Deliverable type catalog', columns: ['ID', 'Code', 'Description', 'Discipline', 'Format', 'Status'] },
  'company-master': { title: 'Company Master', description: 'Client company registry', columns: ['ID', 'Company', 'Contact', 'Email', 'Phone', 'Status'] },
  'vendor-master': { title: 'Vendor Master', description: 'Supplier and vendor registry', columns: ['ID', 'Vendor', 'Category', 'Contact', 'Phone', 'Status'] },
  'bank-master': { title: 'Bank Master', description: 'Bank account registry', columns: ['ID', 'Bank', 'Account', 'Currency', 'Balance', 'Status'] },
  'description-master': { title: 'Description Master', description: 'Standard descriptions for line items', columns: ['ID', 'Code', 'Description', 'Category', 'Unit', 'Status'] },
  'expense-category': { title: 'Expense Categories', description: 'Define expense classification', columns: ['ID', 'Category', 'Code', 'GL Account', 'Type', 'Status'] },
  'holiday-master': { title: 'Holiday Master', description: 'Public and company holidays', columns: ['ID', 'Holiday', 'Date', 'Type', 'Location', 'Status'] },
  'account-head': { title: 'Account Head Master', description: 'Chart of accounts', columns: ['ID', 'Account', 'Code', 'Type', 'Parent', 'Status'] },
  support: { title: 'Support Tickets', description: 'IT and admin support requests', columns: ['ID', 'Ticket No.', 'Subject', 'Priority', 'Status', 'Date'] },
}

export const Route = createFileRoute('/module/$module')({
  ssr: false,
  pendingComponent: ModulePending,
  component: ModuleRoute,
})

function ModuleRoute() {
  const { module } = Route.useParams()
  const config = MODULES[module] ?? {
    title: module.replaceAll('-', ' '),
    description: 'CRM workspace records',
    columns: ['ID', 'Reference', 'Description', 'Status', 'Owner', 'Updated'],
  }

  return (
    <div className="h-full" data-route="module" data-module={module}>
      <GenericPage {...config} />
    </div>
  )
}

function ModulePending() {
  return (
    <div className="grid h-full place-items-center bg-[var(--bg)] text-sm text-[var(--text-muted)]">
      Loading CRM records…
    </div>
  )
}
