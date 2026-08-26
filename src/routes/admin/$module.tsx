import { createFileRoute } from '@tanstack/react-router'
import GenericPage from '~/crm/pages/GenericPage'

const ADMIN_MODULES: Record<
  string,
  { title: string; description: string; columns: string[] }
> = {
  'purchase-orders': {
    title: 'Purchase Orders',
    description: 'Track procurement and material purchase orders',
    columns: ['ID', 'PO Number', 'Vendor', 'Amount', 'Status', 'Date'],
  },
  'sale-invoices': {
    title: 'Sale Invoices',
    description: 'Client billing and tax invoices',
    columns: ['ID', 'Invoice No.', 'Client', 'Amount', 'Status', 'Date'],
  },
  'purchase-invoices': {
    title: 'Purchase Invoices',
    description: 'Vendor invoices received and payment reconciliation',
    columns: ['ID', 'Invoice No.', 'Vendor', 'Amount', 'Status', 'Date'],
  },
  'payment-received': {
    title: 'Payment Received',
    description: 'Record incoming client payments and receipts',
    columns: ['ID', 'Receipt No.', 'Client', 'Amount', 'Status', 'Date'],
  },
  'payment-issued': {
    title: 'Payment Issued',
    description: 'Track outgoing vendor payments and disbursements',
    columns: ['ID', 'Payment No.', 'Vendor', 'Amount', 'Status', 'Date'],
  },
  expenses: {
    title: 'Expenses',
    description: 'Employee and project expense claims',
    columns: ['ID', 'Reference', 'Description', 'Amount', 'Status', 'Date'],
  },
  'cash-voucher': {
    title: 'Cash Vouchers',
    description: 'Petty cash payment and receipt vouchers',
    columns: ['ID', 'Voucher No.', 'Description', 'Amount', 'Status', 'Date'],
  },
  'material-req': {
    title: 'Material Requisitions',
    description: 'Project site material requests and tracking',
    columns: ['ID', 'Req No.', 'Project', 'Amount', 'Status', 'Date'],
  },
  'salary-sheet': {
    title: 'Salary Sheet',
    description: 'Monthly payroll and compensation sheets',
    columns: ['ID', 'Employee', 'Month', 'Net Pay', 'Status', 'Date'],
  },
  'salary-slip': {
    title: 'Salary Slips',
    description: 'Individual employee payslips and deductions',
    columns: ['ID', 'Employee', 'Month', 'Net Pay', 'Status', 'Date'],
  },
  'activity-logs': {
    title: 'Activity Logs',
    description: 'System audit logs and operational event history',
    columns: ['ID', 'User', 'Action', 'Module', 'IP', 'Timestamp'],
  },
  'live-monitoring': {
    title: 'Live Monitoring',
    description: 'Real-time project operations and delivery pulse',
    columns: [
      'ID',
      'Project',
      'Status',
      'Progress',
      'Team Online',
      'Last Update',
    ],
  },
  todos: {
    title: 'Todos & Action Items',
    description: 'Team checklist and operational action items',
    columns: ['ID', 'Task', 'Assignee', 'Due Date', 'Status', 'Priority'],
  },
}

export const Route = createFileRoute('/admin/$module')({
  ssr: true,
  head: ({ params }) => {
    const config = ADMIN_MODULES[params.module]
    return {
      meta: [
        {
          title: config
            ? `${config.title} | AccentCRM`
            : `${params.module} | AccentCRM`,
        },
      ],
    }
  },
  component: AdminModuleRoute,
})

function AdminModuleRoute() {
  const { module } = Route.useParams()
  const config = ADMIN_MODULES[module] ?? {
    title: module.replaceAll('-', ' '),
    description: 'Administration records',
    columns: ['ID', 'Reference', 'Description', 'Status', 'Owner', 'Updated'],
  }

  return (
    <div className="h-full" data-route="admin-module" data-module={module}>
      <GenericPage
        title={config.title}
        description={config.description}
        columns={config.columns}
      />
    </div>
  )
}
