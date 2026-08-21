import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createAppColumnHelper, flexRender, useAppTable, type AppColumnDef } from '~/lib/table'
import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useHotkey } from '@tanstack/react-hotkeys'
import { AlertCircle, CheckCircle2, Download, Edit2, Filter, Package, Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { formatINR } from '~/lib/money'
import {
  createSoftwareAction,
  deleteSoftwareAction,
  getSoftwareMasterPageData,
  updateSoftwareAction,
} from '~/lib/masters/software/functions'

type Software = {
  id: string
  code: string
  name: string
  vendor: string | null
  version: string | null
  licenseType: string | null
  totalLicenses: number
  usedLicenses: number
  costPaise: number
  currency: string
  purchaseDate: string | null
  expiryDate: string | null
  description: string | null
  isActive: boolean
  daysUntilExpiry: number | null
  utilizationPct: number
}

const LICENSE_TYPES = ['Perpetual', 'Subscription', 'Network', 'Trial', 'Enterprise']

function daysBadge(days: number | null) {
  if (days === null) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
  if (days < 0) return <span className="badge badge-danger" style={{ fontSize: 11 }}>{Math.abs(days)}d overdue</span>
  if (days <= 30) return <span className="badge badge-warning" style={{ fontSize: 11 }}>{days}d left</span>
  return <span className="badge badge-success" style={{ fontSize: 11 }}>{days}d left</span>
}

export default function SoftwareMaster() {
  const [data, setData] = useState<Software[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, expiringSoon: 0, totalCostPaise: 0, totalLicenses: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [vendorFilter, setVendorFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Software | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState<Software | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  useHotkey({ key: 'Escape' }, () => {
    setIsModalOpen(false)
    setIsDeleteOpen(null)
  })
  useHotkey({ key: 'k', mod: true }, (e) => {
    e.preventDefault()
    searchRef.current?.focus()
  })
  const handlePacedSearch = useDebouncedCallback((_v: string) => {}, { wait: 200 })

  async function load() {
    setLoading(true)
    try {
      const res = await getSoftwareMasterPageData()
      if (!res.authorized) {
        showFeedback('error', 'Not authorized — sign in as administrator.')
        setData([])
        return
      }
      setData(res.data as Software[])
      setStats(res.stats)
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const costRupees = String(fd.get('costRupees') ?? '').trim()
    const costPaise = costRupees ? Math.round(Number(costRupees.replace(/,/g, '')) * 100) : 0
    const payload = {
      code: String(fd.get('code') ?? ''),
      name: String(fd.get('name') ?? ''),
      vendor: String(fd.get('vendor') ?? '') || null,
      version: String(fd.get('version') ?? '') || null,
      licenseType: String(fd.get('licenseType') ?? '') || null,
      totalLicenses: Number(fd.get('totalLicenses') ?? 1),
      usedLicenses: Number(fd.get('usedLicenses') ?? 0),
      costPaise,
      currency: 'INR',
      purchaseDate: String(fd.get('purchaseDate') ?? '') || null,
      expiryDate: String(fd.get('expiryDate') ?? '') || null,
      description: String(fd.get('description') ?? '') || null,
      isActive: String(fd.get('isActive') ?? 'true') === 'true',
    }
    try {
      const res = editing
        ? await updateSoftwareAction({ data: { id: editing.id, ...payload } })
        : await createSoftwareAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editing ? `Software "${payload.name}" updated.` : `Software "${payload.name}" created.`)
      setIsModalOpen(false)
      setEditing(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!isDeleteOpen) return
    try {
      const res = await deleteSoftwareAction({ data: { id: isDeleteOpen.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Software "${isDeleteOpen.name}" deleted.`)
      setIsDeleteOpen(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  const vendors = useMemo(() => ['All', ...Array.from(new Set(data.map((d) => d.vendor).filter(Boolean) as string[]))], [data])

  const filtered = useMemo(
    () =>
      data.filter((r) => {
        const matchSearch =
          !search ||
          r.code.toLowerCase().includes(search.toLowerCase()) ||
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          (r.vendor ?? '').toLowerCase().includes(search.toLowerCase())
        const matchVendor = vendorFilter === 'All' || r.vendor === vendorFilter
        const matchStatus = statusFilter === 'All' || (statusFilter === 'Active' ? r.isActive : !r.isActive)
        return matchSearch && matchVendor && matchStatus
      }),
    [data, search, vendorFilter, statusFilter],
  )

  const helper = createAppColumnHelper<Software>()
  const columns = useMemo(
    () => [
      helper.accessor('code', {
        header: () => 'Code',
        cell: (i) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{i.getValue()}</span>,
      }),
      helper.accessor('name', {
        header: () => 'Software',
        cell: (info) => {
          const r = info.row.original
          return (
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
              {r.version && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>v{r.version} · {r.licenseType ?? '—'}</div>}
            </div>
          )
        },
      }),
      helper.accessor('vendor', {
        header: () => 'Vendor',
        cell: (i) => <span style={{ fontSize: 13 }}>{i.getValue() || '—'}</span>,
      }),
      helper.accessor('totalLicenses', {
        header: () => 'Licenses',
        cell: (info) => {
          const r = info.row.original
          return (
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600 }}>{r.usedLicenses}/{r.totalLicenses}</div>
              <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 999, overflow: 'hidden', marginTop: 4 }}>
                <div style={{ width: `${r.utilizationPct}%`, height: '100%', background: r.utilizationPct > 90 ? 'var(--danger)' : r.utilizationPct > 70 ? 'var(--warning)' : 'var(--brand-primary)' }} />
              </div>
            </div>
          )
        },
      }),
      helper.accessor('costPaise', {
        header: () => 'Cost',
        cell: (i) => <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--brand-primary)' }}>{formatINR(i.getValue() / 100)}</span>,
      }),
      helper.accessor('expiryDate', {
        header: () => 'Expiry',
        cell: (info) => {
          const r = info.row.original
          return (
            <div style={{ fontSize: 12 }}>
              <div>{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString('en-IN') : '—'}</div>
              <div style={{ marginTop: 2 }}>{daysBadge(r.daysUntilExpiry)}</div>
            </div>
          )
        },
      }),
      helper.accessor('isActive', {
        header: () => 'Status',
        cell: (i) => <span className={i.getValue() ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: 11 }}>{i.getValue() ? 'Active' : 'Inactive'}</span>,
      }),
      helper.display({
        id: 'actions',
        header: () => <div style={{ textAlign: 'right' }}>Actions</div>,
        cell: (info) => {
          const r = info.row.original
          return (
            <div style={{ textAlign: 'right', display: 'inline-flex', gap: 6 }}>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px' }} onClick={() => { setEditing(r); setIsModalOpen(true) }}><Edit2 size={13} /></button>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px', color: 'var(--danger)' }} onClick={() => setIsDeleteOpen(r)}><Trash2 size={13} /></button>
            </div>
          )
        },
      }),
    ],
    [],
  )

  const table = useAppTable({ data: filtered, columns: columns as unknown as AppColumnDef<Software>[] })

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading software masters…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {feedback && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 150, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 8, background: feedback.type === 'success' ? '#16A34A' : '#DC2626', color: '#fff', fontWeight: 600, fontSize: 13.5 }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Software Master</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} software · {stats.active} active · {stats.expiringSoon} expiring ≤30d</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input ref={searchRef} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 180 }} placeholder="Search software..." value={search} onChange={(e) => { setSearch(e.target.value); handlePacedSearch(e.target.value) }} />
          </div>
          <select className="input-base" style={{ width: 'auto', fontSize: 13, height: 32 }} value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
            {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select className="input-base" style={{ width: 'auto', fontSize: 13, height: 32 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option>
          </select>
          <button type="button" className="btn-secondary"><Filter size={14} /> Filter</button>
          <button type="button" className="btn-secondary"><Download size={14} /> Export</button>
          <button type="button" className="btn-primary" onClick={() => { setEditing(null); setIsModalOpen(true) }}><Plus size={14} /> New Software</button>
        </div>
      </div>

      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="kpi-card" style={{ padding: '12px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Software</div><div style={{ fontSize: 20, fontWeight: 800 }}>{stats.total}</div></div>
        <div className="kpi-card" style={{ padding: '12px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Licenses</div><div style={{ fontSize: 20, fontWeight: 800 }}>{stats.totalLicenses}</div></div>
        <div className="kpi-card" style={{ padding: '12px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Cost</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-primary)' }}>{formatINR(stats.totalCostPaise / 100)}</div></div>
        <div className="kpi-card" style={{ padding: '12px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expiring ≤30d</div><div style={{ fontSize: 20, fontWeight: 800, color: stats.expiringSoon > 0 ? 'var(--danger)' : 'var(--success)' }}>{stats.expiringSoon}</div></div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>{table.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
            <tbody>
              {table.getRowModel().rows.map((r) => <tr key={r.id}>{r.getVisibleCells().map((c) => <td key={c.id} style={{ fontSize: 13 }}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}</tr>)}
              {table.getRowModel().rows.length === 0 && <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No software — register your first license.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 640, padding: '24px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Package size={18} style={{ color: 'var(--brand-primary)' }} /><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editing ? `Edit Software: ${editing.code}` : 'New Software License'}</h3></div><button type="button" className="btn-ghost" onClick={() => setIsModalOpen(false)}><X size={16} /></button></div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field><FieldLabel>Code *</FieldLabel><Input name="code" defaultValue={editing?.code ?? ''} placeholder="e.g. SW-AUTOCAD-2024" required style={{ textTransform: 'uppercase' }} /></Field>
                <Field><FieldLabel>Software *</FieldLabel><Input name="name" defaultValue={editing?.name ?? ''} placeholder="e.g. AutoCAD" required /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field><FieldLabel>Vendor</FieldLabel><Input name="vendor" defaultValue={editing?.vendor ?? ''} placeholder="e.g. Autodesk" /></Field>
                <Field><FieldLabel>Version</FieldLabel><Input name="version" defaultValue={editing?.version ?? ''} placeholder="e.g. 2024.1" /></Field>
                <Field><FieldLabel>License Type</FieldLabel><select name="licenseType" defaultValue={editing?.licenseType ?? ''} className="input-base" style={{ height: 40 }}><option value="">Select</option>{LICENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field><FieldLabel>Total Licenses *</FieldLabel><Input name="totalLicenses" type="number" min={1} defaultValue={editing?.totalLicenses ?? 1} required /></Field>
                <Field><FieldLabel>Used</FieldLabel><Input name="usedLicenses" type="number" min={0} defaultValue={editing?.usedLicenses ?? 0} /></Field>
                <Field><FieldLabel>Cost (INR) *</FieldLabel><Input name="costRupees" type="text" defaultValue={editing ? String((editing.costPaise / 100).toFixed(2)) : ''} placeholder="e.g. 125000.00" required /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field><FieldLabel>Purchase Date</FieldLabel><Input name="purchaseDate" type="date" defaultValue={editing?.purchaseDate ?? ''} /></Field>
                <Field><FieldLabel>Expiry Date</FieldLabel><Input name="expiryDate" type="date" defaultValue={editing?.expiryDate ?? ''} /></Field>
              </div>
              <Field><FieldLabel>Description</FieldLabel><Input name="description" defaultValue={editing?.description ?? ''} placeholder="Optional" /></Field>
              <Field><FieldLabel>Status</FieldLabel><select name="isActive" defaultValue={String(editing?.isActive ?? true)} className="input-base" style={{ height: 40 }}><option value="true">Active</option><option value="false">Inactive</option></select></Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}><button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button><Button type="submit" disabled={isSaving} className="bg-[var(--brand-primary)] text-white">{isSaving ? 'Saving…' : editing ? 'Update' : 'Create'}</Button></div>
            </form>
          </div>
        </div>
      )}
      {isDeleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}><h3 style={{ fontWeight: 700 }}>Delete Software</h3><p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Delete <strong>{isDeleteOpen.name}</strong> ({isDeleteOpen.code})?</p><div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}><button type="button" className="btn-secondary" onClick={() => setIsDeleteOpen(null)}>Cancel</button><Button type="button" className="bg-[var(--danger)] text-white" onClick={handleDelete}>Delete</Button></div></div>
        </div>
      )}
    </div>
  )
}
