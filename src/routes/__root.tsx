/// <reference types="vite/client" />

import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useLocation,
} from '@tanstack/react-router'
import { PorscheDesignSystemProvider } from '@porsche-design-system/components-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HotkeysProvider } from '@tanstack/react-hotkeys'
import type { ReactNode } from 'react'
import Sidebar from '~/components/crm/Sidebar'
import TopBar from '~/components/crm/TopBar'
import appCss from '~/styles/app.css?url'
import { useCrmNavigation, useCurrentCrmPage } from '~/crm/navigation'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'CRM Workspace | Project intelligence for every team',
      },
      {
        name: 'description',
        content:
          'A project operations CRM for leads, proposals, people, finance, and delivery.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      // Porsche Design System font preloads — equivalent to getFontLinks({ weights: ['regular','semi-bold','bold'] })
      // from @porsche-design-system/components-react/partials for cdn:auto (com). Keeps
      // document.head.querySelector('link[rel=preload][as=font][href*=porsche-next]') satisfied
      // so PDS does not emit the getFontLinks validation warning. Update hrefs when PDS
      // version / font hashes change (see vite.config.ts porschePartialsPlugin).
      {
        rel: 'preload',
        href: 'https://cdn.ui.porsche.com/porsche-design-system/fonts/porsche-next-latin-regular.b8f1c20.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: 'https://cdn.ui.porsche.com/porsche-design-system/fonts/porsche-next-latin-semi-bold.b5f6fca.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: 'https://cdn.ui.porsche.com/porsche-design-system/fonts/porsche-next-latin-bold.0fbdc6d.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
    ],
  }),
  shellComponent: RootDocument,
  component: CrmShell,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <HotkeysProvider
            defaultOptions={{
              hotkey: { conflictBehavior: 'allow' },
              hotkeySequence: { conflictBehavior: 'allow' },
            }}
          >
            {children}
          </HotkeysProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}

function CrmShell() {
  const location = useLocation()
  const currentPage = useCurrentCrmPage()
  const navigate = useCrmNavigation()

  if (location.pathname === '/login' || location.pathname === '/register') {
    const targetId = location.pathname === '/register' ? '#register-main' : '#login-main'
    const label = location.pathname === '/register' ? 'Skip to register form' : 'Skip to login form'
    return (
      <PorscheDesignSystemProvider theme="light">
        <a className="skip-link" href={targetId}>
          {label}
        </a>
        <Outlet />
        <Scripts />
      </PorscheDesignSystemProvider>
    )
  }

  return (
    <PorscheDesignSystemProvider theme="light">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
        <Sidebar currentPage={currentPage} onNavigate={navigate} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar currentPage={currentPage} onNavigate={navigate} />
          <main id="main-content" className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
      <Scripts />
    </PorscheDesignSystemProvider>
  )
}

function NotFound() {
  const navigate = useCrmNavigation()

  return (
    <div className="grid h-full place-items-center bg-[var(--bg)] p-8 text-center">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--brand-primary)]">
          404 / Route not found
        </p>
        <h1 className="m-0 text-3xl font-semibold text-[var(--text-primary)]">
          This CRM view does not exist.
        </h1>
        <button className="btn-primary mt-5" type="button" onClick={() => void navigate('dashboard')}>
          Return to dashboard
        </button>
      </div>
    </div>
  )
}
