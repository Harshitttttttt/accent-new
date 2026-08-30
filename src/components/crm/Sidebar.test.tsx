import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'

describe('Sidebar Component', () => {
  it('renders AccentCRM logo and navigation groups', () => {
    const onNavigate = vi.fn()
    render(<Sidebar currentPage="dashboard" onNavigate={onNavigate} />)

    expect(screen.getByText('AccentCRM')).toBeInTheDocument()
    expect(screen.getByText('Engineering Suite')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Dashboard' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Projects' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Leads' })).toBeInTheDocument()
  })

  it('triggers onNavigate when a nav item is clicked', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<Sidebar currentPage="dashboard" onNavigate={onNavigate} />)

    const projectButtons = screen.getAllByRole('button', { name: 'Projects' })
    await user.click(projectButtons[0]!)
    expect(onNavigate).toHaveBeenCalledWith('projects')
  })

  it('toggles the Masters dropdown and reveals master items', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<Sidebar currentPage="dashboard" onNavigate={onNavigate} />)

    expect(screen.queryByRole('button', { name: 'Employee Master' })).not.toBeInTheDocument()

    const mastersToggle = screen.getByRole('button', { name: /toggle masters menu/i })
    await user.click(mastersToggle)

    expect(await screen.findByRole('button', { name: 'Employee Master' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'User Master' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Software Master' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'User Master' }))
    expect(onNavigate).toHaveBeenCalledWith('user-master')
  })

  it('collapses and expands the sidebar', async () => {
    const user = userEvent.setup()
    render(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />)

    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i })
    await user.click(collapseBtn)

    const expandBtn = screen.getByRole('button', { name: /expand sidebar/i })
    expect(expandBtn).toBeInTheDocument()

    await user.click(expandBtn)
    expect(screen.getByText('AccentCRM')).toBeInTheDocument()
  })

  it('shows the signed-in user name and role', () => {
    render(
      <Sidebar
        currentPage="dashboard"
        onNavigate={vi.fn()}
        user={{ fullName: 'Harshit Mestry', username: 'harshit', roleNames: ['Administrator'] }}
      />,
    )

    expect(screen.getByText('Harshit Mestry')).toBeInTheDocument()
    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('HM', { selector: '.avatar' })).toBeInTheDocument()
  })

  it('falls back to a guest label when no user is provided', () => {
    render(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />)

    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByText('Not signed in')).toBeInTheDocument()
  })

  it('opens the account menu from the settings gear and offers logout', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn().mockResolvedValue(undefined)
    render(
      <Sidebar
        currentPage="dashboard"
        onNavigate={vi.fn()}
        user={{ fullName: 'Harshit Mestry', username: 'harshit', roleNames: ['Administrator'] }}
        onLogout={onLogout}
      />,
    )

    const gear = screen.getByRole('button', { name: /account settings/i })
    expect(gear).toHaveAttribute('aria-expanded', 'false')

    await user.click(gear)

    const menu = document.getElementById('sidebar-account-menu')
    expect(menu).not.toBeNull()
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
    expect(gear).toHaveAttribute('aria-expanded', 'true')
    // Menu repeats identity so it stays readable in collapsed mode too.
    expect(screen.getAllByText('Harshit Mestry').length).toBeGreaterThan(1)
  })

  it('invokes onLogout when Log out is clicked', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn().mockResolvedValue(undefined)
    render(
      <Sidebar
        currentPage="dashboard"
        onNavigate={vi.fn()}
        user={{ fullName: 'Harshit Mestry', username: 'harshit', roleNames: ['Administrator'] }}
        onLogout={onLogout}
      />,
    )

    await user.click(screen.getByRole('button', { name: /account settings/i }))
    await user.click(screen.getByRole('button', { name: /log out/i }))

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('shows an error status when logout fails', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn().mockRejectedValue(new Error('Network down'))
    render(
      <Sidebar
        currentPage="dashboard"
        onNavigate={vi.fn()}
        user={{ fullName: 'Harshit Mestry', username: 'harshit', roleNames: ['Administrator'] }}
        onLogout={onLogout}
      />,
    )

    await user.click(screen.getByRole('button', { name: /account settings/i }))
    await user.click(screen.getByRole('button', { name: /log out/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/network down/i)
    // Menu stays open so the user can retry.
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })

  it('closes the account menu on Escape and restores focus to the gear', async () => {
    const user = userEvent.setup()
    render(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />)

    const gear = screen.getByRole('button', { name: /account settings/i })
    await user.click(gear)
    expect(document.getElementById('sidebar-account-menu')).not.toBeNull()

    await user.keyboard('{Escape}')

    expect(document.getElementById('sidebar-account-menu')).toBeNull()
    expect(gear).toHaveFocus()
  })

  it('renders all domain group labels', () => {
    render(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />)

    expect(screen.getByText('Core', { selector: '.sidebar-group-label' })).toBeInTheDocument()
    expect(screen.getByText('Commercial', { selector: '.sidebar-group-label' })).toBeInTheDocument()
    expect(screen.getByText('Operations', { selector: '.sidebar-group-label' })).toBeInTheDocument()
    expect(screen.getByText('Finance', { selector: '.sidebar-group-label' })).toBeInTheDocument()
    expect(screen.getByText('HR & Payroll', { selector: '.sidebar-group-label' })).toBeInTheDocument()
    expect(screen.getByText('Reports', { selector: '.sidebar-group-label' })).toBeInTheDocument()
    expect(screen.getByText('Masters', { selector: '.sidebar-group-label' })).toBeInTheDocument()
    expect(screen.getByText('Administration', { selector: '.sidebar-group-label' })).toBeInTheDocument()
  })

  it('toggles the Finance & Accounts dropdown and reveals finance items', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<Sidebar currentPage="dashboard" onNavigate={onNavigate} />)

    const financeToggle = screen.getByRole('button', { name: /toggle finance & accounts menu/i })
    expect(financeToggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(financeToggle)
    expect(financeToggle).toHaveAttribute('aria-expanded', 'true')

    expect(screen.getByRole('button', { name: 'Financial Overview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Purchase Invoices' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Payment Received' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Purchase Invoices' }))
    expect(onNavigate).toHaveBeenCalledWith('purchase-invoices')
  })

  it('auto-expands the parent accordion when the active page is a child item', () => {
    render(<Sidebar currentPage="reports-timesheet" onNavigate={vi.fn()} />)

    // Reports accordion should be auto-expanded because currentPage is 'reports-timesheet'
    const timesheetBtn = screen.getByRole('button', { name: 'Timesheet Report' })
    expect(timesheetBtn).toBeInTheDocument()
    expect(timesheetBtn).toHaveClass('active')
  })

  it('auto-expands finance accordion when active page is a finance child item', () => {
    render(<Sidebar currentPage="expenses" onNavigate={vi.fn()} />)

    const expensesBtn = screen.getByRole('button', { name: 'Expenses' })
    expect(expensesBtn).toBeInTheDocument()
    expect(expensesBtn).toHaveClass('active')
  })
})
