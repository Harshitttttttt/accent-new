import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createAppColumnHelper, flexRender, useAppTable, type AppColumnDef } from '~/lib/table'
import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useHotkey } from '@tanstack/react-hotkeys'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit2,
  Filter,
  Layers,
  LayoutGrid,
  ListTree,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import {
  createActivityAction,
  createDisciplineAction,
  createSubActivityAction,
  deleteActivityAction,
  deleteDisciplineAction,
  deleteSubActivityAction,
  getActivityMasterPageData,
  updateActivityAction,
  updateDisciplineAction,
  updateSubActivityAction,
} from '~/lib/masters/activity/functions'

type Discipline = {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  activitiesCount: number
  subActivitiesCount: number
  createdAt: string | Date
  updatedAt: string | Date
}

type Activity = {
  id: string
  code: string
  name: string
  description: string | null
  disciplineId: string
  disciplineName: string
  disciplineCode: string
  unit: string | null
  isActive: boolean
  subActivitiesCount: number
}

type SubActivity = {
  id: string
  code: string
  name: string
  description: string | null
  activityId: string
  activityName: string
  activityCode: string
  disciplineId: string
  disciplineName: string
  disciplineCode: string
  unit: string | null
  isActive: boolean
}

type Tab = 'disciplines' | 'activities' | 'sub-activities'

const UNIT_OPTIONS = ['Hours', 'Nos', 'SqM', 'CuM', 'Kg', 'Ton', 'M', 'Lot', 'Set', 'Day', 'Month']

export default function ActivityMaster() {
  const [tab, setTab] = useState<Tab>('disciplines')
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [subActivities, setSubActivities] = useState<SubActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [disciplineFilter, setDisciplineFilter] = useState<string>('All')
  const [activityFilter, setActivityFilter] = useState<string>('All')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // discipline modals
  const [discModalOpen, setDiscModalOpen] = useState(false)
  const [editingDisc, setEditingDisc] = useState<Discipline | null>(null)
  const [deleteDisc, setDeleteDisc] = useState<Discipline | null>(null)
  // activity modals
  const [actModalOpen, setActModalOpen] = useState(false)
  const [editingAct, setEditingAct] = useState<Activity | null>(null)
  const [deleteAct, setDeleteAct] = useState<Activity | null>(null)
  // sub modals
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<SubActivity | null>(null)
  const [deleteSub, setDeleteSub] = useState<SubActivity | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  useHotkey({ key: 'Escape' }, () => {
    setDiscModalOpen(false)
    setActModalOpen(false)
    setSubModalOpen(false)
    setDeleteDisc(null)
    setDeleteAct(null)
    setDeleteSub(null)
  })

  useHotkey({ key: 'k', mod: true }, (e) => {
    e.preventDefault()
    searchRef.current?.focus()
  })

  const handlePacedSearch = useDebouncedCallback((_v: string) => {}, { wait: 200 })

  async function load() {
    setLoading(true)
    try {
      const data = await getActivityMasterPageData()
      if (!data.authorized) {
        showFeedback('error', 'Not authorized — sign in as administrator.')
        return
      }
      setDisciplines(data.disciplines as Discipline[])
      setActivities(data.activities as Activity[])
      setSubActivities(data.subActivities as SubActivity[])
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to load masters.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // ── Discipline handlers ──────────────────────────────────────────
  async function handleSaveDiscipline(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      code: String(fd.get('code') ?? ''),
      name: String(fd.get('name') ?? ''),
      description: String(fd.get('description') ?? '') || null,
      isActive: String(fd.get('isActive') ?? 'true') === 'true',
    }
    try {
      const res = editingDisc
        ? await updateDisciplineAction({ data: { id: editingDisc.id, ...payload } })
        : await createDisciplineAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editingDisc ? `Discipline "${payload.name}" updated.` : `Discipline "${payload.name}" created.`)
      setDiscModalOpen(false)
      setEditingDisc(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteDiscipline() {
    if (!deleteDisc) return
    try {
      const res = await deleteDisciplineAction({ data: { id: deleteDisc.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Discipline "${deleteDisc.name}" deleted.`)
      setDeleteDisc(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  // ── Activity handlers ────────────────────────────────────────────
  async function handleSaveActivity(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      code: String(fd.get('code') ?? ''),
      name: String(fd.get('name') ?? ''),
      description: String(fd.get('description') ?? '') || null,
      disciplineId: String(fd.get('disciplineId') ?? ''),
      unit: String(fd.get('unit') ?? '') || null,
      isActive: String(fd.get('isActive') ?? 'true') === 'true',
    }
    if (!payload.disciplineId) {
      showFeedback('error', 'Select a discipline.')
      setIsSaving(false)
      return
    }
    try {
      const res = editingAct
        ? await updateActivityAction({ data: { id: editingAct.id, ...payload } })
        : await createActivityAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editingAct ? `Activity "${payload.name}" updated.` : `Activity "${payload.name}" created.`)
      setActModalOpen(false)
      setEditingAct(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteActivity() {
    if (!deleteAct) return
    try {
      const res = await deleteActivityAction({ data: { id: deleteAct.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Activity "${deleteAct.name}" deleted.`)
      setDeleteAct(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  // ── Sub handlers ─────────────────────────────────────────────────
  async function handleSaveSub(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      code: String(fd.get('code') ?? ''),
      name: String(fd.get('name') ?? ''),
      description: String(fd.get('description') ?? '') || null,
      activityId: String(fd.get('activityId') ?? ''),
      unit: String(fd.get('unit') ?? '') || null,
      isActive: String(fd.get('isActive') ?? 'true') === 'true',
    }
    if (!payload.activityId) {
      showFeedback('error', 'Select an activity.')
      setIsSaving(false)
      return
    }
    try {
      const res = editingSub
        ? await updateSubActivityAction({ data: { id: editingSub.id, ...payload } })
        : await createSubActivityAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editingSub ? `Sub-activity "${payload.name}" updated.` : `Sub-activity "${payload.name}" created.`)
      setSubModalOpen(false)
      setEditingSub(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteSub() {
    if (!deleteSub) return
    try {
      const res = await deleteSubActivityAction({ data: { id: deleteSub.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Sub-activity "${deleteSub.name}" deleted.`)
      setDeleteSub(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  // ── Filtered data ────────────────────────────────────────────────
  const filteredDisciplines = useMemo(
    () =>
      disciplines.filter(
        (d) =>
          !search ||
          d.code.toLowerCase().includes(search.toLowerCase()) ||
          d.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [disciplines, search],
  )

  const filteredActivities = useMemo(
    () =>
      activities.filter((a) => {
        const matchDisc = disciplineFilter === 'All' || a.disciplineId === disciplineFilter
        const matchSearch =
          !search ||
          a.code.toLowerCase().includes(search.toLowerCase()) ||
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.disciplineName.toLowerCase().includes(search.toLowerCase())
        return matchDisc && matchSearch
      }),
    [activities, disciplineFilter, search],
  )

  const filteredSubs = useMemo(
    () =>
      subActivities.filter((s) => {
        const matchDisc = disciplineFilter === 'All' || s.disciplineId === disciplineFilter
        const matchAct = activityFilter === 'All' || s.activityId === activityFilter
        const matchSearch =
          !search ||
          s.code.toLowerCase().includes(search.toLowerCase()) ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.activityName.toLowerCase().includes(search.toLowerCase())
        return matchDisc && matchAct && matchSearch
      }),
    [subActivities, disciplineFilter, activityFilter, search],
  )

  const availableActivitiesForSubFilter = useMemo(
    () =>
      disciplineFilter === 'All'
        ? activities
        : activities.filter((a) => a.disciplineId === disciplineFilter),
    [activities, disciplineFilter],
  )

  // ── Columns ──────────────────────────────────────────────────────
  const discHelper = createAppColumnHelper<Discipline>()
  const discColumns = useMemo(
    () => [
      discHelper.accessor('code', {
        header: () => 'Code',
        cell: (i) => (
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{i.getValue()}</span>
        ),
      }),
      discHelper.accessor('name', {
        header: () => 'Discipline',
        cell: (i) => <span style={{ fontWeight: 600, fontSize: 13 }}>{i.getValue()}</span>,
      }),
      discHelper.accessor('description', {
        header: () => 'Description',
        cell: (i) => (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i.getValue() || '—'}</span>
        ),
      }),
      discHelper.accessor('activitiesCount', {
        header: () => 'Activities',
        cell: (i) => <span className="badge badge-cyan" style={{ fontSize: 11 }}>{i.getValue()}</span>,
      }),
      discHelper.accessor('subActivitiesCount', {
        header: () => 'Sub-Activities',
        cell: (i) => <span className="badge" style={{ fontSize: 11, background: 'var(--surface-secondary)' }}>{i.getValue()}</span>,
      }),
      discHelper.accessor('isActive', {
        header: () => 'Status',
        cell: (i) => (
          <span className={i.getValue() ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: 11 }}>
            {i.getValue() ? 'Active' : 'Inactive'}
          </span>
        ),
      }),
      discHelper.display({
        id: 'actions',
        header: () => <div style={{ textAlign: 'right' }}>Actions</div>,
        cell: (info) => {
          const r = info.row.original
          return (
            <div style={{ textAlign: 'right', display: 'inline-flex', gap: 6 }}>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px' }} onClick={() => { setEditingDisc(r); setDiscModalOpen(true) }}><Edit2 size={13} /></button>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px', color: 'var(--danger)' }} onClick={() => setDeleteDisc(r)}><Trash2 size={13} /></button>
            </div>
          )
        },
      }),
    ],
    [],
  )

  const actHelper = createAppColumnHelper<Activity>()
  const actColumns = useMemo(
    () => [
      actHelper.accessor('code', {
        header: () => 'Code',
        cell: (i) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{i.getValue()}</span>,
      }),
      actHelper.accessor('name', {
        header: () => 'Activity',
        cell: (i) => <span style={{ fontWeight: 600, fontSize: 13 }}>{i.getValue()}</span>,
      }),
      actHelper.accessor('disciplineName', {
        header: () => 'Discipline',
        cell: (info) => {
          const r = info.row.original
          return (
            <span className="badge badge-cyan" style={{ fontSize: 11 }} title={r.disciplineCode}>
              {info.getValue()}
            </span>
          )
        },
      }),
      actHelper.accessor('unit', {
        header: () => 'Unit',
        cell: (i) => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i.getValue() || '—'}</span>,
      }),
      actHelper.accessor('subActivitiesCount', {
        header: () => 'Sub',
        cell: (i) => <span style={{ fontSize: 12 }}>{i.getValue()}</span>,
      }),
      actHelper.accessor('isActive', {
        header: () => 'Status',
        cell: (i) => <span className={i.getValue() ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: 11 }}>{i.getValue() ? 'Active' : 'Inactive'}</span>,
      }),
      actHelper.display({
        id: 'actions',
        header: () => <div style={{ textAlign: 'right' }}>Actions</div>,
        cell: (info) => {
          const r = info.row.original
          return (
            <div style={{ textAlign: 'right', display: 'inline-flex', gap: 6 }}>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px' }} onClick={() => { setEditingAct(r); setActModalOpen(true) }}><Edit2 size={13} /></button>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px', color: 'var(--danger)' }} onClick={() => setDeleteAct(r)}><Trash2 size={13} /></button>
            </div>
          )
        },
      }),
    ],
    [],
  )

  const subHelper = createAppColumnHelper<SubActivity>()
  const subColumns = useMemo(
    () => [
      subHelper.accessor('code', {
        header: () => 'Code',
        cell: (i) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{i.getValue()}</span>,
      }),
      subHelper.accessor('name', {
        header: () => 'Sub-Activity',
        cell: (i) => <span style={{ fontWeight: 600, fontSize: 13 }}>{i.getValue()}</span>,
      }),
      subHelper.accessor('activityName', {
        header: () => 'Activity',
        cell: (info) => {
          const r = info.row.original
          return <span style={{ fontSize: 12 }}>{info.getValue()} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({r.activityCode})</span></span>
        },
      }),
      subHelper.accessor('disciplineName', {
        header: () => 'Discipline',
        cell: (i) => <span className="badge badge-cyan" style={{ fontSize: 11 }}>{i.getValue()}</span>,
      }),
      subHelper.accessor('unit', {
        header: () => 'Unit',
        cell: (i) => <span style={{ fontSize: 12 }}>{i.getValue() || '—'}</span>,
      }),
      subHelper.accessor('isActive', {
        header: () => 'Status',
        cell: (i) => <span className={i.getValue() ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: 11 }}>{i.getValue() ? 'Active' : 'Inactive'}</span>,
      }),
      subHelper.display({
        id: 'actions',
        header: () => <div style={{ textAlign: 'right' }}>Actions</div>,
        cell: (info) => {
          const r = info.row.original
          return (
            <div style={{ textAlign: 'right', display: 'inline-flex', gap: 6 }}>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px' }} onClick={() => { setEditingSub(r); setSubModalOpen(true) }}><Edit2 size={13} /></button>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px', color: 'var(--danger)' }} onClick={() => setDeleteSub(r)}><Trash2 size={13} /></button>
            </div>
          )
        },
      }),
    ],
    [],
  )

  const discTable = useAppTable({ data: filteredDisciplines, columns: discColumns as unknown as AppColumnDef<Discipline>[] })
  const actTable = useAppTable({ data: filteredActivities, columns: actColumns as unknown as AppColumnDef<Activity>[] })
  const subTable = useAppTable({ data: filteredSubs, columns: subColumns as unknown as AppColumnDef<SubActivity>[] })

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading activity masters…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {feedback && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 150, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 8, background: feedback.type === 'success' ? 'var(--success-soft-bg)' : 'var(--danger-soft-bg)', color: feedback.type === 'success' ? 'var(--success-soft-fg)' : 'var(--danger-soft-fg)', fontWeight: 600, fontSize: 13.5, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Activity Master</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Discipline → Activities → Sub-Activities · {disciplines.length} disciplines · {activities.length} activities · {subActivities.length} sub-activities
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input ref={searchRef} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 180 }} placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); handlePacedSearch(e.target.value) }} />
          </div>
          <button type="button" className="btn-secondary"><Filter size={14} /> Filter</button>
          <button type="button" className="btn-secondary"><Download size={14} /> Export</button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="kpi-card" style={{ padding: '12px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disciplines</div><div style={{ fontSize: 20, fontWeight: 800 }}>{disciplines.length}</div></div>
        <div className="kpi-card" style={{ padding: '12px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Activities</div><div style={{ fontSize: 20, fontWeight: 800 }}>{activities.length}</div></div>
        <div className="kpi-card" style={{ padding: '12px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sub-Activities</div><div style={{ fontSize: 20, fontWeight: 800 }}>{subActivities.length}</div></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 28px' }}>
        {([
          { key: 'disciplines' as const, label: 'Disciplines', icon: Layers, count: disciplines.length },
          { key: 'activities' as const, label: 'Activities', icon: LayoutGrid, count: activities.length },
          { key: 'sub-activities' as const, label: 'Sub-Activities', icon: ListTree, count: subActivities.length },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: tab === t.key ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: tab === t.key ? 'var(--brand-primary)' : 'var(--text-muted)', fontWeight: tab === t.key ? 700 : 500, fontSize: 13, background: 'transparent',
            }}
          >
            <t.icon size={14} /> {t.label} <span className="badge" style={{ fontSize: 11, background: tab === t.key ? 'var(--brand-primary)' : 'var(--surface-secondary)', color: tab === t.key ? 'var(--on-brand)' : 'var(--text-muted)' }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Toolbar per tab */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 28px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {tab !== 'disciplines' && (
            <select className="input-base" style={{ width: 'auto', fontSize: 13, height: 32 }} value={disciplineFilter} onChange={(e) => { setDisciplineFilter(e.target.value); setActivityFilter('All') }}>
              <option value="All">All Disciplines</option>
              {disciplines.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
            </select>
          )}
          {tab === 'sub-activities' && (
            <select className="input-base" style={{ width: 'auto', fontSize: 13, height: 32 }} value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}>
              <option value="All">All Activities</option>
              {availableActivitiesForSubFilter.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          )}
        </div>
        <div>
          {tab === 'disciplines' && <button type="button" className="btn-primary" onClick={() => { setEditingDisc(null); setDiscModalOpen(true) }}><Plus size={14} /> New Discipline</button>}
          {tab === 'activities' && <button type="button" className="btn-primary" onClick={() => { setEditingAct(null); setActModalOpen(true) }} disabled={disciplines.length === 0} title={disciplines.length === 0 ? 'Create a discipline first' : undefined}><Plus size={14} /> New Activity</button>}
          {tab === 'sub-activities' && <button type="button" className="btn-primary" onClick={() => { setEditingSub(null); setSubModalOpen(true) }} disabled={activities.length === 0} title={activities.length === 0 ? 'Create an activity first' : undefined}><Plus size={14} /> New Sub-Activity</button>}
        </div>
      </div>

      {/* Tables */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        {tab === 'disciplines' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>{discTable.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
              <tbody>
                {discTable.getRowModel().rows.map((r) => <tr key={r.id}>{r.getVisibleCells().map((c) => <td key={c.id} style={{ fontSize: 13 }}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}</tr>)}
                {discTable.getRowModel().rows.length === 0 && <tr><td colSpan={discColumns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No disciplines — create your first discipline to start the hierarchy.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'activities' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>{actTable.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
              <tbody>
                {actTable.getRowModel().rows.map((r) => <tr key={r.id}>{r.getVisibleCells().map((c) => <td key={c.id} style={{ fontSize: 13 }}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}</tr>)}
                {actTable.getRowModel().rows.length === 0 && <tr><td colSpan={actColumns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{disciplines.length === 0 ? 'Create a discipline first, then add activities.' : 'No activities for this filter.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'sub-activities' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>{subTable.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
              <tbody>
                {subTable.getRowModel().rows.map((r) => <tr key={r.id}>{r.getVisibleCells().map((c) => <td key={c.id} style={{ fontSize: 13 }}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}</tr>)}
                {subTable.getRowModel().rows.length === 0 && <tr><td colSpan={subColumns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{activities.length === 0 ? 'Create an activity first, then add sub-activities.' : 'No sub-activities for this filter.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disc Modal */}
      {discModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: '24px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editingDisc ? 'Edit Discipline' : 'New Discipline'}</h3><button type="button" className="btn-ghost" onClick={() => setDiscModalOpen(false)}><X size={16} /></button></div>
            <form onSubmit={handleSaveDiscipline} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field><FieldLabel htmlFor="disc_code">Code *</FieldLabel><Input id="disc_code" name="code" defaultValue={editingDisc?.code ?? ''} placeholder="e.g. CIVIL" required style={{ textTransform: 'uppercase' }} /></Field>
              <Field><FieldLabel htmlFor="disc_name">Name *</FieldLabel><Input id="disc_name" name="name" defaultValue={editingDisc?.name ?? ''} placeholder="e.g. Civil Engineering" required /></Field>
              <Field><FieldLabel htmlFor="disc_desc">Description</FieldLabel><Input id="disc_desc" name="description" defaultValue={editingDisc?.description ?? ''} placeholder="Optional" /></Field>
              <Field><FieldLabel htmlFor="disc_active">Status</FieldLabel><select id="disc_active" name="isActive" defaultValue={String(editingDisc?.isActive ?? true)} className="input-base" style={{ height: 40 }}><option value="true">Active</option><option value="false">Inactive</option></select></Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}><button type="button" className="btn-secondary" onClick={() => setDiscModalOpen(false)}>Cancel</button><Button type="submit" disabled={isSaving} className="bg-[var(--brand-primary)] text-white">{isSaving ? 'Saving…' : editingDisc ? 'Update' : 'Create'}</Button></div>
            </form>
          </div>
        </div>
      )}
      {deleteDisc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}><h3 style={{ fontWeight: 700 }}>Delete Discipline</h3><p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Delete <strong>{deleteDisc.name}</strong> ({deleteDisc.code})? Fails if activities are linked.</p><div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}><button type="button" className="btn-secondary" onClick={() => setDeleteDisc(null)}>Cancel</button><Button type="button" className="bg-[var(--danger)] text-white" onClick={handleDeleteDiscipline}>Delete</Button></div></div>
        </div>
      )}

      {/* Act Modal */}
      {actModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 560, padding: '24px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editingAct ? 'Edit Activity' : 'New Activity'}</h3><button type="button" className="btn-ghost" onClick={() => setActModalOpen(false)}><X size={16} /></button></div>
            <form onSubmit={handleSaveActivity} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field><FieldLabel>Discipline *</FieldLabel><select name="disciplineId" defaultValue={editingAct?.disciplineId ?? (disciplineFilter !== 'All' ? disciplineFilter : '')} className="input-base" style={{ height: 40 }} required><option value="">Select discipline</option>{disciplines.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field><FieldLabel>Code *</FieldLabel><Input name="code" defaultValue={editingAct?.code ?? ''} placeholder="e.g. CIV-STR-01" required style={{ textTransform: 'uppercase' }} /></Field>
                <Field><FieldLabel>Unit</FieldLabel><select name="unit" defaultValue={editingAct?.unit ?? ''} className="input-base" style={{ height: 40 }}><option value="">Select unit</option>{UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</select></Field>
              </div>
              <Field><FieldLabel>Name *</FieldLabel><Input name="name" defaultValue={editingAct?.name ?? ''} placeholder="e.g. Structural Analysis" required /></Field>
              <Field><FieldLabel>Description</FieldLabel><Input name="description" defaultValue={editingAct?.description ?? ''} placeholder="Optional" /></Field>
              <Field><FieldLabel>Status</FieldLabel><select name="isActive" defaultValue={String(editingAct?.isActive ?? true)} className="input-base" style={{ height: 40 }}><option value="true">Active</option><option value="false">Inactive</option></select></Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}><button type="button" className="btn-secondary" onClick={() => setActModalOpen(false)}>Cancel</button><Button type="submit" disabled={isSaving} className="bg-[var(--brand-primary)] text-white">{isSaving ? 'Saving…' : editingAct ? 'Update' : 'Create'}</Button></div>
            </form>
          </div>
        </div>
      )}
      {deleteAct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}><h3 style={{ fontWeight: 700 }}>Delete Activity</h3><p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Delete <strong>{deleteAct.name}</strong> ({deleteAct.code})? Sub-activities will be cascade-deleted.</p><div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}><button type="button" className="btn-secondary" onClick={() => setDeleteAct(null)}>Cancel</button><Button type="button" className="bg-[var(--danger)] text-white" onClick={handleDeleteActivity}>Delete</Button></div></div>
        </div>
      )}

      {/* Sub Modal */}
      {subModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 560, padding: '24px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editingSub ? 'Edit Sub-Activity' : 'New Sub-Activity'}</h3><button type="button" className="btn-ghost" onClick={() => setSubModalOpen(false)}><X size={16} /></button></div>
            <form onSubmit={handleSaveSub} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field><FieldLabel>Activity *</FieldLabel><select name="activityId" defaultValue={editingSub?.activityId ?? (activityFilter !== 'All' ? activityFilter : '')} className="input-base" style={{ height: 40 }} required><option value="">Select activity</option>{activities.map((a) => <option key={a.id} value={a.id}>{a.disciplineCode} › {a.code} — {a.name}</option>)}</select></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field><FieldLabel>Code *</FieldLabel><Input name="code" defaultValue={editingSub?.code ?? ''} placeholder="e.g. CIV-STR-01-A" required style={{ textTransform: 'uppercase' }} /></Field>
                <Field><FieldLabel>Unit</FieldLabel><select name="unit" defaultValue={editingSub?.unit ?? ''} className="input-base" style={{ height: 40 }}><option value="">Select unit</option>{UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</select></Field>
              </div>
              <Field><FieldLabel>Name *</FieldLabel><Input name="name" defaultValue={editingSub?.name ?? ''} placeholder="e.g. Beam Design" required /></Field>
              <Field><FieldLabel>Description</FieldLabel><Input name="description" defaultValue={editingSub?.description ?? ''} placeholder="Optional" /></Field>
              <Field><FieldLabel>Status</FieldLabel><select name="isActive" defaultValue={String(editingSub?.isActive ?? true)} className="input-base" style={{ height: 40 }}><option value="true">Active</option><option value="false">Inactive</option></select></Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}><button type="button" className="btn-secondary" onClick={() => setSubModalOpen(false)}>Cancel</button><Button type="submit" disabled={isSaving} className="bg-[var(--brand-primary)] text-white">{isSaving ? 'Saving…' : editingSub ? 'Update' : 'Create'}</Button></div>
            </form>
          </div>
        </div>
      )}
      {deleteSub && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}><h3 style={{ fontWeight: 700 }}>Delete Sub-Activity</h3><p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Delete <strong>{deleteSub.name}</strong> ({deleteSub.code})?</p><div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}><button type="button" className="btn-secondary" onClick={() => setDeleteSub(null)}>Cancel</button><Button type="button" className="bg-[var(--danger)] text-white" onClick={handleDeleteSub}>Delete</Button></div></div>
        </div>
      )}
    </div>
  )
}
