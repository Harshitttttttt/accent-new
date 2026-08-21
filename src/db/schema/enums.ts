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
