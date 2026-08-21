import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createAppColumnHelper, flexRender, useAppTable, type AppColumnDef } from '~/lib/table'
import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useHotkey } from '@tanstack/react-hotkeys'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  Edit2,
  Filter,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
  Wallet,
  X,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel, FieldDescription } from '~/components/ui/field'
import { formatINR } from '~/lib/money'
import {
  createBankAction,
  createBankContactAction,
  deleteBankAction,
  deleteBankContactAction,
  getBankMasterPageData,
  setPrimaryBankAction,
  setPrimaryBankContactAction,
  updateBankAction,
  updateBankContactAction,
} from '~/lib/masters/bank/functions'

type Bank = {
  id: string
  code: string
  bankName: string
  branchName: string | null
  branchCode: string | null
  accountHolderName: string | null
  accountNumber: string
  accountType: 'savings' | 'current' | 'cc' | 'od' | 'loan' | 'nre' | 'nro'
  ifscCode: string
  swiftCode: string | null
  micrCode: string | null
  currency: string
  openingBalancePaise: number
  currentBalancePaise: number
  overdraftLimitPaise: number
  isPrimary: boolean
  bankType: string | null
  contactPerson: string | null
  contactPhone: string | null
  contactEmail: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  country: string | null
  postalCode: string | null
  website: string | null
  notes: string | null
  accountManagerId: string | null
  accountManagerName: string | null
  status: 'active' | 'inactive' | 'closed' | 'dormant' | 'frozen'
  createdAt: string
  updatedAt: string
  contacts: { id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null; designation: string | null; isPrimary: boolean }[]
}

type ContactFlat = Bank['contacts'][number] & { bankId: string; bankName: string; bankCode: string; accountNumber: string }
type Tab = 'banks' | 'contacts'

const STATUS_META: Record<string, { cls: string; label: string }> = {
  active: { cls: 'badge badge-cyan', label: 'Active' },
  inactive: { cls: 'badge badge-warning', label: 'Inactive' },
  closed: { cls: 'badge badge-danger', label: 'Closed' },
  dormant: { cls: 'badge badge-steel', label: 'Dormant' },
  frozen: { cls: 'badge badge-danger', label: 'Frozen' },
}
const ACCOUNT_TYPE_LABEL: Record<Bank['accountType'], string> = {
  savings: 'Savings',
  current: 'Current',
  cc: 'CC',
  od: 'OD',
  loan: 'Loan',
  nre: 'NRE',
  nro: 'NRO',
}
const ACCOUNT_TYPE_OPTIONS: Bank['accountType'][] = ['savings', 'current', 'cc', 'od', 'loan', 'nre', 'nro']

function formatBalance(paise: number, currency: string) {
  if (currency === 'INR') return formatINR(paise / 100)
  const sign = paise < 0 ? '-' : ''
  const abs = Math.abs(paise) / 100
  return `${sign}${currency} ${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function BankMaster() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, closed: 0, totalContacts: 0, totalBalancePaise: 0, currencies: 0, primaryBankCode: null as string | null })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [accountTypeFilter, setAccountTypeFilter] = useState('All')
  const [bankFilter, setBankFilter] = useState<string>('All')
  const [tab, setTab] = useState<Tab>('banks')
  const searchRef = useRef<HTMLInputElement>(null)

  const [isBankModalOpen, setIsBankModalOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<Bank | null>(null)
  const [deleteBankTarget, setDeleteBankTarget] = useState<Bank | null>(null)

  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactFlat | null>(null)
  const [deleteContactTarget, setDeleteContactTarget] = useState<ContactFlat | null>(null)
  const [contactBankPreselect, setContactBankPreselect] = useState<string | null>(null)

  const [detailBank, setDetailBank] = useState<Bank | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const bankModalRef = useRef<HTMLDivElement>(null)
  const contactModalRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const [showFilters, setShowFilters] = useState(false)
  const lastFocusRef = useRef<HTMLElement | null>(null)

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  useHotkey({ key: 'Escape' }, () => {
    setIsBankModalOpen(false)
    setIsContactModalOpen(false)
    setDeleteBankTarget(null)
    setDeleteContactTarget(null)
    setDetailBank(null)
  })
  useHotkey({ key: 'k', mod: true }, (e) => {
    e.preventDefault()
    searchRef.current?.focus()
  })
  const handlePacedSearch = useDebouncedCallback((_v: string) => {}, { wait: 200 })

  async function load() {
    setLoading(true)
    try {
      const data = await getBankMasterPageData()
      if (!data.authorized) {
        showFeedback('error', 'Not authorized — sign in as administrator.')
        setBanks([])
        return
      }
      setBanks(data.banks as Bank[])
      setStats(data.stats)
      if (detailBank) {
        const upd = (data.banks as Bank[]).find((b) => b.id === detailBank.id)
        if (upd) setDetailBank(upd)
      }
      if (editingBank) {
        const upd = (data.banks as Bank[]).find((b) => b.id === editingBank.id)
        if (upd) setEditingBank(upd)
      }
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to load banks.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contactsFlat: ContactFlat[] = useMemo(() => {
    const out: ContactFlat[] = []
    for (const b of banks) for (const ct of b.contacts) out.push({ ...ct, bankId: b.id, bankName: b.bankName, bankCode: b.code, accountNumber: b.accountNumber })
    return out.sort((a, b) => (a.isPrimary !== b.isPrimary ? (a.isPrimary ? -1 : 1) : `${a.firstName} ${a.lastName ?? ''}`.localeCompare(`${b.firstName} ${b.lastName ?? ''}`)))
  }, [banks])

  const filteredBanks = useMemo(() => {
    return banks.filter((b) => {
      const q = search.toLowerCase()
      const primary = b.contacts.find((c) => c.isPrimary) ?? b.contacts[0]
      const primaryName = primary ? `${primary.firstName} ${primary.lastName ?? ''}`.toLowerCase() : ''
      const matchesSearch =
        !q ||
        b.bankName.toLowerCase().includes(q) ||
        b.branchName?.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        b.accountNumber.toLowerCase().includes(q) ||
        b.ifscCode.toLowerCase().includes(q) ||
        (b.city ?? '').toLowerCase().includes(q) ||
        ACCOUNT_TYPE_LABEL[b.accountType].toLowerCase().includes(q) ||
        primaryName.includes(q)
      const matchesStatus = statusFilter === 'All' || b.status === statusFilter.toLowerCase()
      const matchesType = accountTypeFilter === 'All' || b.accountType === accountTypeFilter
      const matchesBank = bankFilter === 'All' || b.id === bankFilter
      return matchesSearch && matchesStatus && matchesType && matchesBank
    })
  }, [banks, search, statusFilter, accountTypeFilter, bankFilter])

  const filteredContacts = useMemo(() => {
    return contactsFlat.filter((ct) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        `${ct.firstName} ${ct.lastName ?? ''}`.toLowerCase().includes(q) ||
        (ct.email ?? '').toLowerCase().includes(q) ||
        (ct.phone ?? '').toLowerCase().includes(q) ||
        (ct.designation ?? '').toLowerCase().includes(q) ||
        ct.bankName.toLowerCase().includes(q) ||
        ct.accountNumber.toLowerCase().includes(q)
      const matchesBank = bankFilter === 'All' || ct.bankId === bankFilter
      const bank = banks.find((b) => b.id === ct.bankId)
      const matchesStatus = statusFilter === 'All' || bank?.status === statusFilter.toLowerCase()
      const matchesType = accountTypeFilter === 'All' || bank?.accountType === accountTypeFilter
      return matchesSearch && matchesBank && matchesStatus && matchesType
    })
  }, [contactsFlat, banks, search, bankFilter, statusFilter, accountTypeFilter])

  async function handleSaveBank(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      code: String(fd.get('code') ?? ''),
      bankName: String(fd.get('bankName') ?? ''),
      branchName: String(fd.get('branchName') ?? '') || null,
      branchCode: String(fd.get('branchCode') ?? '') || null,
      accountHolderName: String(fd.get('accountHolderName') ?? '') || null,
      accountNumber: String(fd.get('accountNumber') ?? ''),
      accountType: String(fd.get('accountType') ?? 'current') as Bank['accountType'],
      ifscCode: String(fd.get('ifscCode') ?? ''),
      swiftCode: String(fd.get('swiftCode') ?? '') || null,
      micrCode: String(fd.get('micrCode') ?? '') || null,
      currency: String(fd.get('currency') ?? 'INR') || 'INR',
      openingBalancePaise: (() => {
        const v = String(fd.get('openingBalance') ?? '').trim()
        if (!v) return 0
        const n = Number(v.replace(/,/g, ''))
        return Number.isNaN(n) ? 0 : Math.round(n * 100)
      })(),
      currentBalancePaise: (() => {
        const v = String(fd.get('currentBalance') ?? '').trim()
        if (!v) return undefined
        const n = Number(v.replace(/,/g, ''))
        return Number.isNaN(n) ? undefined : Math.round(n * 100)
      })() as number | undefined,
      overdraftLimitPaise: (() => {
        const v = String(fd.get('overdraftLimit') ?? '').trim()
        if (!v) return 0
        const n = Number(v.replace(/,/g, ''))
        return Number.isNaN(n) ? 0 : Math.round(n * 100)
      })(),
      isPrimary: fd.get('isPrimary') === 'on' || fd.get('isPrimary') === 'true',
      bankType: String(fd.get('bankType') ?? '') || null,
      contactPerson: String(fd.get('contactPerson') ?? '') || null,
      contactPhone: String(fd.get('contactPhone') ?? '') || null,
      contactEmail: String(fd.get('contactEmail') ?? '') || null,
      addressLine1: String(fd.get('addressLine1') ?? '') || null,
      addressLine2: String(fd.get('addressLine2') ?? '') || null,
      city: String(fd.get('city') ?? '') || null,
      state: String(fd.get('state') ?? '') || null,
      country: String(fd.get('country') ?? '') || 'India',
      postalCode: String(fd.get('postalCode') ?? '') || null,
      website: String(fd.get('website') ?? '') || null,
      notes: String(fd.get('notes') ?? '') || null,
      accountManagerId: null as string | null,
      status: String(fd.get('status') ?? 'active') as Bank['status'],
    } as unknown as Record<string, unknown>
    if (payload.currentBalancePaise === undefined) (payload as { currentBalancePaise?: number }).currentBalancePaise = (payload as { openingBalancePaise: number }).openingBalancePaise
    if (!payload.code || !payload.bankName || !payload.accountNumber || !payload.ifscCode) {
      showFeedback('error', 'Bank code, name, account number and IFSC are required.')
      setIsSaving(false)
      return
    }
    try {
      const res = editingBank ? await updateBankAction({ data: { id: editingBank.id, ...payload } as never }) : await createBankAction({ data: payload as never })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editingBank ? `Bank "${payload.bankName as string}" updated.` : `Bank "${payload.bankName as string}" created.`)
      setIsBankModalOpen(false)
      setEditingBank(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteBank() {
    if (!deleteBankTarget) return
    try {
      const res = await deleteBankAction({ data: { id: deleteBankTarget.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Bank "${deleteBankTarget.bankName}" deleted.`)
      setDeleteBankTarget(null)
      setDetailBank(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  async function handleSaveContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const bankId = String(fd.get('bankId') ?? contactBankPreselect ?? editingContact?.bankId ?? '')
    const payload = {
      bankId,
      firstName: String(fd.get('firstName') ?? '').trim(),
      lastName: String(fd.get('lastName') ?? '').trim() || null,
      email: String(fd.get('email') ?? '').trim() || null,
      phone: String(fd.get('phone') ?? '').trim() || null,
      designation: String(fd.get('designation') ?? '').trim() || null,
      isPrimary: fd.get('isPrimary') === 'on' || fd.get('isPrimary') === 'true',
    }
    if (!payload.bankId) {
      showFeedback('error', 'Select a bank.')
      setIsSaving(false)
      return
    }
    if (!payload.firstName) {
      showFeedback('error', 'First name required.')
      setIsSaving(false)
      return
    }
    try {
      const res = editingContact ? await updateBankContactAction({ data: { id: editingContact.id, ...payload } }) : await createBankContactAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editingContact ? `Contact "${payload.firstName}" updated.` : `Contact "${payload.firstName}" created.`)
      setIsContactModalOpen(false)
      setEditingContact(null)
      setContactBankPreselect(null)
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
      const res = await deleteBankContactAction({ data: { id: deleteContactTarget.id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', `Contact "${deleteContactTarget.firstName}" deleted.`)
      setDeleteContactTarget(null)
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed.')
    }
  }
  async function handleSetPrimaryContact(id: string) {
    try {
      const res = await setPrimaryBankContactAction({ data: { id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', 'Primary contact updated.')
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed.')
    }
  }
  async function handleSetPrimaryBank(id: string) {
    try {
      const res = await setPrimaryBankAction({ data: { id } })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', 'Primary bank updated.')
      await load()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed.')
    }
  }

  const bankHelper = createAppColumnHelper<Bank>()
  const bankColumns = useMemo(
    () => [
      bankHelper.accessor('code', {
        header: () => 'Code',
        cell: (i) => <span className="font-mono text-[11.5px] tracking-wide text-[var(--text-muted)]">{i.getValue()}</span>,
      }),
      bankHelper.display({
        id: 'bank',
        header: () => 'Bank',
        cell: (info) => {
          const r = info.row.original
          return (
            <div className="flex items-center gap-3 min-w-[220px]">
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border"
                style={{
                  background: r.isPrimary ? 'var(--brand-primary)' : 'var(--surface-secondary)',
                  borderColor: r.isPrimary ? 'rgba(234,179,8,0.5)' : 'var(--border)',
                  boxShadow: r.isPrimary ? '0 1px 6px rgba(100,18,109,0.2)' : 'none',
                }}
                aria-hidden
              >
                <Landmark size={14} style={{ color: r.isPrimary ? 'var(--on-brand)' : 'var(--brand-primary)' }} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] leading-none font-semibold text-[var(--text-primary)]" style={{ textWrap: 'balance' }}>
                  <span className="truncate">{r.bankName}</span>
                  {r.isPrimary && <Star size={11} aria-label="Primary bank" className="shrink-0 fill-[#EAB308] text-[#EAB308]" />}
                  {r.bankType && <span className="hidden sm:inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-1.5 py-px text-[10px] font-medium tracking-wide text-[var(--text-muted)] uppercase">{r.bankType}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] leading-none text-[var(--text-muted)]">
                  <span className="truncate">{r.branchName || 'No branch'}</span>
                  {r.branchCode && <span className="hidden sm:inline">· {r.branchCode}</span>}
                  <span className="inline-flex items-center gap-1 font-mono text-[11px]">· {r.ifscCode}</span>
                </div>
              </div>
            </div>
          )
        },
      }),
      bankHelper.display({
        id: 'account',
        header: () => 'Account',
        cell: (info) => {
          const r = info.row.original
          return (
            <div className="min-w-[160px]">
              <div className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">
                <CreditCard size={11} className="shrink-0 text-[var(--text-muted)]" aria-hidden />
                <span className="tabular-nums">{r.accountNumber}</span>
                <span className="badge text-[10px] leading-none" style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border)' }}>{ACCOUNT_TYPE_LABEL[r.accountType]}</span>
              </div>
              <div className="mt-1 truncate text-[11px] leading-none text-[var(--text-muted)]" title={r.accountHolderName ?? undefined}>{r.accountHolderName || '—'} · {r.currency}</div>
            </div>
          )
        },
      }),
      bankHelper.display({
        id: 'location',
        header: () => 'Branch location',
        cell: (info) => {
          const r = info.row.original
          const loc = [r.city, r.state].filter(Boolean).join(', ')
          return (
            <div className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-primary)]">
              <MapPin size={12} className="shrink-0 text-[var(--text-muted)]" aria-hidden />
              <span className="truncate max-w-[140px]">{loc || '—'}</span>
            </div>
          )
        },
      }),
      bankHelper.display({
        id: 'balance',
        header: () => <span className="inline-flex items-center gap-1">Balance</span>,
        cell: (info) => {
          const r = info.row.original
          const isNegative = r.currentBalancePaise < 0
          return (
            <div className="text-right min-w-[150px]">
              <div className="tabular-nums text-[13px] font-bold tracking-tight" style={{ color: isNegative ? 'var(--danger)' : 'var(--brand-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatBalance(r.currentBalancePaise, r.currency)}</div>
              <div className="mt-0.5 text-[11px] leading-none text-[var(--text-muted)]">
                <span className="tabular-nums">Opening {formatBalance(r.openingBalancePaise, r.currency)}</span>
                {r.overdraftLimitPaise > 0 && <span className="tabular-nums"> · OD {formatINR(r.overdraftLimitPaise / 100)}</span>}
              </div>
            </div>
          )
        },
      }),
      bankHelper.display({
        id: 'contacts',
        header: () => 'Contacts',
        cell: (info) => {
          const r = info.row.original
          const hasPrimary = r.contacts.some((c) => c.isPrimary)
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDetailBank(r)
              }}
              aria-label={`View ${r.contacts.length} contacts for ${r.bankName}`}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--surface-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1"
              style={{ borderColor: 'var(--border)', background: r.contacts.length ? 'var(--surface)' : 'transparent', minHeight: 28 }}
            >
              <Users size={12} aria-hidden /> {r.contacts.length} {r.contacts.length === 1 ? 'contact' : 'contacts'}
              {hasPrimary && <span className="badge badge-cyan ml-1 text-[10px] leading-none"><Star size={8} aria-hidden /> primary</span>}
            </button>
          )
        },
      }),
      bankHelper.accessor('status', {
        header: () => 'Status',
        cell: (info) => {
          const v = info.getValue()
          const meta = STATUS_META[v] ?? { cls: 'badge', label: v }
          return <span className={meta.cls} style={{ fontSize: 11, textTransform: 'capitalize' }}>{meta.label}</span>
        },
      }),
      bankHelper.display({
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: (info) => {
          const b = info.row.original
          return (
            <div className="inline-flex justify-end gap-1">
              <button
                type="button"
                aria-label={`View details for ${b.bankName}`}
                onClick={(e) => { e.stopPropagation(); setDetailBank(b) }}
                className="inline-flex size-9 items-center justify-center rounded-md border border-transparent text-[var(--text-secondary)] transition-[background,color,scale] duration-150 hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
              >
                <Users size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                aria-label={`Edit ${b.bankName}`}
                onClick={(e) => { e.stopPropagation(); setEditingBank(b); setIsBankModalOpen(true) }}
                className="inline-flex size-9 items-center justify-center rounded-md border border-transparent text-[var(--text-secondary)] transition-[background,color,scale] duration-150 hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
              >
                <Edit2 size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                aria-label={`Delete ${b.bankName}`}
                onClick={(e) => { e.stopPropagation(); setDeleteBankTarget(b) }}
                className="inline-flex size-9 items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-[background,color,scale] duration-150 hover:bg-[var(--danger-soft-bg)] hover:text-[var(--danger)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
              >
                <Trash2 size={14} strokeWidth={1.75} />
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
        header: () => <span title="Primary contact">★</span>,
        cell: (info) => {
          const r = info.row.original
          return r.isPrimary ? (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide" style={{ background: 'rgba(234,179,8,0.12)', color: '#713F12', borderColor: 'rgba(234,179,8,0.35)' }}>
              <Star size={10} className="fill-[#EAB308] text-[#EAB308]" aria-hidden /> Primary
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleSetPrimaryContact(r.id)}
              aria-label={`Set ${r.firstName} as primary contact for ${r.bankName}`}
              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--surface-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
              style={{ borderColor: 'var(--border)', minHeight: 24 }}
            >
              Set primary
            </button>
          )
        },
      }),
      contactHelper.display({
        id: 'bank',
        header: () => 'Bank',
        cell: (info) => {
          const r = info.row.original
          return (
            <span className="inline-flex flex-wrap items-center gap-1 text-xs">
              <span className="font-mono font-semibold tracking-wide text-[var(--text-primary)]">{r.bankCode}</span>
              <span className="font-normal text-[var(--text-muted)]">· {r.bankName}</span>
              <span className="hidden font-mono text-[11px] text-[var(--text-muted)] sm:inline">· {r.accountNumber}</span>
            </span>
          )
        },
      }),
      contactHelper.display({
        id: 'name',
        header: () => 'Contact',
        cell: (info) => {
          const r = info.row.original
          const name = `${r.firstName} ${r.lastName ?? ''}`.trim()
          return (
            <div className="flex items-center gap-2.5">
              <div
                className="flex size-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{
                  background: r.isPrimary ? 'var(--brand-primary)' : 'var(--surface-secondary)',
                  color: r.isPrimary ? 'var(--on-brand)' : 'var(--text-muted)',
                  border: r.isPrimary ? '2px solid rgba(234,179,8,0.55)' : '1px solid var(--border)',
                }}
                aria-hidden
              >
                {r.firstName[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <div className={`truncate text-[13px] leading-none ${r.isPrimary ? 'font-bold' : 'font-medium'}`} style={{ textWrap: 'pretty' }}>{name}</div>
                {r.designation && <div className="mt-1 truncate text-[11px] leading-none text-[var(--text-muted)]">{r.designation}</div>}
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
          return v ? (
            <span className="inline-flex max-w-[220px] items-center gap-1.5 truncate text-xs text-[var(--text-primary)]"><Mail size={11} className="shrink-0 text-[var(--text-muted)]" aria-hidden /><span className="truncate">{v}</span></span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">—</span>
          )
        },
      }),
      contactHelper.display({
        id: 'phone',
        header: () => 'Phone',
        cell: (info) => {
          const v = info.row.original.phone
          return v ? (
            <span className="inline-flex items-center gap-1.5 text-xs tabular-nums"><Phone size={11} className="shrink-0 text-[var(--text-muted)]" aria-hidden />{v}</span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">—</span>
          )
        },
      }),
      contactHelper.display({
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: (info) => {
          const r = info.row.original
          return (
            <div className="inline-flex justify-end gap-1">
              <button
                type="button"
                aria-label={`Edit ${r.firstName} ${r.lastName ?? ''}`}
                onClick={() => { setEditingContact(r); setContactBankPreselect(r.bankId); setIsContactModalOpen(true) }}
                className="inline-flex size-9 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
              >
                <Edit2 size={13} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                aria-label={`Delete ${r.firstName}`}
                onClick={() => setDeleteContactTarget(r)}
                className="inline-flex size-9 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--danger-soft-bg)] hover:text-[var(--danger)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
              >
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            </div>
          )
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const bankTable = useAppTable({ data: filteredBanks, columns: bankColumns as unknown as AppColumnDef<Bank>[] })
  const contactTable = useAppTable({ data: filteredContacts, columns: contactColumns as unknown as AppColumnDef<ContactFlat>[] })

  function trapFocus(container: HTMLElement | null, e: React.KeyboardEvent) {
    if (!container || (e as unknown as KeyboardEvent).key !== 'Tab') return
    const focusable = Array.from(container.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex=\"0\"]')).filter(el => el.offsetParent !== null)
    if (focusable.length === 0) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  useEffect(() => {
    const open = isBankModalOpen || isContactModalOpen || !!detailBank || !!deleteBankTarget || !!deleteContactTarget
    if (open) {
      lastFocusRef.current = document.activeElement as HTMLElement
      const id = isBankModalOpen ? bankModalRef : isContactModalOpen ? contactModalRef : detailBank ? drawerRef : null
      setTimeout(() => {
        const container = id?.current
        const focusable = container?.querySelector<HTMLElement>('button,input,select,textarea,[tabindex=\"0\"]')
        focusable?.focus()
      }, 10)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      lastFocusRef.current?.focus?.()
    }
    return () => { document.body.style.overflow = '' }
  }, [isBankModalOpen, isContactModalOpen, detailBank, deleteBankTarget, deleteContactTarget])

  function handleExportCsv() {
    const rows = (tab === 'contacts' ? filteredContacts : filteredBanks) as unknown as Record<string, unknown>[]
    if (rows.length === 0) { showFeedback('error', 'Nothing to export for current filters.'); return }
    const headers = tab === 'contacts'
      ? ['Bank Code','Bank Name','Account','Contact','Email','Phone','Primary']
      : ['Code','Bank Name','Branch','Account No','Type','IFSC','Balance (₹)','Status','Primary']
    const csv = [headers.join(','), ...rows.map(r => {
      if (tab === 'contacts') {
        const c = r as unknown as ContactFlat
        return [c.bankCode, `"${c.bankName}"`, c.accountNumber, `"${c.firstName} ${c.lastName ?? ''}"`, c.email ?? '', c.phone ?? '', c.isPrimary ? 'Yes' : 'No'].join(',')
      } else {
        const b = r as unknown as Bank
        return [b.code, `"${b.bankName}"`, `"${b.branchName ?? ''}"`, b.accountNumber, ACCOUNT_TYPE_LABEL[b.accountType], b.ifscCode, (b.currentBalancePaise/100).toFixed(2), b.status, b.isPrimary ? 'Yes' : 'No'].join(',')
      }
    })].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = tab === 'contacts' ? 'bank-contacts.csv' : 'banks.csv'; a.click(); URL.revokeObjectURL(url)
    showFeedback('success', tab === 'contacts' ? `Exported ${rows.length} contacts.` : `Exported ${rows.length} banks.`)
  }
  if (loading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="kpi-card animate-pulse" style={{ height: 92, background: 'var(--surface-secondary)' }} />
          ))}
        </div>
        <div className="card flex-1 animate-pulse" style={{ minHeight: 320 }} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]" style={{ position: 'relative' }}>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .bank-row { transition: background 150ms cubic-bezier(0.2,0,0,1), border-color 150ms cubic-bezier(0.2,0,0,1); }
          .bank-toast { animation: bank-toast-in 180ms cubic-bezier(0.2,0,0,1); }
          .bank-drawer { animation: bank-drawer-in 220ms cubic-bezier(0.2,0,0,1); }
          .bank-modal { animation: bank-modal-in 180ms cubic-bezier(0.2,0,0,1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bank-row, .bank-toast, .bank-drawer, .bank-modal { animation: none !important; transition: none !important; }
        }
        @keyframes bank-toast-in { from { opacity:0; transform: translateY(-6px) scale(0.98);} to {opacity:1; transform: translateY(0) scale(1);} }
        @keyframes bank-drawer-in { from { opacity:0; transform: translateX(12px);} to {opacity:1; transform: translateX(0);} }
        @keyframes bank-modal-in { from { opacity:0; transform: translateY(8px) scale(0.98);} to {opacity:1; transform: translateY(0) scale(1);} }
        .bank-table-wrap { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
        .bank-table-wrap::-webkit-scrollbar { height: 6px; width: 6px; }
        .bank-table-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; }
        /* responsive without device presets — content decides via container */
        .bank-kpi-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        @media (min-width: 1280px) { .bank-kpi-grid { grid-template-columns: repeat(5, minmax(0,1fr)); } }
      `}</style>

      {/* stable polite live region — not dynamically inserted */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">{feedback?.message ?? ''}</div>
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="bank-toast fixed right-4 top-4 z-[150] flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg"
          style={{ background: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)', boxShadow: '0 10px 25px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12)' }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={18} aria-hidden /> : <AlertCircle size={18} aria-hidden />}
          <span style={{ textWrap: 'pretty', maxWidth: 360 }}>{feedback.message}</span>
        </div>
      )}
      {/* KPI — full width, justify-between */}
      <section aria-label="Bank overview" className="flex flex-wrap shrink-0 justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg)] p-4 sm:p-4">
        <div className="kpi-card group flex flex-1 min-w-[148px] flex-col gap-3 !p-3.5" style={{ borderRadius: 12 }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Total banks</div>
              <div className="mt-1 tabular-nums text-[20px] font-extrabold leading-none tracking-tight text-[var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.total}</div>
              <div className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]" style={{ textWrap: 'pretty' }}>{stats.total === 0 ? 'No accounts yet' : `${stats.active} of ${stats.total} active`}</div>
            </div>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--brand-primary)] shadow-sm" aria-hidden><Landmark size={15} strokeWidth={1.75} /></div>
          </div>
        </div>

        <div className="kpi-card group flex flex-1 min-w-[132px] flex-col gap-3 !p-3.5" style={{ borderRadius: 12 }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Active</div>
              <div className="mt-1 flex items-baseline gap-1.5 tabular-nums text-[20px] font-extrabold leading-none tracking-tight text-[var(--success)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.active}<span className="text-[11px] font-medium text-[var(--text-muted)]">/{stats.total}</span></div>
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium leading-none text-[var(--success)]"><ShieldCheck size={11} aria-hidden /> Operational</div>
            </div>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--success-soft-bg)] text-[var(--success-soft-fg)]" aria-hidden><CheckCircle2 size={15} strokeWidth={1.75} /></div>
          </div>
        </div>

        <div className="kpi-card group flex flex-1 min-w-[172px] flex-col gap-3 !p-3.5" style={{ borderRadius: 12, borderColor: stats.totalBalancePaise < 0 ? 'rgba(220,38,38,0.2)' : undefined }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Total balance</div>
              <div className="mt-1 truncate tabular-nums text-[16px] font-extrabold leading-none tracking-tight" style={{ color: stats.totalBalancePaise < 0 ? 'var(--danger)' : 'var(--brand-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(stats.totalBalancePaise / 100)}</div>
              <div className="mt-1 truncate text-[11px] leading-none text-[var(--text-muted)]">{stats.currencies} {stats.currencies === 1 ? 'currency' : 'currencies'}</div>
            </div>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: stats.totalBalancePaise < 0 ? 'var(--danger)' : 'var(--brand-primary)' }} aria-hidden><Wallet size={15} strokeWidth={1.75} /></div>
          </div>
        </div>

        <div className="kpi-card group flex flex-1 min-w-[132px] flex-col gap-3 !p-3.5" style={{ borderRadius: 12 }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Contacts</div>
              <div className="mt-1 tabular-nums text-[20px] font-extrabold leading-none tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.totalContacts}</div>
              <div className="mt-1 text-[11px] leading-none text-[var(--text-muted)]">Relationship managers</div>
            </div>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--brand-steel)] shadow-sm" aria-hidden><Users size={15} strokeWidth={1.75} /></div>
          </div>
        </div>

        <div className="kpi-card group flex flex-1 min-w-[132px] flex-col gap-3 !p-3.5" style={{ borderRadius: 12 }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Currencies</div>
              <div className="mt-1 tabular-nums text-[20px] font-extrabold leading-none tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.currencies}</div>
              <div className="mt-1 text-[11px] leading-none text-[var(--text-muted)]">Distinct holdings</div>
            </div>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-secondary)] text-[var(--brand-primary)]" aria-hidden><Building2 size={15} strokeWidth={1.75} /></div>
          </div>
        </div>
      </section>

      {/* Page header — controls distinct from content, breathing room, collapse late */}
      <div className="page-header flex flex-col gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:px-7 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="min-w-[220px] flex-1">
          <h1 className="m-0 text-balance text-[17px] font-bold leading-none tracking-tight text-[var(--text-primary)]" style={{ textWrap: 'balance' }}>Bank Master</h1>
          <p className="mt-1.5 text-pretty text-xs leading-relaxed text-[var(--text-muted)]" style={{ textWrap: 'pretty' }}>
            {tab === 'banks' && `${filteredBanks.length} ${filteredBanks.length === 1 ? 'account' : 'accounts'} · ${stats.active} active${stats.primaryBankCode ? ` · Primary ${stats.primaryBankCode}` : ''}`}
            {tab === 'contacts' && `${filteredContacts.length} ${filteredContacts.length === 1 ? 'contact' : 'contacts'} · across ${banks.length} banks`}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center md:justify-end">
          <label className="search-box group flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--brand-primary)] focus-within:shadow-[0_0_0_3px_rgba(100,18,109,0.08)] md:min-w-[180px] md:max-w-[240px] sm:min-w-[260px]">
            <Search size={14} className="shrink-0 text-[var(--text-muted)]" aria-hidden />
            <input
              ref={searchRef}
              aria-label={tab === 'contacts' ? 'Search contacts' : 'Search banks'}
              className="w-full min-w-0 border-0 bg-transparent p-0 text-base leading-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:outline-none sm:text-[13px]"
              placeholder={tab === 'contacts' ? 'Search contacts…' : 'Search banks, branches, IFSC…'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); handlePacedSearch(e.target.value) }}
              type="search"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden select-none rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-[var(--text-muted)] sm:inline-flex">⌘K</kbd>
          </label>

          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
            {tab === 'banks' && (
              <select id="bank-status-filter" aria-label="Filter by status" className="input-base h-9 !w-auto min-w-[108px] shrink-0 rounded-md px-3 py-2 text-base sm:text-[12px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option>All statuses</option><option>Active</option><option>Inactive</option><option>Closed</option><option>Dormant</option><option>Frozen</option>
              </select>
            )}
            <select id="bank-type-filter" aria-label="Filter by account type" className="input-base h-9 !w-auto min-w-[102px] shrink-0 rounded-md px-3 py-2 text-base sm:text-[12px]" value={accountTypeFilter} onChange={(e) => setAccountTypeFilter(e.target.value)}>
              <option value="All">All types</option>{ACCOUNT_TYPE_OPTIONS.map((c) => <option key={c} value={c}>{ACCOUNT_TYPE_LABEL[c]}</option>)}
            </select>
            <select id="bank-bank-filter" aria-label="Filter by bank" className="input-base h-9 !w-auto min-w-[132px] max-w-[170px] shrink-0 truncate rounded-md px-3 py-2 text-base sm:text-[12px]" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
              <option value="All">All banks</option>{banks.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.bankName}</option>)}
            </select>
            <div className="hidden h-7 w-px bg-[var(--border)] sm:block" aria-hidden />

            {(statusFilter !== 'All' || accountTypeFilter !== 'All' || bankFilter !== 'All' || search) && (
              <button type="button" onClick={() => { setSearch(''); setStatusFilter('All'); setAccountTypeFilter('All'); setBankFilter('All') }} className="btn-secondary h-8 gap-1.5 rounded-lg border-[var(--border)] bg-[var(--surface)] text-[13px] font-medium hover:bg-[var(--surface-secondary)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]" style={{ transition: 'background 150ms cubic-bezier(0.2,0,0,1), scale 120ms cubic-bezier(0.2,0,0,1)' }}>
                <X size={14} strokeWidth={1.75} aria-hidden /> Clear
              </button>
            )}
            <button type="button" onClick={() => setShowFilters(v => !v)} aria-pressed={showFilters} aria-label={showFilters ? 'Hide filters' : 'Show filters'} className="btn-secondary hidden h-9 gap-1.5 rounded-lg border-[var(--border)] bg-[var(--surface)] text-[13px] font-medium hover:bg-[var(--surface-secondary)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] sm:inline-flex" style={{ transition: 'background 150ms cubic-bezier(0.2,0,0,1), scale 120ms cubic-bezier(0.2,0,0,1)', color: showFilters ? 'var(--brand-primary)' : undefined, borderColor: showFilters ? 'var(--brand-primary)' : undefined }}>
              <Filter size={14} strokeWidth={1.75} aria-hidden /> Filter
            </button>
            <button type="button" onClick={handleExportCsv} className="btn-secondary h-8 gap-1.5 rounded-lg border-[var(--border)] bg-[var(--surface)] text-[13px] font-medium hover:bg-[var(--surface-secondary)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]" style={{ transition: 'background 150ms cubic-bezier(0.2,0,0,1), scale 120ms cubic-bezier(0.2,0,0,1)' }} aria-label="Export visible rows as CSV">
              <Download size={14} strokeWidth={1.75} aria-hidden /> <span className="hidden sm:inline">Export</span>
            </button>

            {tab === 'banks' && (
              <button type="button" onClick={() => { setEditingBank(null); setIsBankModalOpen(true) }} className="btn-primary h-8 gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 text-[13px] font-semibold text-white shadow-sm transition-[background,scale] duration-150 hover:bg-[var(--brand-primary-hover)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2">
                <Plus size={14} strokeWidth={2} aria-hidden /> Add bank
              </button>
            )}
            {tab === 'contacts' && (
              <button
                type="button"
                onClick={() => { setEditingContact(null); setContactBankPreselect(bankFilter !== 'All' ? bankFilter : banks[0]?.id ?? null); setIsContactModalOpen(true) }}
                disabled={banks.length === 0}
                className="btn-primary h-8 gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 text-[13px] font-semibold text-white shadow-sm transition-[background,scale,opacity] duration-150 hover:bg-[var(--brand-primary-hover)] active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
              >
                <Plus size={14} strokeWidth={2} aria-hidden /> New contact
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Tabs — native button, aria-selected, logical properties, focus ring */}
      <nav role="tablist" aria-label="Bank sections" className="flex gap-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-7">
        {[
          { key: 'banks' as const, label: 'Banks', icon: Landmark, count: banks.length },
          { key: 'contacts' as const, label: 'Contacts', icon: Users, count: contactsFlat.length },
        ].map((t) => {
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={t.key === 'banks' ? 'panel-banks' : 'panel-contacts'}
              id={t.key === 'banks' ? 'tab-banks' : 'tab-contacts'}
              type="button"
              onClick={() => setTab(t.key)}
              className="inline-flex items-center gap-2 border-b-2 bg-transparent px-4 py-3 text-[13px] transition-[color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
              style={{
                borderBottomColor: isActive ? 'var(--brand-primary)' : 'transparent',
                color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                marginBlockEnd: -1,
              }}
            >
              <t.icon size={14} strokeWidth={isActive ? 2 : 1.75} aria-hidden /> {t.label}
              <span className="badge text-[11px] leading-none" style={{ background: isActive ? 'var(--brand-primary)' : 'var(--surface-secondary)', color: isActive ? 'var(--on-brand)' : 'var(--text-muted)', border: isActive ? '1px solid var(--brand-primary)' : '1px solid var(--border)' }}>{t.count}</span>
            </button>
          )
        })}
      </nav>

      {/* Tables — hint at hidden content via scroll peek, breathing room, distinct controls */}
      <div className="flex-1 overflow-auto bg-[var(--bg)] p-4 sm:p-6">
        {tab === 'banks' && (
          <section id="panel-banks" role="tabpanel" aria-labelledby="tab-banks" className="card overflow-hidden border border-[var(--border)] bg-[var(--surface)]" style={{ borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)' }}>
            <div className="bank-table-wrap overflow-x-auto">
              <table className="data-table w-full min-w-[900px] border-collapse">
                <caption className="sr-only">Bank accounts — code, bank, account, location, balance, contacts, status, actions</caption>
                <thead>{bankTable.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id} scope="col">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
                <tbody>
                  {bankTable.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setDetailBank(row.original)}
                      className="bank-row cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-primary)] hover:[&>td]:!bg-[var(--surface-secondary)]"
                      style={{
                        background: row.original.isPrimary ? 'rgba(100,18,109,0.04)' : undefined,
                        borderInlineStart: row.original.isPrimary ? '3px solid #EAB308' : '3px solid transparent',
                      }}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailBank(row.original) } }}
                      aria-label={`Open details for ${row.original.bankName} ${row.original.code}`}
                    >
                      {row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                    </tr>
                  ))}
                  {bankTable.getRowModel().rows.length === 0 && (
                    <tr>
                      <td colSpan={bankColumns.length} className="p-0">
                        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                          <div className="flex size-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-muted)]" aria-hidden><Landmark size={20} strokeWidth={1.5} /></div>
                          <div>
                            <div className="text-balance text-[15px] font-semibold leading-tight text-[var(--text-primary)]" style={{ textWrap: 'balance' }}>No bank accounts found</div>
                            <div className="mx-auto mt-2 max-w-[42ch] text-pretty text-[13px] leading-relaxed text-[var(--text-muted)]" style={{ textWrap: 'pretty' }}>
                              {search || statusFilter !== 'All' || accountTypeFilter !== 'All' || bankFilter !== 'All' ? <>No accounts match your filters. <button type="button" onClick={() => { setSearch(''); setStatusFilter('All'); setAccountTypeFilter('All'); setBankFilter('All') }} className="font-medium text-[var(--brand-primary)] underline decoration-[var(--brand-primary)]/30 underline-offset-4 hover:decoration-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]">Clear all filters</button>.</> : 'Get started by adding your first bank account. You can track balances, IFSC and relationship managers here.'}
                            </div>
                          </div>
                          {(search === '' && statusFilter === 'All' && accountTypeFilter === 'All' && bankFilter === 'All') && (
                            <Button onClick={() => { setEditingBank(null); setIsBankModalOpen(true) }} className="mt-1 gap-1.5 bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2">
                              <Plus size={14} aria-hidden /> Add bank account <ArrowUpRight size={14} aria-hidden />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* scroll hint for small viewports */}
            <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-[11px] leading-none text-[var(--text-muted)] sm:hidden" aria-hidden>
              <span>Swipe to see more columns</span><span aria-hidden>→</span>
            </div>
          </section>
        )}

        {tab === 'contacts' && (
          <section id="panel-contacts" role="tabpanel" aria-labelledby="tab-contacts" className="card overflow-hidden border border-[var(--border)] bg-[var(--surface)]" style={{ borderRadius: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)' }}>
            <div className="bank-table-wrap overflow-x-auto">
              <table className="data-table w-full min-w-[760px] border-collapse">
                <caption className="sr-only">Bank contacts — primary, bank, contact, email, phone, actions</caption>
                <thead>{contactTable.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id} scope="col">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
                <tbody>
                  {contactTable.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="bank-row" style={row.original.isPrimary ? { background: 'rgba(234,179,8,0.07)' } : undefined}>
                      {row.getVisibleCells().map((cell) => <td key={cell.id} className="text-[13px] leading-snug">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                    </tr>
                  ))}
                  {contactTable.getRowModel().rows.length === 0 && (
                    <tr>
                      <td colSpan={contactColumns.length} className="p-0">
                        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                          <div className="flex size-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--text-muted)]" aria-hidden><Users size={20} strokeWidth={1.5} /></div>
                          <div>
                            <div className="text-balance text-[15px] font-semibold leading-tight" style={{ textWrap: 'balance' }}>{banks.length === 0 ? 'Add a bank first' : 'No contacts match your filters'}</div>
                            <div className="mx-auto mt-2 max-w-[42ch] text-pretty text-[13px] leading-relaxed text-[var(--text-muted)]" style={{ textWrap: 'pretty' }}>
                              {banks.length === 0 ? 'You need at least one bank account before adding relationship managers.' : 'Try broadening your search or switch to the Banks tab.'}
                            </div>
                          </div>
                          {banks.length > 0 && <Button variant="outline" onClick={() => { setEditingContact(null); setContactBankPreselect(bankFilter !== 'All' ? bankFilter : banks[0]?.id ?? null); setIsContactModalOpen(true) }} className="gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"><Plus size={14} aria-hidden /> New contact</Button>}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Detail drawer — grouping with space (24 between groups, 8-12 within), sticky chrome floats */}
      {detailBank && (
        <div role="dialog" aria-modal="true" aria-labelledby="bank-detail-title" className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={() => setDetailBank(null)}>
          <div
            ref={drawerRef}
            role="document"
            tabIndex={-1}
            onKeyDown={(e) => trapFocus(drawerRef.current, e as unknown as React.KeyboardEvent)}
            className="bank-drawer card flex h-full w-full max-w-[580px] flex-col overflow-hidden bg-[var(--surface)] shadow-[-8px_0_32px_rgba(0,0,0,0.14)]"
            style={{ borderRadius: '16px 0 0 16px', borderInlineStart: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header — floats above content */}
            <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white shadow-sm" aria-hidden><Landmark size={14} /></span>
                    <h2 id="bank-detail-title" className="text-balance text-[15px] font-bold leading-none tracking-tight" style={{ textWrap: 'balance' }}>{detailBank.bankName}</h2>
                    <span className="rounded-md bg-[var(--surface-secondary)] px-1.5 py-1 font-mono text-[11px] font-medium leading-none tracking-wide text-[var(--text-muted)]">{detailBank.code}</span>
                    <span className={STATUS_META[detailBank.status]?.cls ?? 'badge'} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.02em' }}>{STATUS_META[detailBank.status]?.label ?? detailBank.status}</span>
                    {detailBank.isPrimary && <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#92400E] ring-1 ring-[#FDE68A]"><Star size={9} className="fill-[#EAB308] text-[#EAB308]" aria-hidden /> Primary</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs leading-none text-[var(--text-muted)]">
                    <CreditCard size={12} aria-hidden className="shrink-0" />
                    <span className="font-mono text-xs font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">{detailBank.accountNumber}</span>
                    <span className="badge text-[10px]" style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border)' }}>{ACCOUNT_TYPE_LABEL[detailBank.accountType]}</span>
                    <span>· {detailBank.currency}</span>
                    <span>·</span>
                    <span className="truncate">{detailBank.branchName || 'No branch'}</span>
                    <span>·</span>
                    <span className="font-mono font-medium">{detailBank.ifscCode}</span>
                    {detailBank.swiftCode && <span className="hidden sm:inline">· SWIFT {detailBank.swiftCode}</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="tabular-nums text-[14px] font-extrabold tracking-tight" style={{ color: detailBank.currentBalancePaise < 0 ? 'var(--danger)' : 'var(--brand-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatBalance(detailBank.currentBalancePaise, detailBank.currency)}</span>
                    <span className="text-[11px] leading-none text-[var(--text-muted)]">Opening <span className="tabular-nums font-medium text-[var(--text-primary)]">{formatBalance(detailBank.openingBalancePaise, detailBank.currency)}</span></span>
                    {detailBank.bankType && <span className="badge text-[10px] capitalize" style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border)' }}>{detailBank.bankType.replace('_', ' ')}</span>}
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] leading-none text-[var(--text-muted)]">
                    <MapPin size={11} aria-hidden className="shrink-0" />
                    <span className="truncate">{[detailBank.city, detailBank.state, detailBank.country].filter(Boolean).join(', ') || 'No address on file'}{detailBank.postalCode ? ` · ${detailBank.postalCode}` : ''}</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close details"
                  onClick={() => setDetailBank(null)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] active:scale-[0.96]"
                >
                  <X size={16} strokeWidth={1.75} />
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setEditingBank(detailBank); setIsBankModalOpen(true) }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                  style={{ transition: 'background 150ms cubic-bezier(0.2,0,0,1), scale 120ms cubic-bezier(0.2,0,0,1)' }}
                >
                  <Edit2 size={13} strokeWidth={1.75} aria-hidden /> Edit bank
                </button>
                {!detailBank.isPrimary && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimaryBank(detailBank.id)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-[#FFFBEB] px-3 py-2 text-[13px] font-semibold text-[#92400E] hover:bg-[#FEF3C7] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EAB308] dark:bg-[rgba(234,179,8,0.15)] dark:text-[#FDE68A]"
                    style={{ borderColor: 'rgba(234,179,8,0.35)' }}
                  >
                    <Star size={13} strokeWidth={1.75} aria-hidden /> Set primary
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setContactBankPreselect(detailBank.id); setEditingContact(null); setIsContactModalOpen(true) }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[var(--brand-primary-hover)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
                  style={{ transition: 'background 150ms cubic-bezier(0.2,0,0,1), scale 120ms cubic-bezier(0.2,0,0,1)' }}
                >
                  <Plus size={13} strokeWidth={2} aria-hidden /> Add contact
                </button>
              </div>
            </div>


            <div className="flex-1 overflow-y-auto overscroll-contain bg-[var(--surface)]" style={{ overscrollBehavior: 'contain' }}>
              <div className="flex flex-col gap-6 p-6">
                {/* Account details — group with space vs separator */}
                <section aria-labelledby="acct-details-heading" className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4" style={{ borderRadius: 12 }}>
                  <h3 id="acct-details-heading" className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Account details</h3>
                  <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div className="flex flex-col gap-1 rounded-lg bg-[var(--surface)] p-2.5 ring-1 ring-[var(--border)]"><dt className="text-[11px] font-medium leading-none text-[var(--text-muted)]">Account holder</dt><dd className="truncate text-[13px] font-semibold leading-none text-[var(--text-primary)]">{detailBank.accountHolderName || '—'}</dd></div>
                    <div className="flex flex-col gap-1 rounded-lg bg-[var(--surface)] p-2.5 ring-1 ring-[var(--border)]"><dt className="text-[11px] font-medium leading-none text-[var(--text-muted)]">IFSC</dt><dd className="font-mono text-[13px] font-semibold leading-none tabular-nums">{detailBank.ifscCode}</dd></div>
                    <div className="flex flex-col gap-1 rounded-lg bg-[var(--surface)] p-2.5 ring-1 ring-[var(--border)]"><dt className="text-[11px] font-medium leading-none text-[var(--text-muted)]">MICR</dt><dd className="font-mono text-[13px] leading-none tabular-nums">{detailBank.micrCode || '—'}</dd></div>
                    <div className="flex flex-col gap-1 rounded-lg bg-[var(--surface)] p-2.5 ring-1 ring-[var(--border)]"><dt className="text-[11px] font-medium leading-none text-[var(--text-muted)]">SWIFT</dt><dd className="font-mono text-[13px] leading-none tabular-nums">{detailBank.swiftCode || '—'}</dd></div>
                    <div className="flex flex-col gap-1 rounded-lg bg-[var(--surface)] p-2.5 ring-1 ring-[var(--border)]"><dt className="text-[11px] font-medium leading-none text-[var(--text-muted)]">Branch code</dt><dd className="text-[13px] font-medium leading-none">{detailBank.branchCode || '—'}</dd></div>
                    <div className="flex flex-col gap-1 rounded-lg bg-[var(--surface)] p-2.5 ring-1 ring-[var(--border)]"><dt className="text-[11px] font-medium leading-none text-[var(--text-muted)]">Overdraft limit</dt><dd className="tabular-nums text-[13px] font-semibold leading-none">{detailBank.overdraftLimitPaise ? formatBalance(detailBank.overdraftLimitPaise, detailBank.currency) : '—'}</dd></div>
                    <div className="col-span-1 flex flex-col gap-1 rounded-lg bg-[var(--surface)] p-2.5 ring-1 ring-[var(--border)] sm:col-span-2"><dt className="text-[11px] font-medium leading-none text-[var(--text-muted)]">Address</dt><dd className="text-pretty text-[13px] leading-snug" style={{ textWrap: 'pretty', overflowWrap: 'break-word' }}>{[detailBank.addressLine1, detailBank.addressLine2].filter(Boolean).join(', ') || '—'}</dd></div>
                    {(detailBank.contactPerson || detailBank.contactPhone || detailBank.contactEmail) && (
                      <div className="col-span-1 flex flex-col gap-1 rounded-lg bg-[var(--surface)] p-2.5 ring-1 ring-[var(--border)] sm:col-span-2">
                        <dt className="text-[11px] font-medium leading-none text-[var(--text-muted)]">Bank contact</dt>
                        <dd className="flex flex-wrap items-center gap-1.5 text-[13px] leading-snug">{[detailBank.contactPerson, detailBank.contactPhone, detailBank.contactEmail].filter(Boolean).join(' · ')}</dd>
                      </div>
                    )}
                    {detailBank.website && <div className="col-span-1 flex flex-col gap-1 rounded-lg bg-[var(--surface)] p-2.5 ring-1 ring-[var(--border)] sm:col-span-2"><dt className="text-[11px] font-medium leading-none text-[var(--text-muted)]">Website</dt><dd className="truncate text-[13px] leading-none text-[var(--brand-primary)] underline decoration-[var(--brand-primary)]/20 underline-offset-4" style={{ overflowWrap: 'break-word' }}>{detailBank.website}</dd></div>}
                    {detailBank.notes && <div className="col-span-1 flex flex-col gap-1 rounded-lg bg-[var(--surface)] p-2.5 ring-1 ring-[var(--border)] sm:col-span-2"><dt className="text-[11px] font-medium leading-none text-[var(--text-muted)]">Notes</dt><dd className="text-pretty text-[13px] leading-relaxed" style={{ textWrap: 'pretty', overflowWrap: 'break-word' }}>{detailBank.notes}</dd></div>}
                  </dl>
                </section>

                {/* Contacts — space groups, redundant cue beyond color (star + label) */}
                <section aria-labelledby="bank-contacts-heading" className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 id="bank-contacts-heading" className="inline-flex items-center gap-1.5 text-[13px] font-bold leading-none tracking-tight"><Users size={13} strokeWidth={1.75} aria-hidden /> Contacts <span className="rounded-full bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)] ring-1 ring-[var(--border)]">{detailBank.contacts.length}</span></h3>
                    <span className="inline-flex items-center gap-1 text-[11px] leading-none text-[var(--text-muted)]"><Star size={11} className="fill-[#EAB308] text-[#EAB308]" aria-hidden /> Primary is starred</span>
                  </div>

                  {detailBank.contacts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-8 text-center">
                      <div className="mx-auto max-w-[32ch]">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">No contacts yet</div>
                        <div className="mt-1 text-pretty text-xs leading-relaxed text-[var(--text-muted)]" style={{ textWrap: 'pretty' }}>Add the relationship manager for this bank so your team knows who to call.</div>
                        <Button onClick={() => { setContactBankPreselect(detailBank.id); setEditingContact(null); setIsContactModalOpen(true) }} size="sm" className="mt-3 gap-1.5 bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] active:scale-[0.96]"><Plus size={14} aria-hidden /> Add contact</Button>
                      </div>
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2" role="list">
                      {detailBank.contacts
                        .slice()
                        .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1))
                        .map((ct) => (
                          <li
                            key={ct.id}
                            className="flex items-center justify-between gap-3 rounded-xl border bg-[var(--surface)] p-3 shadow-sm transition-[border-color,background] duration-150"
                            style={{
                              borderColor: ct.isPrimary ? 'rgba(100,18,109,0.18)' : 'var(--border)',
                              background: ct.isPrimary ? 'rgba(100,18,109,0.04)' : 'var(--surface)',
                              borderRadius: 12,
                            }}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div
                                className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                                style={{
                                  background: ct.isPrimary ? 'var(--brand-primary)' : 'var(--surface-secondary)',
                                  color: ct.isPrimary ? 'var(--on-brand)' : 'var(--text-muted)',
                                  border: ct.isPrimary ? '2px solid #EAB308' : '1px solid var(--border)',
                                }}
                                aria-hidden
                              >
                                {ct.firstName[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 text-[13px] leading-none">
                                  <span className={`truncate ${ct.isPrimary ? 'font-bold' : 'font-semibold'}`}>{ct.firstName} {ct.lastName ?? ''}</span>
                                  {ct.isPrimary && <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[#92400E] ring-1 ring-[#FDE68A] dark:bg-[rgba(234,179,8,0.18)] dark:text-[#FDE68A]"><Star size={8} className="fill-[#EAB308] text-[#EAB308]" aria-hidden /> Primary</span>}
                                  {ct.designation && <span className="rounded-full bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] ring-1 ring-[var(--border)]">{ct.designation}</span>}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                                  {ct.email && <span className="inline-flex items-center gap-1 truncate"><Mail size={10} aria-hidden className="shrink-0" /><span className="truncate">{ct.email}</span></span>}
                                  {ct.phone && <span className="inline-flex items-center gap-1 tabular-nums"><Phone size={10} aria-hidden className="shrink-0" />{ct.phone}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {!ct.isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryContact(ct.id)}
                                  aria-label={`Set ${ct.firstName} as primary`}
                                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium leading-none hover:bg-[var(--surface-secondary)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                                  style={{ minHeight: 28 }}
                                >
                                  <Star size={11} aria-hidden /> Set primary
                                </button>
                              )}
                              <button
                                type="button"
                                aria-label={`Edit ${ct.firstName}`}
                                onClick={() => {
                                  const flat: ContactFlat = { ...ct, bankId: detailBank.id, bankName: detailBank.bankName, bankCode: detailBank.code, accountNumber: detailBank.accountNumber }
                                  setEditingContact(flat)
                                  setContactBankPreselect(detailBank.id)
                                  setIsContactModalOpen(true)
                                }}
                                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                              >
                                <Edit2 size={13} strokeWidth={1.75} />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${ct.firstName}`}
                                onClick={() => {
                                  const flat: ContactFlat = { ...ct, bankId: detailBank.id, bankName: detailBank.bankName, bankCode: detailBank.code, accountNumber: detailBank.accountNumber }
                                  setDeleteContactTarget(flat)
                                }}
                                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--danger-soft-bg)] hover:text-[var(--danger)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
                              >
                                <Trash2 size={13} strokeWidth={1.75} />
                              </button>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bank modal — sections with legends, logical grouping, 2× gap between groups */}
      {isBankModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="bank-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={() => setIsBankModalOpen(false)}>
          <div
            ref={bankModalRef}
            tabIndex={-1}
            onKeyDown={(e) => trapFocus(bankModalRef.current, e as unknown as React.KeyboardEvent)}
            className="bank-modal card flex max-h-[90vh] w-full max-w-[760px] flex-col overflow-hidden bg-[var(--surface)] shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
            style={{ borderRadius: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4 sm:px-7">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white shadow-sm" aria-hidden><Landmark size={16} /></span>
                <div className="min-w-0">
                  <h3 id="bank-modal-title" className="truncate text-balance text-[15px] font-bold leading-none tracking-tight" style={{ textWrap: 'balance' }}>{editingBank ? `Edit bank · ${editingBank.code}` : 'Add bank account'}</h3>
                  <p className="mt-1 hidden text-xs leading-relaxed text-[var(--text-muted)] sm:block">Fields marked * are required. Balances are stored as paise — enter rupees.</p>
                </div>
              </div>
              <button type="button" aria-label="Close dialog" onClick={() => setIsBankModalOpen(false)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] active:scale-[0.96]">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleSaveBank} noValidate className="flex flex-1 flex-col overflow-y-auto overscroll-contain" style={{ overscrollBehavior: 'contain' }}>
              <div className="flex flex-col gap-7 p-6 sm:p-7">
                {/* Identity */}
                <fieldset className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4" style={{ borderRadius: 12 }}>
                  <legend className="px-1 text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Identity</legend>
                  <div className="bank-form-2 grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor="bank-code">Bank code *</FieldLabel>
                      <Input id="bank-code" name="code" defaultValue={editingBank?.code || `BANK-2026-${String(banks.length + 1).padStart(4, '0')}`} placeholder="BANK-2026-0007" required autoComplete="off" spellCheck={false} className="h-10 font-mono text-base uppercase tabular-nums sm:text-sm" style={{ textTransform: 'uppercase' }} />
                      <FieldDescription className="text-[11px]">Unique code, e.g. BANK-2026-0007</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="bank-name">Bank name *</FieldLabel>
                      <Input id="bank-name" name="bankName" defaultValue={editingBank?.bankName || ''} placeholder="State Bank of India" required autoComplete="organization" className="h-10 text-base sm:text-sm" />
                    </Field>
                  </div>
                  <div className="bank-form-3 grid grid-cols-3 gap-3">
                    <Field><FieldLabel htmlFor="branch-name">Branch name</FieldLabel><Input id="branch-name" name="branchName" defaultValue={editingBank?.branchName || ''} placeholder="Fort Mumbai" autoComplete="address-level2" className="h-10 text-base sm:text-sm" /></Field>
                    <Field><FieldLabel htmlFor="branch-code">Branch code</FieldLabel><Input id="branch-code" name="branchCode" defaultValue={editingBank?.branchCode || ''} placeholder="SBI0001" className="h-10 font-mono text-base sm:text-sm uppercase" style={{ textTransform: 'uppercase' }} /></Field>
                    <Field>
                      <FieldLabel htmlFor="bank-type">Bank type</FieldLabel>
                      <select id="bank-type" name="bankType" defaultValue={editingBank?.bankType || ''} className="input-base h-9 rounded-md text-base sm:text-[13px]">
                        <option value="">Select type</option><option value="public">Public</option><option value="private">Private</option><option value="foreign">Foreign</option><option value="cooperative">Cooperative</option><option value="small_finance">Small Finance</option><option value="payments">Payments</option>
                      </select>
                    </Field>
                  </div>
                </fieldset>

                {/* Account */}
                <fieldset className="flex flex-col gap-4">
                  <legend className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Account</legend>
                  <div className="bank-form-2 grid grid-cols-2 gap-3">
                    <Field><FieldLabel htmlFor="acc-holder">Account holder</FieldLabel><Input id="acc-holder" name="accountHolderName" defaultValue={editingBank?.accountHolderName || 'Accent Techno Solutions Pvt Ltd'} placeholder="Accent Techno Solutions Pvt Ltd" autoComplete="organization" className="h-10 text-base sm:text-sm" /></Field>
                    <Field><FieldLabel htmlFor="acc-number">Account number *</FieldLabel><Input id="acc-number" name="accountNumber" defaultValue={editingBank?.accountNumber || ''} placeholder="0000001234567890" required inputMode="numeric" autoComplete="off" className="h-10 font-mono text-base sm:text-sm tabular-nums" /></Field>
                  </div>
                  <div className="bank-form-3 grid grid-cols-3 gap-3">
                    <Field>
                      <FieldLabel htmlFor="acc-type">Account type *</FieldLabel>
                      <select id="acc-type" name="accountType" defaultValue={editingBank?.accountType || 'current'} className="input-base h-9 rounded-md text-base sm:text-[13px]">
                        {ACCOUNT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>)}
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="currency">Currency</FieldLabel>
                      <select id="currency" name="currency" defaultValue={editingBank?.currency || 'INR'} className="input-base h-9 rounded-md text-base sm:text-[13px]">
                        <option>INR</option><option>USD</option><option>EUR</option><option>GBP</option><option>AED</option><option>SAR</option>
                      </select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="status">Status</FieldLabel>
                      <select id="status" name="status" defaultValue={editingBank?.status || 'active'} className="input-base h-9 rounded-md text-base sm:text-[13px]">
                        <option value="active">Active</option><option value="inactive">Inactive</option><option value="closed">Closed</option><option value="dormant">Dormant</option><option value="frozen">Frozen</option>
                      </select>
                    </Field>
                  </div>
                  <div className="bank-form-3 grid grid-cols-3 gap-3">
                    <Field><FieldLabel htmlFor="ifsc">IFSC code *</FieldLabel><Input id="ifsc" name="ifscCode" defaultValue={editingBank?.ifscCode || ''} placeholder="SBIN0000001" required className="h-10 font-mono text-base sm:text-sm uppercase tabular-nums" style={{ textTransform: 'uppercase' }} autoComplete="off" spellCheck={false} /></Field>
                    <Field><FieldLabel htmlFor="swift">SWIFT code</FieldLabel><Input id="swift" name="swiftCode" defaultValue={editingBank?.swiftCode || ''} placeholder="SBININBB" className="h-10 font-mono text-base sm:text-sm uppercase" style={{ textTransform: 'uppercase' }} autoComplete="off" /></Field>
                    <Field><FieldLabel htmlFor="micr">MICR code</FieldLabel><Input id="micr" name="micrCode" defaultValue={editingBank?.micrCode || ''} placeholder="400002001" className="h-10 font-mono text-base sm:text-sm tabular-nums" inputMode="numeric" /></Field>
                  </div>
                </fieldset>

                {/* Financials */}
                <fieldset className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm" style={{ borderRadius: 12 }}>
                  <legend className="px-1 text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Balances</legend>
                  <div className="bank-form-3 grid grid-cols-3 gap-3">
                    <Field>
                      <FieldLabel htmlFor="opening">Opening balance (₹)</FieldLabel>
                      <Input id="opening" name="openingBalance" inputMode="decimal" defaultValue={editingBank ? String((editingBank.openingBalancePaise / 100).toFixed(2)) : ''} placeholder="500000.00" className="h-10 font-mono text-base sm:text-sm tabular-nums" />
                      <FieldDescription className="text-[11px]">Rupees, e.g. 12,50,000.00</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="current">Current balance (₹)</FieldLabel>
                      <Input id="current" name="currentBalance" inputMode="decimal" defaultValue={editingBank ? String((editingBank.currentBalancePaise / 100).toFixed(2)) : ''} placeholder="1250000.00" className="h-10 font-mono text-base sm:text-sm tabular-nums" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="od">OD limit (₹)</FieldLabel>
                      <Input id="od" name="overdraftLimit" inputMode="decimal" defaultValue={editingBank ? String((editingBank.overdraftLimitPaise / 100).toFixed(2)) : ''} placeholder="0.00" className="h-10 font-mono text-base sm:text-sm tabular-nums" />
                    </Field>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-[var(--surface-secondary)] p-3 transition-colors hover:bg-[var(--surface-secondary)] focus-within:ring-2 focus-within:ring-[var(--brand-primary)] focus-within:ring-offset-1" style={{ borderColor: 'var(--border)', borderRadius: 12 }}>
                    <input type="checkbox" name="isPrimary" defaultChecked={editingBank?.isPrimary ?? false} className="mt-0.5 size-4 rounded border-[var(--border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]" />
                    <span className="flex-1 text-sm leading-snug">
                      <span className="inline-flex items-center gap-1.5 font-semibold"><Star size={13} className="fill-[#EAB308] text-[#EAB308]" aria-hidden /> Mark as primary bank</span>
                      <span className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]" style={{ textWrap: 'pretty' }}>Only one primary at a time — this will replace the existing primary for all statements.</span>
                    </span>
                  </label>
                </fieldset>

                {/* Location + contact */}
                <fieldset className="flex flex-col gap-4">
                  <legend className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Location & branch contact</legend>
                  <div className="bank-form-3 grid grid-cols-3 gap-3">
                    <Field><FieldLabel htmlFor="city">City</FieldLabel><Input id="city" name="city" defaultValue={editingBank?.city || ''} placeholder="Mumbai" autoComplete="address-level2" className="h-10 text-base sm:text-sm" /></Field>
                    <Field><FieldLabel htmlFor="state-bl">State</FieldLabel><Input id="state-bl" name="state" defaultValue={editingBank?.state || ''} placeholder="Maharashtra" autoComplete="address-level1" className="h-10 text-base sm:text-sm" /></Field>
                    <Field><FieldLabel htmlFor="country">Country</FieldLabel><Input id="country" name="country" defaultValue={editingBank?.country || 'India'} placeholder="India" autoComplete="country-name" className="h-10 text-base sm:text-sm" /></Field>
                  </div>
                  <div className="bank-form-2 grid grid-cols-2 gap-3">
                    <Field><FieldLabel htmlFor="addr1">Address line 1</FieldLabel><Input id="addr1" name="addressLine1" defaultValue={editingBank?.addressLine1 || ''} placeholder="Street, building" autoComplete="street-address" className="h-10 text-base sm:text-sm" /></Field>
                    <Field><FieldLabel htmlFor="addr2">Address line 2</FieldLabel><Input id="addr2" name="addressLine2" defaultValue={editingBank?.addressLine2 || ''} placeholder="Area, landmark" className="h-10 text-base sm:text-sm" /></Field>
                  </div>
                  <div className="bank-form-2 grid grid-cols-2 gap-3">
                    <Field><FieldLabel htmlFor="postal">Postal code</FieldLabel><Input id="postal" name="postalCode" defaultValue={editingBank?.postalCode || ''} placeholder="400001" inputMode="numeric" autoComplete="postal-code" className="h-10 font-mono text-base sm:text-sm tabular-nums" /></Field>
                    <Field><FieldLabel htmlFor="website">Website</FieldLabel><Input id="website" name="website" type="url" inputMode="url" defaultValue={editingBank?.website || ''} placeholder="https://bank.com" autoComplete="url" className="h-10 text-base sm:text-sm" /></Field>
                  </div>
                  <div className="bank-form-3 grid grid-cols-3 gap-3">
                    <Field><FieldLabel htmlFor="cperson">Contact person</FieldLabel><Input id="cperson" name="contactPerson" defaultValue={editingBank?.contactPerson || ''} placeholder="Branch manager" autoComplete="name" className="h-10 text-base sm:text-sm" /></Field>
                    <Field><FieldLabel htmlFor="cphone">Contact phone</FieldLabel><Input id="cphone" name="contactPhone" type="tel" inputMode="tel" defaultValue={editingBank?.contactPhone || ''} placeholder="+91 98765 43210" autoComplete="tel" className="h-10 font-mono text-base sm:text-sm tabular-nums" /></Field>
                    <Field><FieldLabel htmlFor="cemail">Contact email</FieldLabel><Input id="cemail" name="contactEmail" type="email" inputMode="email" defaultValue={editingBank?.contactEmail || ''} placeholder="manager@bank.com" autoComplete="email" className="h-10 text-base sm:text-sm" /></Field>
                  </div>
                  <Field><FieldLabel htmlFor="notes">Notes</FieldLabel><Input id="notes" name="notes" defaultValue={editingBank?.notes || ''} placeholder="Optional notes — e.g. operating hours, remarks" className="h-10 text-base sm:text-sm" /></Field>
                </fieldset>

                {editingBank && editingBank.contacts.length > 0 && (
                  <section aria-labelledby="edit-contacts-heading" className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4" style={{ borderRadius: 12 }}>
                    <h4 id="edit-contacts-heading" className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Relationship contacts — ★ Primary is starred</h4>
                    <ul className="mt-3 flex flex-col gap-2" role="list">
                      {editingBank.contacts.map((ct) => (
                        <li key={ct.id} className="flex items-center justify-between gap-3 rounded-lg border bg-[var(--surface)] px-3 py-2 shadow-sm" style={{ borderColor: ct.isPrimary ? 'rgba(100,18,109,0.15)' : 'var(--border)', background: ct.isPrimary ? 'rgba(100,18,109,0.04)' : 'white', borderRadius: 10 }}>
                          <span className="min-w-0 flex-1 truncate text-xs leading-none">
                            <span className="font-semibold">{ct.firstName} {ct.lastName ?? ''}</span>
                            {ct.isPrimary && <span className="ml-2 inline-flex items-center rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-bold text-[#92400E] ring-1 ring-[#FDE68A]">★ Primary</span>}
                            <span className="ml-2 text-[var(--text-muted)]">{ct.email ?? ''}{ct.phone ? ` · ${ct.phone}` : ''}</span>
                          </span>
                          {!ct.isPrimary && (
                            <button type="button" onClick={async () => { await handleSetPrimaryContact(ct.id) }} className="inline-flex shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium hover:bg-[var(--surface-secondary)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]">Set primary</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4 sm:px-7">
                <button type="button" onClick={() => setIsBankModalOpen(false)} className="btn-secondary h-10 rounded-lg px-4 text-sm font-medium active:scale-[0.98]">Cancel</button>
                <Button type="submit" disabled={isSaving} className="h-10 gap-1.5 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-primary-hover)] active:scale-[0.96] disabled:opacity-60">
                  {isSaving ? 'Saving…' : editingBank ? 'Save changes' : 'Create bank'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact modal */}
      {isContactModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={() => { setIsContactModalOpen(false); setEditingContact(null); setContactBankPreselect(null) }}>
          <div ref={contactModalRef} tabIndex={-1} onKeyDown={(e) => trapFocus(contactModalRef.current, e as unknown as React.KeyboardEvent)} className="bank-modal card flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden bg-[var(--surface)] shadow-[0_20px_60px_rgba(0,0,0,0.22)]" style={{ borderRadius: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
              <h3 id="contact-modal-title" className="inline-flex items-center gap-2 text-[15px] font-bold leading-none tracking-tight"><span className="flex size-7 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white"><Users size={13} /></span>{editingContact ? 'Edit contact' : 'New contact'}</h3>
              <button type="button" aria-label="Close dialog" onClick={() => { setIsContactModalOpen(false); setEditingContact(null); setContactBankPreselect(null) }} className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-secondary)] active:scale-[0.96]"><X size={16} /></button>
            </div>
            <form id="contact-form" onSubmit={handleSaveContact} noValidate className="flex flex-col gap-5 overflow-y-auto p-6">
              <Field>
                <FieldLabel htmlFor="contact-bank">Bank *</FieldLabel>
                <select
                  id="contact-bank"
                  name="bankId"
                  defaultValue={editingContact?.bankId ?? contactBankPreselect ?? (banks[0]?.id ?? '')}
                  className="input-base h-9 rounded-md text-base sm:text-[13px]"
                  required
                  disabled={!!editingContact && !!contactBankPreselect}
                  aria-describedby="contact-bank-hint"
                >
                  <option value="">Select bank</option>{banks.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.bankName} · {b.accountNumber}</option>)}
                </select>
                <FieldDescription id="contact-bank-hint" className="text-[11px]">The relationship manager belongs to this bank account.</FieldDescription>
                {editingContact && contactBankPreselect && <input type="hidden" name="bankId" value={editingContact.bankId} />}
              </Field>
              <div className="bank-form-2 grid grid-cols-2 gap-3">
                <Field><FieldLabel htmlFor="cfname">First name *</FieldLabel><Input id="cfname" name="firstName" defaultValue={editingContact?.firstName ?? ''} placeholder="Rajesh" required autoComplete="given-name" className="h-10 text-base sm:text-sm" /></Field>
                <Field><FieldLabel htmlFor="clname">Last name</FieldLabel><Input id="clname" name="lastName" defaultValue={editingContact?.lastName ?? ''} placeholder="Kulkarni" autoComplete="family-name" className="h-10 text-base sm:text-sm" /></Field>
              </div>
              <Field><FieldLabel htmlFor="cemail2">Email</FieldLabel><Input id="cemail2" name="email" type="email" inputMode="email" defaultValue={editingContact?.email ?? ''} placeholder="rajesh@bank.com" autoComplete="email" className="h-10 text-base sm:text-sm" /></Field>
              <div className="bank-form-2 grid grid-cols-2 gap-3">
                <Field><FieldLabel htmlFor="cphone2">Phone</FieldLabel><Input id="cphone2" name="phone" type="tel" inputMode="tel" defaultValue={editingContact?.phone ?? ''} placeholder="+91 98765 43210" autoComplete="tel" className="h-10 font-mono text-base sm:text-sm tabular-nums" /></Field>
                <Field><FieldLabel htmlFor="cdesig">Designation</FieldLabel><Input id="cdesig" name="designation" defaultValue={editingContact?.designation ?? ''} placeholder="Branch manager" autoComplete="organization-title" className="h-10 text-base sm:text-sm" /></Field>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border bg-[var(--surface-secondary)] p-3 hover:bg-[var(--surface-secondary)] focus-within:ring-2 focus-within:ring-[var(--brand-primary)]" style={{ borderColor: 'var(--border)', borderRadius: 12 }}>
                <input type="checkbox" name="isPrimary" defaultChecked={editingContact?.isPrimary ?? false} className="mt-0.5 size-4 rounded border-[var(--border)] text-[var(--brand-primary)]" />
                <span className="text-sm leading-snug"><span className="inline-flex items-center gap-1 font-semibold"><Star size={12} className="fill-[#EAB308] text-[#EAB308]" aria-hidden /> Set as primary contact</span><span className="mt-1 block text-xs text-[var(--text-muted)]">Primary contacts are highlighted everywhere and used for quick actions.</span></span>
              </label>
              <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4 -mx-6 -mb-6 mt-2">
                <button type="button" onClick={() => { setIsContactModalOpen(false); setEditingContact(null); setContactBankPreselect(null) }} className="btn-secondary h-10 rounded-lg px-4 text-sm active:scale-[0.98]">Cancel</button>
                <Button type="submit" disabled={isSaving} className="h-10 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] active:scale-[0.96]">{isSaving ? 'Saving…' : editingContact ? 'Update contact' : 'Create contact'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete bank confirm — distinct treatment, verb-first, no color-only meaning */}
      {deleteBankTarget && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-bank-title" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={() => setDeleteBankTarget(null)}>
          <div className="bank-modal card w-full max-w-[440px] p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.22)]" style={{ borderRadius: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--danger-soft-bg)] text-[var(--danger)] ring-1 ring-[var(--border)]" aria-hidden><Trash2 size={22} strokeWidth={1.75} /></div>
            <h3 id="delete-bank-title" className="mt-4 text-balance text-[16px] font-bold leading-none" style={{ textWrap: 'balance' }}>Delete bank account?</h3>
            <p className="mx-auto mt-2 max-w-[34ch] text-pretty text-[13px] leading-relaxed text-[var(--text-muted)]" style={{ textWrap: 'pretty' }}>
              This will permanently delete <span className="font-semibold text-[var(--text-primary)]">{deleteBankTarget.bankName}</span> <span className="font-mono text-xs">({deleteBankTarget.code} · {deleteBankTarget.accountNumber})</span> and its {deleteBankTarget.contacts.length} {deleteBankTarget.contacts.length === 1 ? 'contact' : 'contacts'}. You cannot undo this.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button type="button" onClick={() => setDeleteBankTarget(null)} className="btn-secondary h-10 rounded-lg px-5 text-sm font-medium active:scale-[0.98]">Cancel</button>
              <Button type="button" onClick={handleDeleteBank} className="h-10 gap-1.5 rounded-lg bg-[var(--danger)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#B91C1C] active:scale-[0.96]"><Trash2 size={14} aria-hidden /> Delete bank</Button>
            </div>
          </div>
        </div>
      )}

      {deleteContactTarget && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-contact-title" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={() => setDeleteContactTarget(null)}>
          <div className="card w-full max-w-[420px] p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.22)]" style={{ borderRadius: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-contact-title" className="text-balance text-[16px] font-bold" style={{ textWrap: 'balance' }}>Delete contact?</h3>
            <p className="mx-auto mt-2 max-w-[34ch] text-pretty text-[13px] leading-relaxed text-[var(--text-muted)]" style={{ textWrap: 'pretty' }}>
              Remove <span className="font-semibold text-[var(--text-primary)]">{deleteContactTarget.firstName} {deleteContactTarget.lastName ?? ''}</span>{deleteContactTarget.email ? ` (${deleteContactTarget.email})` : ''} from <span className="font-medium text-[var(--text-primary)]">{deleteContactTarget.bankName}</span>? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button type="button" onClick={() => setDeleteContactTarget(null)} className="btn-secondary h-10 rounded-lg px-5 text-sm font-medium">Cancel</button>
              <Button type="button" onClick={handleDeleteContact} className="h-10 rounded-lg bg-[var(--danger)] px-5 text-sm font-semibold text-white hover:bg-[#B91C1C] active:scale-[0.96]">Delete contact</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
