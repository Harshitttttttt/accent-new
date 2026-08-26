import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RegisterForm } from './register-form'

const mockNavigate = vi.fn()
const mockInvalidate = vi.fn()
const mockRegisterUser = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouter: () => ({ invalidate: mockInvalidate }),
}))

vi.mock('~/lib/auth.functions', () => ({
  registerUser: (...args: unknown[]) => mockRegisterUser(...args),
}))

describe('RegisterForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders locked state when registration is not permitted', () => {
    render(
      <RegisterForm
        registrationStatus={{
          canRegister: false,
          isInitialAdminSetup: false,
          totalUsers: 1,
          currentUser: null,
          roles: [],
        }}
      />,
    )

    expect(screen.getByText(/administrator access required/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in as administrator/i })).toBeInTheDocument()
  })

  it('renders initial bootstrap setup mode banner when 0 users exist', () => {
    render(
      <RegisterForm
        registrationStatus={{
          canRegister: true,
          isInitialAdminSetup: true,
          totalUsers: 0,
          currentUser: null,
          roles: [{ code: 'admin', name: 'Administrator', description: null }],
        }}
      />,
    )

    expect(screen.getByText(/initial bootstrap mode/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create administrator account/i })).toBeInTheDocument()
  })

  it('validates password mismatch on submission', async () => {
    const user = userEvent.setup()

    render(
      <RegisterForm
        registrationStatus={{
          canRegister: true,
          isInitialAdminSetup: true,
          totalUsers: 0,
          currentUser: null,
          roles: [{ code: 'admin', name: 'Administrator', description: null }],
        }}
      />,
    )

    await user.type(screen.getByLabelText(/full name/i), 'Admin User')
    await user.type(screen.getByLabelText(/username/i), 'admin')
    await user.type(screen.getByLabelText(/work email/i), 'admin@accent.com')
    await user.type(screen.getByLabelText(/^password/i), 'Password123456!')
    await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPassword123!')
    await user.click(screen.getByRole('button', { name: /create administrator account/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(mockRegisterUser).not.toHaveBeenCalled()
  })
})
