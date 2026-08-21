import { useState } from 'react'
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
} from 'lucide-react'

type Page = string

interface Props {
  currentPage: Page
  onNavigate: (page: Page) => void
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
      { id: 'quotations', label: 'Quotations', icon: <FileText size={16} /> },
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

export default function Sidebar({ currentPage, onNavigate }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    reports: false,
    masters: false,
  })

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

      {/* Expand button when collapsed */}
      {collapsed && (
        <div
          style={{
            padding: '8px 6px',
            borderTop: '1px solid var(--border)',
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

      {/* User */}
      {!collapsed && (
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            className="avatar"
            style={{
              background: 'linear-gradient(135deg,#64126D,#86288F)',
              fontSize: 12,
            }}
          >
            SM
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
              Sara Mohammed
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Project Manager
            </div>
          </div>
          <Settings
            size={15}
            style={{ color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
          />
        </div>
      )}
    </aside>
  )
}
