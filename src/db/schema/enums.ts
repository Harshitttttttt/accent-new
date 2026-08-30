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

export const vendorQuotationStatusEnum = pgEnum('vendor_quotation_status', [
  'draft',
  'sent',
  'approved',
  'rejected',
  'expired',
])

export const saleInvoiceStatusEnum = pgEnum('sale_invoice_status', ['draft', 'sent', 'paid', 'overdue', 'cancelled'])

export const purchaseInvoiceStatusEnum = pgEnum('purchase_invoice_status', [
  'draft',
  'pending',
  'approved',
  'paid',
  'overdue',
  'cancelled',
])

export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'partial', 'paid', 'overdue'])

export const gstTypeEnum = pgEnum('gst_type', ['cgst_sgst', 'igst'])

export const riskStatusEnum = pgEnum('risk_status', ['open', 'mitigated', 'closed'])

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'not_started',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
])

export const assignmentPriorityEnum = pgEnum('assignment_priority', ['low', 'medium', 'high', 'critical'])

export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'in_progress',
  'waiting_on_user',
  'resolved',
  'closed',
])

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'low',
  'medium',
  'high',
  'urgent',
])

export const ticketCategoryEnum = pgEnum('ticket_category', [
  'it_support',
  'software_license',
  'hardware',
  'admin',
  'hr',
  'billing',
  'access_request',
  'other',
])

export const clientPurchaseOrderStatusEnum = pgEnum('client_purchase_order_status', [
  'draft',
  'acknowledged',
  'in_progress',
  'fulfilled',
  'on_hold',
  'cancelled',
])

export const vendorPurchaseOrderStatusEnum = pgEnum('vendor_purchase_order_status', [
  'draft',
  'pending_approval',
  'approved',
  'issued',
  'partially_received',
  'fulfilled',
  'cancelled',
])

export const clientPaymentStatusEnum = pgEnum('client_payment_status', [
  'draft',
  'pending_clearance',
  'cleared',
  'bounced',
  'cancelled',
])

export const clientPaymentTypeEnum = pgEnum('client_payment_type', [
  'invoice_payment',
  'advance_payment',
  'retention_release',
  'security_deposit',
  'other',
])

export const paymentModeEnum = pgEnum('payment_mode', [
  'neft',
  'rtgs',
  'imps',
  'cheque',
  'upi',
  'bank_transfer',
  'wire_transfer',
  'cash',
  'other',
])

export const paymentReleaseStatusEnum = pgEnum('payment_release_status', [
  'draft',
  'pending_approval',
  'approved',
  'processed',
  'cleared',
  'failed',
  'cancelled',
])

export const paymentReleaseTypeEnum = pgEnum('payment_release_type', [
  'advance_refund',
  'security_deposit_refund',
  'retention_release',
  'excess_payment_refund',
  'credit_settlement',
  'other',
])

