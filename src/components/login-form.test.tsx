import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { LoginForm } from './login-form'

const mockNavigate = vi.fn()
const mockInvalidate = vi.fn()
const mockLoginUser = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouter: () => ({ invalidate: mockInvalidate }),
}))

vi.mock('~/lib/auth.functions', () => ({
  loginUser: (...args: unknown[]) => mockLoginUser(...args),
}))

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form inputs and controls', () => {
    render(<LoginForm />)

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in to workspace/i })).toBeInTheDocument()
  })

  it('submits valid credentials and navigates on success', async () => {
    const user = userEvent.setup()
    mockLoginUser.mockResolvedValueOnce({ ok: true, user: { id: '1', email: 'admin@accent.com' } })

    render(<LoginForm />)

    await user.type(screen.getByLabelText(/work email/i), 'admin@accent.com')
    await user.type(screen.getByLabelText(/password/i), 'SuperAdmin2026!')
    await user.click(screen.getByRole('button', { name: /sign in to workspace/i }))

    expect(mockLoginUser).toHaveBeenCalledWith({
      data: {
        email: 'admin@accent.com',
        password: 'SuperAdmin2026!',
      },
    })
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
  })

  it('displays error feedback when login fails', async () => {
    const user = userEvent.setup()
    mockLoginUser.mockResolvedValueOnce({ ok: false, message: 'Invalid email or password.' })

    render(<LoginForm />)

    await user.type(screen.getByLabelText(/work email/i), 'wrong@accent.com')
    await user.type(screen.getByLabelText(/password/i), 'WrongPass1234!')
    await user.click(screen.getByRole('button', { name: /sign in to workspace/i }))

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
