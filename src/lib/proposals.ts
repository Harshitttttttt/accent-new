import { z } from 'zod'

// ── Status / vocabulary (single canonical set) ───────────────────────────
export const PROPOSAL_STATUSES = [
  'draft',
  'internal_review',
  'sent',
  'negotiation',
  'accepted',
  'rejected',
  'cancelled',
] as const

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: 'Draft',
  internal_review: 'Internal Review',
  sent: 'Sent',
  negotiation: 'Negotiation',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

/** Status badge color classes for the CRM theme. */
export const PROPOSAL_STATUS_BADGES: Record<ProposalStatus, string> = {
  draft: 'badge-neutral',
  internal_review: 'badge-info',
  sent: 'badge-cyan',
  negotiation: 'badge-warning',
  accepted: 'badge-success',
  rejected: 'badge-danger',
  cancelled: 'badge-neutral',
}

/** Statuses that still count as live pipeline (not decided/closed). */
export const OPEN_PROPOSAL_STATUSES: readonly ProposalStatus[] = [
  'draft',
  'internal_review',
  'sent',
  'negotiation',
]

export const PROPOSAL_CONTRACT_TYPES = ['lumpsum', 'manhours_basis', 'line_wise'] as const
export type ProposalContractType = (typeof PROPOSAL_CONTRACT_TYPES)[number]

export const PROPOSAL_CONTRACT_TYPE_LABELS: Record<ProposalContractType, string> = {
  lumpsum: 'Lumpsum',
  manhours_basis: 'Man-hours basis',
  line_wise: 'Line-wise',
}

export const PROPOSAL_DELIVERY_MODES = [
  'Onsite at client location',
  'Offshore at ATS office',
  'Hybrid',
] as const

/** Standard terms seeded on new proposals (ported from the old CRM, INR wording). */
export const DEFAULT_PAYMENT_TERMS = `Payment shall be released by the client within 7 days from the date of the invoice.
Payment shall be by way of RTGS transfer to ATSPL bank account.
Late payment charges will be 2% per month on the total bill amount if bills are not settled within the credit period of 30 days.
In case of project delays beyond two months, software cost of ₹10,000/- per month will be charged.
Upon completion of the scope of work, if a project is cancelled or held by the client for any reason, Accent Techno Solutions Private Limited is entitled to 100% invoice against the completed work.`

export const DEFAULT_OTHER_TERMS = `Input, output & any excerpts in between are intellectual property of the client. ATS shall not voluntarily disclose any such documents to third parties and will undertake all commonly accepted practices and tools to avoid the loss or spillover of such information.
ATS shall take utmost care to maintain confidentiality of any information or intellectual property of the client that it may come across.
ATS is allowed to use the contract as a customer reference. However, no data or intellectual property of the client can be disclosed to third parties without the written consent of the client.
Any additional work will be charged extra. GST 18% extra as applicable on total project cost.
The proposal is based on the client's enquiry and provided input data.
Work will start within 15 days after receipt of confirmed LOI/PO.`

// ── Validators shared by server functions ────────────────────────────────
const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

const optionalEmail = z.preprocess(emptyToNull, z.string().trim().max(255).email().nullable())
const optionalShortText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable())
const optionalDate = z.preprocess(emptyToNull, z.string().date().nullable())
const optionalMoney = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
)

export const proposalSoftwareInputSchema = z.object({
  softwareId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  name: z.string().trim().min(1, 'Software name is required').max(255),
  notes: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
})

export const proposalQuotationLineInputSchema = z.object({
  description: z.string().trim().min(1, 'Line description is required').max(500),
  quantity: z.number().int().min(1).max(100_000),
  unitPricePaise: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
})

export const proposalInputSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(255),
  description: optionalShortText(10_000),
  companyId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  companyName: z.string().trim().min(2, 'Company name is required').max(255),
  contactName: optionalShortText(255),
  contactEmail: optionalEmail,
  contactPhone: optionalShortText(20),
  designation: optionalShortText(100),
  city: optionalShortText(100),
  siteLocation: optionalShortText(255),
  scopeOfWork: optionalShortText(200_000),
  priority: z.enum(['low', 'medium', 'high']),
  contractType: z.enum(PROPOSAL_CONTRACT_TYPES),
  valuePaise: optionalMoney,
  plannedStartDate: optionalDate,
  plannedEndDate: optionalDate,
  dueDate: optionalDate,
  modeOfDelivery: optionalShortText(100),
  revisionsIncluded: z.number().int().min(0).max(20),
  siteVisits: z.number().int().min(0).max(100),
  siteVisitNotes: optionalShortText(5_000),
  validityDays: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.number().int().min(0).max(365).nullable(),
  ),
  estimatedCostPaise: optionalMoney,
  commercialNotes: optionalShortText(5_000),
  paymentTerms: optionalShortText(10_000),
  otherTerms: optionalShortText(10_000),
  inputDocuments: z.array(z.string().trim().min(1).max(500)).max(100),
  deliverables: z.array(z.string().trim().min(1).max(500)).max(100),
  exclusions: z.array(z.string().trim().min(1).max(500)).max(100),
  software: z.array(proposalSoftwareInputSchema).max(100),
  quotationLines: z.array(proposalQuotationLineInputSchema).max(200),
})

export type ProposalInput = z.infer<typeof proposalInputSchema>

export const proposalUpdateSchema = proposalInputSchema.extend({
  id: z.string().uuid(),
})
export type ProposalUpdate = z.infer<typeof proposalUpdateSchema>

export const proposalStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(PROPOSAL_STATUSES),
  note: optionalShortText(1_000),
})

export const proposalFollowUpInputSchema = z.object({
  proposalId: z.string().uuid(),
  dueDate: z.string().date(),
  note: z.string().trim().min(1, 'Note is required').max(2_000),
})

export const proposalFollowUpToggleSchema = z.object({
  id: z.string().uuid(),
  done: z.boolean(),
})

export const proposalCommentInputSchema = z.object({
  proposalId: z.string().uuid(),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5_000),
})

export const convertLeadToProposalSchema = z.object({
  leadId: z.string().uuid(),
})

export const proposalIdSchema = z.object({
  id: z.string().uuid(),
})

// ── Serialized shapes crossing the RPC boundary ──────────────────────────
export type ProposalListItem = {
  id: string
  proposalNumber: string
  title: string
  companyName: string
  status: ProposalStatus
  priority: 'low' | 'medium' | 'high'
  contractType: ProposalContractType
  valuePaise: number | null
  dueDate: string | null
  leadId: string | null
  leadNumber: string | null
  createdAt: string
}

export type ProposalSoftwareLine = {
  id: string
  softwareId: string | null
  name: string
  notes: string | null
}

export type ClientQuotationLine = {
  id: string
  description: string
  quantity: number
  unitPricePaise: number
  amountPaise: number
}

export type ProposalFollowUp = {
  id: string
  dueDate: string
  note: string
  doneAt: string | null
}

export type ProposalComment = {
  id: string
  authorName: string | null
  body: string
  createdAt: string
}

/**
 * Twenty-style unified timeline: status transitions and discussion comments
 * interleaved into one chronological feed (newest first).
 */
export type ProposalTimelineItem = {
  id: string
  kind: 'comment' | 'status'
  at: string
  authorName: string | null
  body: string | null
  fromStatus: ProposalStatus | null
  toStatus: ProposalStatus | null
  note: string | null
}

export type ProposalDetail = {
  id: string
  proposalNumber: string
  leadId: string | null
  leadNumber: string | null
  companyId: string | null
  companyName: string
  title: string
  description: string | null
  status: ProposalStatus
  priority: 'low' | 'medium' | 'high'
  contractType: ProposalContractType
  valuePaise: number | null
  currency: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  designation: string | null
  city: string | null
  siteLocation: string | null
  scopeOfWork: string | null
  plannedStartDate: string | null
  plannedEndDate: string | null
  dueDate: string | null
  modeOfDelivery: string | null
  revisionsIncluded: number
  siteVisits: number
  siteVisitNotes: string | null
  validityDays: number | null
  estimatedCostPaise: number | null
  commercialNotes: string | null
  paymentTerms: string | null
  otherTerms: string | null
  inputDocuments: string[]
  deliverables: string[]
  exclusions: string[]
  software: ProposalSoftwareLine[]
  quotationLines: ProposalQuotationLine[]
  followUps: ProposalFollowUp[]
  comments: ProposalComment[]
  timeline: ProposalTimelineItem[]
  createdAt: string
  updatedAt: string
}

export type ProposalFormOptions = {
  companies: { id: string; code: string; name: string }[]
  software: { id: string; name: string; version: string | null }[]
}

export type ProposalsPagePayload = {
  authorized: boolean
  proposals: ProposalListItem[]
  options: ProposalFormOptions
}

export type ProposalDetailPayload = {
  authorized: boolean
  proposal: ProposalDetail | null
  options: ProposalFormOptions
}

// ── Client-side rollups (mirror leads.computeLeadStats pattern) ──────────
export type ProposalStats = {
  totalProposals: number
  totalValuePaise: number
  openValuePaise: number
  acceptedValuePaise: number
  byStatus: Record<ProposalStatus, { count: number; valuePaise: number }>
}

export const EMPTY_PROPOSAL_STATS: ProposalStats = {
  totalProposals: 0,
  totalValuePaise: 0,
  openValuePaise: 0,
  acceptedValuePaise: 0,
  byStatus: Object.fromEntries(
    PROPOSAL_STATUSES.map((status) => [status, { count: 0, valuePaise: 0 }]),
  ) as ProposalStats['byStatus'],
}

/**
 * Client-side rollup so KPI tiles react instantly to status changes and
 * optimistic updates without a refetch.
 */
export function computeProposalStats(
  proposals: readonly {
    status: ProposalStatus
    valuePaise: number | null
  }[],
): ProposalStats {
  const stats: ProposalStats = {
    totalProposals: proposals.length,
    totalValuePaise: 0,
    openValuePaise: 0,
    acceptedValuePaise: 0,
    byStatus: Object.fromEntries(
      PROPOSAL_STATUSES.map((status) => [status, { count: 0, valuePaise: 0 }]),
    ) as ProposalStats['byStatus'],
  }
  for (const proposal of proposals) {
    const valuePaise = proposal.valuePaise ?? 0
    const bucket = stats.byStatus[proposal.status]
    bucket.count += 1
    bucket.valuePaise += valuePaise
    stats.totalValuePaise += valuePaise
    if (OPEN_PROPOSAL_STATUSES.includes(proposal.status)) stats.openValuePaise += valuePaise
    if (proposal.status === 'accepted') stats.acceptedValuePaise += valuePaise
  }
  return stats
}

/** Sum of quotation line amounts — integer paise math, safe for display. */
export function quotationLinesTotalPaise(
  lines: readonly { quantity: number; unitPricePaise: number }[],
): number {
  return lines.reduce((total, line) => total + line.quantity * line.unitPricePaise, 0)
}

/** @deprecated use ClientQuotationLine */
export type ProposalQuotationLine = ClientQuotationLine
