import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TopBar from './TopBar'
describe('TopBar Component', () => {
  it('renders active page title based on current page identifier', () => {
    const onNavigate = vi.fn()
    const { rerender } = render(<TopBar currentPage="dashboard" onNavigate={onNavigate} />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard')

    rerender(<TopBar currentPage="projects" onNavigate={onNavigate} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Projects')

    rerender(<TopBar currentPage="user-master" onNavigate={onNavigate} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('User Master')
  })

  it('renders search input with shortcut badge', () => {
    render(<TopBar currentPage="dashboard" onNavigate={vi.fn()} />)

    expect(screen.getByPlaceholderText(/search projects, leads, clients/i)).toBeInTheDocument()
    expect(screen.getByText('⌘')).toBeInTheDocument()
    expect(screen.getByText('K')).toBeInTheDocument()
  })

  it('renders dark mode toggle button and toggles themes', async () => {
    const user = userEvent.setup()

    render(<TopBar currentPage="dashboard" onNavigate={vi.fn()} />)

    const themeToggle = screen.getByRole('button', { name: /switch to dark mode|switch to light mode/i })
    expect(themeToggle).toBeInTheDocument()

    await user.click(themeToggle)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await user.click(themeToggle)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('renders quick action and notification buttons', () => {
    render(<TopBar currentPage="dashboard" onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /open command palette/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open notifications/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument()
  })

  it('shows the signed-in user name, role, and initials', () => {
    render(
      <TopBar
        currentPage="dashboard"
        onNavigate={vi.fn()}
        user={{ fullName: 'Harshit Mestry', username: 'harshit', roleNames: ['Administrator'] }}
      />,
    )

    expect(screen.getByText('Harshit Mestry')).toBeInTheDocument()
    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('HM')).toBeInTheDocument()
  })

  it('falls back to guest labels when no user is provided', () => {
    render(<TopBar currentPage="dashboard" onNavigate={vi.fn()} />)

    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByText('Not signed in')).toBeInTheDocument()
  })
})
