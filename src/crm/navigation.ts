import { useLocation, useRouter } from '@tanstack/react-router'

export function pageFromPath(pathname: string): string {
  if (pathname === '/') return 'dashboard'
  if (pathname === '/projects') return 'projects'
  if (pathname.startsWith('/projects/')) return 'project-detail'
  if (pathname === '/leads') return 'leads'
  if (pathname === '/proposals') return 'proposals'
  if (pathname.startsWith('/proposals/')) return 'proposals'
  if (pathname === '/finance') return 'financial-dashboard'
  if (pathname === '/masters/users') return 'user-master'
  if (pathname.startsWith('/masters/')) {
    return decodeURIComponent(pathname.slice('/masters/'.length))
  }
  if (pathname === '/employees') return 'employee-master'
  if (pathname.startsWith('/employees/')) return 'employee-profile'
  if (pathname === '/reports') return 'reports'
  if (pathname.startsWith('/reports/')) {
    return decodeURIComponent(pathname.slice('/reports/'.length))
  }
  // Static client/vendor quotation & purchase order routes shadow the generic /admin/$module page.
  if (pathname.startsWith('/admin/client-quotations')) return 'client-quotations'
  if (pathname.startsWith('/admin/vendor-quotations')) return 'vendor-quotations'
  if (pathname.startsWith('/admin/client-purchase-orders')) return 'client-purchase-orders'
  if (pathname.startsWith('/admin/vendor-purchase-orders')) return 'vendor-purchase-orders'
  if (pathname.startsWith('/admin/payment-received') || pathname.startsWith('/admin/payments-received')) return 'payment-received'
  if (pathname.startsWith('/admin/payment-issued') || pathname.startsWith('/admin/payments-released') || pathname.startsWith('/admin/payment-released')) return 'payment-issued'
  // Legacy aliases — keep for old links/bookmarks.
  if (pathname.startsWith('/admin/quotations')) return 'client-quotations'
  if (pathname.startsWith('/admin/quotation-outgoing')) return 'vendor-quotations'
  if (pathname.startsWith('/admin/purchase-orders-incoming') || pathname.startsWith('/admin/incoming-purchase-orders') || pathname.startsWith('/admin/client-pos')) return 'client-purchase-orders'
  if (pathname.startsWith('/admin/purchase-orders-outgoing') || pathname.startsWith('/admin/outgoing-purchase-orders') || pathname.startsWith('/admin/vendor-pos')) return 'vendor-purchase-orders'
  if (pathname === '/admin/purchase-orders') return 'client-purchase-orders'
  if (pathname.startsWith('/admin/')) {
    return decodeURIComponent(pathname.slice('/admin/'.length))
  }
  if (pathname === '/tasks') return 'tasks'
  if (pathname === '/messages') return 'messages'
  if (pathname === '/support' || pathname.startsWith('/support/')) return 'support'
  if (pathname.startsWith('/module/')) {
    return decodeURIComponent(pathname.slice('/module/'.length))
  }
  return 'dashboard'
}

export function useCrmNavigation() {
  const router = useRouter()

  return (page: string) => {
    switch (page) {
      case 'dashboard':
        return router.navigate({ to: '/' })
      case 'projects':
        return router.navigate({ to: '/projects' })
      case 'project-detail':
        return router.navigate({ to: '/projects/$projectId', params: { projectId: 'adnoc-gas-plant' } })
      case 'leads':
        return router.navigate({ to: '/leads' })
      case 'proposals':
        return router.navigate({ to: '/proposals' })
      case 'financial-dashboard':
      case 'sale-invoices':
        return router.navigate({ to: '/finance' })
      case 'payment-received':
      case 'payments-received':
        return router.navigate({ to: '/admin/payment-received' })
      case 'payment-issued':
      case 'payments-released':
      case 'payment-released':
        return router.navigate({ to: '/admin/payment-issued' })
      case 'employee-profile':
        return router.navigate({ to: '/employees/$employeeId', params: { employeeId: 'sara-mohammed' } })
      case 'user-master':
        return router.navigate({ to: '/masters/users' })
      case 'employee-master':
      case 'activity-master':
      case 'software-master':
      case 'deliverables-master':
      case 'company-master':
      case 'vendor-master':
      case 'bank-master':
      case 'description-master':
      case 'expense-category':
      case 'holiday-master':
      case 'account-head':
        return router.navigate({ to: '/masters/$master', params: { master: page } })
      case 'reports':
        return router.navigate({ to: '/reports' })
      case 'reports-employee':
      case 'reports-timesheet':
      case 'reports-manhours':
      case 'reports-balances':
      case 'reports-project-status':
      case 'reports-attendance':
        return router.navigate({ to: '/reports/$report', params: { report: page } })
      case 'client-quotations':
        return router.navigate({ to: '/admin/client-quotations' })
      case 'vendor-quotations':
        return router.navigate({ to: '/admin/vendor-quotations' })
      case 'client-purchase-orders':
      case 'purchase-orders-incoming':
      case 'incoming-purchase-orders':
      case 'client-pos':
        return router.navigate({ to: '/admin/client-purchase-orders' })
      case 'vendor-purchase-orders':
      case 'purchase-orders-outgoing':
      case 'outgoing-purchase-orders':
      case 'vendor-pos':
        return router.navigate({ to: '/admin/vendor-purchase-orders' })
      // Legacy aliases
      case 'quotations':
        return router.navigate({ to: '/admin/client-quotations' })
      case 'quotation-outgoing':
        return router.navigate({ to: '/admin/vendor-quotations' })
      case 'purchase-orders':
        return router.navigate({ to: '/admin/client-purchase-orders' })
      case 'purchase-invoices':
      case 'cash-voucher':
      case 'material-req':
      case 'salary-sheet':
      case 'salary-slip':
      case 'activity-logs':
      case 'live-monitoring':
        return router.navigate({ to: '/admin/$module', params: { module: page } })
      case 'tasks':
        return router.navigate({ to: '/tasks' })
      case 'messages':
        return router.navigate({ to: '/messages' })
      case 'support':
        return router.navigate({ to: '/support' })
      default:
        return router.navigate({ to: '/module/$module', params: { module: page } })
    }
  }
}
export function useCurrentCrmPage() {
  const location = useLocation()
  return pageFromPath(location.pathname)
}
