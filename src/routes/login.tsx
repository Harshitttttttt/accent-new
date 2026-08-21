import { ArrowUpRight, GalleryVerticalEnd, ShieldCheck } from 'lucide-react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { LoginForm } from '~/components/login-form'

export const Route = createFileRoute('/login')({
  ssr: true,
  head: () => ({
    meta: [
      { title: 'Sign in | AccentCRM' },
      {
        name: 'description',
        content: 'Sign in to the AccentCRM project operations workspace.',
      },
    ],
  }),
  component: LoginPage,
})

function LoginPage() {
  return (
    <div
      className="grid min-h-svh bg-[var(--bg)] lg:grid-cols-2"
      data-route="login"
    >
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold tracking-tight text-[var(--text-primary)]"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white shadow-sm">
              <GalleryVerticalEnd className="size-4" aria-hidden="true" />
            </span>
            AccentCRM
          </Link>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)] sm:inline">
            Engineering suite
          </span>
        </div>

        <main className="flex flex-1 items-center justify-center py-10" id="login-main">
          <div className="w-full max-w-[380px]">
            <LoginForm />
            <div className="mt-6 text-center text-xs text-[var(--text-muted)]">
              Need to set up the workspace or register?{' '}
              <Link
                to="/register"
                className="font-medium text-[var(--brand-primary)] underline-offset-4 hover:underline"
              >
                Go to registration
              </Link>
            </div>
          </div>
        </main>
        <p className="text-center text-xs text-[var(--text-muted)] md:text-left">
          Secure workspace access for project teams.
        </p>
      </div>

      <div className="relative hidden overflow-hidden bg-[var(--brand-primary)] lg:block">
        <div
          className="absolute -right-24 -top-24 size-[420px] rounded-full border-[72px] border-white/10"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-48 -left-32 size-[520px] rounded-full border-[96px] border-[var(--brand-secondary)]/40"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)',
            backgroundSize: '38px 38px',
          }}
          aria-hidden="true"
        />
        <div className="relative flex h-full flex-col justify-between p-10 text-white xl:p-14">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Project intelligence
          </div>

          <div className="max-w-lg">
            <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-white/60">
              One workspace. Every decision.
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Bring every project decision into focus.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/75">
              Keep leads, proposals, people, finance, and delivery moving from
              one clear operational view.
            </p>
          </div>

          <Link
            to="/"
            className="group inline-flex w-fit items-center gap-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            Explore the workspace
            <ArrowUpRight
              className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </div>
  )
}
