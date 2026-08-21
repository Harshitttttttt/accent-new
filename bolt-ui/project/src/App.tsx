import { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Leads from './pages/Leads';
import Proposals from './pages/Proposals';
import FinancialDashboard from './pages/FinancialDashboard';
import EmployeeProfile from './pages/EmployeeProfile';
import EmployeeDirectory from './pages/EmployeeDirectory';
import Reports from './pages/Reports';
import Tasks from './pages/Tasks';
import Messages from './pages/Messages';
import GenericPage from './pages/GenericPage';

export default function App() {
  const [page, setPage] = useState('dashboard');

  function navigate(p: string) {
    setPage(p);
  }

  function renderPage() {
    switch (page) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} />;
      case 'projects':
      case 'project-detail':
        return page === 'project-detail' ? <ProjectDetail onNavigate={navigate} /> : <Projects onNavigate={navigate} />;
      case 'leads':
        return <Leads />;
      case 'proposals':
        return <Proposals />;
      case 'employee-profile':
        return <EmployeeProfile onNavigate={navigate} />;
      case 'employee-master':
      case 'user-master':
        return <EmployeeDirectory onNavigate={navigate} />;
      case 'reports':
      case 'reports-employee':
      case 'reports-timesheet':
      case 'reports-manhours':
      case 'reports-balances':
      case 'reports-project-status':
      case 'reports-attendance':
        return <Reports />;
      case 'tasks':
      case 'todos':
        return <Tasks />;
      case 'messages':
        return <Messages />;
      case 'sale-invoices':
      case 'payment-received':
      case 'payment-issued':
        return <FinancialDashboard />;
      case 'quotations':
        return <GenericPage title="Quotations" description="Manage client quotations" columns={['ID', 'Quotation No.', 'Description', 'Amount', 'Status', 'Date']} />;
      case 'purchase-orders':
        return <GenericPage title="Purchase Orders" description="Track procurement orders" columns={['ID', 'PO Number', 'Vendor', 'Amount', 'Status', 'Date']} />;
      case 'purchase-invoices':
        return <GenericPage title="Purchase Invoices" description="Vendor invoices received" columns={['ID', 'Invoice No.', 'Vendor', 'Amount', 'Status', 'Date']} />;
      case 'expenses':
        return <GenericPage title="Expenses" description="Employee expense submissions" columns={['ID', 'Reference', 'Description', 'Amount', 'Status', 'Date']} />;
      case 'cash-voucher':
        return <GenericPage title="Cash Vouchers" description="Cash payment vouchers" columns={['ID', 'Voucher No.', 'Description', 'Amount', 'Status', 'Date']} />;
      case 'material-req':
        return <GenericPage title="Material Requisitions" description="Project material requests" columns={['ID', 'Req No.', 'Project', 'Amount', 'Status', 'Date']} />;
      case 'salary-sheet':
        return <GenericPage title="Salary Sheet" description="Monthly payroll summary" columns={['ID', 'Employee', 'Month', 'Net Pay', 'Status', 'Date']} />;
      case 'salary-slip':
        return <GenericPage title="Salary Slips" description="Individual payslips" columns={['ID', 'Employee', 'Month', 'Net Pay', 'Status', 'Date']} />;
      case 'activity-logs':
        return <GenericPage title="Activity Logs" description="System audit trail" columns={['ID', 'User', 'Action', 'Module', 'IP', 'Timestamp']} />;
      case 'live-monitoring':
        return <GenericPage title="Live Monitoring" description="Real-time project monitoring dashboard" columns={['ID', 'Project', 'Status', 'Progress', 'Team Online', 'Last Update']} />;
      case 'activity-master':
        return <GenericPage title="Activity Master" description="Define project activities" columns={['ID', 'Activity Code', 'Description', 'Discipline', 'Unit', 'Status']} />;
      case 'software-master':
        return <GenericPage title="Software Master" description="Engineering software inventory" columns={['ID', 'Software', 'Vendor', 'Licenses', 'Cost', 'Expiry']} />;
      case 'deliverables-master':
        return <GenericPage title="Deliverables Master" description="Deliverable type catalog" columns={['ID', 'Code', 'Description', 'Discipline', 'Format', 'Status']} />;
      case 'company-master':
        return <GenericPage title="Company Master" description="Client company registry" columns={['ID', 'Company', 'Contact', 'Email', 'Phone', 'Status']} />;
      case 'vendor-master':
        return <GenericPage title="Vendor Master" description="Supplier and vendor registry" columns={['ID', 'Vendor', 'Category', 'Contact', 'Phone', 'Status']} />;
      case 'bank-master':
        return <GenericPage title="Bank Master" description="Bank account registry" columns={['ID', 'Bank', 'Account', 'Currency', 'Balance', 'Status']} />;
      case 'description-master':
        return <GenericPage title="Description Master" description="Standard descriptions for line items" columns={['ID', 'Code', 'Description', 'Category', 'Unit', 'Status']} />;
      case 'expense-category':
        return <GenericPage title="Expense Categories" description="Define expense classification" columns={['ID', 'Category', 'Code', 'GL Account', 'Type', 'Status']} />;
      case 'holiday-master':
        return <GenericPage title="Holiday Master" description="Public and company holidays" columns={['ID', 'Holiday', 'Date', 'Type', 'Location', 'Status']} />;
      case 'account-head':
        return <GenericPage title="Account Head Master" description="Chart of accounts" columns={['ID', 'Account', 'Code', 'Type', 'Parent', 'Status']} />;
      case 'support':
        return <GenericPage title="Support Tickets" description="IT and admin support requests" columns={['ID', 'Ticket No.', 'Subject', 'Priority', 'Status', 'Date']} />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar currentPage={page} onNavigate={navigate} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar currentPage={page} onNavigate={navigate} />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
