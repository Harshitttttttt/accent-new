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
})
