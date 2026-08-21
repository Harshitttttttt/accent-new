import { createFileRoute } from '@tanstack/react-router'
import GenericPage from '~/crm/pages/GenericPage'
import EmployeeDirectory from '~/crm/pages/EmployeeDirectory'
import CompanyMaster from '~/crm/pages/CompanyMaster'
import VendorMaster from '~/crm/pages/VendorMaster'
import BankMaster from '~/crm/pages/BankMaster'
import ActivityMaster from '~/crm/pages/ActivityMaster'
import SoftwareMaster from '~/crm/pages/SoftwareMaster'
import { useCrmNavigation } from '~/crm/navigation'

const MASTER_CONFIGS: Record<
  string,
  { title: string; description: string; columns: string[] }
> = {
  'employee-master': {
    title: 'Employee Master',
    description: 'Staff directory, skills, roles, and utilization',
    columns: [
      'Employee',
      'Role',
      'Department',
      'Location',
      'Utilization',
      'Skills',
      'Status',
    ],
  },
  'activity-master': {
    title: 'Activity Master',
    description: 'Define engineering project activities and rate units',
    columns: [
      'ID',
      'Activity Code',
      'Description',
      'Discipline',
      'Unit',
      'Status',
    ],
  },
  'software-master': {
    title: 'Software Master',
    description: 'Engineering software licenses and inventory',
    columns: ['ID', 'Software', 'Vendor', 'Licenses', 'Cost', 'Expiry'],
  },
  'deliverables-master': {
    title: 'Deliverables Master',
    description: 'Deliverable type catalog and revision standards',
    columns: ['ID', 'Code', 'Description', 'Discipline', 'Format', 'Status'],
  },
  'company-master': {
    title: 'Company Master',
    description: 'Client company registry and profile details',
    columns: ['ID', 'Company', 'Contact', 'Email', 'Phone', 'Status'],
  },
  'vendor-master': {
    title: 'Vendor Master',
    description: 'Approved suppliers, contractors, and service providers',
    columns: ['ID', 'Vendor', 'Category', 'Contact', 'Phone', 'Status'],
  },
  'bank-master': {
    title: 'Bank Master',
    description: 'Company bank accounts, currencies, and balances',
    columns: ['ID', 'Bank', 'Account', 'Currency', 'Balance', 'Status'],
  },
  'description-master': {
    title: 'Description Master',
    description: 'Standard line item descriptions for quotes and billing',
    columns: ['ID', 'Code', 'Description', 'Category', 'Unit', 'Status'],
  },
  'expense-category': {
    title: 'Expense Categories',
    description: 'Define expense classification and GL account links',
    columns: ['ID', 'Category', 'Code', 'GL Account', 'Type', 'Status'],
  },
  'holiday-master': {
    title: 'Holiday Master',
    description: 'Public and company holiday calendar',
    columns: ['ID', 'Holiday', 'Date', 'Type', 'Location', 'Status'],
  },
  'account-head': {
    title: 'Account Head Master',
    description: 'Financial chart of accounts and ledger hierarchy',
    columns: ['ID', 'Account', 'Code', 'Type', 'Parent', 'Status'],
  },
}

export const Route = createFileRoute('/masters/$master')({
  ssr: true,
  head: ({ params }) => {
    const config = MASTER_CONFIGS[params.master]
    return {
      meta: [
        {
          title: config
            ? `${config.title} | AccentCRM`
            : `${params.master} Master | AccentCRM`,
        },
      ],
    }
  },
  component: MasterRoute,
})

function MasterRoute() {
  const { master } = Route.useParams()
  const navigate = useCrmNavigation()

  if (master === 'employee-master') {
    return (
      <div className="h-full" data-route="master" data-master={master}>
        <EmployeeDirectory onNavigate={navigate} />
      </div>
    )
  }

  if (master === 'company-master') {
    return (
      <div className="h-full" data-route="company-master">
        <CompanyMaster onNavigate={navigate} />
      </div>
    )
  }

  if (master === 'vendor-master') {
    return (
      <div className="h-full" data-route="vendor-master">
        <VendorMaster />
      </div>
    )
  }

  if (master === 'bank-master') {
    return (
      <div className="h-full" data-route="bank-master">
        <BankMaster />
      </div>
    )
  }

  if (master === 'activity-master') {
    return (
      <div className="h-full" data-route="activity-master">
        <ActivityMaster />
      </div>
    )
  }

  if (master === 'software-master') {
    return (
      <div className="h-full" data-route="software-master">
        <SoftwareMaster />
      </div>
    )
  }

  const config = MASTER_CONFIGS[master] ?? {
    title: master.replaceAll('-', ' '),
    description: 'Master catalog records',
    columns: ['ID', 'Code', 'Description', 'Category', 'Status', 'Updated'],
  }

  return (
    <div className="h-full" data-route="master" data-master={master}>
      <GenericPage
        title={config.title}
        description={config.description}
        columns={config.columns}
      />
    </div>
  )
}
