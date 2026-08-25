import { pgEnum } from 'drizzle-orm/pg-core'

export const projectStatus = pgEnum('crm_project_status', ['active', 'at-risk', 'completed'])
export const activityTone = pgEnum('crm_activity_tone', ['success', 'warning', 'info', 'danger'])
export const employmentTypeEnum = pgEnum('employment_type', ['full_time', 'contract', 'intern', 'consultant'])
export const employeeStatusEnum = pgEnum('employee_status', ['active', 'notice_period', 'inactive', 'terminated'])
export const companyStatusEnum = pgEnum('company_status', ['active', 'inactive'])
export const vendorCategoryEnum = pgEnum('vendor_category', [
  'supplier',
  'subcontractor',
  'service_provider',
  'contractor',
  'manufacturer',
  'trader',
  'consultant',
  'oem',
  'distributor',
])
export const vendorStatusEnum = pgEnum('vendor_status', ['active', 'inactive', 'blacklisted', 'on_hold'])
export const bankAccountTypeEnum = pgEnum('bank_account_type', ['savings', 'current', 'cc', 'od', 'loan', 'nre', 'nro'])
export const bankStatusEnum = pgEnum('bank_status', ['active', 'inactive', 'closed', 'dormant', 'frozen'])
export const leadSourceCodeEnum = pgEnum('lead_source_code', [
  'website',
  'linkedin',
  'referral',
  'existing_client',
  'cold_call',
  'tender_portal',
  'exhibition',
  'other',
])

export const leadStageEnum = pgEnum('lead_stage', [
  'prospecting',
  'qualified',
  'proposal_sent',
  'negotiation',
  'closed_won',
  'closed_lost',
])

export const leadPriorityEnum = pgEnum('lead_priority', ['low', 'medium', 'high'])

export const leadEnquiryTypeEnum = pgEnum('lead_enquiry_type', [
  'Email',
  'Phone',
  'Meeting',
  'WhatsApp',
  'Tender',
  'Other',
])

export const proposalStatusEnum = pgEnum('proposal_status', [
  'draft',
  'internal_review',
  'sent',
  'negotiation',
  'accepted',
  'rejected',
  'cancelled',
])

export const proposalContractTypeEnum = pgEnum('proposal_contract_type', [
  'lumpsum',
  'manhours_basis',
  'line_wise',
])

export const projectLifecycleEnum = pgEnum('project_lifecycle', [
  'planning',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
])

export const milestoneStatusEnum = pgEnum('milestone_status', ['pending', 'in_progress', 'done'])

export const riskSeverityEnum = pgEnum('risk_severity', ['low', 'medium', 'high'])

export const riskStatusEnum = pgEnum('risk_status', ['open', 'mitigated', 'closed'])
