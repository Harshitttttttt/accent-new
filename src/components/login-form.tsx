import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useState, type ComponentProps } from 'react'
import { cn } from '~/lib/utils'
import { loginUser } from '~/lib/auth.functions'
import { Button } from '~/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '~/components/ui/field'
import { Input } from '~/components/ui/input'

export function LoginForm({
  className,
  ...props
}: ComponentProps<'form'>) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setStatus(null)
      setIsSubmitting(true)

      try {
        const result = await loginUser({
          data: {
            email: value.email,
            password: value.password,
          },
        })

        if (!result.ok) {
          setStatus(result.message)
          return
        }

        await navigate({ to: '/' })
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Login failed')
      } finally {
        setIsSubmitting(false)
      }
    },
  })

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
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            Welcome back
          </h1>
          <p className="max-w-sm text-sm leading-6 text-[var(--text-muted)]">
            Sign in to your AccentCRM workspace to continue.
          </p>
        </div>

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
                placeholder="sara.mohammed@accentts.com"
                autoComplete="email"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          </form.Field>
        </Field>

        <Field>
          <div className="flex items-center">
            <FieldLabel
              htmlFor="password"
              className="text-sm font-medium text-[var(--text-primary)]"
            >
              Password
            </FieldLabel>
            <button
              type="button"
              className="ml-auto text-xs font-medium text-[var(--brand-primary)] underline-offset-4 hover:underline"
              onClick={() =>
                setStatus(
                  'Password reset is managed by your workspace administrator.',
                )
              }
            >
              Forgot password?
            </button>
          </div>
          <form.Field name="password">
            {(field) => (
              <Input
                id="password"
                name={field.name}
                type="password"
                autoComplete="current-password"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
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
            {isSubmitting ? 'Signing in…' : 'Sign in to workspace'}
          </Button>
        </Field>

        {status ? (
          <FieldDescription
            role="status"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-center text-xs text-[var(--text-secondary)]"
          >
            {status}
          </FieldDescription>
        ) : null}
      </FieldGroup>
    </form>
  )
}
