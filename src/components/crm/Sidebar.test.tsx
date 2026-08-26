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
})
