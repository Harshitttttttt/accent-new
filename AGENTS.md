# AGENTS.md — AccentCRM

AccentCRM for Accent Techno Solutions Pvt Ltd. TanStack Start (Vite 8) + TanStack Router file-based routes + Drizzle ORM 1.0-rc + Neon PostgreSQL (HTTP driver) + Decimal.js (INR paise). Deploys to **Cloudflare Workers** (`wrangler.jsonc`, `nodejs_compat`; build output `dist/client` + `dist/server`).

## Commands

```bash
pnpm dev                          # vite dev via @cloudflare/vite-plugin (workerd); port = DEV_PORT or 3000
pnpm build                        # vite build && tsc --noEmit
pnpm typecheck                    # tsc --noEmit only
pnpm test                         # vitest run (once)
pnpm test src/lib/money.test.ts   # single file — same pattern for any src/**/*.test.{ts,tsx}
pnpm deploy                       # vite build && wrangler deploy (Workers, name accent-crm)
pnpm cf-typegen                   # wrangler types → regenerates gitignored worker-configuration.d.ts
pnpm db:check                     # ping Neon, list tables/users/roles (tsx scripts/check-db.ts)
pnpm db:generate                  # drizzle-kit generate from src/db/schema.ts → drizzle/
pnpm db:migrate                   # drizzle-kit migrate (db:push is dev prototype sync only)
pnpm db:studio                    # Drizzle Studio
```

Package manager `pnpm@11.22.0` (not npm/yarn). Node 22+, TypeScript 7, target ES2024, strict, `noEmit`. No lint script and no CI — `pnpm test` + `pnpm build` are the whole verification gate.

## Env (lazy, two-file setup)

- `src/env/server.ts` validates on first access (Proxy), **not at import** — so `vite build` succeeds without `DEV_DB_URL`; runtime throws clearly if missing. Don't convert back to eager Zod parse.
- Local dev needs both: `.dev.vars` (copy `.dev.vars.example`) feeds workerd's `process.env` under `vite dev`; `.env` additionally needed for Node-only tools (`drizzle-kit`, `tsx scripts/`). Both gitignored.
- Production: `wrangler secret put DEV_DB_URL`. `DEV_PORT` optional (default 3000).
- `src/db/index.server.ts` exports `db` as a lazy Proxy (defers `neon()` until first query) for the same reason — never call DB at module top level.

## Architecture

- **Domain trio:** each feature in `src/lib/` is `<domain>.ts` (pure shared helpers/types + colocated tests), `<domain>.server.ts` (DB access, server-only), `<domain>.functions.ts` (`createServerFn` RPC — safe to import in components). Never import `.server.ts` from client code; mock the `.functions` module in component tests.
- **Routing:** `src/routes/` file-based; `$param.tsx` = dynamic segment. `src/routeTree.gen.ts` is generated — never edit.
- **Navigation coupling:** Sidebar/TopBar resolve pages via `pageFromPath()` in `src/crm/navigation.ts` — adding/changing a route requires updating that mapping or nav highlighting breaks.
- **Root shell:** `src/routes/__root.tsx` loader fetches `currentUser` for every path except `/login`,`/register` (standalone shell); CRM shell wraps `PorscheDesignSystemProvider` + `QueryClient` (5m staleTime) + `HotkeysProvider`. Theme toggle writes `data-theme` on `<html>`; `useAppTheme` mirrors it into the PDS provider — keep this sync intact when touching theming.
- **Schema is modular:** edit `src/db/schema/<module>.ts` (auth, employees, crm, masters/*, proposals, projects); `src/db/schema.ts` only re-exports them so `~/db/schema` imports stay stable. Declare indexes in table callbacks.
- **Server fn middleware:** `src/start.ts` applies `createCsrfMiddleware` to all `serverFn` calls — don't bypass.
- **Path alias:** `~/*` → `src/*` (tsconfig paths + vite `tsconfigPaths` + vitest alias). shadcn (`components.json`, new-york style) aliases `~/components`, `~/components/ui`, `~/lib/utils`.

## Conventions & Gotchas

- **Money — paise integers, Decimal.js only:** financial values stored/transmitted as **paise integers** (`1 INR = 100 paise`); never float arithmetic. Use `src/lib/money.ts`: `rupeesToPaise`, `paiseToRupees`, `addMoney`/`subtractMoney`/`multiplyMoney`/`divideMoney`/`sumMoney`, `calculateTax` (GST), `calculateMargin`, `formatINR` (Indian grouping), `formatINRCompact` (Cr/L/K), `parseINRToPaise`, `amountInWordsINR`. `Decimal`: precision 28, ROUND_HALF_UP.
- **Auth / RBAC:** `users` (login) vs `employees` (HR, nullable `user_id`). Scrypt N=16384 r=8 p=1, 64-byte key; passwords 12–256 chars. Session cookie `accentcrm_session` (HttpOnly SameSite=Lax, 30d TTL); parse via `parseSessionCookie`/`normalizeIpAddress`, verify via `findSessionById` reading the `cookie` request header. First registration (`totalUsers===0`) creates `admin` + auto-login; afterwards only admin registers. Roles: `admin`, `project_manager`, `accounts`, `hr`, `engineer` (`DEFAULT_ROLES` in auth.server.ts); seed with `ensureDefaultRoles`/`ensureDefaultPermissions` using `.onConflictDoNothing({ target })`.
- **Server function headers:** reads → `private, max-age=300` (or `private, no-store` for sensitive), mutations → `no-store`. Mutations return `{ ok, message?, data? }`.
- **UI:** Tailwind v4 via `@tailwindcss/vite`; tokens in `src/styles/app.css` (`@theme inline`, Inter) + `src/styles/crm.css` (`--brand-primary:#64126D`, `--bg:#F8F9FC`). Compose classes with `cn()` from `~/lib/utils`.
- `bolt-ui/` is reference mockup — never import from it (gitignored).

## Testing

- Vitest + jsdom + Testing Library; config `vitest.config.ts` (`globals:true`, `include: src/**/*.{test,spec}.{ts,tsx}`). Real DB is never hit: `src/test/setup.ts` mocks `~/env/server` and `~/db/index.server` (stub `db` + `pingDatabase`) and runs `cleanup()`.
- For components calling RPC, mock at the boundary: `vi.mock('~/lib/auth.functions', ...)` etc.

## Behavior — Best Practice Challenge (project-local)

- **Always use current best practices** for this stack by default (ES2024/TS strict, TanStack Start + file-based routing, createServerFn RPC, Drizzle 1.0-rc + Neon HTTP, Tailwind v4, RBAC, paise/Decimal.js) — never silently implement an anti-pattern.
- **Challenge suboptimal requests:** if the user's idea is valid but redundant or improvable, say so before implementing: "Your approach works, but best practice is X because Y (trade-offs: correctness/security/perf/maintainability/idiomatic). Recommended: Z with file:line refs." Wait for confirmation on high-risk changes; proceed on clearly better alternatives after stating them once.
- Prioritize evidence over agreement — cite docs/code and suggest the better alternative before proceeding.
- **Log debt while exploring:** whenever reading through the codebase, if you encounter poor practices (convention drift from this file, anti-patterns, misleading dead code, security/correctness risks), append one entry per finding to `docs/tech-debt.md` — `file:line`, what's wrong, why it matters, suggested fix, date found. Do not fix unasked; mention the finding to the user only when relevant to the current task.
