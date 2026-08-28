import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  LayoutDashboard,
  Users,
  FileText,
  FolderKanban,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Settings,
  MessageSquare,
  CheckSquare,
  HeadphonesIcon,
  Star,
  Clock,
  Receipt,
  ShoppingCart,
  CreditCard,
  Wallet,
  Package,
  DollarSign,
  FileSpreadsheet,
  UserCog,
  Building2,
  Truck,
  Landmark,
  Tag,
  Activity,
  Monitor,
  BookOpen,
  ChevronLeft,
  LogOut,
} from 'lucide-react'
import { initialsFromName, primaryRoleName, type CrmUserView } from '~/lib/user-display'

type Page = string

interface Props {
  currentPage: Page
  onNavigate: (page: Page) => void
  /** Signed-in account; omit for a signed-out fallback. */
  user?: CrmUserView | null
  /** Signs the user out and redirects; omit to hide the logout item. */
  onLogout?: () => Promise<void>
}

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  children?: NavItem[]
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Core',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
      { id: 'leads', label: 'Leads', icon: <Users size={16} /> },
      { id: 'proposals', label: 'Proposals', icon: <FileText size={16} /> },
      { id: 'projects', label: 'Projects', icon: <FolderKanban size={16} /> },
    ],
  },
  {
    label: 'Reports',
    items: [
      {
        id: 'reports',
        label: 'Reports',
        icon: <BarChart2 size={16} />,
        children: [
          { id: 'reports-employee', label: 'Employee Report', icon: <Users size={14} /> },
          { id: 'reports-timesheet', label: 'Timesheet Report', icon: <Clock size={14} /> },
          { id: 'reports-manhours', label: 'Manhours Billing', icon: <DollarSign size={14} /> },
          { id: 'reports-balances', label: 'Outstanding Balances', icon: <Wallet size={14} /> },
          { id: 'reports-project-status', label: 'Project Status', icon: <FolderKanban size={14} /> },
          { id: 'reports-attendance', label: 'Attendance Report', icon: <CheckSquare size={14} /> },
        ],
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'client-quotations', label: 'Client Quotations', icon: <FileText size={16} /> },
      { id: 'vendor-quotations', label: 'Vendor Quotations', icon: <Truck size={16} /> },
      { id: 'purchase-orders', label: 'Purchase Orders', icon: <ShoppingCart size={16} /> },
      { id: 'sale-invoices', label: 'Sale Invoices', icon: <Receipt size={16} /> },
      { id: 'purchase-invoices', label: 'Purchase Invoices', icon: <Receipt size={16} /> },
      { id: 'payment-received', label: 'Payment Received', icon: <CreditCard size={16} /> },
      { id: 'payment-issued', label: 'Payment Issued', icon: <Wallet size={16} /> },
      { id: 'expenses', label: 'Expenses', icon: <DollarSign size={16} /> },
      { id: 'cash-voucher', label: 'Cash Voucher', icon: <FileSpreadsheet size={16} /> },
      { id: 'material-req', label: 'Material Requisition', icon: <Package size={16} /> },
      { id: 'salary-sheet', label: 'Salary Sheet', icon: <FileSpreadsheet size={16} /> },
      { id: 'salary-slip', label: 'Salary Slip', icon: <FileText size={16} /> },
      { id: 'activity-logs', label: 'Activity Logs', icon: <Activity size={16} /> },
      { id: 'live-monitoring', label: 'Live Monitoring', icon: <Monitor size={16} /> },
      { id: 'todos', label: 'Todos', icon: <CheckSquare size={16} /> },
    ],
  },
  {
    label: 'Masters',
    items: [
      {
        id: 'masters',
        label: 'Masters',
        icon: <Landmark size={16} />,
        children: [
          { id: 'employee-master', label: 'Employee Master', icon: <UserCog size={14} /> },
          { id: 'user-master', label: 'User Master', icon: <Users size={14} /> },
          { id: 'activity-master', label: 'Activity Master', icon: <Activity size={14} /> },
          { id: 'software-master', label: 'Software Master', icon: <Settings size={14} /> },
          { id: 'deliverables-master', label: 'Deliverables Master', icon: <BookOpen size={14} /> },
          { id: 'company-master', label: 'Company Master', icon: <Building2 size={14} /> },
          { id: 'vendor-master', label: 'Vendor Master', icon: <Truck size={14} /> },
          { id: 'bank-master', label: 'Bank Master', icon: <Landmark size={14} /> },
          { id: 'description-master', label: 'Description Master', icon: <FileText size={14} /> },
          { id: 'expense-category', label: 'Expense Category', icon: <Tag size={14} /> },
          { id: 'holiday-master', label: 'Holiday Master', icon: <Clock size={14} /> },
          { id: 'account-head', label: 'Account Head Master', icon: <Landmark size={14} /> },
        ],
      },
    ],
  },
  {
    label: 'Collaboration',
    items: [
      { id: 'messages', label: 'Messages', icon: <MessageSquare size={16} /> },
      { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={16} /> },
      { id: 'support', label: 'Support Tickets', icon: <HeadphonesIcon size={16} /> },
    ],
  },
]

const FAVORITES = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={14} /> },
  { id: 'projects', label: 'Projects', icon: <FolderKanban size={14} /> },
  { id: 'sale-invoices', label: 'Sale Invoices', icon: <Receipt size={14} /> },
]

const RECENTS = [
  { id: 'project-detail', label: 'ADNOC Gas Plant Expansion', icon: <FolderKanban size={14} /> },
  { id: 'employee-profile', label: 'Sara Mohammed', icon: <Users size={14} /> },
  { id: 'proposals', label: 'Proposals', icon: <FileText size={14} /> },
]

const ACCOUNT_MENU_ID = 'sidebar-account-menu'

export default function Sidebar({ currentPage, onNavigate, user, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    reports: false,
    masters: false,
  })
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [menuCoords, setMenuCoords] = useState<{
    top: number
    left: number
    transform: string
  } | null>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const gearButtonRef = useRef<HTMLButtonElement>(null)

  // Close the account menu on collapse toggle, outside pointer press, or
  // Escape. Focus returns to the gear trigger on Escape so keyboard users
  // don't lose their place.
  useEffect(() => {
    if (!accountMenuOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      // The menu is portaled to document.body, so check both anchors.
      if (accountRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return
      }
      setAccountMenuOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false)
        gearButtonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [accountMenuOpen])

  // Collapsing/expanding moves the trigger — never leave a stale-positioned menu.
  useEffect(() => {
    setAccountMenuOpen(false)
  }, [collapsed])

  function toggleAccountMenu() {
    if (!accountMenuOpen && gearButtonRef.current) {
      const rect = gearButtonRef.current.getBoundingClientRect()
      const MENU_WIDTH = 220
      const MENU_MARGIN = 8
      // Open upward from the trigger; anchored sideways when collapsed.
      const left = collapsed
        ? Math.min(rect.right + 10, window.innerWidth - MENU_WIDTH - MENU_MARGIN)
        : Math.min(rect.left, window.innerWidth - MENU_WIDTH - MENU_MARGIN)
      const top = Math.max(MENU_MARGIN, collapsed ? rect.bottom : rect.top - MENU_MARGIN)
      setMenuCoords({ top, left, transform: 'translateY(-100%)' })
    }
    setAccountMenuOpen((open) => !open)
  }

  async function handleLogout() {
    if (!onLogout || isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError(null)
    try {
      await onLogout()
      setAccountMenuOpen(false)
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : 'Failed to sign out. Please try again.',
      )
    } finally {
      setIsLoggingOut(false)
    }
  }

  const displayName = user?.fullName || 'Guest'
  const displayRole = primaryRoleName(user) ?? 'Not signed in'

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function isActive(id: string) {
    return currentPage === id
  }

  const width = collapsed ? 64 : 240

  return (
    <aside
      style={{
        width,
        minWidth: width,
        height: '100vh',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? '18px 0' : '18px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 10,
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #64126D, #86288F)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ color: 'white', fontSize: 14, fontWeight: 800 }}>A</span>
            </div>
            <div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                }}
              >
                AccentCRM
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--text-muted)',
                  lineHeight: 1.2,
                }}
              >
                Engineering Suite
              </div>
            </div>
          </div>
        )}
        {collapsed && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #64126D, #86288F)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: 'white', fontSize: 14, fontWeight: 800 }}>A</span>
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={() => setCollapsed(true)}
            className="btn-ghost"
            style={{ padding: '4px 6px' }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Scrollable nav */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: collapsed ? '8px 6px' : '8px 10px',
        }}
      >
        {/* Favorites */}
        {!collapsed && (
          <>
            <div className="sidebar-group-label" style={{ marginTop: 12 }}>
              <Star size={10} style={{ display: 'inline', marginRight: 4 }} />
              Favorites
            </div>
            {FAVORITES.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`sidebar-link ${isActive(item.id) ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                {item.icon}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              </button>
            ))}
            <div className="sidebar-group-label" style={{ marginTop: 12 }}>
              <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
              Recents
            </div>
            {RECENTS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`sidebar-link ${isActive(item.id) ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                {item.icon}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              </button>
            ))}
          </>
        )}

        {/* Main nav groups */}
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && <div className="sidebar-group-label">{group.label}</div>}
            {group.items.map((item) => (
              <div key={item.id}>
                {item.children ? (
                  <>
                    <button
                      type="button"
                      className={`sidebar-link ${item.children.some((c) => isActive(c.id)) ? 'active' : ''}`}
                      onClick={() =>
                        collapsed ? setCollapsed(false) : toggleGroup(item.id)
                      }
                      style={{ justifyContent: collapsed ? 'center' : undefined }}
                      aria-label={
                        collapsed
                          ? `Expand ${item.label} menu`
                          : `Toggle ${item.label} menu`
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      {item.icon}
                      {!collapsed && (
                        <>
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {expandedGroups[item.id] ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </>
                      )}
                    </button>
                    {!collapsed && expandedGroups[item.id] && (
                      <div style={{ paddingLeft: 12 }}>
                        {item.children.map((child) => (
                          <button
                            type="button"
                            key={child.id}
                            className={`sidebar-link ${isActive(child.id) ? 'active' : ''}`}
                            onClick={() => onNavigate(child.id)}
                          >
                            {child.icon}
                            <span>{child.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className={`sidebar-link ${isActive(item.id) ? 'active' : ''}`}
                    onClick={() => onNavigate(item.id)}
                    aria-label={item.label}
                    title={collapsed ? item.label : undefined}
                  >
                    {item.icon}
                    {!collapsed && (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Account footer — signed-in identity + settings gear at the end of the sidebar */}
      <div
        ref={accountRef}
        style={{
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 30,
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: collapsed ? 'center' : 'center',
          gap: collapsed ? 2 : 10,
          padding: collapsed ? '8px 6px' : '12px 14px',
        }}
      >
        {!collapsed && (
          <>
            <div
              className="avatar"
              style={{
                background: 'linear-gradient(135deg,#64126D,#86288F)',
                fontSize: 12,
              }}
              aria-hidden="true"
            >
              {initialsFromName(user?.fullName ?? '')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayRole}
              </div>
            </div>
          </>
        )}
        <button
          ref={gearButtonRef}
          type="button"
          className="btn-ghost"
          aria-label="Account settings"
          aria-expanded={accountMenuOpen}
          aria-controls={accountMenuOpen ? ACCOUNT_MENU_ID : undefined}
          title="Account settings"
          style={{ padding: 6, borderRadius: 8, flexShrink: 0 }}
          onClick={toggleAccountMenu}
        >
          <Settings size={15} />
        </button>
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div
          style={{
            padding: '0 6px 8px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            aria-label="Expand sidebar"
            className="btn-ghost"
            style={{ width: '100%', justifyContent: 'center', padding: '8px' }}
            onClick={() => setCollapsed(false)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Account settings menu — portaled so the sidebar's overflow:hidden never clips it */}
      {accountMenuOpen &&
        menuCoords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            id={ACCOUNT_MENU_ID}
            style={{
              position: 'fixed',
              top: menuCoords.top,
              left: menuCoords.left,
              transform: menuCoords.transform,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              padding: 6,
              minWidth: 220,
              zIndex: 200,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: 4,
              }}
            >
              <div
                className="avatar"
                style={{
                  background: 'linear-gradient(135deg,#64126D,#86288F)',
                  fontSize: 11,
                  width: 28,
                  height: 28,
                }}
                aria-hidden="true"
              >
                {initialsFromName(user?.fullName ?? '')}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayName}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                  {displayRole}
                </div>
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                className="sidebar-link"
                style={{ borderRadius: 6, color: 'var(--text-secondary)' }}
                disabled={isLoggingOut}
                aria-busy={isLoggingOut}
                onClick={() => void handleLogout()}
              >
                <LogOut size={14} aria-hidden="true" />
                {isLoggingOut ? 'Signing out…' : 'Log out'}
              </button>
            )}
            {logoutError && (
              <p
                role="status"
                style={{
                  margin: '6px 4px 2px',
                  fontSize: 11.5,
                  color: 'var(--danger, #b3261e)',
                }}
              >
                {logoutError}
              </p>
            )}
          </div>,
          document.body,
        )}
    </aside>
  )
}
