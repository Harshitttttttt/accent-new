import { z } from 'zod'

// ── Vocabularies ─────────────────────────────────────────────────────────
export const ASSIGNMENT_STATUSES = ['not_started', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const ASSIGNMENT_STATUS_BADGES: Record<AssignmentStatus, string> = {
  not_started: 'badge-neutral',
  in_progress: 'badge-info',
  on_hold: 'badge-warning',
  completed: 'badge-success',
  cancelled: 'badge-neutral',
}

export const ASSIGNMENT_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type AssignmentPriority = (typeof ASSIGNMENT_PRIORITIES)[number]

export const ASSIGNMENT_PRIORITY_LABELS: Record<AssignmentPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

// ── Validators ───────────────────────────────────────────────────────────
const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

const optionalShortText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable())
const optionalDate = z.preprocess(emptyToNull, z.string().date().nullable())
const optionalId = z.preprocess(emptyToNull, z.string().uuid().nullable())

export const createAssignmentSchema = z.object({
  projectId: z.string().uuid(),
  disciplineId: optionalId,
  activityId: optionalId,
  subActivityId: optionalId,
  disciplineName: z.string().trim().min(1, 'Discipline is required').max(150),
  activityName: z.string().trim().min(1, 'Activity is required').max(150),
  subActivityName: optionalShortText(150),
  assigneeId: optionalId,
  plannedMinutes: z.number().int().min(0).max(100_000_000),
  quantity: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.number().int().min(1).max(1_000_000).nullable(),
  ),
  dueDate: optionalDate,
  priority: z.enum(ASSIGNMENT_PRIORITIES).default('medium'),
  remark: optionalShortText(2_000),
})
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>

/** Patch-style update — the client sends only the fields that changed. */
export const updateAssignmentSchema = z.object({
  id: z.string().uuid(),
  assigneeId: optionalId.optional(),
  plannedMinutes: z.number().int().min(0).max(100_000_000).optional(),
  quantity: z.preprocess(
    (v) => (v === undefined ? undefined : v === '' || v === null ? null : v),
    z.number().int().min(1).max(1_000_000).nullable().optional(),
  ),
  dueDate: z.preprocess(
    (v) => (v === undefined ? undefined : v === '' || v === null ? null : v),
    z.string().date().nullable().optional(),
  ),
  priority: z.enum(ASSIGNMENT_PRIORITIES).optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  remark: z.preprocess(
    (v) => (v === undefined ? undefined : v === '' || v === null ? null : v),
    z.string().trim().max(2_000).nullable().optional(),
  ),
})
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>

export const createAssignmentLogSchema = z.object({
  assignmentId: z.string().uuid(),
  logDate: z.string().date(),
  minutes: z.number().int().min(1, 'Log at least 1 minute').max(1_440, 'Max 24h per entry'),
  note: optionalShortText(2_000),
})
export type CreateAssignmentLogInput = z.infer<typeof createAssignmentLogSchema>

export const assignmentLogIdSchema = z.object({ id: z.string().uuid() })

export const listWorkLogsSchema = z.object({
  projectId: z.string().uuid(),
  startDate: z.preprocess(emptyToNull, z.string().date().nullable()),
  endDate: z.preprocess(emptyToNull, z.string().date().nullable()),
  assigneeId: optionalId,
})

// ── Serialized shapes crossing the RPC boundary ──────────────────────────
export type ActivityTreeSubActivity = {
  id: string
  code: string
  name: string
  unit: string | null
}

export type ActivityTreeActivity = {
  id: string
  code: string
  name: string
  unit: string | null
  subActivities: ActivityTreeSubActivity[]
}

export type ActivityTreeDiscipline = {
  id: string
  code: string
  name: string
  activities: ActivityTreeActivity[]
}

export type AssignmentListItem = {
  id: string
  disciplineId: string | null
  activityId: string | null
  subActivityId: string | null
  disciplineName: string
  activityName: string
  subActivityName: string | null
  assigneeId: string | null
  assigneeName: string | null
  plannedMinutes: number
  loggedMinutes: number
  quantity: number | null
  unit: string | null
  dueDate: string | null
  priority: AssignmentPriority
  status: AssignmentStatus
  remark: string | null
  createdAt: string
}

/** Flat work-log entry for the day-wise view — grouped client-side. */
export type WorkLogEntry = {
  id: string
  assignmentId: string
  logDate: string
  minutes: number
  note: string | null
  assigneeId: string | null
  assigneeName: string | null
  disciplineName: string
  activityName: string
  subActivityName: string | null
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0h'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
