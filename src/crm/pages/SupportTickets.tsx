import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  Headphones,
  History,
  LayoutGrid,
  List,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
import {
  addTicketCommentAction,
  assignTicketAction,
  createSupportTicketAction,
  deleteSupportTicketAction,
  getSupportTicketDetailData,
  getSupportTicketsPageData,
  updateSupportTicketAction,
  updateTicketStatusAction,
} from '~/lib/support-tickets.functions'
import {
  CLOSED_TICKET_STATUSES,
  computeSupportTicketStats,
  isTicketOverdue,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_COLORS,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_BADGES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_BADGES,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  type CreateTicketInput,
  type SupportTicketDetail,
  type SupportTicketListItem,
  type SupportTicketsPagePayload,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type UpdateTicketInput,
} from '~/lib/support-tickets'

function formatDate(val: string | null): string {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(val: string | null): string {
  if (!val) return '—'
  return new Date(val).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type TabFilter =
  | 'all'
  | 'my_tickets'
  | 'assigned_to_me'
  | 'open'
  | 'in_progress'
  | 'waiting_on_user'
  | 'resolved'
  | 'closed'
  | 'overdue'

export default function SupportTickets({
  initialData,
}: {
  initialData: SupportTicketsPagePayload
}) {
  const [data, setData] = useState<SupportTicketsPagePayload>(initialData)
  const [viewMode, setViewMode] = useState<'table' | 'board'>('table')
  const [search, setSearch] = useState('')

  const currentUser = data.currentUser
  const isAdminOrStaff = Boolean(currentUser?.isAdmin || currentUser?.isStaff)

  const [tabFilter, setTabFilter] = useState<TabFilter>(isAdminOrStaff ? 'all' : 'my_tickets')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')

  // Modals & Drawers
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<SupportTicketDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailTab, setDetailTab] = useState<'stream' | 'comments' | 'activities'>('stream')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState<SupportTicketListItem | null>(null)
  const [isResolveModalOpen, setIsResolveModalOpen] = useState<{ id: string; targetStatus: TicketStatus } | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SupportTicketListItem | null>(null)

  // Submissions
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [commentMessage, setCommentMessage] = useState('')
  const [isInternalComment, setIsInternalComment] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  // Keyboard shortcut: Escape closes drawer/modals
  useHotkey({ key: 'Escape' }, () => {
    if (isCreateOpen) setIsCreateOpen(false)
    else if (editingTicket) setEditingTicket(null)
    else if (isResolveModalOpen) setIsResolveModalOpen(null)
    else if (deleteTarget) setDeleteTarget(null)
    else if (selectedTicketId) {
      setSelectedTicketId(null)
      setDetailData(null)
    }
  })

  // Reload full data
  async function reload() {
    try {
      const res = await getSupportTicketsPageData()
      setData(res)
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to reload tickets.')
    }
  }

  // Load ticket details when drawer opens
  useEffect(() => {
    if (!selectedTicketId) {
      setDetailData(null)
      return
    }

    let active = true
    setLoadingDetail(true)

    getSupportTicketDetailData({ data: { id: selectedTicketId } })
      .then((res) => {
        if (active && res.detail) {
          setDetailData(res.detail)
        }
      })
      .catch((e) => {
        if (active) {
          showFeedback('error', e instanceof Error ? e.message : 'Failed to load ticket details.')
        }
      })
      .finally(() => {
        if (active) setLoadingDetail(false)
      })

    return () => {
      active = false
    }
  }, [selectedTicketId])

  // Calculated Stats
  const stats = useMemo(() => computeSupportTicketStats(data.tickets), [data.tickets])

  const myTicketsCount = useMemo(() => {
    if (!currentUser) return 0
    return data.tickets.filter(
      (t) =>
        (t.requesterId && t.requesterId === currentUser.id) ||
        (t.requesterEmail && currentUser.email && t.requesterEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser.fullName && t.requesterName.toLowerCase() === currentUser.fullName.toLowerCase()) ||
        (currentUser.username && t.requesterName.toLowerCase() === currentUser.username.toLowerCase()),
    ).length
  }, [data.tickets, currentUser])

  const assignedToMeCount = useMemo(() => {
    if (!currentUser) return 0
    return data.tickets.filter(
      (t) =>
        (currentUser.employeeId && t.assignedTo === currentUser.employeeId) ||
        (currentUser.fullName && t.assigneeName && t.assigneeName.toLowerCase() === currentUser.fullName.toLowerCase()),
    ).length
  }, [data.tickets, currentUser])

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.tickets.filter((t) => {
      const matchesSearch =
        !q ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.requesterName.toLowerCase().includes(q) ||
        (t.assigneeName && t.assigneeName.toLowerCase().includes(q)) ||
        (t.relatedProjectName && t.relatedProjectName.toLowerCase().includes(q)) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))

      let matchesTab = true
      if (tabFilter === 'my_tickets') {
        matchesTab = Boolean(
          (currentUser?.id && t.requesterId === currentUser.id) ||
            (currentUser?.email && t.requesterEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
            (currentUser?.fullName && t.requesterName.toLowerCase() === currentUser.fullName.toLowerCase()) ||
            (currentUser?.username && t.requesterName.toLowerCase() === currentUser.username.toLowerCase()),
        )
      } else if (tabFilter === 'assigned_to_me') {
        matchesTab = Boolean(
          (currentUser?.employeeId && t.assignedTo === currentUser.employeeId) ||
            (currentUser?.fullName && t.assigneeName?.toLowerCase() === currentUser.fullName.toLowerCase()),
        )
      } else if (tabFilter === 'open') matchesTab = t.status === 'open'
      else if (tabFilter === 'in_progress') matchesTab = t.status === 'in_progress'
      else if (tabFilter === 'waiting_on_user') matchesTab = t.status === 'waiting_on_user'
      else if (tabFilter === 'resolved') matchesTab = t.status === 'resolved'
      else if (tabFilter === 'closed') matchesTab = t.status === 'closed'
      else if (tabFilter === 'overdue') matchesTab = isTicketOverdue(t.dueDate, t.status)

      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter
      const matchesAssignee = assigneeFilter === 'all' || t.assignedTo === assigneeFilter

      return matchesSearch && matchesTab && matchesCategory && matchesPriority && matchesAssignee
    })
  }, [data.tickets, search, tabFilter, categoryFilter, priorityFilter, assigneeFilter, currentUser])

  // ── Actions ──────────────────────────────────────────────────────────────
  async function handleCreateTicket(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)

    const tagsRaw = String(formData.get('tags') ?? '').trim()
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

    const requesterName = isAdminOrStaff
      ? String(formData.get('requesterName') ?? '').trim() || undefined
      : undefined

    const requesterEmail = isAdminOrStaff
      ? String(formData.get('requesterEmail') ?? '').trim() || undefined
      : undefined

    const assignedTo = isAdminOrStaff
      ? String(formData.get('assignedTo') ?? '').trim() || null
      : null

    const relatedProjectId = isAdminOrStaff
      ? String(formData.get('relatedProjectId') ?? '').trim() || null
      : null

    const payload: CreateTicketInput = {
      title: String(formData.get('title') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      category: (formData.get('category') as TicketCategory) || 'it_support',
      priority: (formData.get('priority') as TicketPriority) || 'medium',
      requesterName,
      requesterEmail,
      assignedTo,
      relatedProjectId,
      dueDate: String(formData.get('dueDate') ?? '').trim() || null,
      tags,
    }

    try {
      const res = await createSupportTicketAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Ticket ${res.data.ticketNumber} created successfully!`)
      setIsCreateOpen(false)
      await reload()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to create ticket.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateTicket(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingTicket) return
    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)

    const tagsRaw = String(formData.get('tags') ?? '').trim()
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

    const payload: UpdateTicketInput = {
      id: editingTicket.id,
      title: String(formData.get('title') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      category: (formData.get('category') as TicketCategory) || 'it_support',
      priority: (formData.get('priority') as TicketPriority) || 'medium',
      status: (formData.get('status') as TicketStatus) || editingTicket.status,
      requesterName: String(formData.get('requesterName') ?? '').trim() || editingTicket.requesterName,
      requesterEmail: String(formData.get('requesterEmail') ?? '').trim() || null,
      assignedTo: isAdminOrStaff ? String(formData.get('assignedTo') ?? '').trim() || null : editingTicket.assignedTo,
      relatedProjectId: isAdminOrStaff ? String(formData.get('relatedProjectId') ?? '').trim() || null : editingTicket.relatedProjectId,
      dueDate: String(formData.get('dueDate') ?? '').trim() || null,
      resolutionNotes: String(formData.get('resolutionNotes') ?? '').trim() || null,
      tags,
    }

    try {
      const res = await updateSupportTicketAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Ticket ${editingTicket.ticketNumber} updated!`)
      setEditingTicket(null)
      await reload()
      if (selectedTicketId === editingTicket.id) {
        const detailRes = await getSupportTicketDetailData({ data: { id: editingTicket.id } })
        if (detailRes.detail) setDetailData(detailRes.detail)
      }
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to update ticket.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStatusChange(ticketId: string, newStatus: TicketStatus, notes?: string) {
    if (newStatus === 'resolved' && !notes && isResolveModalOpen?.id !== ticketId) {
      setIsResolveModalOpen({ id: ticketId, targetStatus: newStatus })
      return
    }

    try {
      const res = await updateTicketStatusAction({
        data: {
          id: ticketId,
          status: newStatus,
          resolutionNotes: notes ?? null,
        },
      })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Status updated to ${TICKET_STATUS_LABELS[newStatus]}`)
      setIsResolveModalOpen(null)
      setResolveNotes('')
      await reload()
      if (selectedTicketId === ticketId) {
        const detailRes = await getSupportTicketDetailData({ data: { id: ticketId } })
        if (detailRes.detail) setDetailData(detailRes.detail)
      }
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to update status.')
    }
  }

  async function handleAssignTicket(ticketId: string, employeeId: string | null) {
    try {
      const res = await assignTicketAction({
        data: {
          id: ticketId,
          assignedTo: employeeId,
        },
      })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', 'Ticket assigned successfully.')
      await reload()
      if (selectedTicketId === ticketId) {
        const detailRes = await getSupportTicketDetailData({ data: { id: ticketId } })
        if (detailRes.detail) setDetailData(detailRes.detail)
      }
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to assign ticket.')
    }
  }

  async function handleAddComment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedTicketId || !commentMessage.trim()) return
    setIsSubmitting(true)

    try {
      const res = await addTicketCommentAction({
        data: {
          ticketId: selectedTicketId,
          message: commentMessage.trim(),
          isInternal: isAdminOrStaff ? isInternalComment : false,
        },
      })
      if (!res.ok) throw new Error(res.message)
      setCommentMessage('')
      showFeedback('success', isInternalComment ? 'Internal note added.' : 'Reply posted.')
      const detailRes = await getSupportTicketDetailData({ data: { id: selectedTicketId } })
      if (detailRes.detail) setDetailData(detailRes.detail)
      await reload()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to post comment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteTicket() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)

    try {
      const res = await deleteSupportTicketAction({ data: { id: target.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Ticket ${target.ticketNumber} deleted.`)
      if (selectedTicketId === target.id) {
        setSelectedTicketId(null)
        setDetailData(null)
      }
      await reload()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to delete ticket.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Toast Feedback */}
      {feedback && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 24,
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 8,
            background: feedback.type === 'success' ? 'var(--success-soft-bg)' : 'var(--danger-soft-bg)',
            color: feedback.type === 'success' ? 'var(--success-soft-fg)' : 'var(--danger-soft-fg)',
            fontWeight: 600,
            fontSize: 13.5,
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ padding: '16px 28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              Support Tickets
            </h2>
            {isAdminOrStaff ? (
              <span
                className="badge badge-purple"
                style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                title="Full Admin & Triage console"
              >
                <ShieldCheck size={12} /> Admin Console
              </span>
            ) : (
              <span
                className="badge badge-cyan"
                style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                title="Employee Helpdesk Portal"
              >
                <User size={12} /> My Helpdesk
              </span>
            )}
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            {isAdminOrStaff ? (
              <>
                {stats.total} total tickets · {stats.open + stats.inProgress} active requests
                {stats.overdue > 0 && (
                  <span style={{ color: 'var(--danger)', fontWeight: 600, marginLeft: 6 }}>
                    · {stats.overdue} overdue
                  </span>
                )}
              </>
            ) : (
              <>
                {myTicketsCount} ticket{myTicketsCount === 1 ? '' : 's'} submitted by you · Fast IT & Admin assistance
              </>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Search bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 36,
              boxSizing: 'border-box',
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0 12px',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                width: 190,
                color: 'var(--text-primary)',
              }}
              placeholder="Search tickets, tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: 0, height: 22, width: 22, minWidth: 22 }}
                onClick={() => setSearch('')}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 36,
              boxSizing: 'border-box',
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 3,
              gap: 2,
            }}
          >
            <button
              type="button"
              className={`btn-ghost ${viewMode === 'table' ? 'active' : ''}`}
              style={{
                height: 28,
                width: 32,
                minWidth: 32,
                padding: 0,
                borderRadius: 6,
                background: viewMode === 'table' ? 'var(--surface)' : 'transparent',
                color: viewMode === 'table' ? 'var(--brand-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              className={`btn-ghost ${viewMode === 'board' ? 'active' : ''}`}
              style={{
                height: 28,
                width: 32,
                minWidth: 32,
                padding: 0,
                borderRadius: 6,
                background: viewMode === 'board' ? 'var(--surface)' : 'transparent',
                color: viewMode === 'board' ? 'var(--brand-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'board' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
              onClick={() => setViewMode('board')}
              title="Kanban Board View"
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          <button
            type="button"
            className="btn-secondary"
            style={{ height: 36, width: 36, minWidth: 36, padding: 0, boxSizing: 'border-box' }}
            onClick={reload}
            title="Refresh ticket records"
          >
            <RefreshCw size={14} />
          </button>

          <button
            type="button"
            className="btn-primary"
            style={{ height: 36, boxSizing: 'border-box' }}
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={14} /> New Ticket
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div
        style={{
          padding: '12px 28px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-secondary)',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div className="kpi-card" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {isAdminOrStaff ? 'Total Tickets' : 'My Total'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
            {isAdminOrStaff ? stats.total : myTicketsCount}
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Open
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0284C7', marginTop: 2 }}>
            {stats.open}
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            In Progress
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-primary)', marginTop: 2 }}>
            {stats.inProgress}
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Waiting on User
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#D97706', marginTop: 2 }}>
            {stats.waiting}
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Urgent / High
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#DC2626', marginTop: 2 }}>
            {stats.urgentOrHigh}
          </div>
        </div>

        <div className="kpi-card" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Resolved
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#16A34A', marginTop: 2 }}>
            {stats.resolved + stats.closed}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Quick Filters Bar */}
      <div
        style={{
          padding: '0 28px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {/* Status Tabs */}
        <div className="tab-nav" style={{ borderBottom: 'none' }}>
          <button
            type="button"
            className={`tab-btn ${tabFilter === 'my_tickets' ? 'active' : ''}`}
            onClick={() => setTabFilter('my_tickets')}
          >
            My Tickets <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{myTicketsCount}</span>
          </button>
          {assignedToMeCount > 0 && (
            <button
              type="button"
              className={`tab-btn ${tabFilter === 'assigned_to_me' ? 'active' : ''}`}
              onClick={() => setTabFilter('assigned_to_me')}
            >
              Assigned to Me <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{assignedToMeCount}</span>
            </button>
          )}
          <button
            type="button"
            className={`tab-btn ${tabFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTabFilter('all')}
          >
            All <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{stats.total}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${tabFilter === 'open' ? 'active' : ''}`}
            onClick={() => setTabFilter('open')}
          >
            Open <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{stats.open}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${tabFilter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setTabFilter('in_progress')}
          >
            In Progress <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{stats.inProgress}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${tabFilter === 'waiting_on_user' ? 'active' : ''}`}
            onClick={() => setTabFilter('waiting_on_user')}
          >
            Waiting <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{stats.waiting}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${tabFilter === 'resolved' ? 'active' : ''}`}
            onClick={() => setTabFilter('resolved')}
          >
            Resolved <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{stats.resolved}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${tabFilter === 'closed' ? 'active' : ''}`}
            onClick={() => setTabFilter('closed')}
          >
            Closed <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{stats.closed}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${tabFilter === 'overdue' ? 'active' : ''}`}
            onClick={() => setTabFilter('overdue')}
          >
            Overdue{' '}
            <span
              style={{
                fontSize: 11,
                color: stats.overdue > 0 ? 'var(--danger)' : 'var(--text-muted)',
                fontWeight: stats.overdue > 0 ? 700 : 400,
                marginLeft: 4,
              }}
            >
              {stats.overdue}
            </span>
          </button>
        </div>

        {/* Dropdown Filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface-secondary)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="all">All Categories</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TICKET_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface-secondary)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="all">All Priorities</option>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TICKET_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>

          {isAdminOrStaff && (
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              style={{
                fontSize: 12,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface-secondary)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="all">All Assignees</option>
              {data.options.employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Content: Table or Kanban Board */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {viewMode === 'table' ? (
          /* Table View */
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Ticket No</th>
                  <th>Subject</th>
                  <th style={{ width: 130 }}>Category</th>
                  <th style={{ width: 130 }}>Requester</th>
                  <th style={{ width: 130 }}>Assignee</th>
                  <th style={{ width: 90 }}>Priority</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 100 }}>Due Date</th>
                  <th style={{ width: 90 }}>Created</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => {
                  const overdue = isTicketOverdue(t.dueDate, t.status)
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 600, color: 'var(--brand-primary)', fontSize: 12.5 }}>
                        {t.ticketNumber}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                          {t.title}
                        </div>
                        {t.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                            {t.tags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: 10,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: 'var(--surface-secondary)',
                                  color: 'var(--text-muted)',
                                  border: '1px solid var(--border)',
                                }}
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 500,
                            color: TICKET_CATEGORY_COLORS[t.category],
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: TICKET_CATEGORY_COLORS[t.category],
                            }}
                          />
                          {TICKET_CATEGORY_LABELS[t.category]}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{t.requesterName}</td>
                      <td>
                        {t.assigneeName ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div
                              className="avatar"
                              style={{
                                width: 22,
                                height: 22,
                                fontSize: 9.5,
                                background: 'var(--brand-primary)',
                              }}
                            >
                              {t.assigneeName
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </div>
                            <span style={{ fontSize: 12.5 }}>{t.assigneeName}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${TICKET_PRIORITY_BADGES[t.priority]}`} style={{ fontSize: 11 }}>
                          {TICKET_PRIORITY_LABELS[t.priority]}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${TICKET_STATUS_BADGES[t.status]}`} style={{ fontSize: 11 }}>
                          {TICKET_STATUS_LABELS[t.status]}
                        </span>
                      </td>
                      <td>
                        {t.dueDate ? (
                          <span
                            style={{
                              fontSize: 12,
                              color: overdue ? 'var(--danger)' : 'var(--text-muted)',
                              fontWeight: overdue ? 700 : 400,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            {overdue && <AlertTriangle size={12} />}
                            {formatDate(t.dueDate)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{formatDate(t.createdAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div
                          style={{ display: 'inline-flex', gap: 4 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '4px 6px' }}
                            title="Edit Ticket"
                            onClick={() => setEditingTicket(t)}
                          >
                            <Edit2 size={13} />
                          </button>
                          {(isAdminOrStaff || t.status === 'open') && (
                            <button
                              type="button"
                              className="btn-ghost"
                              style={{ padding: '4px 6px', color: 'var(--danger)' }}
                              title="Delete Ticket"
                              onClick={() => setDeleteTarget(t)}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {filteredTickets.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                      <Headphones size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <div style={{ fontSize: 14, fontWeight: 600 }}>No support tickets found</div>
                      <p style={{ margin: '4px 0 16px', fontSize: 12 }}>
                        {tabFilter === 'my_tickets'
                          ? "You haven't submitted any tickets matching this filter."
                          : 'Create a new ticket or adjust your active filters.'}
                      </p>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ margin: '0 auto' }}
                        onClick={() => setIsCreateOpen(true)}
                      >
                        <Plus size={13} /> New Support Ticket
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Kanban Board View */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 14,
              height: '100%',
              minHeight: 520,
              alignItems: 'start',
            }}
          >
            {TICKET_STATUSES.map((statusKey) => {
              const columnTickets = filteredTickets.filter((t) => t.status === statusKey)
              return (
                <div
                  key={statusKey}
                  style={{
                    background: 'var(--surface-secondary)',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '100%',
                  }}
                >
                  {/* Column Header */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--surface)',
                      borderTopLeftRadius: 10,
                      borderTopRightRadius: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`badge ${TICKET_STATUS_BADGES[statusKey]}`} style={{ fontSize: 11 }}>
                        {TICKET_STATUS_LABELS[statusKey]}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                      {columnTickets.length}
                    </span>
                  </div>

                  {/* Column Cards */}
                  <div
                    style={{
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      overflowY: 'auto',
                      maxHeight: 'calc(100vh - 300px)',
                    }}
                  >
                    {columnTickets.map((t) => {
                      const overdue = isTicketOverdue(t.dueDate, t.status)
                      return (
                        <div
                          key={t.id}
                          className="card"
                          style={{
                            padding: '12px 14px',
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          }}
                          onClick={() => setSelectedTicketId(t.id)}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 6,
                            }}
                          >
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand-primary)' }}>
                              {t.ticketNumber}
                            </span>
                            <span className={`badge ${TICKET_PRIORITY_BADGES[t.priority]}`} style={{ fontSize: 10 }}>
                              {t.priority}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              marginBottom: 6,
                              lineHeight: 1.35,
                            }}
                          >
                            {t.title}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span
                              style={{
                                fontSize: 11,
                                color: TICKET_CATEGORY_COLORS[t.category],
                                fontWeight: 500,
                              }}
                            >
                              {TICKET_CATEGORY_LABELS[t.category]}
                            </span>
                            {t.relatedProjectName && (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  color: 'var(--text-muted)',
                                  background: 'var(--surface-secondary)',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                }}
                              >
                                {t.relatedProjectName}
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderTop: '1px solid var(--border-subtle)',
                              paddingTop: 8,
                              fontSize: 11,
                              color: 'var(--text-muted)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {t.dueDate && (
                                <span
                                  style={{
                                    color: overdue ? 'var(--danger)' : 'var(--text-muted)',
                                    fontWeight: overdue ? 700 : 400,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <Clock size={11} /> {formatDate(t.dueDate)}
                                </span>
                              )}
                              {t.commentCount > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <MessageSquare size={11} /> {t.commentCount}
                                </span>
                              )}
                            </div>

                            {t.assigneeName ? (
                              <div
                                className="avatar"
                                style={{
                                  width: 20,
                                  height: 20,
                                  fontSize: 9,
                                  background: 'var(--brand-primary)',
                                }}
                                title={`Assigned to ${t.assigneeName}`}
                              >
                                {t.assigneeName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')}
                              </div>
                            ) : (
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Unassigned</span>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {columnTickets.length === 0 && (
                      <div
                        style={{
                          padding: '24px 12px',
                          textAlign: 'center',
                          fontSize: 12,
                          color: 'var(--text-muted)',
                        }}
                      >
                        No tickets
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── TICKET DETAIL DRAWER ────────────────────────────────────────── */}
      {selectedTicketId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 200,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => {
            setSelectedTicketId(null)
            setDetailData(null)
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 620,
              height: '100%',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
              animation: 'slideInRight 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetail || !detailData ? (
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
                Loading ticket details…
              </div>
            ) : (
              <>
                {/* Drawer Header */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--brand-primary)' }}>
                      {detailData.ticket.ticketNumber}
                    </span>
                    <span className={`badge ${TICKET_STATUS_BADGES[detailData.ticket.status]}`} style={{ fontSize: 11 }}>
                      {TICKET_STATUS_LABELS[detailData.ticket.status]}
                    </span>
                    <span className={`badge ${TICKET_PRIORITY_BADGES[detailData.ticket.priority]}`} style={{ fontSize: 11 }}>
                      {TICKET_PRIORITY_LABELS[detailData.ticket.priority]}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '6px 8px' }}
                      title="Edit Ticket"
                      onClick={() => setEditingTicket(detailData.ticket)}
                    >
                      <Edit2 size={14} />
                    </button>
                    {(isAdminOrStaff || detailData.ticket.status === 'open') && (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: '6px 8px', color: 'var(--danger)' }}
                        title="Delete Ticket"
                        onClick={() => setDeleteTarget(detailData.ticket)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '6px 8px' }}
                      onClick={() => {
                        setSelectedTicketId(null)
                        setDetailData(null)
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Drawer Quick Status & Reassign Action Bar */}
                <div
                  style={{
                    padding: '10px 20px',
                    background: 'var(--surface-secondary)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                    <select
                      value={detailData.ticket.status}
                      onChange={(e) => handleStatusChange(detailData.ticket.id, e.target.value as TicketStatus)}
                      style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                      }}
                    >
                      {TICKET_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TICKET_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isAdminOrStaff && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Assign:</span>
                      <select
                        value={detailData.ticket.assignedTo ?? ''}
                        onChange={(e) => handleAssignTicket(detailData.ticket.id, e.target.value || null)}
                        style={{
                          fontSize: 12,
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <option value="">Unassigned</option>
                        {data.options.employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Drawer Scrollable Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
                  {/* Title & Category Header */}
                  <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {detailData.ticket.title}
                  </h3>

                  {/* Metadata Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                      padding: 14,
                      borderRadius: 8,
                      background: 'var(--surface-secondary)',
                      border: '1px solid var(--border)',
                      marginBottom: 16,
                      fontSize: 12.5,
                    }}
                  >
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Category</div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: TICKET_CATEGORY_COLORS[detailData.ticket.category],
                          marginTop: 2,
                        }}
                      >
                        {TICKET_CATEGORY_LABELS[detailData.ticket.category]}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Requester</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                        {detailData.ticket.requesterName}
                        {detailData.ticket.requesterEmail && (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11.5, marginLeft: 4 }}>
                            ({detailData.ticket.requesterEmail})
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Due Date</div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: isTicketOverdue(detailData.ticket.dueDate, detailData.ticket.status)
                            ? 'var(--danger)'
                            : 'var(--text-primary)',
                          marginTop: 2,
                        }}
                      >
                        {formatDate(detailData.ticket.dueDate)}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Related Project</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                        {detailData.ticket.relatedProjectName ?? '—'}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Created At</div>
                      <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>
                        {formatDateTime(detailData.ticket.createdAt)}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Tags</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                        {detailData.ticket.tags.length > 0
                          ? detailData.ticket.tags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: 10,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                }}
                              >
                                #{tag}
                              </span>
                            ))
                          : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Description
                    </div>
                    <div
                      style={{
                        fontSize: 13.5,
                        color: 'var(--text-primary)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        padding: '12px 14px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                      }}
                    >
                      {detailData.ticket.description}
                    </div>
                  </div>

                  {/* Resolution Notes Banner if resolved */}
                  {detailData.ticket.resolutionNotes && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        background: 'var(--success-soft-bg)',
                        border: '1px solid var(--success-soft-border)',
                        color: 'var(--success-soft-fg)',
                        marginBottom: 20,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12.5 }}>
                        <CheckCircle2 size={15} /> Resolution Details
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5 }}>
                        {detailData.ticket.resolutionNotes}
                      </p>
                      {detailData.ticket.resolvedByName && (
                        <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                          Resolved by {detailData.ticket.resolvedByName} on {formatDate(detailData.ticket.resolvedAt)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Conversation & Activity Stream */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border)',
                        marginBottom: 14,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{
                            padding: '6px 4px',
                            fontSize: 13,
                            fontWeight: detailTab === 'stream' ? 700 : 500,
                            color: detailTab === 'stream' ? 'var(--brand-primary)' : 'var(--text-muted)',
                            borderBottom: detailTab === 'stream' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                            borderRadius: 0,
                          }}
                          onClick={() => setDetailTab('stream')}
                        >
                          All Feed ({detailData.comments.length + detailData.activities.length})
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{
                            padding: '6px 4px',
                            fontSize: 13,
                            fontWeight: detailTab === 'comments' ? 700 : 500,
                            color: detailTab === 'comments' ? 'var(--brand-primary)' : 'var(--text-muted)',
                            borderBottom: detailTab === 'comments' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                            borderRadius: 0,
                          }}
                          onClick={() => setDetailTab('comments')}
                        >
                          Replies & Updates ({detailData.comments.length})
                        </button>
                        {isAdminOrStaff && (
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{
                              padding: '6px 4px',
                              fontSize: 13,
                              fontWeight: detailTab === 'activities' ? 700 : 500,
                              color: detailTab === 'activities' ? 'var(--brand-primary)' : 'var(--text-muted)',
                              borderBottom: detailTab === 'activities' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                              borderRadius: 0,
                            }}
                            onClick={() => setDetailTab('activities')}
                          >
                            Audit History ({detailData.activities.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stream Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {detailTab !== 'activities' &&
                        detailData.comments.map((comm) => (
                          <div
                            key={comm.id}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 8,
                              background: comm.isInternal ? '#FFFBEB' : 'var(--surface)',
                              border: comm.isInternal ? '1px solid #FDE68A' : '1px solid var(--border)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div
                                  className="avatar"
                                  style={{
                                    width: 24,
                                    height: 24,
                                    fontSize: 10,
                                    background: comm.isInternal ? '#D97706' : 'var(--brand-primary)',
                                  }}
                                >
                                  {comm.authorName
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')}
                                </div>
                                <div>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {comm.authorName}
                                  </span>
                                  {comm.isInternal && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: '#B45309',
                                        background: '#FEF3C7',
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                        marginLeft: 6,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3,
                                      }}
                                    >
                                      <Lock size={9} /> Internal Note
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {formatDateTime(comm.createdAt)}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: 'var(--text-primary)',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {comm.message}
                            </div>
                          </div>
                        ))}

                      {detailTab !== 'comments' &&
                        detailData.activities.map((act) => (
                          <div
                            key={act.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                              fontSize: 12,
                              color: 'var(--text-muted)',
                              padding: '6px 4px',
                            }}
                          >
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: 'var(--surface-secondary)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginTop: 2,
                              }}
                            >
                              <History size={11} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{act.actorName}</span>{' '}
                              <span>{act.action}:</span>{' '}
                              <span style={{ color: 'var(--text-primary)' }}>{act.newValue ?? act.oldValue ?? ''}</span>
                            </div>
                            <span style={{ fontSize: 11 }}>{formatDate(act.createdAt)}</span>
                          </div>
                        ))}

                      {detailData.comments.length === 0 && detailData.activities.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: 'var(--text-muted)' }}>
                          No conversation or activity logs yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Drawer Footer: Add Comment / Note */}
                <form
                  onSubmit={handleAddComment}
                  style={{
                    padding: '14px 20px',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <Textarea
                    placeholder={
                      isInternalComment
                        ? 'Write a private internal note (visible only to staff)…'
                        : 'Write a public reply…'
                    }
                    rows={2}
                    value={commentMessage}
                    onChange={(e) => setCommentMessage(e.target.value)}
                    required
                    style={{ fontSize: 13 }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {isAdminOrStaff ? (
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          cursor: 'pointer',
                          color: isInternalComment ? '#B45309' : 'var(--text-muted)',
                          fontWeight: isInternalComment ? 600 : 400,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isInternalComment}
                          onChange={(e) => setIsInternalComment(e.target.checked)}
                        />
                        <Lock size={12} /> Internal Note
                      </label>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Replies are visible to support staff.
                      </span>
                    )}

                    <Button
                      type="submit"
                      disabled={isSubmitting || !commentMessage.trim()}
                      className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] text-xs h-8 px-4"
                    >
                      <Send size={12} className="mr-1" />
                      {isSubmitting ? 'Posting…' : isInternalComment ? 'Post Note' : 'Send Reply'}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE TICKET MODAL ────────────────────────────────────────── */}
      {isCreateOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 600,
              padding: '24px 28px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Headphones size={18} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {isAdminOrStaff ? 'New Support Ticket' : 'Submit Support Request'}
                </h3>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setIsCreateOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field>
                <FieldLabel htmlFor="create-title">Subject / Title *</FieldLabel>
                <Input
                  id="create-title"
                  name="title"
                  placeholder="e.g. AutoCAD civil workstation license expired"
                  required
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field>
                  <FieldLabel htmlFor="create-category">Category *</FieldLabel>
                  <select
                    id="create-category"
                    name="category"
                    defaultValue="it_support"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      fontSize: 13,
                    }}
                  >
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {TICKET_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="create-priority">Priority *</FieldLabel>
                  <select
                    id="create-priority"
                    name="priority"
                    defaultValue="medium"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      fontSize: 13,
                    }}
                  >
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {TICKET_PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Admin/Staff optional override for external callers/clients */}
              {isAdminOrStaff && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field>
                    <FieldLabel htmlFor="create-requesterName">On Behalf of Requester (Optional)</FieldLabel>
                    <Input
                      id="create-requesterName"
                      name="requesterName"
                      placeholder={`Default: ${currentUser?.fullName || currentUser?.username || 'You'}`}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="create-requesterEmail">Requester Email (Optional)</FieldLabel>
                    <Input
                      id="create-requesterEmail"
                      name="requesterEmail"
                      type="email"
                      placeholder="e.g. client@external.com"
                    />
                  </Field>
                </div>
              )}

              {isAdminOrStaff && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field>
                    <FieldLabel htmlFor="create-assignedTo">Assign To</FieldLabel>
                    <select
                      id="create-assignedTo"
                      name="assignedTo"
                      defaultValue=""
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        fontSize: 13,
                      }}
                    >
                      <option value="">Unassigned</option>
                      {data.options.employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} {emp.designation ? `(${emp.designation})` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="create-relatedProjectId">Related Project</FieldLabel>
                    <select
                      id="create-relatedProjectId"
                      name="relatedProjectId"
                      defaultValue=""
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        fontSize: 13,
                      }}
                    >
                      <option value="">None (General)</option>
                      {data.options.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field>
                  <FieldLabel htmlFor="create-dueDate">Due Date</FieldLabel>
                  <Input
                    id="create-dueDate"
                    name="dueDate"
                    type="date"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="create-tags">Tags (comma-separated)</FieldLabel>
                  <Input
                    id="create-tags"
                    name="tags"
                    placeholder="e.g. license, autocad, urgent"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="create-description">Detailed Description *</FieldLabel>
                <Textarea
                  id="create-description"
                  name="description"
                  placeholder="Describe the issue, error codes, steps to reproduce, or requirements in detail..."
                  rows={4}
                  required
                />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]"
                >
                  {isSubmitting ? 'Creating…' : 'Submit Ticket'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT TICKET MODAL ────────────────────────────────────────── */}
      {editingTicket && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 600,
              padding: '24px 28px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 size={18} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Edit Ticket {editingTicket.ticketNumber}
                </h3>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditingTicket(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateTicket} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field>
                <FieldLabel htmlFor="edit-title">Subject / Title *</FieldLabel>
                <Input
                  id="edit-title"
                  name="title"
                  defaultValue={editingTicket.title}
                  required
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field>
                  <FieldLabel htmlFor="edit-category">Category *</FieldLabel>
                  <select
                    id="edit-category"
                    name="category"
                    defaultValue={editingTicket.category}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      fontSize: 13,
                    }}
                  >
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {TICKET_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="edit-priority">Priority *</FieldLabel>
                  <select
                    id="edit-priority"
                    name="priority"
                    defaultValue={editingTicket.priority}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      fontSize: 13,
                    }}
                  >
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {TICKET_PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="edit-status">Status *</FieldLabel>
                  <select
                    id="edit-status"
                    name="status"
                    defaultValue={editingTicket.status}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      fontSize: 13,
                    }}
                  >
                    {TICKET_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {TICKET_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {isAdminOrStaff && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field>
                    <FieldLabel htmlFor="edit-requesterName">Requester Name *</FieldLabel>
                    <Input
                      id="edit-requesterName"
                      name="requesterName"
                      defaultValue={editingTicket.requesterName}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="edit-requesterEmail">Requester Email</FieldLabel>
                    <Input
                      id="edit-requesterEmail"
                      name="requesterEmail"
                      type="email"
                      defaultValue={editingTicket.requesterEmail ?? ''}
                    />
                  </Field>
                </div>
              )}

              {isAdminOrStaff && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field>
                    <FieldLabel htmlFor="edit-assignedTo">Assign To</FieldLabel>
                    <select
                      id="edit-assignedTo"
                      name="assignedTo"
                      defaultValue={editingTicket.assignedTo ?? ''}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        fontSize: 13,
                      }}
                    >
                      <option value="">Unassigned</option>
                      {data.options.employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} {emp.designation ? `(${emp.designation})` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="edit-relatedProjectId">Related Project</FieldLabel>
                    <select
                      id="edit-relatedProjectId"
                      name="relatedProjectId"
                      defaultValue={editingTicket.relatedProjectId ?? ''}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        fontSize: 13,
                      }}
                    >
                      <option value="">None (General)</option>
                      {data.options.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field>
                  <FieldLabel htmlFor="edit-dueDate">Due Date</FieldLabel>
                  <Input
                    id="edit-dueDate"
                    name="dueDate"
                    type="date"
                    defaultValue={editingTicket.dueDate ?? ''}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="edit-tags">Tags (comma-separated)</FieldLabel>
                  <Input
                    id="edit-tags"
                    name="tags"
                    defaultValue={editingTicket.tags.join(', ')}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="edit-description">Detailed Description *</FieldLabel>
                <Textarea
                  id="edit-description"
                  name="description"
                  defaultValue={editingTicket.description}
                  rows={4}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-resolutionNotes">Resolution Notes (Optional)</FieldLabel>
                <Textarea
                  id="edit-resolutionNotes"
                  name="resolutionNotes"
                  defaultValue={editingTicket.resolutionNotes ?? ''}
                  placeholder="Notes explaining how the ticket was addressed or resolved..."
                  rows={2}
                />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingTicket(null)}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]"
                >
                  {isSubmitting ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RESOLVE DIALOG WITH NOTES ─────────────────────────────────── */}
      {isResolveModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 460,
              padding: '24px 28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Mark Ticket as Resolved</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Please provide brief resolution notes to document how this issue was resolved.
            </p>

            <Textarea
              placeholder="e.g. License reallocated from inventory and verified working on user machine."
              rows={3}
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              style={{ fontSize: 13, marginBottom: 16 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsResolveModalOpen(null)
                  setResolveNotes('')
                }}
              >
                Cancel
              </button>
              <Button
                type="button"
                className="bg-[var(--success)] text-white hover:bg-green-700"
                onClick={() =>
                  handleStatusChange(
                    isResolveModalOpen.id,
                    isResolveModalOpen.targetStatus,
                    resolveNotes.trim() || undefined,
                  )
                }
              >
                Confirm Resolution
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ─────────────────────────────────── */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 420,
              padding: '24px 28px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(220,38,38,0.1)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Trash2 size={22} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>
              Delete Ticket {deleteTarget.ticketNumber}?
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Are you sure you want to remove &quot;{deleteTarget.title}&quot;? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <Button
                type="button"
                className="bg-[var(--danger)] text-white hover:bg-red-700"
                onClick={handleDeleteTicket}
              >
                Delete Ticket
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
