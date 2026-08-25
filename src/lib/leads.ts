import { z } from 'zod'

// ── Stage / priority vocabularies (single canonical set) ─────────────────
export const LEAD_STAGES = [
  'prospecting',
  'qualified',
  'proposal_sent',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const

export type LeadStage = (typeof LEAD_STAGES)[number]

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  prospecting: 'Prospecting',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

/** Stages that still count toward the open pipeline value. */
export const OPEN_LEAD_STAGES: readonly LeadStage[] = [
  'prospecting',
  'qualified',
  'proposal_sent',
  'negotiation',
]

/** Stages that end the deal lifecycle. */
export const CLOSED_LEAD_STAGES: readonly LeadStage[] = ['closed_won', 'closed_lost']

export const LEAD_PRIORITIES = ['low', 'medium', 'high'] as const
export type LeadPriority = (typeof LEAD_PRIORITIES)[number]

export const LEAD_PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const LEAD_SOURCE_CODES = [
  'website',
  'linkedin',
  'referral',
  'existing_client',
  'cold_call',
  'tender_portal',
  'exhibition',
  'other',
] as const

export type LeadSourceCode = (typeof LEAD_SOURCE_CODES)[number]

export const LEAD_SOURCE_LABELS: Record<LeadSourceCode, string> = {
  website: 'Website',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  existing_client: 'Existing Client',
  cold_call: 'Cold Call',
  tender_portal: 'Tender Portal',
  exhibition: 'Exhibition',
  other: 'Other',
}

export const LEAD_ENQUIRY_TYPES = ['Email', 'Phone', 'Meeting', 'WhatsApp', 'Tender', 'Other'] as const

// ── Serialized row shape crossing the RPC boundary ───────────────────────
export type LeadListItem = {
  id: string
  leadNumber: string
  companyId: string | null
  companyName: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  designation: string | null
  inquiryEmail: string | null
  ccEmails: string[]
  city: string | null
  projectDescription: string | null
  enquiryType: string
  sourceCode: LeadSourceCode
  stage: LeadStage
  priority: LeadPriority
  valuePaise: number | null
  probability: number | null
  score: number | null
  closedAt: string | null
  lostReason: string | null
  assignedTo: string | null
  assigneeName: string | null
  enquiryDate: string
  expectedCloseDate: string | null
  lastActivityAt: string
  notes: string | null
  createdAt: string
}

export type LeadStats = {
  totalLeads: number
  openPipelinePaise: number
  wonValuePaise: number
  byStage: Record<LeadStage, { count: number; valuePaise: number }>
}

export type LeadFormOptions = {
  companies: { id: string; code: string; name: string }[]
  employees: { id: string; firstName: string; lastName: string | null }[]
}

export type LeadsPagePayload = {
  authorized: boolean
  leads: LeadListItem[]
  stats: LeadStats
  options: LeadFormOptions
}

export const EMPTY_LEAD_STATS: LeadStats = {
  totalLeads: 0,
  openPipelinePaise: 0,
  wonValuePaise: 0,
  byStage: Object.fromEntries(
    LEAD_STAGES.map((stage) => [stage, { count: 0, valuePaise: 0 }]),
  ) as LeadStats['byStage'],
}

/**
 * Client-side mirror of `getLeadStats()` (leads.server.ts) — rolls KPIs up from
 * a leads list so the UI reacts instantly to optimistic kanban moves without a
 * refetch. Keep the open/won rules in sync with the SQL version.
 */
export function computeLeadStats(
  leads: readonly { stage: LeadStage; valuePaise: number | null }[],
): LeadStats {
  const stats: LeadStats = {
    totalLeads: leads.length,
    openPipelinePaise: 0,
    wonValuePaise: 0,
    byStage: Object.fromEntries(
      LEAD_STAGES.map((stage) => [stage, { count: 0, valuePaise: 0 }]),
    ) as LeadStats['byStage'],
  }
  for (const lead of leads) {
    const valuePaise = lead.valuePaise ?? 0
    const bucket = stats.byStage[lead.stage]
    bucket.count += 1
    bucket.valuePaise += valuePaise
    if (OPEN_LEAD_STAGES.includes(lead.stage)) stats.openPipelinePaise += valuePaise
    if (lead.stage === 'closed_won') stats.wonValuePaise += valuePaise
  }
  return stats
}

export const EMPTY_LEADS_PAGE: LeadsPagePayload = {
  authorized: false,
  leads: [],
  stats: EMPTY_LEAD_STATS,
  options: { companies: [], employees: [] },
}

// ── Validators shared by server functions ────────────────────────────────
const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

const optionalEmail = z.preprocess(emptyToNull, z.string().trim().max(255).email().nullable())
const optionalShortText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable())
const optionalDate = z.preprocess(emptyToNull, z.string().date().nullable())

export const leadInputSchema = z.object({
  companyId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  companyName: z.string().trim().min(2, 'Company name is required').max(255),
  contactName: optionalShortText(255).optional(),
  contactEmail: optionalEmail.optional(),
  contactPhone: optionalShortText(20).optional(),
  designation: optionalShortText(100).optional(),
  inquiryEmail: optionalEmail.optional(),
  ccEmails: z.array(z.string().trim().email()).max(10).optional(),
  city: optionalShortText(100).optional(),
  projectDescription: optionalShortText(5000).optional(),
  enquiryType: z.enum(LEAD_ENQUIRY_TYPES).default('Email'),
  sourceCode: z.enum(LEAD_SOURCE_CODES).default('website'),
  stage: z.enum(LEAD_STAGES).default('prospecting'),
  priority: z.enum(LEAD_PRIORITIES).default('medium'),
  valuePaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  lostReason: optionalShortText(500).optional(),
  assignedTo: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  enquiryDate: optionalDate.optional(),
  expectedCloseDate: optionalDate.optional(),
  notes: optionalShortText(5000).optional(),
})

export type LeadInput = z.infer<typeof leadInputSchema>

export const updateLeadSchema = leadInputSchema.extend({
  id: z.string().uuid(),
})

export type LeadUpdate = z.infer<typeof updateLeadSchema>

export const updateLeadStageSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(LEAD_STAGES),
})

export const deleteLeadSchema = z.object({
  id: z.string().uuid(),
})
