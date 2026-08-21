import { useState } from 'react';
import { Search, Bell, Plus, Command, MessageSquare, ChevronDown } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads Pipeline',
  proposals: 'Proposals',
  projects: 'Projects',
  'project-detail': 'Project Detail',
  'employee-profile': 'Employee Profile',
  reports: 'Reports',
  'reports-employee': 'Employee Report',
  'reports-timesheet': 'Timesheet Report',
  'reports-manhours': 'Manhours Billing',
  'reports-balances': 'Outstanding Balances',
  'reports-project-status': 'Project Status',
  'reports-attendance': 'Attendance Report',
  quotations: 'Quotations',
  'purchase-orders': 'Purchase Orders',
  'sale-invoices': 'Sale Invoices',
  'purchase-invoices': 'Purchase Invoices',
  'payment-received': 'Payment Received',
  'payment-issued': 'Payment Issued',
  expenses: 'Expenses',
  'cash-voucher': 'Cash Voucher',
  'material-req': 'Material Requisition',
  'salary-sheet': 'Salary Sheet',
  'salary-slip': 'Salary Slip',
  'activity-logs': 'Activity Logs',
  'live-monitoring': 'Live Monitoring',
  todos: 'Todos',
  'employee-master': 'Employee Master',
  'user-master': 'User Master',
  'activity-master': 'Activity Master',
  'software-master': 'Software Master',
  'deliverables-master': 'Deliverables Master',
  'company-master': 'Company Master',
  'vendor-master': 'Vendor Master',
  'bank-master': 'Bank Master',
  'description-master': 'Description Master',
  'expense-category': 'Expense Category',
  'holiday-master': 'Holiday Master',
  'account-head': 'Account Head Master',
  messages: 'Messages',
  tasks: 'Tasks',
  support: 'Support Tickets',
  'financial-dashboard': 'Financial Dashboard',
};

interface Props {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function TopBar({ currentPage, onNavigate }: Props) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  return (
    <header style={{
      height: 56,
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 12,
      flexShrink: 0,
      position: 'relative',
      zIndex: 20,
    }}>
      {/* Page title */}
      <div style={{ minWidth: 160, flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
          {PAGE_TITLES[currentPage] ?? currentPage}
        </h1>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Accent Techno Solutions
        </div>
      </div>

      {/* Search */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: searchFocused ? 'var(--surface)' : 'var(--surface-secondary)',
            border: `1px solid ${searchFocused ? 'var(--brand-primary)' : 'var(--border)'}`,
            borderRadius: 8, padding: '7px 12px', width: '100%', maxWidth: 480,
            boxShadow: searchFocused ? '0 0 0 3px rgba(100,18,109,0.08)' : 'none',
            transition: 'all 0.15s',
          }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="search"
            aria-label="Search projects, leads, and clients"
            placeholder="Search projects, leads, clients..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, color: 'var(--text-primary)', width: '100%' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <kbd style={{ background: 'var(--border)', borderRadius: 4, padding: '1px 5px', fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'inherit' }}>⌘</kbd>
            <kbd style={{ background: 'var(--border)', borderRadius: 4, padding: '1px 5px', fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'inherit' }}>K</kbd>
          </div>
        </div>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {/* Command palette */}
        <button aria-label="Open command palette" className="topbar-icon-btn" title="Command Palette">
          <Command size={16} aria-hidden="true" />
        </button>

        {/* Messages */}
        <button aria-label="Open messages" className="topbar-icon-btn" onClick={() => onNavigate('messages')} title="Messages">
          <MessageSquare size={16} aria-hidden="true" />
          <span className="notification-dot" aria-hidden="true" />
        </button>

        {/* Notifications */}
        <button aria-label="Open notifications" className="topbar-icon-btn" title="Notifications">
          <Bell size={16} aria-hidden="true" />
          <span className="notification-dot" aria-hidden="true" />
        </button>

        {/* Quick create */}
        <div style={{ position: 'relative' }}>
          <button className="btn-primary" style={{ padding: '7px 14px', gap: 6 }}
            onClick={() => setShowQuickCreate(v => !v)}>
            <Plus size={15} />
            <span>New</span>
            <ChevronDown size={13} />
          </button>
          {showQuickCreate && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              padding: 6, minWidth: 180, zIndex: 100,
            }} onBlur={() => setShowQuickCreate(false)}>
              {['New Project', 'New Lead', 'New Proposal', 'New Invoice', 'New Task'].map(item => (
                <button key={item} className="sidebar-link" style={{ borderRadius: 6, fontSize: 13 }}
                  onClick={() => setShowQuickCreate(false)}>
                  <Plus size={13} />
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 4px' }} />

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 8, transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <div className="avatar" style={{ background: 'linear-gradient(135deg,#64126D,#86288F)', width: 30, height: 30, fontSize: 11 }}>SM</div>
          <div style={{ fontSize: 12.5 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Sara M.</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
}
