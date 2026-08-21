import { useMemo, useState, type FormEvent } from 'react'
import { createAppColumnHelper, flexRender, useAppTable, type AppColumnDef } from '~/lib/table'
import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useHotkey } from '@tanstack/react-hotkeys'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit2,
  FileText,
  Filter,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'

export interface GenericRow {
  id: string
  cells: string[]
}

interface Props {
  title: string
  description?: string
  columns?: string[]
  rows?: GenericRow[]
  kpis?: { label: string; value: string; color?: string }[]
}

const DEFAULT_COLUMNS = ['ID', 'Reference', 'Description', 'Amount', 'Status', 'Date']

const SAMPLE_ROWS: GenericRow[] = [
  { id: '1', cells: ['REF-001', 'QTN-2026-001', 'Process Engineering Study', '₹ 12,00,000', 'Active', '2026-08-12'] },
  { id: '2', cells: ['REF-002', 'QTN-2026-002', 'Pipeline Assessment', '₹ 38,00,000', 'Pending', '2026-08-10'] },
  { id: '3', cells: ['REF-003', 'QTN-2026-003', 'Structural Review', '₹ 8,50,000', 'Closed', '2026-08-05'] },
  { id: '4', cells: ['REF-004', 'QTN-2026-004', 'Electrical Audit', '₹ 21,00,000', 'Active', '2026-08-08'] },
  { id: '5', cells: ['REF-005', 'QTN-2026-005', 'HSE Compliance Audit', '₹ 9,50,000', 'Pending', '2026-08-14'] },
]

const columnHelper = createAppColumnHelper<GenericRow>()

export default function GenericPage({ title, description, columns, rows, kpis }: Props) {
  const cols = columns ?? DEFAULT_COLUMNS
  const [data, setData] = useState<GenericRow[]>(rows ?? SAMPLE_ROWS)
  const [search, setSearch] = useState('')

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<GenericRow | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState<GenericRow | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback(null)
    }, 4000)
  }

  // Hotkey: Escape closes modals
  useHotkey({ key: 'Escape' }, () => {
    setIsModalOpen(false)
    setIsDeleteOpen(null)
  })

  const handlePacedSearch = useDebouncedCallback((_val: string) => {
    // debounced search callback
  }, { wait: 200 })

  function handleSaveRow(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)

    const formData = new FormData(e.currentTarget)
    const newCells = cols.map((_, i) => String(formData.get(`cell_${i}`) ?? '').trim())

    if (editingRow) {
      setData((prev) =>
        prev.map((r) =>
          r.id === editingRow.id
            ? {
                ...r,
                cells: newCells,
              }
            : r,
        ),
      )
      showFeedback('success', `Record updated successfully.`)
    } else {
      const newRow: GenericRow = {
        id: crypto.randomUUID(),
        cells: newCells,
      }
      setData((prev) => [newRow, ...prev])
      showFeedback('success', `New record created successfully.`)
    }

    setIsSaving(false)
    setIsModalOpen(false)
    setEditingRow(null)
  }

  function handleDeleteRow() {
    if (!isDeleteOpen) return
    setData((prev) => prev.filter((r) => r.id !== isDeleteOpen.id))
    showFeedback('success', `Record deleted.`)
    setIsDeleteOpen(null)
  }

  const filteredData = useMemo(() => {
    return data.filter((r) =>
      r.cells.some((c) => c.toLowerCase().includes(search.toLowerCase())),
    )
  }, [data, search])

  const tableColumns = useMemo(() => {
    const baseCols = cols.map((colName, index) =>
      columnHelper.accessor((row) => row.cells[index] ?? '', {
        id: `col_${index}`,
        header: () => colName,
        cell: (info) => {
          const cell = info.getValue()
          if (cell === 'Active') {
            return <span className="badge badge-cyan" style={{ fontSize: 11 }}>{cell}</span>
          }
          if (cell === 'Pending') {
            return <span className="badge badge-warning" style={{ fontSize: 11 }}>{cell}</span>
          }
          if (cell === 'Closed' || cell === 'Completed') {
            return <span className="badge badge-success" style={{ fontSize: 11 }}>{cell}</span>
          }
          if (cell === 'Overdue') {
            return <span className="badge badge-danger" style={{ fontSize: 11 }}>{cell}</span>
          }
          if (cell.startsWith('₹') || cell.startsWith('AED ')) {
            return <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{cell}</span>
          }
          return cell
        },
      }),
    )

    const actionsCol = columnHelper.display({
      id: 'actions',
      header: () => <div style={{ textAlign: 'right' }}>Actions</div>,
      cell: (info) => {
        const row = info.row.original
        return (
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-flex', gap: 6 }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: '5px 8px' }}
                title="Edit Record"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingRow(row)
                  setIsModalOpen(true)
                }}
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: '5px 8px', color: 'var(--danger)' }}
                title="Delete Record"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsDeleteOpen(row)
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )
      },
    })

    return [...baseCols, actionsCol]
  }, [cols])

  const table = useAppTable({
    data: filteredData,
    columns: tableColumns as unknown as AppColumnDef<GenericRow>[],
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Toast Feedback Notification */}
      {feedback && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 8,
            background: feedback.type === 'success' ? 'var(--success-soft-bg)' : 'var(--danger-soft-bg)',
            color: feedback.type === 'success' ? 'var(--success-soft-fg)' : 'var(--danger-soft-fg)',
            fontWeight: 600,
            fontSize: 13.5,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {description ?? `${filteredData.length} records`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 180, color: 'var(--text-primary)' }}
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                handlePacedSearch(e.target.value)
              }}
            />
          </div>
          <button type="button" className="btn-secondary"><Filter size={14} /> Filter</button>
          <button type="button" className="btn-secondary"><Download size={14} /> Export</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setEditingRow(null)
              setIsModalOpen(true)
            }}
          >
            <Plus size={14} /> New
          </button>
        </div>
      </div>

      {kpis && (
        <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)', display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 12, flexShrink: 0 }}>
          {kpis.map((k) => (
            <div key={k.label} className="kpi-card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color ?? 'var(--text-primary)', marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ fontSize: 13 }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td
                    colSpan={tableColumns.length}
                    style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}
                  >
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE / EDIT RECORD */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
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
              maxWidth: 520,
              padding: '24px 28px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editingRow ? `Edit ${title} Record` : `New ${title} Record`}
                </h3>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveRow} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cols.map((colName, index) => (
                <Field key={colName}>
                  <FieldLabel htmlFor={`cell_${index}`}>{colName}</FieldLabel>
                  <Input
                    id={`cell_${index}`}
                    name={`cell_${index}`}
                    defaultValue={editingRow ? editingRow.cells[index] || '' : ''}
                    placeholder={`Enter ${colName.toLowerCase()}...`}
                    required={index === 0 || index === 1}
                  />
                </Field>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]"
                >
                  {isSaving ? 'Saving...' : editingRow ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {isDeleteOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
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
              maxWidth: 400,
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
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Delete Record</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Are you sure you want to delete this record? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsDeleteOpen(null)}
              >
                Cancel
              </button>
              <Button
                type="button"
                className="bg-[var(--danger)] text-white hover:bg-red-700"
                onClick={handleDeleteRow}
              >
                Delete Record
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
