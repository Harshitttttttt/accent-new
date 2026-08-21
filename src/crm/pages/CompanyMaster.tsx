import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createAppColumnHelper, flexRender, useAppTable, type AppColumnDef } from '~/lib/table'
import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useHotkey } from '@tanstack/react-hotkeys'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Download,
  Edit2,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import {
  createCompanyAction,
  createCompanyEmailAction,
  createContactAction,
  deleteCompanyAction,
  deleteCompanyEmailAction,
  deleteContactAction,
  getCompanyMasterPageData,
  setPrimaryContactAction,
  updateCompanyAction,
  updateCompanyEmailAction,
  updateContactAction,
} from '~/lib/masters/company/functions'

// ── Types ───────────────────────────────────────────────────────────────
type Company = {
  id: string
  code: string
  name: string
  legalName: string | null
  website: string | null
  industry: string | null
  gstin: string | null
  pan: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  country: string | null
  postalCode: string | null
  inquiryEmail: string | null
  notes: string | null
  accountManagerId: string | null
  accountManagerName: string | null
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
  contacts: {
    id: string
    firstName: string
    lastName: string | null
    email: string | null
    phone: string | null
    designation: string | null
    isPrimary: boolean
  }[]
  emails: { id: string; email: string; type: string | null }[]
}

type ContactFlat = Company['contacts'][number] & { companyId: string; companyName: string; companyCode: string }
type EmailFlat = Company['emails'][number] & { companyId: string; companyName: string; companyCode: string }

type Tab = 'companies' | 'contacts' | 'emails'

const STATUS_BADGE: Record<string, string> = {
  active: 'badge badge-cyan',
  inactive: 'badge badge-warning',
}

export default function CompanyMaster({ onNavigate: _onNavigate }: { onNavigate: (p: string) => void }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, totalContacts: 0, totalEmails: 0, industries: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [companyFilter, setCompanyFilter] = useState<string>('All')
  const [tab, setTab] = useState<Tab>('companies')
  const searchRef = useRef<HTMLInputElement>(null)

  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState<Company | null>(null)

  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactFlat | null>(null)
  const [deleteContactTarget, setDeleteContactTarget] = useState<ContactFlat | null>(null)
  const [contactCompanyPreselect, setContactCompanyPreselect] = useState<string | null>(null)

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [editingEmail, setEditingEmail] = useState<EmailFlat | null>(null)
  const [deleteEmailTarget, setDeleteEmailTarget] = useState<EmailFlat | null>(null)
  const [emailCompanyPreselect, setEmailCompanyPreselect] = useState<string | null>(null)

  // per-company detail drawer
  const [detailCompany, setDetailCompany] = useState<Company | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  useHotkey({ key: 'Escape' }, () => {
    setIsCompanyModalOpen(false)
    setIsContactModalOpen(false)
    setIsEmailModalOpen(false)
    setDeleteCompanyTarget(null)
    setDeleteContactTarget(null)
    setDeleteEmailTarget(null)
    setDetailCompany(null)
  })
  useHotkey({ key: 'k', mod: true }, (e) => {
    e.preventDefault()
    searchRef.current?.focus()
  })

  const handlePacedSearch = useDebouncedCallback((_v: string) => {}, { wait: 200 })

  async function load() {
    setLoading(true)
    try {
      const data = await getCompanyMasterPageData()
      if (!data.authorized) {
        showFeedback('error', 'Not authorized — sign in as administrator.')
        setCompanies([])
        return
      }
      setCompanies(data.companies as Company[])
      setStats(data.stats)
      // keep detailCompany in sync if currently open
      if (detailCompany) {
        const updated = (data.companies as Company[]).find((c) => c.id === detailCompany.id)
        if (updated) setDetailCompany(updated)
      }
      if (editingCompany) {
        const upd = (data.companies as Company[]).find((c) => c.id === editingCompany.id)
        if (upd) setEditingCompany(upd)
      }
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to load companies.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Derived flat lists ───────────────────────────────────────────────
  const contactsFlat: ContactFlat[] = useMemo(() => {
    const out: ContactFlat[] = []
    for (const c of companies) {
      for (const ct of c.contacts) {
        out.push({ ...ct, companyId: c.id, companyName: c.name, companyCode: c.code })
      }
    }
    return out.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
      return `${a.firstName} ${a.lastName ?? ''}`.localeCompare(`${b.firstName} ${b.lastName ?? ''}`)
    })
  }, [companies])

  const emailsFlat: EmailFlat[] = useMemo(() => {
    const out: EmailFlat[] = []
    for (const c of companies) {
      for (const em of c.emails) out.push({ ...em, companyId: c.id, companyName: c.name, companyCode: c.code })
    }
    return out.sort((a, b) => a.email.localeCompare(b.email))
  }, [companies])

  // ── Filters ──────────────────────────────────────────────────────────
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const q = search.toLowerCase()
      const primary = c.contacts.find((ct) => ct.isPrimary) ?? c.contacts[0]
      const primaryName = primary ? `${primary.firstName} ${primary.lastName ?? ''}`.toLowerCase() : ''
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q) ||
        (c.industry ?? '').toLowerCase().includes(q) ||
        primaryName.includes(q) ||
        c.contacts.some((ct) => (ct.email ?? '').toLowerCase().includes(q)) ||
        c.emails.some((e) => e.email.toLowerCase().includes(q))
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter.toLowerCase()
      const matchesCompany = companyFilter === 'All' || c.id === companyFilter
      return matchesSearch && matchesStatus && matchesCompany
    })
  }, [companies, search, statusFilter, companyFilter])

  const filteredContacts = useMemo(() => {
    return contactsFlat.filter((ct) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        `${ct.firstName} ${ct.lastName ?? ''}`.toLowerCase().includes(q) ||
        (ct.email ?? '').toLowerCase().includes(q) ||
        (ct.phone ?? '').toLowerCase().includes(q) ||
        (ct.designation ?? '').toLowerCase().includes(q) ||
        ct.companyName.toLowerCase().includes(q) ||
        ct.companyCode.toLowerCase().includes(q)
      const matchesCompany = companyFilter === 'All' || ct.companyId === companyFilter
      return matchesSearch && matchesCompany
    })
  }, [contactsFlat, search, companyFilter])

  const filteredEmails = useMemo(() => {
    return emailsFlat.filter((em) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        em.email.toLowerCase().includes(q) ||
        (em.type ?? '').toLowerCase().includes(q) ||
        em.companyName.toLowerCase().includes(q) ||
        em.companyCode.toLowerCase().includes(q)
      const matchesCompany = companyFilter === 'All' || em.companyId === companyFilter
      return matchesSearch && matchesCompany
    })
  }, [emailsFlat, search, companyFilter])

  // ── Company handlers ─────────────────────────────────────────────────
  async function handleSaveCompany(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      code: String(fd.get('code') ?? ''),
      name: String(fd.get('name') ?? ''),
      legalName: String(fd.get('legalName') ?? '') || null,
      website: String(fd.get('website') ?? '') || null,
      industry: String(fd.get('industry') ?? '') || null,
      gstin: String(fd.get('gstin') ?? '') || null,
      pan: String(fd.get('pan') ?? '') || null,
      addressLine1: String(fd.get('addressLine1') ?? '') || null,
      addressLine2: String(fd.get('addressLine2') ?? '') || null,
      city: String(fd.get('city') ?? '') || null,
      state: String(fd.get('state') ?? '') || null,
      country: String(fd.get('country') ?? '') || 'India',
      postalCode: String(fd.get('postalCode') ?? '') || null,
      inquiryEmail: String(fd.get('inquiryEmail') ?? '') || null,
      notes: String(fd.get('notes') ?? '') || null,
      accountManagerId: null as string | null,
      status: (String(fd.get('status') ?? 'active') as 'active' | 'inactive') || 'active',
    }
    if (!payload.code || !payload.name) {
      showFeedback('error', 'Company code and name are required.')
      setIsSaving(false)
      return
    }
    try {
      const res = editingCompany
        ? await updateCompanyAction({ data: { id: editingCompany.id, ...payload } })
        : await createCompanyAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editingCompany ? `Company "${payload.name}" updated.` : `Company "${payload.name}" created.`)
      setIsCompanyModalOpen(false)
      setEditingCompany(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteCompany() {
    if (!deleteCompanyTarget) return
    try {
      const res = await deleteCompanyAction({ data: { id: deleteCompanyTarget.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Company "${deleteCompanyTarget.name}" deleted.`)
      setDeleteCompanyTarget(null)
      setDetailCompany(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  // ── Contact handlers ─────────────────────────────────────────────────
  async function handleSaveContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const companyId = String(fd.get('companyId') ?? contactCompanyPreselect ?? editingContact?.companyId ?? '')
    const payload = {
      companyId,
      firstName: String(fd.get('firstName') ?? '').trim(),
      lastName: String(fd.get('lastName') ?? '').trim() || null,
      email: String(fd.get('email') ?? '').trim() || null,
      phone: String(fd.get('phone') ?? '').trim() || null,
      designation: String(fd.get('designation') ?? '').trim() || null,
      isPrimary: fd.get('isPrimary') === 'on' || fd.get('isPrimary') === 'true',
    }
    if (!payload.companyId) {
      showFeedback('error', 'Select a company.')
      setIsSaving(false)
      return
    }
    if (!payload.firstName) {
      showFeedback('error', 'First name is required.')
      setIsSaving(false)
      return
    }
    try {
      const res = editingContact
        ? await updateContactAction({ data: { id: editingContact.id, ...payload } })
        : await createContactAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editingContact ? `Contact "${payload.firstName}" updated.` : `Contact "${payload.firstName}" created.`)
      setIsContactModalOpen(false)
      setEditingContact(null)
      setContactCompanyPreselect(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteContact() {
    if (!deleteContactTarget) return
    try {
      const res = await deleteContactAction({ data: { id: deleteContactTarget.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Contact "${deleteContactTarget.firstName}" deleted.`)
      setDeleteContactTarget(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  async function handleSetPrimary(contactId: string) {
    try {
      const res = await setPrimaryContactAction({ data: { id: contactId } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', 'Primary contact updated.')
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to set primary.')
    }
  }

  // ── Email handlers ───────────────────────────────────────────────────
  async function handleSaveEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const companyId = String(fd.get('companyId') ?? emailCompanyPreselect ?? editingEmail?.companyId ?? '')
    const payload = {
      companyId,
      email: String(fd.get('email') ?? '').trim(),
      type: String(fd.get('type') ?? '').trim() || null,
    }
    if (!payload.companyId || !payload.email) {
      showFeedback('error', 'Company and email are required.')
      setIsSaving(false)
      return
    }
    try {
      const res = editingEmail
        ? await updateCompanyEmailAction({ data: { id: editingEmail.id, email: payload.email, type: payload.type } })
        : await createCompanyEmailAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editingEmail ? 'Company email updated.' : 'Company email added.')
      setIsEmailModalOpen(false)
      setEditingEmail(null)
      setEmailCompanyPreselect(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteEmail() {
    if (!deleteEmailTarget) return
    try {
      const res = await deleteCompanyEmailAction({ data: { id: deleteEmailTarget.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Email "${deleteEmailTarget.email}" deleted.`)
      setDeleteEmailTarget(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  // ── Columns ──────────────────────────────────────────────────────────
  const companyHelper = createAppColumnHelper<Company>()
  const companyColumns = useMemo(
    () => [
      companyHelper.accessor('code', {
        header: () => 'Code',
        cell: (info) => <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{info.getValue()}</span>,
      }),
      companyHelper.accessor('name', {
        header: () => 'Company',
        cell: (info) => {
          const row = info.row.original
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={14} style={{ color: 'var(--brand-primary)' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{row.name}</div>
                {row.legalName && row.legalName !== row.name && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{row.legalName}</div>
                )}
              </div>
            </div>
          )
        },
      }),
      companyHelper.accessor('industry', {
        header: () => 'Industry',
        cell: (info) => <span style={{ fontSize: 13 }}>{info.getValue() || '—'}</span>,
      }),
      companyHelper.accessor('city', {
        header: () => 'Location',
        cell: (info) => {
          const row = info.row.original
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
              {[row.city, row.state].filter(Boolean).join(', ') || '—'}
            </div>
          )
        },
      }),
      companyHelper.display({
        id: 'primaryContact',
        header: () => 'Primary Contact',
        cell: (info) => {
          const row = info.row.original
          const primary = row.contacts.find((c) => c.isPrimary) ?? row.contacts[0]
          if (!primary) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— no contacts —</span>
          const fullName = `${primary.firstName} ${primary.lastName ?? ''}`.trim()
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px',
                borderRadius: 6,
                background: primary.isPrimary ? 'rgba(100,18,109,0.06)' : 'transparent',
                border: primary.isPrimary ? '1px solid rgba(100,18,109,0.12)' : '1px solid transparent',
              }}
            >
              <div style={{ width: 24, height: 24, borderRadius: 999, background: primary.isPrimary ? 'var(--brand-primary)' : 'var(--surface-secondary)', color: primary.isPrimary ? 'var(--on-brand)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                {primary.firstName[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {fullName}
                  {primary.isPrimary && <Star size={11} style={{ color: '#EAB308', fill: '#EAB308' }} />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  <Mail size={10} /> {primary.email || '—'}
                  {primary.designation && <span> · {primary.designation}</span>}
                </div>
              </div>
            </div>
          )
        },
      }),
      companyHelper.display({
        id: 'contactsCount',
        header: () => 'Contacts',
        cell: (info) => {
          const row = info.row.original
          const count = row.contacts.length
          const primaryCount = row.contacts.filter((c) => c.isPrimary).length
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDetailCompany(row)
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: count ? 'var(--surface-secondary)' : 'transparent', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 8px', cursor: 'pointer' }}
              title={`View all ${count} contacts`}
            >
              <Users size={12} /> {count} {count === 1 ? 'contact' : 'contacts'}
              {primaryCount > 0 && <span className="badge badge-cyan" style={{ fontSize: 10 }}><Star size={8} /> primary</span>}
            </button>
          )
        },
      }),
      companyHelper.display({
        id: 'emailsCount',
        header: () => 'Emails',
        cell: (info) => {
          const row = info.row.original
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <Mail size={12} /> {row.emails.length}
            </span>
          )
        },
      }),
      companyHelper.accessor('status', {
        header: () => 'Status',
        cell: (info) => {
          const v = info.getValue()
          return <span className={STATUS_BADGE[v] ?? 'badge'} style={{ fontSize: 11, textTransform: 'capitalize' }}>{v}</span>
        },
      }),
      companyHelper.display({
        id: 'actions',
        header: () => <div style={{ textAlign: 'right' }}>Actions</div>,
        cell: (info) => {
          const c = info.row.original
          return (
            <div style={{ textAlign: 'right', display: 'inline-flex', gap: 6 }}>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px' }} title="View contacts" onClick={(e) => { e.stopPropagation(); setDetailCompany(c) }}>
                <Users size={13} />
              </button>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px' }} title="Edit Company" onClick={(e) => { e.stopPropagation(); setEditingCompany(c); setIsCompanyModalOpen(true) }}>
                <Edit2 size={13} />
              </button>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px', color: 'var(--danger)' }} title="Delete Company" onClick={(e) => { e.stopPropagation(); setDeleteCompanyTarget(c) }}>
                <Trash2 size={13} />
              </button>
            </div>
          )
        },
      }),
    ],
    [],
  )

  const contactHelper = createAppColumnHelper<ContactFlat>()
  const contactColumns = useMemo(
    () => [
      contactHelper.display({
        id: 'primary',
        header: () => <span title="Primary">★</span>,
        cell: (info) => {
          const r = info.row.original
          return r.isPrimary ? (
            <span className="badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#A16207', border: '1px solid rgba(234,179,8,0.3)', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Star size={10} style={{ fill: '#EAB308', color: '#EAB308' }} /> Primary</span>
          ) : (
            <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 999 }} title="Set as primary" onClick={() => handleSetPrimary(r.id)}>
              Set primary
            </button>
          )
        },
      }),
      contactHelper.display({
        id: 'company',
        header: () => 'Company',
        cell: (info) => {
          const r = info.row.original
          return <span style={{ fontSize: 12, fontWeight: 600 }}>{r.companyCode} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {r.companyName}</span></span>
        },
      }),
      contactHelper.display({
        id: 'name',
        header: () => 'Contact',
        cell: (info) => {
          const r = info.row.original
          const name = `${r.firstName} ${r.lastName ?? ''}`.trim()
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 999, background: r.isPrimary ? 'var(--brand-primary)' : 'var(--surface-secondary)', color: r.isPrimary ? 'var(--on-brand)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: r.isPrimary ? '2px solid rgba(234,179,8,0.6)' : 'none' }}>{r.firstName[0]?.toUpperCase() ?? '?'}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: r.isPrimary ? 700 : 500 }}>{name}</div>
                {r.designation && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.designation}</div>}
              </div>
            </div>
          )
        },
      }),
      contactHelper.display({
        id: 'email',
        header: () => 'Email',
        cell: (info) => {
          const v = info.row.original.email
          return v ? <span style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={11} style={{ color: 'var(--text-muted)' }} /> {v}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
        },
      }),
      contactHelper.display({
        id: 'phone',
        header: () => 'Phone',
        cell: (info) => {
          const v = info.row.original.phone
          return v ? <span style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={11} style={{ color: 'var(--text-muted)' }} /> {v}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
        },
      }),
      contactHelper.display({
        id: 'actions',
        header: () => <div style={{ textAlign: 'right' }}>Actions</div>,
        cell: (info) => {
          const r = info.row.original
          return (
            <div style={{ textAlign: 'right', display: 'inline-flex', gap: 6 }}>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px' }} title="Edit contact" onClick={() => { setEditingContact(r); setContactCompanyPreselect(r.companyId); setIsContactModalOpen(true) }}><Edit2 size={13} /></button>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px', color: 'var(--danger)' }} title="Delete contact" onClick={() => setDeleteContactTarget(r)}><Trash2 size={13} /></button>
            </div>
          )
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const emailHelper = createAppColumnHelper<EmailFlat>()
  const emailColumns = useMemo(
    () => [
      emailHelper.display({
        id: 'company',
        header: () => 'Company',
        cell: (info) => {
          const r = info.row.original
          return <span style={{ fontSize: 12, fontWeight: 600 }}>{r.companyCode} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {r.companyName}</span></span>
        },
      }),
      emailHelper.accessor('email', {
        header: () => 'Email',
        cell: (info) => <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={12} style={{ color: 'var(--text-muted)' }} /> {info.getValue()}</span>,
      }),
      emailHelper.accessor('type', {
        header: () => 'Type',
        cell: (info) => <span className="badge" style={{ fontSize: 11, background: 'var(--surface-secondary)' }}>{info.getValue() || '—'}</span>,
      }),
      emailHelper.display({
        id: 'actions',
        header: () => <div style={{ textAlign: 'right' }}>Actions</div>,
        cell: (info) => {
          const r = info.row.original
          return (
            <div style={{ textAlign: 'right', display: 'inline-flex', gap: 6 }}>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px' }} title="Edit email" onClick={() => { setEditingEmail(r); setEmailCompanyPreselect(r.companyId); setIsEmailModalOpen(true) }}><Edit2 size={13} /></button>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px', color: 'var(--danger)' }} title="Delete email" onClick={() => setDeleteEmailTarget(r)}><Trash2 size={13} /></button>
            </div>
          )
        },
      }),
    ],
    [],
  )

  const companyTable = useAppTable({ data: filteredCompanies, columns: companyColumns as unknown as AppColumnDef<Company>[] })
  const contactTable = useAppTable({ data: filteredContacts, columns: contactColumns as unknown as AppColumnDef<ContactFlat>[] })
  const emailTable = useAppTable({ data: filteredEmails, columns: emailColumns as unknown as AppColumnDef<EmailFlat>[] })

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading company masters…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {feedback && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 150, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 8, background: feedback.type === 'success' ? 'var(--success-soft-bg)' : 'var(--danger-soft-bg)', color: feedback.type === 'success' ? 'var(--success-soft-fg)' : 'var(--danger-soft-fg)', fontWeight: 600, fontSize: 13.5, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* KPI Row */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, flexShrink: 0 }}>
        <div className="kpi-card" style={{ padding: '14px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Companies</div><div style={{ fontSize: 22, fontWeight: 800 }}>{stats.total}</div></div>
        <div className="kpi-card" style={{ padding: '14px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{stats.active}</div></div>
        <div className="kpi-card" style={{ padding: '14px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Contacts</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-primary)' }}>{stats.totalContacts}</div></div>
        <div className="kpi-card" style={{ padding: '14px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Company Emails</div><div style={{ fontSize: 22, fontWeight: 800 }}>{stats.totalEmails}</div></div>
        <div className="kpi-card" style={{ padding: '14px 16px' }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Industries</div><div style={{ fontSize: 22, fontWeight: 800 }}>{stats.industries}</div></div>
      </div>

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Company Master</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            {tab === 'companies' && `${filteredCompanies.length} companies · ${stats.active} active`}
            {tab === 'contacts' && `${filteredContacts.length} contacts · ${contactsFlat.filter(c=>c.isPrimary).length} primary`}
            {tab === 'emails' && `${filteredEmails.length} emails`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input ref={searchRef} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 200, color: 'var(--text-primary)' }} placeholder={tab === 'contacts' ? 'Search contacts...' : tab === 'emails' ? 'Search emails...' : 'Search companies...'} value={search} onChange={(e) => { setSearch(e.target.value); handlePacedSearch(e.target.value) }} />
          </div>
          {tab === 'companies' && (
            <select className="input-base" style={{ width: 'auto', fontSize: 13 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option>All</option><option>Active</option><option>Inactive</option>
            </select>
          )}
          <select className="input-base" style={{ width: 'auto', fontSize: 13 }} value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="All">All Companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
          <button type="button" className="btn-secondary"><Filter size={14} /> Filter</button>
          <button type="button" className="btn-secondary"><Download size={14} /> Export</button>
          {tab === 'companies' && <button type="button" className="btn-primary" onClick={() => { setEditingCompany(null); setIsCompanyModalOpen(true) }}><Plus size={14} /> Add Company</button>}
          {tab === 'contacts' && <button type="button" className="btn-primary" onClick={() => { setEditingContact(null); setContactCompanyPreselect(companyFilter !== 'All' ? companyFilter : companies[0]?.id ?? null); setIsContactModalOpen(true) }} disabled={companies.length===0}><Plus size={14} /> New Contact</button>}
          {tab === 'emails' && <button type="button" className="btn-primary" onClick={() => { setEditingEmail(null); setEmailCompanyPreselect(companyFilter !== 'All' ? companyFilter : companies[0]?.id ?? null); setIsEmailModalOpen(true) }} disabled={companies.length===0}><Plus size={14} /> New Email</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 28px' }}>
        {[
          { key: 'companies' as const, label: 'Companies', icon: Building2, count: companies.length },
          { key: 'contacts' as const, label: 'Contacts', icon: Users, count: contactsFlat.length },
          { key: 'emails' as const, label: 'Emails', icon: Mail, count: emailsFlat.length },
        ].map((t) => (
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

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        {tab === 'companies' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>{companyTable.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
              <tbody>
                {companyTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => setDetailCompany(row.original)}>
                    {row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                  </tr>
                ))}
                {companyTable.getRowModel().rows.length === 0 && <tr><td colSpan={companyColumns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No companies found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'contacts' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>{contactTable.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
              <tbody>
                {contactTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} style={row.original.isPrimary ? { background: 'rgba(234,179,8,0.06)' } : undefined}>
                    {row.getVisibleCells().map((cell) => <td key={cell.id} style={{ fontSize: 13 }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                  </tr>
                ))}
                {contactTable.getRowModel().rows.length === 0 && <tr><td colSpan={contactColumns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{companies.length===0 ? 'Create a company first.' : 'No contacts for this filter. Add a contact to get started.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'emails' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>{emailTable.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
              <tbody>
                {emailTable.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id} style={{ fontSize: 13 }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
                {emailTable.getRowModel().rows.length === 0 && <tr><td colSpan={emailColumns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{companies.length===0 ? 'Create a company first.' : 'No emails for this filter.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer for company contacts+emails */}
      {detailCompany && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 90, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setDetailCompany(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 520, height: '100%', overflowY: 'auto', padding: 24, background: 'var(--surface)', boxShadow: '-8px 0 24px rgba(0,0,0,0.12)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={16} style={{ color: 'var(--brand-primary)' }} />
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{detailCompany.name}</h3>
                  <span className={STATUS_BADGE[detailCompany.status] ?? 'badge'} style={{ fontSize: 10 }}>{detailCompany.status}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{detailCompany.code} · {detailCompany.industry || '—'} · {[detailCompany.city, detailCompany.state].filter(Boolean).join(', ') || '—'}</div>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setDetailCompany(null)}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setEditingCompany(detailCompany); setIsCompanyModalOpen(true) }}><Edit2 size={13} /> Edit Company</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => { setContactCompanyPreselect(detailCompany.id); setEditingContact(null); setIsContactModalOpen(true) }}><Plus size={13} /> Add Contact</button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={13} /> Contacts ({detailCompany.contacts.length})</h4>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>★ = Primary</span>
              </div>
              {detailCompany.contacts.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, background: 'var(--surface-secondary)', borderRadius: 8 }}>No contacts yet — add the first contact for this company.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detailCompany.contacts
                    .slice()
                    .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1))
                    .map((ct) => (
                    <div
                      key={ct.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: ct.isPrimary ? 'rgba(100,18,109,0.06)' : 'var(--surface-secondary)',
                        border: ct.isPrimary ? '1px solid rgba(100,18,109,0.18)' : '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 999, background: ct.isPrimary ? 'var(--brand-primary)' : 'var(--surface-secondary)', color: ct.isPrimary ? 'var(--on-brand)' : 'var(--text-muted)', border: ct.isPrimary ? '2px solid #EAB308' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>{ct.firstName[0]?.toUpperCase()}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: ct.isPrimary ? 700 : 600, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            {ct.firstName} {ct.lastName ?? ''} {ct.isPrimary && <span className="badge" style={{ background: '#EAB308', color: '#fff', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 2 }}><Star size={8} fill="#fff" /> Primary</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                            {ct.designation && <span>{ct.designation}</span>}
                            {ct.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Mail size={10} /> {ct.email}</span>}
                            {ct.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Phone size={10} /> {ct.phone}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {!ct.isPrimary && (
                          <button type="button" className="btn-ghost" title="Set as primary" style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} onClick={() => handleSetPrimary(ct.id)}><Star size={12} /> Set primary</button>
                        )}
                        <button type="button" className="btn-ghost" style={{ padding: '5px 8px' }} title="Edit" onClick={() => { const flat: ContactFlat = { ...ct, companyId: detailCompany.id, companyName: detailCompany.name, companyCode: detailCompany.code }; setEditingContact(flat); setContactCompanyPreselect(detailCompany.id); setIsContactModalOpen(true) }}><Edit2 size={13} /></button>
                        <button type="button" className="btn-ghost" style={{ padding: '5px 8px', color: 'var(--danger)' }} onClick={() => { const flat: ContactFlat = { ...ct, companyId: detailCompany.id, companyName: detailCompany.name, companyCode: detailCompany.code }; setDeleteContactTarget(flat) }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={13} /> Company Emails ({detailCompany.emails.length})</h4>
                <button type="button" className="btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={() => { setEmailCompanyPreselect(detailCompany.id); setEditingEmail(null); setIsEmailModalOpen(true) }}><Plus size={12} /> Add Email</button>
              </div>
              {detailCompany.emails.length === 0 ? (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, background: 'var(--surface-secondary)', borderRadius: 8 }}>No extra emails.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detailCompany.emails.map((em) => (
                    <div key={em.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: 'var(--surface-secondary)', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <div><div style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11} /> {em.email}</div>{em.type && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Type: {em.type}</div>}</div>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button type="button" className="btn-ghost" style={{ padding: '4px 6px' }} onClick={() => { const flat: EmailFlat = { ...em, companyId: detailCompany.id, companyName: detailCompany.name, companyCode: detailCompany.code }; setEditingEmail(flat); setEmailCompanyPreselect(detailCompany.id); setIsEmailModalOpen(true) }}><Edit2 size={12} /></button>
                        <button type="button" className="btn-ghost" style={{ padding: '4px 6px', color: 'var(--danger)' }} onClick={() => { const flat: EmailFlat = { ...em, companyId: detailCompany.id, companyName: detailCompany.name, companyCode: detailCompany.code }; setDeleteEmailTarget(flat) }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPANY CREATE/EDIT */}
      {isCompanyModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 720, padding: '24px 28px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Building2 size={18} style={{ color: 'var(--brand-primary)' }} /><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editingCompany ? `Edit Company: ${editingCompany.code}` : 'Register New Company'}</h3></div>
              <button type="button" className="btn-ghost" onClick={() => setIsCompanyModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveCompany} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field><FieldLabel htmlFor="code">Company Code *</FieldLabel><Input id="code" name="code" defaultValue={editingCompany?.code || `COMP-2026-${String(companies.length + 1).padStart(4, '0')}`} placeholder="COMP-2026-0008" required style={{ textTransform: 'uppercase' }} /></Field>
                <Field><FieldLabel htmlFor="name">Display Name *</FieldLabel><Input id="name" name="name" defaultValue={editingCompany?.name || ''} placeholder="Bharat Petroleum" required /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field><FieldLabel htmlFor="legalName">Legal Name</FieldLabel><Input id="legalName" name="legalName" defaultValue={editingCompany?.legalName || ''} placeholder="Bharat Petroleum Corporation Limited" /></Field>
                <Field><FieldLabel htmlFor="industry">Industry</FieldLabel><Input id="industry" name="industry" defaultValue={editingCompany?.industry || ''} placeholder="Oil & Gas" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field><FieldLabel htmlFor="website">Website</FieldLabel><Input id="website" name="website" defaultValue={editingCompany?.website || ''} placeholder="https://example.com" /></Field>
                <Field><FieldLabel htmlFor="inquiryEmail">Inquiry Email</FieldLabel><Input id="inquiryEmail" name="inquiryEmail" type="email" defaultValue={editingCompany?.inquiryEmail || ''} placeholder="info@company.com" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field><FieldLabel htmlFor="city">City</FieldLabel><Input id="city" name="city" defaultValue={editingCompany?.city || ''} placeholder="Mumbai" /></Field>
                <Field><FieldLabel htmlFor="state">State</FieldLabel><Input id="state" name="state" defaultValue={editingCompany?.state || ''} placeholder="Maharashtra" /></Field>
                <Field><FieldLabel htmlFor="country">Country</FieldLabel><Input id="country" name="country" defaultValue={editingCompany?.country || 'India'} placeholder="India" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field><FieldLabel htmlFor="addressLine1">Address Line 1</FieldLabel><Input id="addressLine1" name="addressLine1" defaultValue={editingCompany?.addressLine1 || ''} placeholder="Street, Building" /></Field>
                <Field><FieldLabel htmlFor="addressLine2">Address Line 2</FieldLabel><Input id="addressLine2" name="addressLine2" defaultValue={editingCompany?.addressLine2 || ''} placeholder="Area, Landmark" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field><FieldLabel htmlFor="postalCode">Postal Code</FieldLabel><Input id="postalCode" name="postalCode" defaultValue={editingCompany?.postalCode || ''} placeholder="400001" /></Field>
                <Field><FieldLabel htmlFor="gstin">GSTIN</FieldLabel><Input id="gstin" name="gstin" defaultValue={editingCompany?.gstin || ''} placeholder="27AAAAA0000A1Z5" style={{ textTransform: 'uppercase' }} /></Field>
                <Field><FieldLabel htmlFor="pan">PAN</FieldLabel><Input id="pan" name="pan" defaultValue={editingCompany?.pan || ''} placeholder="AAAAA0000A" style={{ textTransform: 'uppercase' }} /></Field>
              </div>
              <Field><FieldLabel htmlFor="notes">Notes</FieldLabel><Input id="notes" name="notes" defaultValue={editingCompany?.notes || ''} placeholder="Optional notes" /></Field>
              <Field style={{ marginTop: 4 }}><FieldLabel htmlFor="status">Status</FieldLabel><select id="status" name="status" defaultValue={editingCompany?.status || 'active'} className="input-base" style={{ width: '100%', height: 40 }}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>

              {editingCompany && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Contacts for this company — manage to set primary ★</div>
                  {editingCompany.contacts.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-secondary)', padding: 10, borderRadius: 6, textAlign: 'center' }}>No contacts yet. Save company then add contacts via detail drawer or Contacts tab.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {editingCompany.contacts.map((ct) => (
                        <div key={ct.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: ct.isPrimary ? 'rgba(100,18,109,0.06)' : 'var(--surface-secondary)', borderRadius: 6, border: ct.isPrimary ? '1px solid rgba(100,18,109,0.15)' : '1px solid var(--border)' }}>
                          <div style={{ fontSize: 12 }}><strong>{ct.firstName} {ct.lastName ?? ''}</strong> {ct.isPrimary && <span style={{ background: '#EAB308', color: '#fff', fontSize: 10, padding: '1px 5px', borderRadius: 999, marginLeft: 4 }}>★ Primary</span>} <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{ct.email ?? ''} {ct.phone ? `· ${ct.phone}` : ''}</span></div>
                          {!ct.isPrimary && <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 999 }} onClick={async () => { await handleSetPrimary(ct.id); const updated = companies.find((x)=>x.id===editingCompany.id); if(updated) { /* will reload */ } }}>Set primary</button>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { setContactCompanyPreselect(editingCompany.id); setEditingContact(null); setIsContactModalOpen(true) }}><Plus size={12} /> Add Contact</button>
                    <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setDetailCompany(editingCompany)}><Users size={12} /> View all contacts</button>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Company Emails ({editingCompany.emails.length})</div>
                    {editingCompany.emails.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No extra emails.</div> : editingCompany.emails.map((em) => <div key={em.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}><span>{em.email} {em.type ? `(${em.type})` : ''}</span></div>)}
                    <button type="button" className="btn-secondary" style={{ fontSize: 12, marginTop: 8 }} onClick={() => { setEmailCompanyPreselect(editingCompany.id); setEditingEmail(null); setIsEmailModalOpen(true) }}><Plus size={12} /> Add Email</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" className="btn-secondary" onClick={() => setIsCompanyModalOpen(false)}>Cancel</button>
                <Button type="submit" disabled={isSaving} className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]">{isSaving ? 'Saving...' : editingCompany ? 'Update Company' : 'Register Company'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONTACT CREATE/EDIT */}
      {isContactModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: '24px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Users size={16} style={{ color: 'var(--brand-primary)' }} /> {editingContact ? 'Edit Contact' : 'New Contact'}</h3>
              <button type="button" className="btn-ghost" onClick={() => { setIsContactModalOpen(false); setEditingContact(null); setContactCompanyPreselect(null) }}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field><FieldLabel>Company *</FieldLabel>
                <select name="companyId" defaultValue={editingContact?.companyId ?? contactCompanyPreselect ?? (companies[0]?.id ?? '')} className="input-base" style={{ height: 40 }} required disabled={!!editingContact && !!contactCompanyPreselect}>
                  <option value="">Select company</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
                {editingContact && contactCompanyPreselect && <input type="hidden" name="companyId" value={editingContact.companyId} />}
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field><FieldLabel>First Name *</FieldLabel><Input name="firstName" defaultValue={editingContact?.firstName ?? ''} placeholder="Rajesh" required /></Field>
                <Field><FieldLabel>Last Name</FieldLabel><Input name="lastName" defaultValue={editingContact?.lastName ?? ''} placeholder="Sharma" /></Field>
              </div>
              <Field><FieldLabel>Email</FieldLabel><Input name="email" type="email" defaultValue={editingContact?.email ?? ''} placeholder="rajesh@company.com" /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field><FieldLabel>Phone</FieldLabel><Input name="phone" defaultValue={editingContact?.phone ?? ''} placeholder="+91 98765 43210" /></Field>
                <Field><FieldLabel>Designation</FieldLabel><Input name="designation" defaultValue={editingContact?.designation ?? ''} placeholder="VP Engineering" /></Field>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', background: 'var(--surface-secondary)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <input type="checkbox" name="isPrimary" defaultChecked={editingContact?.isPrimary ?? false} /> <Star size={13} style={{ color: '#EAB308' }} /> Set as <strong>primary</strong> contact for this company (only one primary allowed — will replace existing)
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => { setIsContactModalOpen(false); setEditingContact(null); setContactCompanyPreselect(null) }}>Cancel</button>
                <Button type="submit" disabled={isSaving} className="bg-[var(--brand-primary)] text-white">{isSaving ? 'Saving…' : editingContact ? 'Update Contact' : 'Create Contact'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL CREATE/EDIT */}
      {isEmailModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: '24px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={16} style={{ color: 'var(--brand-primary)' }} /> {editingEmail ? 'Edit Company Email' : 'New Company Email'}</h3>
              <button type="button" className="btn-ghost" onClick={() => { setIsEmailModalOpen(false); setEditingEmail(null); setEmailCompanyPreselect(null) }}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveEmail} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field><FieldLabel>Company *</FieldLabel>
                <select name="companyId" defaultValue={editingEmail?.companyId ?? emailCompanyPreselect ?? (companies[0]?.id ?? '')} className="input-base" style={{ height: 40 }} required disabled={!!editingEmail}>
                  <option value="">Select company</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
                {editingEmail && <input type="hidden" name="companyId" value={editingEmail.companyId} />}
              </Field>
              <Field><FieldLabel>Email *</FieldLabel><Input name="email" type="email" defaultValue={editingEmail?.email ?? ''} placeholder="info@company.com" required /></Field>
              <Field><FieldLabel>Type</FieldLabel><Input name="type" defaultValue={editingEmail?.type ?? ''} placeholder="e.g. inquiry, support, billing" /><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Optional label for routing.</div></Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => { setIsEmailModalOpen(false); setEditingEmail(null); setEmailCompanyPreselect(null) }}>Cancel</button>
                <Button type="submit" disabled={isSaving} className="bg-[var(--brand-primary)] text-white">{isSaving ? 'Saving…' : editingEmail ? 'Update Email' : 'Create Email'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATIONS */}
      {deleteCompanyTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, padding: '24px 28px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(220,38,38,0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><Trash2 size={22} /></div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Delete Company</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Delete <strong>{deleteCompanyTarget.name}</strong> ({deleteCompanyTarget.code})? This will cascade-delete all {deleteCompanyTarget.contacts.length} contacts and {deleteCompanyTarget.emails.length} emails.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn-secondary" onClick={() => setDeleteCompanyTarget(null)}>Cancel</button>
              <Button type="button" className="bg-[var(--danger)] text-white hover:bg-red-700" onClick={handleDeleteCompany}>Delete Company</Button>
            </div>
          </div>
        </div>
      )}
      {deleteContactTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, padding: '24px 28px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Delete Contact</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Delete <strong>{deleteContactTarget.firstName} {deleteContactTarget.lastName ?? ''}</strong> ({deleteContactTarget.email ?? 'no email'}) from {deleteContactTarget.companyName}?</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn-secondary" onClick={() => setDeleteContactTarget(null)}>Cancel</button>
              <Button type="button" className="bg-[var(--danger)] text-white" onClick={handleDeleteContact}>Delete Contact</Button>
            </div>
          </div>
        </div>
      )}
      {deleteEmailTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, padding: '24px 28px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Delete Company Email</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Delete email <strong>{deleteEmailTarget.email}</strong> from {deleteEmailTarget.companyName}?</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn-secondary" onClick={() => setDeleteEmailTarget(null)}>Cancel</button>
              <Button type="button" className="bg-[var(--danger)] text-white" onClick={handleDeleteEmail}>Delete Email</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
