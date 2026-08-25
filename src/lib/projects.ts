import { z } from 'zod'

// ── Lifecycle / vocabulary (single canonical set) ────────────────────────
export const PROJECT_STATUSES = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const PROJECT_STATUS_BADGES: Record<ProjectStatus, string> = {
  planning: 'badge-info',
  in_progress: 'badge-success',
  on_hold: 'badge-warning',
  completed: 'badge-purple',
  cancelled: 'badge-neutral',
}

/** Statuses that count as live delivery work. */
export const ACTIVE_PROJECT_STATUSES: readonly ProjectStatus[] = ['planning', 'in_progress', 'on_hold']

export const MILESTONE_STATUSES = ['pending', 'in_progress', 'done'] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
}

export const RISK_SEVERITIES = ['low', 'medium', 'high'] as const
export type RiskSeverity = (typeof RISK_SEVERITIES)[number]

export const RISK_STATUSES = ['open', 'mitigated', 'closed'] as const
export type RiskStatus = (typeof RISK_STATUSES)[number]

// ── Validators shared by server functions ────────────────────────────────
const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

const optionalShortText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable())
const optionalEmail = z.preprocess(emptyToNull, z.string().trim().max(255).email().nullable())
const optionalDate = z.preprocess(emptyToNull, z.string().date().nullable())
const optionalMoney = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
)

export const projectMemberInputSchema = z.object({
  employeeId: z.string().uuid(),
  role: z.string().trim().min(1).max(100),
})

export const projectMilestoneInputSchema = z.object({
  name: z.string().trim().min(1, 'Milestone name is required').max(255),
  dueDate: optionalDate,
  status: z.enum(MILESTONE_STATUSES).default('pending'),
})

export const projectMilestoneStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(MILESTONE_STATUSES),
})

export const projectRiskInputSchema = z.object({
  description: z.string().trim().min(1, 'Risk description is required').max(1_000),
  severity: z.enum(RISK_SEVERITIES),
  mitigation: optionalShortText(2_000),
  status: z.enum(RISK_STATUSES).default('open'),
})

export const projectRiskStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(RISK_STATUSES),
})

export const projectSoftwareInputSchema = z.object({
  softwareId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  name: z.string().trim().min(1, 'Software name is required').max(255),
  notes: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
})

export const projectInputSchema = z.object({
  name: z.string().trim().min(2, 'Project name is required').max(255),
  description: optionalShortText(10_000),
  companyId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  companyName: z.string().trim().min(2, 'Client name is required').max(255),
  contactName: optionalShortText(255),
  contactEmail: optionalEmail,
  contactPhone: optionalShortText(20),
  designation: optionalShortText(100),
  city: optionalShortText(100),
  siteLocation: optionalShortText(255),
  priority: z.enum(['low', 'medium', 'high']),
  contractType: z.enum(['lumpsum', 'manhours_basis', 'line_wise']),
  progress: z.number().int().min(0).max(100),
  contractValuePaise: optionalMoney,
  estimatedCostPaise: optionalMoney,
  startDate: optionalDate,
  endDate: optionalDate,
  kickoffMeetingDate: optionalDate,
  modeOfDelivery: optionalShortText(100),
  paymentTerms: optionalShortText(10_000),
  otherTerms: optionalShortText(10_000),
  notes: optionalShortText(5_000),
  projectManagerId: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  scopeOfWork: optionalShortText(200_000),
  inputDocuments: z.array(z.string().trim().min(1).max(500)).max(100),
  deliverables: z.array(z.string().trim().min(1).max(500)).max(100),
  exclusions: z.array(z.string().trim().min(1).max(500)).max(100),
  software: z.array(projectSoftwareInputSchema).max(100),
  members: z.array(projectMemberInputSchema).max(100),
  milestones: z.array(projectMilestoneInputSchema).max(100),
  risks: z.array(projectRiskInputSchema).max(100),
})

export type ProjectInput = z.infer<typeof projectInputSchema>

export const projectUpdateSchema = projectInputSchema.extend({
  id: z.string().uuid(),
})
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>

export const projectStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(PROJECT_STATUSES),
  note: optionalShortText(1_000),
})

export const projectCommentInputSchema = z.object({
  projectId: z.string().uuid(),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5_000),
})

export const convertProposalToProjectSchema = z.object({
  proposalId: z.string().uuid(),
})

export const projectIdSchema = z.object({
  id: z.string().uuid(),
})

// ── Serialized shapes crossing the RPC boundary ──────────────────────────
export type ProjectMember = {
  id: string
  employeeId: string
  employeeName: string
  role: string
}

export type ProjectMilestone = {
  id: string
  name: string
  dueDate: string | null
  status: MilestoneStatus
  completedAt: string | null
}

export type ProjectRisk = {
  id: string
  description: string
  severity: RiskSeverity
  mitigation: string | null
  status: RiskStatus
}

export type ProjectSoftwareLine = {
  id: string
  softwareId: string | null
  name: string
  notes: string | null
}

/**
 * Twenty-style unified timeline: status transitions and discussion comments
 * interleaved into one chronological feed (newest first).
 */
export type ProjectTimelineItem = {
  id: string
  kind: 'comment' | 'status'
  at: string
  authorName: string | null
  body: string | null
  fromStatus: ProjectStatus | null
  toStatus: ProjectStatus | null
  note: string | null
}

export type ProjectListItem = {
  id: string
  projectNumber: string
  name: string
  companyName: string
  status: ProjectStatus
  priority: 'low' | 'medium' | 'high'
  progress: number
  contractValuePaise: number | null
  startDate: string | null
  endDate: string | null
  managerName: string | null
  proposalNumber: string | null
  createdAt: string
}

export type ProjectDetail = {
  id: string
  projectNumber: string
  proposalId: string | null
  proposalNumber: string | null
  leadNumber: string | null
  companyId: string | null
  companyName: string
  name: string
  description: string | null
  status: ProjectStatus
  priority: 'low' | 'medium' | 'high'
  contractType: 'lumpsum' | 'manhours_basis' | 'line_wise'
  progress: number
  contractValuePaise: number | null
  estimatedCostPaise: number | null
  currency: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  designation: string | null
  city: string | null
  siteLocation: string | null
  startDate: string | null
  endDate: string | null
  kickoffMeetingDate: string | null
  modeOfDelivery: string | null
  paymentTerms: string | null
  otherTerms: string | null
  notes: string | null
  projectManagerId: string | null
  managerName: string | null
  scopeOfWork: string | null
  inputDocuments: string[]
  deliverables: string[]
  exclusions: string[]
  software: ProjectSoftwareLine[]
  members: ProjectMember[]
  milestones: ProjectMilestone[]
  risks: ProjectRisk[]
  timeline: ProjectTimelineItem[]
  createdAt: string
  updatedAt: string
}

export type ProjectFormOptions = {
  companies: { id: string; code: string; name: string }[]
  employees: { id: string; firstName: string; lastName: string | null }[]
  software: { id: string; name: string; version: string | null }[]
}

export type ProjectsPagePayload = {
  authorized: boolean
  projects: ProjectListItem[]
  options: ProjectFormOptions
}

export type ProjectDetailPayload = {
  authorized: boolean
  project: ProjectDetail | null
  options: ProjectFormOptions
}

// ── Client-side rollups (same pattern as leads/proposals) ────────────────
export type ProjectStats = {
  totalProjects: number
  activeCount: number
  activeValuePaise: number
  completedValuePaise: number
  byStatus: Record<ProjectStatus, { count: number; valuePaise: number }>
}

export const EMPTY_PROJECT_STATS: ProjectStats = {
  totalProjects: 0,
  activeCount: 0,
  activeValuePaise: 0,
  completedValuePaise: 0,
  byStatus: Object.fromEntries(
    PROJECT_STATUSES.map((status) => [status, { count: 0, valuePaise: 0 }]),
  ) as ProjectStats['byStatus'],
}

/** Client-side rollup so KPI tiles react instantly without a refetch. */
export function computeProjectStats(
  projects: readonly { status: ProjectStatus; contractValuePaise: number | null }[],
): ProjectStats {
  const stats: ProjectStats = {
    totalProjects: projects.length,
    activeCount: 0,
    activeValuePaise: 0,
    completedValuePaise: 0,
    byStatus: Object.fromEntries(
      PROJECT_STATUSES.map((status) => [status, { count: 0, valuePaise: 0 }]),
    ) as ProjectStats['byStatus'],
  }
  for (const project of projects) {
    const valuePaise = project.contractValuePaise ?? 0
    const bucket = stats.byStatus[project.status]
    bucket.count += 1
    bucket.valuePaise += valuePaise
    if (ACTIVE_PROJECT_STATUSES.includes(project.status)) {
      stats.activeCount += 1
      stats.activeValuePaise += valuePaise
    }
    if (project.status === 'completed') stats.completedValuePaise += valuePaise
  }
  return stats
}
