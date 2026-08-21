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
  Truck,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Field, FieldLabel } from '~/components/ui/field'
import {
  createVendorAction,
  createVendorContactAction,
  createVendorEmailAction,
  deleteVendorAction,
  deleteVendorContactAction,
  deleteVendorEmailAction,
  getVendorMasterPageData,
  setPrimaryVendorContactAction,
  updateVendorAction,
  updateVendorContactAction,
  updateVendorEmailAction,
} from '~/lib/masters/vendor/functions'

// ── Types ───────────────────────────────────────────────────────────────
type Vendor = {
  id: string
  code: string
  name: string
  legalName: string | null
  vendorCategory: 'supplier' | 'subcontractor' | 'service_provider' | 'contractor' | 'manufacturer' | 'trader' | 'consultant' | 'oem' | 'distributor'
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
  status: 'active' | 'inactive' | 'blacklisted' | 'on_hold'
  rating: number | null
  paymentTerms: string | null
  msmeNumber: string | null
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

type ContactFlat = Vendor['contacts'][number] & { vendorId: string; vendorName: string; vendorCode: string }
type EmailFlat = Vendor['emails'][number] & { vendorId: string; vendorName: string; vendorCode: string }

type Tab = 'vendors' | 'contacts' | 'emails'

const STATUS_BADGE: Record<string, string> = {
  active: 'badge badge-cyan',
  inactive: 'badge badge-warning',
  blacklisted: 'badge badge-danger',
  on_hold: 'badge badge-secondary',
}

const CATEGORY_LABEL: Record<Vendor['vendorCategory'], string> = {
  supplier: 'Supplier',
  subcontractor: 'Subcontractor',
  service_provider: 'Service Provider',
  contractor: 'Contractor',
  manufacturer: 'Manufacturer',
  trader: 'Trader',
  consultant: 'Consultant',
  oem: 'OEM',
  distributor: 'Distributor',
}

const CATEGORY_OPTIONS: Vendor['vendorCategory'][] = ['supplier','subcontractor','service_provider','contractor','manufacturer','trader','consultant','oem','distributor']

export default function VendorMaster() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, blacklisted: 0, totalContacts: 0, totalEmails: 0, categories: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [vendorFilter, setVendorFilter] = useState<string>('All')
  const [tab, setTab] = useState<Tab>('vendors')
  const searchRef = useRef<HTMLInputElement>(null)

  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [deleteVendorTarget, setDeleteVendorTarget] = useState<Vendor | null>(null)

  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactFlat | null>(null)
  const [deleteContactTarget, setDeleteContactTarget] = useState<ContactFlat | null>(null)
  const [contactVendorPreselect, setContactVendorPreselect] = useState<string | null>(null)

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [editingEmail, setEditingEmail] = useState<EmailFlat | null>(null)
  const [deleteEmailTarget, setDeleteEmailTarget] = useState<EmailFlat | null>(null)
  const [emailVendorPreselect, setEmailVendorPreselect] = useState<string | null>(null)

  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  useHotkey({ key: 'Escape' }, () => {
    setIsVendorModalOpen(false)
    setIsContactModalOpen(false)
    setIsEmailModalOpen(false)
    setDeleteVendorTarget(null)
    setDeleteContactTarget(null)
    setDeleteEmailTarget(null)
    setDetailVendor(null)
  })
  useHotkey({ key: 'k', mod: true }, (e) => { e.preventDefault(); searchRef.current?.focus() })

  const handlePacedSearch = useDebouncedCallback((_v: string) => {}, { wait: 200 })

  async function load() {
    setLoading(true)
    try {
      const data = await getVendorMasterPageData()
      if (!data.authorized) {
        showFeedback('error', 'Not authorized — sign in as administrator.')
        setVendors([])
        return
      }
      setVendors(data.vendors as Vendor[])
      setStats(data.stats)
      if (detailVendor) {
        const upd = (data.vendors as Vendor[]).find((v) => v.id === detailVendor.id)
        if (upd) setDetailVendor(upd)
      }
      if (editingVendor) {
        const upd = (data.vendors as Vendor[]).find((v) => v.id === editingVendor.id)
        if (upd) setEditingVendor(upd)
      }
    } catch (e) {
      showFeedback('error', e instanceof Error ? e.message : 'Failed to load vendors.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contactsFlat: ContactFlat[] = useMemo(() => {
    const out: ContactFlat[] = []
    for (const v of vendors) for (const ct of v.contacts) out.push({ ...ct, vendorId: v.id, vendorName: v.name, vendorCode: v.code })
    return out.sort((a,b)=> a.isPrimary!==b.isPrimary ? (a.isPrimary?-1:1) : `${a.firstName} ${a.lastName??''}`.localeCompare(`${b.firstName} ${b.lastName??''}`))
  }, [vendors])

  const emailsFlat: EmailFlat[] = useMemo(() => {
    const out: EmailFlat[] = []
    for (const v of vendors) for (const em of v.emails) out.push({ ...em, vendorId: v.id, vendorName: v.name, vendorCode: v.code })
    return out.sort((a,b)=> a.email.localeCompare(b.email))
  }, [vendors])

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const q = search.toLowerCase()
      const primary = v.contacts.find((c)=>c.isPrimary) ?? v.contacts[0]
      const primaryName = primary ? `${primary.firstName} ${primary.lastName??''}`.toLowerCase() : ''
      const matchesSearch = !q || v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q) || (v.city??'').toLowerCase().includes(q) || (v.vendorCategory??'').toLowerCase().includes(q) || CATEGORY_LABEL[v.vendorCategory].toLowerCase().includes(q) || (v.industry??'').toLowerCase().includes(q) || primaryName.includes(q) || v.contacts.some((c)=>(c.email??'').toLowerCase().includes(q)) || v.emails.some((e)=>e.email.toLowerCase().includes(q))
      const matchesStatus = statusFilter==='All' || v.status===statusFilter.toLowerCase()
      const matchesCategory = categoryFilter==='All' || v.vendorCategory===categoryFilter
      const matchesVendor = vendorFilter==='All' || v.id===vendorFilter
      return matchesSearch && matchesStatus && matchesCategory && matchesVendor
    })
  }, [vendors, search, statusFilter, categoryFilter, vendorFilter])

  const filteredContacts = useMemo(() => {
    return contactsFlat.filter((ct)=>{
      const q=search.toLowerCase()
      const matchesSearch = !q || `${ct.firstName} ${ct.lastName??''}`.toLowerCase().includes(q) || (ct.email??'').toLowerCase().includes(q) || (ct.phone??'').toLowerCase().includes(q) || (ct.designation??'').toLowerCase().includes(q) || ct.vendorName.toLowerCase().includes(q) || ct.vendorCode.toLowerCase().includes(q)
      const matchesVendor = vendorFilter==='All' || ct.vendorId===vendorFilter
      const matchesCategory = categoryFilter==='All' || vendors.find((v)=>v.id===ct.vendorId)?.vendorCategory===categoryFilter
      const matchesStatus = statusFilter==='All' || vendors.find((v)=>v.id===ct.vendorId)?.status===statusFilter.toLowerCase()
      return matchesSearch && matchesVendor && matchesCategory && matchesStatus
    })
  }, [contactsFlat, vendors, search, vendorFilter, categoryFilter, statusFilter])

  const filteredEmails = useMemo(() => {
    return emailsFlat.filter((em)=>{
      const q=search.toLowerCase()
      const matchesSearch = !q || em.email.toLowerCase().includes(q) || (em.type??'').toLowerCase().includes(q) || em.vendorName.toLowerCase().includes(q) || em.vendorCode.toLowerCase().includes(q)
      const matchesVendor = vendorFilter==='All' || em.vendorId===vendorFilter
      const matchesCategory = categoryFilter==='All' || vendors.find((v)=>v.id===em.vendorId)?.vendorCategory===categoryFilter
      return matchesSearch && matchesVendor && matchesCategory
    })
  }, [emailsFlat, vendors, search, vendorFilter, categoryFilter])

  // ── Vendor handlers ──────────────────────────────────────────────────
  async function handleSaveVendor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      code: String(fd.get('code') ?? ''),
      name: String(fd.get('name') ?? ''),
      legalName: String(fd.get('legalName') ?? '') || null,
      vendorCategory: String(fd.get('vendorCategory') ?? 'supplier') as Vendor['vendorCategory'],
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
      status: String(fd.get('status') ?? 'active') as Vendor['status'],
      rating: fd.get('rating') ? Number(fd.get('rating')) : null,
      paymentTerms: String(fd.get('paymentTerms') ?? '') || null,
      msmeNumber: String(fd.get('msmeNumber') ?? '') || null,
    }
    if (!payload.code || !payload.name) { showFeedback('error','Vendor code and name are required.'); setIsSaving(false); return }
    try {
      const res = editingVendor ? await updateVendorAction({ data: { id: editingVendor.id, ...payload } }) : await createVendorAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editingVendor ? `Vendor "${payload.name}" updated.` : `Vendor "${payload.name}" created.`)
      setIsVendorModalOpen(false); setEditingVendor(null); await load()
    } catch (err) { showFeedback('error', err instanceof Error ? err.message : 'Save failed.') }
    finally { setIsSaving(false) }
  }

  async function handleDeleteVendor() {
    if (!deleteVendorTarget) return
    try { const res = await deleteVendorAction({ data: { id: deleteVendorTarget.id } }); if (!res.ok) throw new Error(res.message); showFeedback('success', `Vendor "${deleteVendorTarget.name}" deleted.`); setDeleteVendorTarget(null); setDetailVendor(null); await load() } catch (err) { showFeedback('error', err instanceof Error ? err.message : 'Delete failed.') }
  }

  async function handleSaveContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const vendorId = String(fd.get('vendorId') ?? contactVendorPreselect ?? editingContact?.vendorId ?? '')
    const payload = {
      vendorId,
      firstName: String(fd.get('firstName') ?? '').trim(),
      lastName: String(fd.get('lastName') ?? '').trim() || null,
      email: String(fd.get('email') ?? '').trim() || null,
      phone: String(fd.get('phone') ?? '').trim() || null,
      designation: String(fd.get('designation') ?? '').trim() || null,
      isPrimary: fd.get('isPrimary') === 'on' || fd.get('isPrimary') === 'true',
    }
    if (!payload.vendorId) { showFeedback('error','Select a vendor.'); setIsSaving(false); return }
    if (!payload.firstName) { showFeedback('error','First name required.'); setIsSaving(false); return }
    try {
      const res = editingContact ? await updateVendorContactAction({ data: { id: editingContact.id, ...payload } }) : await createVendorContactAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editingContact ? `Contact "${payload.firstName}" updated.` : `Contact "${payload.firstName}" created.`)
      setIsContactModalOpen(false); setEditingContact(null); setContactVendorPreselect(null); await load()
    } catch (err) { showFeedback('error', err instanceof Error ? err.message : 'Save failed.') }
    finally { setIsSaving(false) }
  }

  async function handleDeleteContact() {
    if (!deleteContactTarget) return
    try { const res = await deleteVendorContactAction({ data: { id: deleteContactTarget.id } }); if (!res.ok) throw new Error(res.message); showFeedback('success', `Contact "${deleteContactTarget.firstName}" deleted.`); setDeleteContactTarget(null); await load() } catch (err) { showFeedback('error', err instanceof Error ? err.message : 'Delete failed.') }
  }

  async function handleSetPrimary(contactId: string) {
    try { const res = await setPrimaryVendorContactAction({ data: { id: contactId } }); if (!res.ok) throw new Error(res.message); showFeedback('success','Primary contact updated.'); await load() } catch (err) { showFeedback('error', err instanceof Error ? err.message : 'Failed to set primary.') }
  }

  async function handleSaveEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const vendorId = String(fd.get('vendorId') ?? emailVendorPreselect ?? editingEmail?.vendorId ?? '')
    const payload = { vendorId, email: String(fd.get('email') ?? '').trim(), type: String(fd.get('type') ?? '').trim() || null }
    if (!payload.vendorId || !payload.email) { showFeedback('error','Vendor and email required.'); setIsSaving(false); return }
    try {
      const res = editingEmail ? await updateVendorEmailAction({ data: { id: editingEmail.id, email: payload.email, type: payload.type } }) : await createVendorEmailAction({ data: payload })
      if (!res.ok) throw new Error(res.message)
      showFeedback('success', editingEmail ? 'Vendor email updated.' : 'Vendor email added.')
      setIsEmailModalOpen(false); setEditingEmail(null); setEmailVendorPreselect(null); await load()
    } catch (err) { showFeedback('error', err instanceof Error ? err.message : 'Save failed.') }
    finally { setIsSaving(false) }
  }

  async function handleDeleteEmail() {
    if (!deleteEmailTarget) return
    try { const res = await deleteVendorEmailAction({ data: { id: deleteEmailTarget.id } }); if (!res.ok) throw new Error(res.message); showFeedback('success', `Email "${deleteEmailTarget.email}" deleted.`); setDeleteEmailTarget(null); await load() } catch (err) { showFeedback('error', err instanceof Error ? err.message : 'Delete failed.') }
  }

  // ── Columns ──────────────────────────────────────────────────────────
  const vendorHelper = createAppColumnHelper<Vendor>()
  const vendorColumns = useMemo(() => [
    vendorHelper.accessor('code', { header: ()=>'Code', cell:(i)=><span style={{fontSize:12,fontFamily:'monospace',color:'var(--text-muted)'}}>{i.getValue()}</span> }),
    vendorHelper.accessor('name', { header:()=>'Vendor', cell:(info)=>{
      const r=info.row.original
      return (
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,borderRadius:6,background:'var(--surface-secondary)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Truck size={14} style={{color:'var(--brand-primary)'}} /></div>
          <div><div style={{fontSize:13,fontWeight:600}}>{r.name}</div>{r.legalName && r.legalName!==r.name && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>{r.legalName}</div>}</div>
        </div>
      )
    }}),
    vendorHelper.accessor('vendorCategory', { header:()=>'Category', cell:(info)=>{
      const v=info.getValue(); return <span className="badge" style={{fontSize:11,background:'var(--surface-secondary)',textTransform:'capitalize'}}>{CATEGORY_LABEL[v as Vendor['vendorCategory']] ?? v}</span>
    }}),
    vendorHelper.accessor('industry', { header:()=>'Industry', cell:(i)=><span style={{fontSize:13}}>{i.getValue()||'—'}</span> }),
    vendorHelper.accessor('city', { header:()=>'Location', cell:(info)=>{ const r=info.row.original; return <div style={{display:'flex',alignItems:'center',gap:4,fontSize:13}}><MapPin size={12} style={{color:'var(--text-muted)'}} />{[r.city,r.state].filter(Boolean).join(', ')||'—'}</div> }}),
    vendorHelper.display({ id:'primaryContact', header:()=>'Primary Contact', cell:(info)=>{
      const row=info.row.original; const primary=row.contacts.find((c)=>c.isPrimary) ?? row.contacts[0]; if(!primary) return <span style={{fontSize:12,color:'var(--text-muted)'}}>— no contacts —</span>
      const fullName=`${primary.firstName} ${primary.lastName??''}`.trim()
      return (
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 8px',borderRadius:6,background:primary.isPrimary?'rgba(100,18,109,0.06)':'transparent',border:primary.isPrimary?'1px solid rgba(100,18,109,0.12)':'1px solid transparent'}}>
          <div style={{width:24,height:24,borderRadius:999,background:primary.isPrimary?'var(--brand-primary)':'var(--surface-secondary)',color:primary.isPrimary?'var(--on-brand)':'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700}}>{primary.firstName[0]?.toUpperCase()??'?'}</div>
          <div><div style={{fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4}}>{fullName}{primary.isPrimary && <Star size={11} style={{color:'#EAB308',fill:'#EAB308'}} />}</div><div style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'var(--text-muted)',marginTop:1}}><Mail size={10} />{primary.email||'—'}{primary.designation && <span> · {primary.designation}</span>}</div></div>
        </div>
      )
    }}),
    vendorHelper.display({ id:'contactsCount', header:()=>'Contacts', cell:(info)=>{
      const row=info.row.original; const count=row.contacts.length; const primaryCount=row.contacts.filter((c)=>c.isPrimary).length
      return <button type="button" onClick={(e)=>{e.stopPropagation(); setDetailVendor(row)}} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,background:count?'var(--surface-secondary)':'transparent',border:'1px solid var(--border)',borderRadius:999,padding:'4px 8px',cursor:'pointer'}} title={`View all ${count} contacts`}><Users size={12} />{count} {count===1?'contact':'contacts'}{primaryCount>0 && <span className="badge badge-cyan" style={{fontSize:10}}><Star size={8} /> primary</span>}</button>
    }}),
    vendorHelper.display({ id:'emailsCount', header:()=>'Emails', cell:(info)=>{ const r=info.row.original; return <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:12,color:'var(--text-muted)'}}><Mail size={12} />{r.emails.length}</span> }}),
    vendorHelper.accessor('status', { header:()=>'Status', cell:(info)=>{ const v=info.getValue(); return <span className={STATUS_BADGE[v]??'badge'} style={{fontSize:11,textTransform:'capitalize'}}>{v.replace('_',' ')}</span> }}),
    vendorHelper.display({ id:'actions', header:()=><div style={{textAlign:'right'}}>Actions</div>, cell:(info)=>{
      const v=info.row.original
      return <div style={{textAlign:'right',display:'inline-flex',gap:6}}><button type="button" className="btn-ghost" style={{padding:'5px 8px'}} title="View contacts" onClick={(e)=>{e.stopPropagation(); setDetailVendor(v)}}><Users size={13} /></button><button type="button" className="btn-ghost" style={{padding:'5px 8px'}} title="Edit Vendor" onClick={(e)=>{e.stopPropagation(); setEditingVendor(v); setIsVendorModalOpen(true)}}><Edit2 size={13} /></button><button type="button" className="btn-ghost" style={{padding:'5px 8px',color:'var(--danger)'}} title="Delete" onClick={(e)=>{e.stopPropagation(); setDeleteVendorTarget(v)}}><Trash2 size={13} /></button></div>
    }}),
  ], [])

  const contactHelper = createAppColumnHelper<ContactFlat>()
  const contactColumns = useMemo(()=>[
    contactHelper.display({ id:'primary', header:()=><span title="Primary">★</span>, cell:(info)=>{
      const r=info.row.original
      return r.isPrimary ? <span className="badge" style={{background:'rgba(234,179,8,0.15)',color:'#A16207',border:'1px solid rgba(234,179,8,0.3)',fontSize:10,display:'inline-flex',alignItems:'center',gap:3}}><Star size={10} style={{fill:'#EAB308',color:'#EAB308'}} /> Primary</span> : <button type="button" className="btn-ghost" style={{padding:'4px 8px',fontSize:11,border:'1px solid var(--border)',borderRadius:999}} title="Set as primary" onClick={()=>handleSetPrimary(r.id)}>Set primary</button>
    }}),
    contactHelper.display({ id:'vendor', header:()=>'Vendor', cell:(info)=>{ const r=info.row.original; return <span style={{fontSize:12,fontWeight:600}}>{r.vendorCode} <span style={{color:'var(--text-muted)',fontWeight:400}}>· {r.vendorName}</span></span> }}),
    contactHelper.display({ id:'name', header:()=>'Contact', cell:(info)=>{ const r=info.row.original; const name=`${r.firstName} ${r.lastName??''}`.trim(); return <div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:26,height:26,borderRadius:999,background:r.isPrimary?'var(--brand-primary)':'var(--surface-secondary)',color:r.isPrimary?'var(--on-brand)':'var(--text-muted)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,border:r.isPrimary?'2px solid rgba(234,179,8,0.6)':'none'}}>{r.firstName[0]?.toUpperCase()??'?'}</div><div><div style={{fontSize:13,fontWeight:r.isPrimary?700:500}}>{name}</div>{r.designation && <div style={{fontSize:11,color:'var(--text-muted)'}}>{r.designation}</div>}</div></div> }}),
    contactHelper.display({ id:'email', header:()=>'Email', cell:(info)=>{ const v=info.row.original.email; return v ? <span style={{fontSize:12,display:'inline-flex',alignItems:'center',gap:4}}><Mail size={11} style={{color:'var(--text-muted)'}} />{v}</span> : <span style={{color:'var(--text-muted)',fontSize:12}}>—</span> }}),
    contactHelper.display({ id:'phone', header:()=>'Phone', cell:(info)=>{ const v=info.row.original.phone; return v ? <span style={{fontSize:12,display:'inline-flex',alignItems:'center',gap:4}}><Phone size={11} style={{color:'var(--text-muted)'}} />{v}</span> : <span style={{color:'var(--text-muted)',fontSize:12}}>—</span> }}),
    contactHelper.display({ id:'actions', header:()=><div style={{textAlign:'right'}}>Actions</div>, cell:(info)=>{ const r=info.row.original; return <div style={{textAlign:'right',display:'inline-flex',gap:6}}><button type="button" className="btn-ghost" style={{padding:'5px 8px'}} title="Edit" onClick={()=>{setEditingContact(r); setContactVendorPreselect(r.vendorId); setIsContactModalOpen(true)}}><Edit2 size={13} /></button><button type="button" className="btn-ghost" style={{padding:'5px 8px',color:'var(--danger)'}} title="Delete" onClick={()=>setDeleteContactTarget(r)}><Trash2 size={13} /></button></div> }}),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const emailHelper = createAppColumnHelper<EmailFlat>()
  const emailColumns = useMemo(()=>[
    emailHelper.display({ id:'vendor', header:()=>'Vendor', cell:(info)=>{ const r=info.row.original; return <span style={{fontSize:12,fontWeight:600}}>{r.vendorCode} <span style={{color:'var(--text-muted)',fontWeight:400}}>· {r.vendorName}</span></span> }}),
    emailHelper.accessor('email', { header:()=>'Email', cell:(info)=><span style={{fontSize:13,display:'inline-flex',alignItems:'center',gap:4}}><Mail size={12} style={{color:'var(--text-muted)'}} />{info.getValue()}</span> }),
    emailHelper.accessor('type', { header:()=>'Type', cell:(info)=><span className="badge" style={{fontSize:11,background:'var(--surface-secondary)'}}>{info.getValue()||'—'}</span> }),
    emailHelper.display({ id:'actions', header:()=><div style={{textAlign:'right'}}>Actions</div>, cell:(info)=>{ const r=info.row.original; return <div style={{textAlign:'right',display:'inline-flex',gap:6}}><button type="button" className="btn-ghost" style={{padding:'5px 8px'}} title="Edit" onClick={()=>{setEditingEmail(r); setEmailVendorPreselect(r.vendorId); setIsEmailModalOpen(true)}}><Edit2 size={13} /></button><button type="button" className="btn-ghost" style={{padding:'5px 8px',color:'var(--danger)'}} title="Delete" onClick={()=>setDeleteEmailTarget(r)}><Trash2 size={13} /></button></div> }}),
  ], [])

  const vendorTable = useAppTable({ data: filteredVendors, columns: vendorColumns as unknown as AppColumnDef<Vendor>[] })
  const contactTable = useAppTable({ data: filteredContacts, columns: contactColumns as unknown as AppColumnDef<ContactFlat>[] })
  const emailTable = useAppTable({ data: filteredEmails, columns: emailColumns as unknown as AppColumnDef<EmailFlat>[] })

  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Loading vendor masters…</div>

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',position:'relative'}}>
      {feedback && <div style={{position:'fixed',top:20,right:20,zIndex:150,display:'flex',alignItems:'center',gap:10,padding:'12px 18px',borderRadius:8,background:feedback.type==='success'?'var(--success-soft-bg)':'var(--danger-soft-bg)',color:feedback.type==='success'?'var(--success-soft-fg)':'var(--danger-soft-fg)',fontWeight:600,fontSize:13.5,boxShadow:'0 10px 25px rgba(0,0,0,0.2)'}}>{feedback.type==='success'?<CheckCircle2 size={18} />:<AlertCircle size={18} />}<span>{feedback.message}</span></div>}

      {/* KPI */}
      <div style={{padding:'16px 28px',borderBottom:'1px solid var(--border)',background:'var(--surface-secondary)',display:'grid',gridTemplateColumns:'repeat(5, 1fr)',gap:12,flexShrink:0}}>
        <div className="kpi-card" style={{padding:'14px 16px'}}><div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase'}}>Total Vendors</div><div style={{fontSize:22,fontWeight:800}}>{stats.total}</div></div>
        <div className="kpi-card" style={{padding:'14px 16px'}}><div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase'}}>Active</div><div style={{fontSize:22,fontWeight:800,color:'var(--success)'}}>{stats.active}</div></div>
        <div className="kpi-card" style={{padding:'14px 16px'}}><div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase'}}>Total Contacts</div><div style={{fontSize:22,fontWeight:800,color:'var(--brand-primary)'}}>{stats.totalContacts}</div></div>
        <div className="kpi-card" style={{padding:'14px 16px'}}><div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase'}}>Vendor Emails</div><div style={{fontSize:22,fontWeight:800}}>{stats.totalEmails}</div></div>
        <div className="kpi-card" style={{padding:'14px 16px'}}><div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase'}}>Categories</div><div style={{fontSize:22,fontWeight:800}}>{stats.categories}</div></div>
      </div>

      {/* Header */}
      <div className="page-header">
        <div><h2 style={{margin:0,fontSize:16,fontWeight:700}}>Vendor Master</h2><p style={{margin:0,fontSize:12,color:'var(--text-muted)'}}>{tab==='vendors' && `${filteredVendors.length} vendors · ${stats.active} active`}{tab==='contacts' && `${filteredContacts.length} contacts · ${contactsFlat.filter(c=>c.isPrimary).length} primary`}{tab==='emails' && `${filteredEmails.length} emails`}</p></div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--surface-secondary)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 12px'}}><Search size={14} style={{color:'var(--text-muted)'}} /><input ref={searchRef} style={{border:'none',background:'transparent',outline:'none',fontSize:13,width:200,color:'var(--text-primary)'}} placeholder={tab==='contacts'?'Search contacts...':tab==='emails'?'Search emails...':'Search vendors...'} value={search} onChange={(e)=>{setSearch(e.target.value); handlePacedSearch(e.target.value)}} /></div>
          {tab==='vendors' && <select className="input-base" style={{width:'auto',fontSize:13}} value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option><option>Blacklisted</option><option>On_hold</option></select>}
          <select className="input-base" style={{width:'auto',fontSize:13}} value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)}><option value="All">All Categories</option>{CATEGORY_OPTIONS.map((c)=><option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select>
          <select className="input-base" style={{width:'auto',fontSize:13}} value={vendorFilter} onChange={(e)=>setVendorFilter(e.target.value)}><option value="All">All Vendors</option>{vendors.map((v)=><option key={v.id} value={v.id}>{v.code} — {v.name}</option>)}</select>
          <button type="button" className="btn-secondary"><Filter size={14} /> Filter</button>
          <button type="button" className="btn-secondary"><Download size={14} /> Export</button>
          {tab==='vendors' && <button type="button" className="btn-primary" onClick={()=>{setEditingVendor(null); setIsVendorModalOpen(true)}}><Plus size={14} /> Add Vendor</button>}
          {tab==='contacts' && <button type="button" className="btn-primary" onClick={()=>{setEditingContact(null); setContactVendorPreselect(vendorFilter!=='All'?vendorFilter:vendors[0]?.id??null); setIsContactModalOpen(true)}} disabled={vendors.length===0}><Plus size={14} /> New Contact</button>}
          {tab==='emails' && <button type="button" className="btn-primary" onClick={()=>{setEditingEmail(null); setEmailVendorPreselect(vendorFilter!=='All'?vendorFilter:vendors[0]?.id??null); setIsEmailModalOpen(true)}} disabled={vendors.length===0}><Plus size={14} /> New Email</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',background:'var(--surface)',padding:'0 28px'}}>
        {[
          {key:'vendors' as const,label:'Vendors',icon:Truck,count:vendors.length},
          {key:'contacts' as const,label:'Contacts',icon:Users,count:contactsFlat.length},
          {key:'emails' as const,label:'Emails',icon:Mail,count:emailsFlat.length},
        ].map((t)=>(
          <button key={t.key} type="button" onClick={()=>setTab(t.key)} style={{display:'flex',alignItems:'center',gap:8,padding:'12px 16px',borderBottom:tab===t.key?'2px solid var(--brand-primary)':'2px solid transparent',color:tab===t.key?'var(--brand-primary)':'var(--text-muted)',fontWeight:tab===t.key?700:500,fontSize:13,background:'transparent'}}>
            <t.icon size={14} /> {t.label} <span className="badge" style={{fontSize:11,background:tab===t.key?'var(--brand-primary)':'var(--surface-secondary)',color:tab===t.key?'var(--on-brand)':'var(--text-muted)'}}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{flex:1,overflow:'auto',padding:28}}>
        {tab==='vendors' && <div className="card" style={{overflow:'hidden'}}><table className="data-table" style={{width:'100%',borderCollapse:'collapse'}}><thead>{vendorTable.getHeaderGroups().map((hg)=><tr key={hg.id}>{hg.headers.map((h)=><th key={h.id}>{h.isPlaceholder?null:flexRender(h.column.columnDef.header,h.getContext())}</th>)}</tr>)}</thead><tbody>{vendorTable.getRowModel().rows.map((row)=><tr key={row.id} style={{cursor:'pointer'}} onClick={()=>setDetailVendor(row.original)}>{row.getVisibleCells().map((cell)=><td key={cell.id}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</td>)}</tr>)}{vendorTable.getRowModel().rows.length===0 && <tr><td colSpan={vendorColumns.length} style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>No vendors found</td></tr>}</tbody></table></div>}
        {tab==='contacts' && <div className="card" style={{overflow:'hidden'}}><table className="data-table" style={{width:'100%',borderCollapse:'collapse'}}><thead>{contactTable.getHeaderGroups().map((hg)=><tr key={hg.id}>{hg.headers.map((h)=><th key={h.id}>{h.isPlaceholder?null:flexRender(h.column.columnDef.header,h.getContext())}</th>)}</tr>)}</thead><tbody>{contactTable.getRowModel().rows.map((row)=><tr key={row.id} style={row.original.isPrimary ? {background:'rgba(234,179,8,0.06)'} : undefined}>{row.getVisibleCells().map((cell)=><td key={cell.id} style={{fontSize:13}}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</td>)}</tr>)}{contactTable.getRowModel().rows.length===0 && <tr><td colSpan={contactColumns.length} style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>{vendors.length===0?'Create a vendor first.':'No contacts for this filter.'}</td></tr>}</tbody></table></div>}
        {tab==='emails' && <div className="card" style={{overflow:'hidden'}}><table className="data-table" style={{width:'100%',borderCollapse:'collapse'}}><thead>{emailTable.getHeaderGroups().map((hg)=><tr key={hg.id}>{hg.headers.map((h)=><th key={h.id}>{h.isPlaceholder?null:flexRender(h.column.columnDef.header,h.getContext())}</th>)}</tr>)}</thead><tbody>{emailTable.getRowModel().rows.map((row)=><tr key={row.id}>{row.getVisibleCells().map((cell)=><td key={cell.id} style={{fontSize:13}}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</td>)}</tr>)}{emailTable.getRowModel().rows.length===0 && <tr><td colSpan={emailColumns.length} style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>{vendors.length===0?'Create a vendor first.':'No emails for this filter.'}</td></tr>}</tbody></table></div>}
      </div>

      {/* Detail drawer */}
      {detailVendor && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:90,display:'flex',justifyContent:'flex-end'}} onClick={()=>setDetailVendor(null)}>
          <div className="card" style={{width:'100%',maxWidth:560,height:'100%',overflowY:'auto',padding:24,background:'var(--surface)',boxShadow:'-8px 0 24px rgba(0,0,0,0.12)'}} onClick={(e)=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8}}><Truck size={16} style={{color:'var(--brand-primary)'}} /><h3 style={{margin:0,fontSize:15,fontWeight:700}}>{detailVendor.name}</h3><span className={STATUS_BADGE[detailVendor.status]??'badge'} style={{fontSize:10}}>{detailVendor.status.replace('_',' ')}</span><span className="badge" style={{fontSize:10,background:'var(--surface-secondary)'}}>{CATEGORY_LABEL[detailVendor.vendorCategory]}</span></div>
                <div style={{fontSize:12,color:'var(--text-muted)',fontFamily:'monospace',marginTop:2}}>{detailVendor.code} · {detailVendor.industry||'—'} · {[detailVendor.city,detailVendor.state].filter(Boolean).join(', ')||'—'}{detailVendor.rating && <span> · ★ {detailVendor.rating}/5</span>}</div>
                {detailVendor.paymentTerms && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}><Wrench size={10} /> Payment: {detailVendor.paymentTerms} {detailVendor.msmeNumber && `· MSME: ${detailVendor.msmeNumber}`}</div>}
              </div>
              <button type="button" className="btn-ghost" onClick={()=>setDetailVendor(null)}><X size={16} /></button>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <button type="button" className="btn-secondary" style={{flex:1}} onClick={()=>{setEditingVendor(detailVendor); setIsVendorModalOpen(true)}}><Edit2 size={13} /> Edit Vendor</button>
              <button type="button" className="btn-primary" style={{flex:1}} onClick={()=>{setContactVendorPreselect(detailVendor.id); setEditingContact(null); setIsContactModalOpen(true)}}><Plus size={13} /> Add Contact</button>
            </div>

            <div style={{borderTop:'1px solid var(--border)',paddingTop:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><h4 style={{margin:0,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}><Users size={13} /> Contacts ({detailVendor.contacts.length})</h4><span style={{fontSize:11,color:'var(--text-muted)'}}>★ = Primary</span></div>
              {detailVendor.contacts.length===0 ? <div style={{padding:16,textAlign:'center',color:'var(--text-muted)',fontSize:12,background:'var(--surface-secondary)',borderRadius:8}}>No contacts yet — add the first contact for this vendor.</div> : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {detailVendor.contacts.slice().sort((a,b)=> a.isPrimary===b.isPrimary?0:a.isPrimary?-1:1).map((ct)=>(
                    <div key={ct.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'10px 12px',borderRadius:8,background:ct.isPrimary?'rgba(100,18,109,0.06)':'var(--surface-secondary)',border:ct.isPrimary?'1px solid rgba(100,18,109,0.18)':'1px solid var(--border)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
                        <div style={{width:30,height:30,borderRadius:999,background:ct.isPrimary?'var(--brand-primary)':'var(--surface-secondary)',color:ct.isPrimary?'var(--on-brand)':'var(--text-muted)',border:ct.isPrimary?'2px solid #EAB308':'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11}}>{ct.firstName[0]?.toUpperCase()}</div>
                        <div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:ct.isPrimary?700:600,display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>{ct.firstName} {ct.lastName??''} {ct.isPrimary && <span className="badge" style={{background:'#EAB308',color:'#fff',fontSize:10,display:'inline-flex',alignItems:'center',gap:2}}><Star size={8} fill="#fff" /> Primary</span>}</div><div style={{fontSize:11,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:6,marginTop:2,flexWrap:'wrap'}}>{ct.designation && <span>{ct.designation}</span>}{ct.email && <span style={{display:'inline-flex',alignItems:'center',gap:3}}><Mail size={10} />{ct.email}</span>}{ct.phone && <span style={{display:'inline-flex',alignItems:'center',gap:3}}><Phone size={10} />{ct.phone}</span>}</div></div>
                      </div>
                      <div style={{display:'flex',gap:4,flexShrink:0}}>
                        {!ct.isPrimary && <button type="button" className="btn-ghost" title="Set as primary" style={{padding:'5px 8px',border:'1px solid var(--border)',borderRadius:6,fontSize:11}} onClick={()=>handleSetPrimary(ct.id)}><Star size={12} /> Set primary</button>}
                        <button type="button" className="btn-ghost" style={{padding:'5px 8px'}} title="Edit" onClick={()=>{ const flat:ContactFlat={...ct,vendorId:detailVendor.id,vendorName:detailVendor.name,vendorCode:detailVendor.code}; setEditingContact(flat); setContactVendorPreselect(detailVendor.id); setIsContactModalOpen(true)}}><Edit2 size={13} /></button>
                        <button type="button" className="btn-ghost" style={{padding:'5px 8px',color:'var(--danger)'}} onClick={()=>{ const flat:ContactFlat={...ct,vendorId:detailVendor.id,vendorName:detailVendor.name,vendorCode:detailVendor.code}; setDeleteContactTarget(flat)}}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{borderTop:'1px solid var(--border)',paddingTop:16,marginTop:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><h4 style={{margin:0,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}><Mail size={13} /> Vendor Emails ({detailVendor.emails.length})</h4><button type="button" className="btn-secondary" style={{height:28,fontSize:11}} onClick={()=>{setEmailVendorPreselect(detailVendor.id); setEditingEmail(null); setIsEmailModalOpen(true)}}><Plus size={12} /> Add Email</button></div>
              {detailVendor.emails.length===0 ? <div style={{padding:12,textAlign:'center',color:'var(--text-muted)',fontSize:12,background:'var(--surface-secondary)',borderRadius:8}}>No extra emails.</div> : (
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {detailVendor.emails.map((em)=>(
                    <div key={em.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'8px 10px',background:'var(--surface-secondary)',borderRadius:6,border:'1px solid var(--border)'}}>
                      <div><div style={{fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><Mail size={11} />{em.email}</div>{em.type && <div style={{fontSize:11,color:'var(--text-muted)'}}>Type: {em.type}</div>}</div>
                      <div style={{display:'inline-flex',gap:4}}>
                        <button type="button" className="btn-ghost" style={{padding:'4px 6px'}} onClick={()=>{ const flat:EmailFlat={...em,vendorId:detailVendor.id,vendorName:detailVendor.name,vendorCode:detailVendor.code}; setEditingEmail(flat); setEmailVendorPreselect(detailVendor.id); setIsEmailModalOpen(true)}}><Edit2 size={12} /></button>
                        <button type="button" className="btn-ghost" style={{padding:'4px 6px',color:'var(--danger)'}} onClick={()=>{ const flat:EmailFlat={...em,vendorId:detailVendor.id,vendorName:detailVendor.name,vendorCode:detailVendor.code}; setDeleteEmailTarget(flat)}}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VENDOR */}
      {isVendorModalOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div className="card" style={{width:'100%',maxWidth:720,padding:'24px 28px',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 40px rgba(0,0,0,0.2)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}><div style={{display:'flex',alignItems:'center',gap:8}}><Truck size={18} style={{color:'var(--brand-primary)'}} /><h3 style={{margin:0,fontSize:16,fontWeight:700}}>{editingVendor ? `Edit Vendor: ${editingVendor.code}` : 'Register New Vendor'}</h3></div><button type="button" className="btn-ghost" onClick={()=>setIsVendorModalOpen(false)}><X size={16} /></button></div>
            <form onSubmit={handleSaveVendor} style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field><FieldLabel>Vendor Code *</FieldLabel><Input name="code" defaultValue={editingVendor?.code || `VEND-2026-${String(vendors.length+1).padStart(4,'0')}`} placeholder="VEND-2026-0008" required style={{textTransform:'uppercase'}} /></Field>
                <Field><FieldLabel>Vendor Name *</FieldLabel><Input name="name" defaultValue={editingVendor?.name||''} placeholder="SteelTech Suppliers" required /></Field>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field><FieldLabel>Legal Name</FieldLabel><Input name="legalName" defaultValue={editingVendor?.legalName||''} placeholder="SteelTech Suppliers Private Limited" /></Field>
                <Field><FieldLabel>Category *</FieldLabel>
                  <select name="vendorCategory" defaultValue={editingVendor?.vendorCategory||'supplier'} className="input-base" style={{height:40}}>
                    {CATEGORY_OPTIONS.map((c)=><option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field><FieldLabel>Website</FieldLabel><Input name="website" defaultValue={editingVendor?.website||''} placeholder="https://example.com" /></Field>
                <Field><FieldLabel>Inquiry Email</FieldLabel><Input name="inquiryEmail" type="email" defaultValue={editingVendor?.inquiryEmail||''} placeholder="info@vendor.com" /></Field>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field><FieldLabel>Industry</FieldLabel><Input name="industry" defaultValue={editingVendor?.industry||''} placeholder="Steel, Civil, Electrical..." /></Field>
                <Field><FieldLabel>Rating (1-5)</FieldLabel><select name="rating" defaultValue={editingVendor?.rating ? String(editingVendor.rating) : ''} className="input-base" style={{height:40}}><option value="">Select rating</option><option value="1">1 — Poor</option><option value="2">2 — Fair</option><option value="3">3 — Good</option><option value="4">4 — Very Good</option><option value="5">5 — Excellent</option></select></Field>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <Field><FieldLabel>City</FieldLabel><Input name="city" defaultValue={editingVendor?.city||''} placeholder="Mumbai" /></Field>
                <Field><FieldLabel>State</FieldLabel><Input name="state" defaultValue={editingVendor?.state||''} placeholder="Maharashtra" /></Field>
                <Field><FieldLabel>Country</FieldLabel><Input name="country" defaultValue={editingVendor?.country||'India'} placeholder="India" /></Field>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field><FieldLabel>Address Line 1</FieldLabel><Input name="addressLine1" defaultValue={editingVendor?.addressLine1||''} placeholder="Street, Building" /></Field>
                <Field><FieldLabel>Address Line 2</FieldLabel><Input name="addressLine2" defaultValue={editingVendor?.addressLine2||''} placeholder="Area, Landmark" /></Field>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <Field><FieldLabel>Postal Code</FieldLabel><Input name="postalCode" defaultValue={editingVendor?.postalCode||''} placeholder="400001" /></Field>
                <Field><FieldLabel>GSTIN</FieldLabel><Input name="gstin" defaultValue={editingVendor?.gstin||''} placeholder="27AAAAA0000A1Z5" style={{textTransform:'uppercase'}} /></Field>
                <Field><FieldLabel>PAN</FieldLabel><Input name="pan" defaultValue={editingVendor?.pan||''} placeholder="AAAAA0000A" style={{textTransform:'uppercase'}} /></Field>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field><FieldLabel>MSME/Udyam No.</FieldLabel><Input name="msmeNumber" defaultValue={editingVendor?.msmeNumber||''} placeholder="UDYAM-MH-01-0001234" /></Field>
                <Field><FieldLabel>Payment Terms</FieldLabel><Input name="paymentTerms" defaultValue={editingVendor?.paymentTerms||''} placeholder="Net 30, Advance 50%..." /></Field>
              </div>
              <Field><FieldLabel>Notes</FieldLabel><Input name="notes" defaultValue={editingVendor?.notes||''} placeholder="Optional notes, compliance remarks..." /></Field>
              <Field style={{marginTop:4}}><FieldLabel>Status</FieldLabel><select name="status" defaultValue={editingVendor?.status||'active'} className="input-base" style={{width:'100%',height:40}}><option value="active">Active</option><option value="inactive">Inactive</option><option value="blacklisted">Blacklisted</option><option value="on_hold">On Hold</option></select></Field>

              {editingVendor && (
                <div style={{borderTop:'1px solid var(--border)',paddingTop:14,marginTop:4}}>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:8}}>Contacts for this vendor — manage to set primary ★</div>
                  {editingVendor.contacts.length===0 ? <div style={{fontSize:12,color:'var(--text-muted)',background:'var(--surface-secondary)',padding:10,borderRadius:6,textAlign:'center'}}>No contacts yet. Save vendor then add contacts via drawer or Contacts tab.</div> : (
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {editingVendor.contacts.map((ct)=>(
                        <div key={ct.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 8px',background:ct.isPrimary?'rgba(100,18,109,0.06)':'var(--surface-secondary)',borderRadius:6,border:ct.isPrimary?'1px solid rgba(100,18,109,0.15)':'1px solid var(--border)'}}>
                          <div style={{fontSize:12}}><strong>{ct.firstName} {ct.lastName??''}</strong> {ct.isPrimary && <span style={{background:'#EAB308',color:'#fff',fontSize:10,padding:'1px 5px',borderRadius:999,marginLeft:4}}>★ Primary</span>} <span style={{color:'var(--text-muted)',marginLeft:6}}>{ct.email??''} {ct.phone?`· ${ct.phone}`:''}</span></div>
                          {!ct.isPrimary && <button type="button" className="btn-ghost" style={{fontSize:11,padding:'3px 6px',border:'1px solid var(--border)',borderRadius:999}} onClick={async()=>{await handleSetPrimary(ct.id)}}>Set primary</button>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{marginTop:8,display:'flex',gap:8}}>
                    <button type="button" className="btn-secondary" style={{fontSize:12}} onClick={()=>{setContactVendorPreselect(editingVendor.id); setEditingContact(null); setIsContactModalOpen(true)}}><Plus size={12} /> Add Contact</button>
                    <button type="button" className="btn-secondary" style={{fontSize:12}} onClick={()=>setDetailVendor(editingVendor)}><Users size={12} /> View all</button>
                  </div>
                  <div style={{marginTop:12}}>
                    <div style={{fontSize:12,fontWeight:600,marginBottom:4}}>Vendor Emails ({editingVendor.emails.length})</div>
                    {editingVendor.emails.length===0 ? <div style={{fontSize:12,color:'var(--text-muted)'}}>No extra emails.</div> : editingVendor.emails.map((em)=><div key={em.id} style={{fontSize:12,padding:'4px 0',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between'}}><span>{em.email} {em.type?`(${em.type})`:''}</span></div>)}
                    <button type="button" className="btn-secondary" style={{fontSize:12,marginTop:8}} onClick={()=>{setEmailVendorPreselect(editingVendor.id); setEditingEmail(null); setIsEmailModalOpen(true)}}><Plus size={12} /> Add Email</button>
                  </div>
                </div>
              )}

              <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:16}}>
                <button type="button" className="btn-secondary" onClick={()=>setIsVendorModalOpen(false)}>Cancel</button>
                <Button type="submit" disabled={isSaving} className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]">{isSaving?'Saving...':editingVendor?'Update Vendor':'Register Vendor'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONTACT */}
      {isContactModalOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:110,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div className="card" style={{width:'100%',maxWidth:520,padding:'24px 28px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h3 style={{margin:0,fontSize:16,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Users size={16} style={{color:'var(--brand-primary)'}} />{editingContact?'Edit Contact':'New Contact'}</h3><button type="button" className="btn-ghost" onClick={()=>{setIsContactModalOpen(false); setEditingContact(null); setContactVendorPreselect(null)}}><X size={16} /></button></div>
            <form onSubmit={handleSaveContact} style={{display:'flex',flexDirection:'column',gap:12}}>
              <Field><FieldLabel>Vendor *</FieldLabel><select name="vendorId" defaultValue={editingContact?.vendorId ?? contactVendorPreselect ?? (vendors[0]?.id??'')} className="input-base" style={{height:40}} required disabled={!!editingContact && !!contactVendorPreselect}><option value="">Select vendor</option>{vendors.map((v)=><option key={v.id} value={v.id}>{v.code} — {v.name}</option>)}</select>{editingContact && contactVendorPreselect && <input type="hidden" name="vendorId" value={editingContact.vendorId} />}</Field>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field><FieldLabel>First Name *</FieldLabel><Input name="firstName" defaultValue={editingContact?.firstName??''} placeholder="Ramesh" required /></Field>
                <Field><FieldLabel>Last Name</FieldLabel><Input name="lastName" defaultValue={editingContact?.lastName??''} placeholder="Kumar" /></Field>
              </div>
              <Field><FieldLabel>Email</FieldLabel><Input name="email" type="email" defaultValue={editingContact?.email??''} placeholder="ramesh@vendor.com" /></Field>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field><FieldLabel>Phone</FieldLabel><Input name="phone" defaultValue={editingContact?.phone??''} placeholder="+91 98765 43210" /></Field>
                <Field><FieldLabel>Designation</FieldLabel><Input name="designation" defaultValue={editingContact?.designation??''} placeholder="Project Manager" /></Field>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer',background:'var(--surface-secondary)',padding:'8px 10px',borderRadius:6,border:'1px solid var(--border)'}}><input type="checkbox" name="isPrimary" defaultChecked={editingContact?.isPrimary??false} /> <Star size={13} style={{color:'#EAB308'}} /> Set as <strong>primary</strong> contact (only one primary — will replace existing)</label>
              <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:8}}><button type="button" className="btn-secondary" onClick={()=>{setIsContactModalOpen(false); setEditingContact(null); setContactVendorPreselect(null)}}>Cancel</button><Button type="submit" disabled={isSaving} className="bg-[var(--brand-primary)] text-white">{isSaving?'Saving…':editingContact?'Update Contact':'Create Contact'}</Button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL */}
      {isEmailModalOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:110,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div className="card" style={{width:'100%',maxWidth:520,padding:'24px 28px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h3 style={{margin:0,fontSize:16,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Mail size={16} style={{color:'var(--brand-primary)'}} />{editingEmail?'Edit Vendor Email':'New Vendor Email'}</h3><button type="button" className="btn-ghost" onClick={()=>{setIsEmailModalOpen(false); setEditingEmail(null); setEmailVendorPreselect(null)}}><X size={16} /></button></div>
            <form onSubmit={handleSaveEmail} style={{display:'flex',flexDirection:'column',gap:12}}>
              <Field><FieldLabel>Vendor *</FieldLabel><select name="vendorId" defaultValue={editingEmail?.vendorId ?? emailVendorPreselect ?? (vendors[0]?.id??'')} className="input-base" style={{height:40}} required disabled={!!editingEmail}><option value="">Select vendor</option>{vendors.map((v)=><option key={v.id} value={v.id}>{v.code} — {v.name}</option>)}</select>{editingEmail && <input type="hidden" name="vendorId" value={editingEmail.vendorId} />}</Field>
              <Field><FieldLabel>Email *</FieldLabel><Input name="email" type="email" defaultValue={editingEmail?.email??''} placeholder="info@vendor.com" required /></Field>
              <Field><FieldLabel>Type</FieldLabel><Input name="type" defaultValue={editingEmail?.type??''} placeholder="e.g. billing, support, sales" /><div style={{fontSize:11,color:'var(--text-muted)'}}>Optional label for routing.</div></Field>
              <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:8}}><button type="button" className="btn-secondary" onClick={()=>{setIsEmailModalOpen(false); setEditingEmail(null); setEmailVendorPreselect(null)}}>Cancel</button><Button type="submit" disabled={isSaving} className="bg-[var(--brand-primary)] text-white">{isSaving?'Saving…':editingEmail?'Update Email':'Create Email'}</Button></div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATIONS */}
      {deleteVendorTarget && <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:120,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}><div className="card" style={{width:'100%',maxWidth:420,padding:'24px 28px',textAlign:'center',boxShadow:'0 20px 40px rgba(0,0,0,0.2)'}}><div style={{width:48,height:48,borderRadius:'50%',background:'rgba(220,38,38,0.1)',color:'var(--danger)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}><Trash2 size={22} /></div><h3 style={{margin:'0 0 8px',fontSize:16,fontWeight:700}}>Delete Vendor</h3><p style={{margin:0,fontSize:13,color:'var(--text-muted)',lineHeight:1.5}}>Delete <strong>{deleteVendorTarget.name}</strong> ({deleteVendorTarget.code})? This will cascade-delete all {deleteVendorTarget.contacts.length} contacts and {deleteVendorTarget.emails.length} emails.</p><div style={{display:'flex',justifyContent:'center',gap:10,marginTop:20}}><button type="button" className="btn-secondary" onClick={()=>setDeleteVendorTarget(null)}>Cancel</button><Button type="button" className="bg-[var(--danger)] text-white hover:bg-red-700" onClick={handleDeleteVendor}>Delete Vendor</Button></div></div></div>}
      {deleteContactTarget && <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:120,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}><div className="card" style={{width:'100%',maxWidth:420,padding:'24px 28px',textAlign:'center'}}><h3 style={{margin:'0 0 8px',fontSize:16,fontWeight:700}}>Delete Contact</h3><p style={{margin:0,fontSize:13,color:'var(--text-muted)'}}>Delete <strong>{deleteContactTarget.firstName} {deleteContactTarget.lastName??''}</strong> ({deleteContactTarget.email??'no email'}) from {deleteContactTarget.vendorName}?</p><div style={{display:'flex',justifyContent:'center',gap:10,marginTop:20}}><button type="button" className="btn-secondary" onClick={()=>setDeleteContactTarget(null)}>Cancel</button><Button type="button" className="bg-[var(--danger)] text-white" onClick={handleDeleteContact}>Delete Contact</Button></div></div></div>}
      {deleteEmailTarget && <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:120,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}><div className="card" style={{width:'100%',maxWidth:420,padding:'24px 28px',textAlign:'center'}}><h3 style={{margin:'0 0 8px',fontSize:16,fontWeight:700}}>Delete Vendor Email</h3><p style={{margin:0,fontSize:13,color:'var(--text-muted)'}}>Delete email <strong>{deleteEmailTarget.email}</strong> from {deleteEmailTarget.vendorName}?</p><div style={{display:'flex',justifyContent:'center',gap:10,marginTop:20}}><button type="button" className="btn-secondary" onClick={()=>setDeleteEmailTarget(null)}>Cancel</button><Button type="button" className="bg-[var(--danger)] text-white" onClick={handleDeleteEmail}>Delete Email</Button></div></div></div>}
    </div>
  )
}
