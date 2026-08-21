import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { CheckCircle2, Lock, Shield, UserPlus } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { cn } from '~/lib/utils'
import { registerUser, type RegistrationStatus } from '~/lib/auth.functions'
import { Button } from '~/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '~/components/ui/field'
import { Input } from '~/components/ui/input'

export function RegisterForm({
  registrationStatus,
  className,
  ...props
}: ComponentProps<'form'> & {
  registrationStatus: RegistrationStatus
}) {
  const navigate = useNavigate()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isInitial = registrationStatus.isInitialAdminSetup
  const canRegister = registrationStatus.canRegister

  const form = useForm({
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      roleCode: isInitial ? 'admin' : (registrationStatus.roles[0]?.code ?? 'engineer'),
      password: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      setErrorMessage(null)
      setStatusMessage(null)

      if (value.password.length < 12) {
        setErrorMessage('Password must be at least 12 characters long.')
        return
      }

      if (value.password !== value.confirmPassword) {
        setErrorMessage('Passwords do not match. Please verify and re-type.')
        return
      }

      setIsSubmitting(true)

      try {
        const result = await registerUser({
          data: {
            fullName: value.fullName.trim(),
            username: value.username.trim().toLowerCase(),
            email: value.email.trim().toLowerCase(),
            password: value.password,
            roleCode: isInitial ? 'admin' : value.roleCode,
          },
        })

        if (!result.ok) {
          setErrorMessage(result.message)
          setIsSubmitting(false)
          return
        }

        setStatusMessage(result.message)

        if (isInitial) {
          setTimeout(() => {
            void navigate({ to: '/' })
          }, 1000)
        } else {
          form.reset()
          setIsSubmitting(false)
        }
      } catch (error) {
        console.error('Registration failed', error)
        setErrorMessage('An unexpected error occurred. Please try again.')
        setIsSubmitting(false)
      }
    },
  })

  if (!canRegister) {
    return (
      <div
        className={cn(
          'flex flex-col items-center gap-6 text-center',
          className,
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--surface-secondary)] text-[var(--text-muted)]">
          <Lock className="size-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Administrator access required
          </h1>
          <p className="max-w-sm text-sm leading-6 text-[var(--text-muted)]">
            User registration is restricted to authorized administrators. Please
            sign in to manage workspace accounts.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => navigate({ to: '/login' })}
          className="h-11 rounded-lg bg-[var(--brand-primary)] px-6 font-semibold text-white shadow-sm hover:bg-[var(--brand-primary-hover)]"
        >
          Sign in as administrator
        </Button>
      </div>
    )
  }

  return (
    <form
      {...props}
      className={cn('flex flex-col gap-6', className)}
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-white shadow-sm">
            <UserPlus className="size-5" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            {isInitial ? 'Set up administrator' : 'Register team member'}
          </h1>
          <p className="max-w-sm text-sm leading-6 text-[var(--text-muted)]">
            {isInitial
              ? 'Create the primary administrator account for this workspace.'
              : 'Create a new user account and assign workspace permissions.'}
          </p>
        </div>

        {isInitial ? (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--brand-primary)]/20 bg-[#F3E8F5] p-3 text-xs text-[var(--brand-primary)]">
            <Shield className="size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Initial Bootstrap Mode:</strong> This account will receive
              full administrator privileges and automatically sign you in.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            <Shield
              className="size-4 text-[var(--brand-primary)]"
              aria-hidden="true"
            />
            <span>
              Admin session active:{' '}
              <strong>
                {registrationStatus.currentUser?.fullName ||
                  registrationStatus.currentUser?.username}
              </strong>
            </span>
          </div>
        )}

        <Field>
          <FieldLabel
            htmlFor="fullName"
            className="text-sm font-medium text-[var(--text-primary)]"
          >
            Full name
          </FieldLabel>
          <form.Field name="fullName">
            {(field) => (
              <Input
                id="fullName"
                name={field.name}
                type="text"
                placeholder="Jane Doe"
                required
                autoComplete="name"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-11 rounded-lg border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] shadow-none focus-visible:border-[var(--brand-primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--brand-primary)]/20"
              />
            )}
          </form.Field>
        </Field>

        <Field>
          <FieldLabel
            htmlFor="username"
            className="text-sm font-medium text-[var(--text-primary)]"
          >
            Username
          </FieldLabel>
          <form.Field name="username">
            {(field) => (
              <Input
                id="username"
                name={field.name}
                type="text"
                placeholder="jane.doe"
                required
                autoComplete="username"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-11 rounded-lg border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] shadow-none focus-visible:border-[var(--brand-primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--brand-primary)]/20"
              />
            )}
          </form.Field>
          <FieldDescription className="text-xs text-[var(--text-muted)]">
            Use lowercase letters, numbers, dashes, and dots.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel
            htmlFor="email"
            className="text-sm font-medium text-[var(--text-primary)]"
          >
            Work email
          </FieldLabel>
          <form.Field name="email">
            {(field) => (
              <Input
                id="email"
                name={field.name}
                type="email"
                placeholder="jane.doe@company.com"
                required
                autoComplete="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-11 rounded-lg border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] shadow-none focus-visible:border-[var(--brand-primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--brand-primary)]/20"
              />
            )}
          </form.Field>
        </Field>

        <Field>
          <FieldLabel
            htmlFor="roleCode"
            className="text-sm font-medium text-[var(--text-primary)]"
          >
            Assigned role
          </FieldLabel>
          {isInitial ? (
            <Input
              id="roleCode"
              name="roleCode"
              type="text"
              value="Administrator (admin)"
              readOnly
              disabled
              className="h-11 rounded-lg border-[var(--border)] bg-[var(--surface-secondary)] px-3 text-sm text-[var(--text-muted)] shadow-none"
            />
          ) : (
            <form.Field name="roleCode">
              {(field) => (
                <select
                  id="roleCode"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] shadow-none focus-visible:border-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-primary)]/20"
                >
                  {registrationStatus.roles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} — {r.description || r.code}
                    </option>
                  ))}
                </select>
              )}
            </form.Field>
          )}
        </Field>

        <Field>
          <FieldLabel
            htmlFor="password"
            className="text-sm font-medium text-[var(--text-primary)]"
          >
            Password
          </FieldLabel>
          <form.Field name="password">
            {(field) => (
              <Input
                id="password"
                name={field.name}
                type="password"
                required
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-11 rounded-lg border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] shadow-none focus-visible:border-[var(--brand-primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--brand-primary)]/20"
              />
            )}
          </form.Field>
          <FieldDescription className="text-xs text-[var(--text-muted)]">
            Must be at least 12 characters.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel
            htmlFor="confirmPassword"
            className="text-sm font-medium text-[var(--text-primary)]"
          >
            Confirm password
          </FieldLabel>
          <form.Field name="confirmPassword">
            {(field) => (
              <Input
                id="confirmPassword"
                name={field.name}
                type="password"
                required
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-11 rounded-lg border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] shadow-none focus-visible:border-[var(--brand-primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--brand-primary)]/20"
              />
            )}
          </form.Field>
        </Field>

        <Field>
          <Button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="h-11 w-full rounded-lg bg-[var(--brand-primary)] font-semibold text-white shadow-sm hover:bg-[var(--brand-primary-hover)]"
          >
            {isSubmitting
              ? isInitial
                ? 'Creating administrator…'
                : 'Registering user…'
              : isInitial
                ? 'Create administrator account'
                : 'Register user'}
          </Button>
        </Field>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-center text-xs font-medium text-[var(--danger)]"
          >
            {errorMessage}
          </div>
        ) : null}

        {statusMessage ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-2 text-center text-xs font-medium text-[var(--success)]"
          >
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
        ) : null}
      </FieldGroup>
    </form>
  )
}
