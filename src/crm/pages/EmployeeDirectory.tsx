import { useMemo, useRef, useState, type FormEvent } from 'react'
import { createAppColumnHelper, flexRender, useAppTable, type AppColumnDef } from '~/lib/table'
import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useHotkey } from '@tanstack/react-hotkeys'
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Grid3X3,
  List,
  Mail,
  MapPin,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import { EMPLOYEES } from '../data/mock'

export type EmployeeMock = (typeof EMPLOYEES)[number]

const columnHelper = createAppColumnHelper<EmployeeMock>()

export default function EmployeeDirectory({
  onNavigate,
}: {
  onNavigate: (p: string) => void
}) {
  const [employees, setEmployees] = useState<EmployeeMock[]>(EMPLOYEES)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [deptFilter, setDeptFilter] = useState('All')
  const searchRef = useRef<HTMLInputElement>(null)

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeMock | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState<EmployeeMock | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => {
      setFeedback(null)
    }, 4000)
  }

  // Hotkey: Escape closes modals, Mod+K focuses search
  useHotkey({ key: 'Escape' }, () => {
    setIsModalOpen(false)
    setIsDeleteOpen(null)
  })

  useHotkey({ key: 'k', mod: true }, (event) => {
    event.preventDefault()
    searchRef.current?.focus()
  })

  // Pacer debounced search
  const handlePacedSearch = useDebouncedCallback((_val: string) => {
    // debounced search trigger
  }, { wait: 200 })

  const departments = useMemo(
    () => ['All', ...Array.from(new Set(employees.map((e) => e.dept)))],
    [employees],
  )

  function handleSaveEmployee(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)

    const formData = new FormData(e.currentTarget)
    const name = String(formData.get('name') ?? '').trim()
    const employeeCode = String(formData.get('employeeCode') ?? '').trim().toUpperCase()
    const role = String(formData.get('role') ?? '').trim()
    const dept = String(formData.get('dept') ?? 'Engineering').trim()
    const location = String(formData.get('location') ?? 'Mumbai').trim()
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const phone = String(formData.get('phone') ?? '').trim()
    const utilization = Number(formData.get('utilization') || 75)
    const skillsRaw = String(formData.get('skills') ?? '')
    const skills = skillsRaw
      ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : ['Process', 'Engineering']
    const status = (formData.get('status') as 'active' | 'inactive') || 'active'

    if (!name || !employeeCode) {
      showFeedback('error', 'Name and employee code are required.')
      setIsSaving(false)
      return
    }

    const initials = name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    if (editingEmployee) {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === editingEmployee.id
            ? {
                ...emp,
                name,
                employeeCode,
                role,
                dept,
                department: dept,
                location,
                email,
                phone,
                utilization,
                skills,
                status,
                avatar: initials,
              }
            : emp,
        ),
      )
      showFeedback('success', `Employee "${name}" updated successfully.`)
    } else {
      const newEmp: EmployeeMock = {
        id: crypto.randomUUID(),
        employeeCode,
        name,
        firstName: name.split(' ')[0] || '',
        lastName: name.split(' ').slice(1).join(' ') || '',
        role,
        designation: role,
        dept,
        department: dept,
        location,
        email,
        phone,
        utilization,
        skills,
        status,
        avatar: initials,
        color: '#64126D',
        employmentType: 'full_time',
        joined: new Date().toISOString().split('T')[0] || '',
        joiningDate: new Date().toISOString().split('T')[0] || '',
      }
      setEmployees((prev) => [newEmp, ...prev])
      showFeedback('success', `Employee "${name}" added to directory.`)
    }

    setIsSaving(false)
    setIsModalOpen(false)
    setEditingEmployee(null)
  }

  function handleDeleteEmployee() {
    if (!isDeleteOpen) return
    const targetName = isDeleteOpen.name
    setEmployees((prev) => prev.filter((e) => e.id !== isDeleteOpen.id))
    showFeedback('success', `Employee "${targetName}" removed from directory.`)
    setIsDeleteOpen(null)
  }

  const filtered = useMemo(() => {
    return employees.filter(
      (e) =>
        (deptFilter === 'All' || e.dept === deptFilter) &&
        (e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.role.toLowerCase().includes(search.toLowerCase()) ||
          e.employeeCode.toLowerCase().includes(search.toLowerCase())),
    )
  }, [deptFilter, employees, search])

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => 'Employee',
        cell: (info) => {
          const row = info.row.original
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: 'var(--brand-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {row.avatar}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{row.name}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                  }}
                >
                  {row.employeeCode} · {row.email}
                </div>
              </div>
            </div>
          )
        },
      }),
      columnHelper.accessor('role', {
        header: () => 'Role',
        cell: (info) => <span style={{ fontSize: 13 }}>{info.getValue()}</span>,
      }),
      columnHelper.accessor('dept', {
        header: () => 'Department',
        cell: (info) => (
          <span className="badge badge-cyan" style={{ fontSize: 11 }}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('location', {
        header: () => 'Location',
        cell: (info) => (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('utilization', {
        header: () => 'Utilization',
        cell: (info) => {
          const val = info.getValue()
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 60,
                  height: 6,
                  background: 'var(--border)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${val}%`,
                    height: '100%',
                    background:
                      val > 85
                        ? 'var(--danger)'
                        : val > 65
                          ? 'var(--success)'
                          : 'var(--warning)',
                    borderRadius: 999,
                  }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{val}%</span>
            </div>
          )
        },
      }),
      columnHelper.accessor('skills', {
        header: () => 'Skills',
        cell: (info) => (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {info.getValue().map((skill: string) => (
              <span
                key={skill}
                style={{
                  fontSize: 10.5,
                  padding: '1px 6px',
                  background: 'var(--surface-secondary)',
                  borderRadius: 4,
                  color: 'var(--text-muted)',
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        ),
      }),
      columnHelper.accessor('status', {
        header: () => 'Status',
        cell: (info) => (
          <span
            className={
              info.getValue() === 'active' ? 'badge badge-success' : 'badge badge-warning'
            }
            style={{ fontSize: 11, textTransform: 'capitalize' }}
          >
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div style={{ textAlign: 'right' }}>Actions</div>,
        cell: (info) => {
          const emp = info.row.original
          return (
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '5px 8px' }}
                  title="Edit Employee"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingEmployee(emp)
                    setIsModalOpen(true)
                  }}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '5px 8px', color: 'var(--danger)' }}
                  title="Delete Employee"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsDeleteOpen(emp)
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        },
      }),
    ],
    [],
  )

  const table = useAppTable({
    data: filtered,
    columns: columns as unknown as AppColumnDef<EmployeeMock>[],
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
            background: feedback.type === 'success' ? '#16A34A' : '#DC2626',
            color: '#FFFFFF',
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
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Employee Directory
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {filtered.length} employees ·{' '}
            {employees.filter((e) => e.status === 'active').length} active
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '7px 12px',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchRef}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                width: 180,
                color: 'var(--text-primary)',
              }}
              placeholder="Search employees..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                handlePacedSearch(e.target.value)
              }}
            />
          </div>
          <select
            className="input-base"
            style={{ width: 'auto', fontSize: 13 }}
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className={view === 'grid' ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '7px 10px' }}
              onClick={() => setView('grid')}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              type="button"
              className={view === 'list' ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '7px 10px' }}
              onClick={() => setView('list')}
            >
              <List size={14} />
            </button>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setEditingEmployee(null)
              setIsModalOpen(true)
            }}
          >
            <Plus size={14} /> Add Employee
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        {view === 'grid' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {filtered.map((e) => (
              <div
                key={e.id}
                className="card"
                style={{ padding: '18px 20px', cursor: 'pointer', position: 'relative' }}
                onClick={() => onNavigate('employee-profile')}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: 'var(--brand-primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      {e.avatar}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--brand-primary)',
                          fontWeight: 500,
                        }}
                      >
                        {e.role}
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: 'var(--text-muted)',
                          fontFamily: 'monospace',
                          marginTop: 1,
                        }}
                      >
                        {e.employeeCode}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{ display: 'flex', gap: 4 }}
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '4px 6px' }}
                      title="Edit Employee"
                      onClick={() => {
                        setEditingEmployee(e)
                        setIsModalOpen(true)
                      }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '4px 6px', color: 'var(--danger)' }}
                      title="Delete Employee"
                      onClick={() => setIsDeleteOpen(e)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Mail size={12} /> {e.email}
                  </div>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <MapPin size={12} /> {e.location}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span className="badge badge-cyan" style={{ fontSize: 11 }}>
                    {e.dept}
                  </span>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Util:
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color:
                          e.utilization > 85
                            ? 'var(--danger)'
                            : e.utilization > 65
                              ? 'var(--success)'
                              : 'var(--warning)',
                      }}
                    >
                      {e.utilization}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table
              className="data-table"
              style={{ width: '100%', borderCollapse: 'collapse' }}
            >
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onNavigate('employee-profile')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: CREATE / EDIT EMPLOYEE */}
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
              maxWidth: 580,
              padding: '24px 28px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={18} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {editingEmployee ? `Edit Employee: ${editingEmployee.employeeCode}` : 'Add New Employee'}
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

            <form onSubmit={handleSaveEmployee} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field>
                  <FieldLabel htmlFor="employeeCode">Employee Code *</FieldLabel>
                  <Input
                    id="employeeCode"
                    name="employeeCode"
                    defaultValue={editingEmployee?.employeeCode || `EMP-${String(employees.length + 1).padStart(3, '0')}`}
                    placeholder="e.g. EMP-009"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="name">Full Name *</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingEmployee?.name || ''}
                    placeholder="e.g. Sara Mohammed"
                    required
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field>
                  <FieldLabel htmlFor="role">Role / Designation</FieldLabel>
                  <Input
                    id="role"
                    name="role"
                    defaultValue={editingEmployee?.role || ''}
                    placeholder="e.g. Senior Process Engineer"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="dept">Department</FieldLabel>
                  <select
                    id="dept"
                    name="dept"
                    defaultValue={editingEmployee?.dept || 'Engineering'}
                    className="input-base"
                    style={{ width: '100%', height: 40 }}
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Process">Process</option>
                    <option value="PMO">PMO</option>
                    <option value="Civil">Civil</option>
                    <option value="HSE">HSE</option>
                    <option value="Admin">Admin</option>
                    <option value="Finance">Finance</option>
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field>
                  <FieldLabel htmlFor="email">Work Email</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={editingEmployee?.email || ''}
                    placeholder="e.g. sara.m@accentts.com"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="location">Location / Office</FieldLabel>
                  <Input
                    id="location"
                    name="location"
                    defaultValue={editingEmployee?.location || ''}
                    placeholder="e.g. Mumbai, Abu Dhabi"
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field>
                  <FieldLabel htmlFor="utilization">Target Utilization (%)</FieldLabel>
                  <Input
                    id="utilization"
                    name="utilization"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={editingEmployee?.utilization ?? 80}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="status">Status</FieldLabel>
                  <select
                    id="status"
                    name="status"
                    defaultValue={editingEmployee?.status || 'active'}
                    className="input-base"
                    style={{ width: '100%', height: 40 }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="skills">Skills (comma-separated)</FieldLabel>
                <Input
                  id="skills"
                  name="skills"
                  defaultValue={editingEmployee?.skills?.join(', ') || ''}
                  placeholder="e.g. Process Simulation, HYSYS, FEED, HAZOP"
                />
              </Field>

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
                  {isSaving ? 'Saving...' : editingEmployee ? 'Update Employee' : 'Add Employee'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE EMPLOYEE CONFIRMATION */}
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
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Delete Employee</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>{isDeleteOpen.name}</strong> ({isDeleteOpen.employeeCode}) from the directory?
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
                onClick={handleDeleteEmployee}
              >
                Delete Employee
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
