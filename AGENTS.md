# AGENTS.md — AccentCRM

AccentCRM for Accent Techno Solutions Pvt Ltd. TanStack Start (Vite 8 + Nitro SSR) + TanStack Router file-based routes + Drizzle ORM + Neon PostgreSQL (HTTP driver) + Decimal.js (INR paise).

## Commands

```bash
pnpm dev                          # Vite dev server, port from DEV_PORT in .env (default 3000)
pnpm build                        # vite build && tsc --noEmit (produces .output/server/index.mjs)
pnpm typecheck                    # tsc --noEmit only
pnpm start                        # node .output/server/index.mjs
pnpm test                         # vitest run (once)
pnpm test:watch                   # vitest watch
pnpm test src/lib/money.test.ts   # single file — same pattern for any src/**/*.test.ts
pnpm db:check                     # ping Neon, list tables/users/roles (tsx scripts/check-db.ts)
pnpm db:generate                  # drizzle-kit generate from src/db/schema.ts
pnpm db:migrate                   # drizzle-kit migrate
pnpm db:push                      # drizzle-kit push (dev prototype sync only)
pnpm db:studio                    # Drizzle Studio
```

Package manager is `pnpm@11.5.0` (not npm/yarn). Node 22+, `target: ES2024`, TS strict, `noEmit: true`.

## Architecture

- **Routing:** `src/routes/` file-based. `index.tsx` = base path, `$param.tsx` = dynamic segment (`masters/$master.tsx` → `/masters/:master`). `src/routeTree.gen.ts` is generated — never edit.
- **Client/server split:** `*.functions.ts` (`createServerFn`) is the RPC boundary — safe to import in components. `*.server.ts` (`src/lib/auth.server.ts`, `src/db/index.server.ts`, `src/env/server.ts`) is server-only — never import in client components. `src/start.ts` adds `createCsrfMiddleware` for all `serverFn` calls.
- **Path alias:** `~/*` → `src/*` (via `tsconfig.json:paths` + `vite.config.ts: tsconfigPaths:true` + `vitest.config.ts: alias`). `components.json` aliases `~/components`, `~/lib/utils`.
- **DB:** Schema in `src/db/schema.ts`, migrations in `drizzle/`, config in `drizzle.config.ts`. `src/db/index.server.ts` creates Neon `neon(env.DEV_DB_URL)` + `drizzle({client})`. Drizzle ORM `1.0.0-rc.4`.
- **Env:** Only `DEV_DB_URL` (validated Zod `z.url()` in `src/env/server.ts` via `@t3-oss/env-core`, loads `dotenv/config`). Required for dev/build/db commands; missing/invalid URL throws. `.env` is gitignored (see `.env` example in repo root if present). Tests mock it in `src/test/setup.ts`.
- **Build artifacts (gitignored):** `.output/`, `dist/`, `src/routeTree.gen.ts`, `*.tsbuildinfo`.

## Conventions & Gotchas

- **Money — paise integers, Decimal.js only:** All financial values stored/transmitted as **paise integers** (`1 INR = 100 paise`). Never use `+ - * /` floats. Use `src/lib/money.ts`: `rupeesToPaise`, `paiseToRupees`, `addMoney`/`subtractMoney`/`multiplyMoney`/`divideMoney`, `calculateTax` (GST), `calculateMargin`, `formatINR` (Indian grouping `1,23,456.78`), `formatPaise`, `formatINRCompact` (`Cr`/`L`/`K`), `parseINRToPaise`. `Decimal` is `precision:28, ROUND_HALF_UP`.
- **Auth / RBAC:** `users` (login) vs `employees` (HR, nullable `user_id` FK). Scrypt hash `N=16384 r=8 p=1 64B` — passwords 12–256 chars. Session cookie `accentcrm_session` (HttpOnly SameSite=Lax, 30d TTL, `accentcrm_session` parsed via `parseSessionCookie`/`normalizeIpAddress`). Server fns read `getRequestHeader('cookie')`, call `findSessionById`. Initial registration (`totalUsers===0`) creates `admin` and auto-login; afterwards only `admin` can register. Roles: `admin`, `project_manager`, `accounts`, `hr`, `engineer`; permissions seeded via `ensureDefaultRoles`/`ensureDefaultPermissions` — always use `.onConflictDoNothing()` for seeds.
- **Server function headers:** Always set `Cache-Control`: `public, max-age=300` for public, `private, no-store` for authenticated, `no-store` for mutations. Return `{ ok, message?, data? }` for mutations.
- **Async / DB:** Prefer `Promise.withResolvers<T>()` over `new Promise`. Declare Drizzle indexes in table callbacks for FKs/lookups. Use `onConflictDoNothing({ target: ... })`.
- **UI:** Tailwind v4 (`@tailwindcss/vite`), `src/styles/app.css` (Inter via `@fontsource/inter` 400–800, `@theme inline`) + `src/styles/crm.css` tokens (`--brand-primary:#64126D`, `--bg:#F8F9FC`). Use `cn()` from `~/lib/utils` (clsx+twMerge). `src/routes/__root.tsx` switches CRM shell vs standalone for `/login`/`/register`; provides `PorscheDesignSystemProvider`, `QueryClient` (5m staleTime), `HotkeysProvider`. `bolt-ui/` is reference mockup — never import from it.

## Behavior - Best Practice Challenge (project-local, per opencode docs: AGENTS.md is active in V2, `instructions` in opencode.json is not yet resolved)

- Before implementing, evaluate the user's requested approach against best practices for this stack (ES2024/TS strict, TanStack Start + Router file-based routing, createServerFn RPC, Drizzle 1.0-rc + Neon HTTP, Tailwind v4, RBAC, paise/Decimal.js). If the request is valid but suboptimal, explicitly challenge it: state "Your approach works, but best practice is X because Y (trade-offs: correctness/security/perf/maintainability/idiomatic). Recommended: Z with file:line refs" and wait for confirmation on high-risk changes. Never silently implement an anti-pattern.
- Prioritize evidence over agreement — cite docs/code and suggest the better alternative before proceeding.

## Testing & Verification

- Runner: `vitest` + `jsdom` + `@testing-library/react` + `@testing-library/jest-dom/vitest`. Config: `vitest.config.ts` (`globals:true`, `setupFiles: src/test/setup.ts`, `include: src/**/*.{test,spec}.{ts,tsx}`).
- `src/test/setup.ts` mocks `~/env/server` (dummy `DEV_DB_URL`) and `~/db/index.server` (stub `db`/`pingDatabase`) + `cleanup()` afterEach. Real DB is not hit in tests — mock server fns with `vi.mock('~/lib/auth.functions')`.
- Before completing full-stack changes: `pnpm test` and `pnpm build` (build includes typecheck) must pass.
