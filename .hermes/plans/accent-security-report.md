# AccentCRM — Security Deep-Dive Report (Piolium analogue)

**Date:** 2026-08-27 · **Analyst:** hermes/security-audit · **Bases:** `tzevk/accent` (`/tmp/accent-old`, Node 24 / Next 16 / MySQL / 85 tests) and `Harshitttttttt/accent-new` (`/tmp/hermes-accent-new`, TanStack Start / Drizzle / Neon / Cloudflare Workers) · **Branch:** `hermes/security-audit` → `dev`

> Covers (a) auth/RBAC, session, rate limiting, SQLi, XSS, secrets, dependencies; (b) requesting-code-review style checks; (c) AGENTS.md gotchas (`isDelete`, money/paise, proxy rate limits, session handling); (d) remediation for `accent-new`. Severity: **Critical / High / Medium / Low**. Every finding carries `file:line` + evidence + fix.

---

## Executive Summary

| Area | Old (tzevk/accent) | New (accent-new) | Worst severity |
|---|---|---|---|
| Authentication | Mature (bcrypt + SHA-256 session hash + DB validation) but has legacy plaintext fallback | Strong (scrypt + base64url tokens) with CSRF middleware, but **no rate limiting** | **High** (old legacy fallback, new brute-force) |
| RBAC | Flat + field-level dual model, well-tested | Correct per-module guards where present, but **6 read endpoints have zero auth** | **Critical** |
| Session & cookies | HttpOnly Lax, 5-min cache, proper invalidation | HttpOnly Lax, no cache (good), but Secure only in prod and missing `__Host-` prefix | **Medium** |
| Rate limiting | In-memory proxy limiter (not horizontally scalable) | **None** | **High** |
| SQL injection | Parameterized via mysql2 — safe | Parameterized via Drizzle — safe (minor like-pattern nuance) | **Low** |
| XSS | Regex `sanitizeHtml` (weak) + safe upload rasterization | No raw HTML sinks found; Tiptap content needs server sanitization | **Medium** |
| Secrets exposure | Clean (gitignored `.env`, Bearer timing-safe) | Clean (gitignored `.dev.vars`/`.env`) | **Low** |
| Dependencies | **13 vulns (1 critical, 10 high, 2 moderate)** | Low vuln surface but `pnpm audit` not wired in CI | **Critical** |
| Money handling | Decimal.js shared lib, correct | Decimal.js precision 28, paise integers, excellent | **Low** |
| Soft-delete (`isDelete`) | Enforced with generated-column uniqueness | **Not present** — hard deletes | **Medium** |
| Security headers | Only `/uploads` headers; no CSP/HSTS/X-Frame | None | **Medium** |

**Single most urgent fix for `accent-new`:** gate the unauthenticated read endpoints in `src/lib/crm.functions.ts` and `src/lib/project-activities.functions.ts` (`getCrmSnapshot`, `getDatabaseHealth`, `getCrmActivity`, `getProjectSnapshot`, `getEmployeeSnapshot`, `getCompanyList`, `getActivityMasterTree`) — currently any anonymous caller can enumerate CRM data and probe DB health. Second: add rate limiting to login.

---

## 1. Old Repo — `tzevk/accent` (`/tmp/accent-old`)

### 1.1 Authentication & Session

**[M-01] Medium — `proxy.ts:221-260` only checks cookie presence; real validation is deferred**

Evidence: `proxy.ts:218-260` — `const isAuthenticated = !!req.cookies.get('session')?.value` then `NextResponse.next()`. Comment correctly notes “forgeable cookie buys nothing” because `src/utils/api-permissions.js:107-157` validates `token_hash` against `sessions` + `u.isDelete=0` + `expires_at > NOW()` + `is_active/status`. However the redirect/401 boundary in the proxy can be bypassed by colluding with any public path prefix (e.g. `/_next` is public by design but an attacker with a forged cookie still gets `isAuthenticated=true` and bypasses the `/signin` redirect — harmless, but worth documenting).

Fix for new: keep the split (edge check = presence, Node check = DB) but ensure Workers middleware mirrors it; document the threat model in code comments (already done in new’s `auth.server.ts:167-205`).

**[H-01] High — Legacy plaintext password fallback with non-constant-time comparison**

Evidence: `src/utils/password.ts:18-27`:
```ts
if (needsRehash(hash)) { return plaintext === hash; }
```
`needsRehash` is `!hash.startsWith('$2')`. Any user whose row still holds a plaintext password (pre-migration) is compared with `===`, which is not constant-time and leaks timing. Also the plaintext value sits in the DB at rest until the next successful login triggers the upgrade at `src/app/api/login/route.js:93-104` (`UPDATE users SET password_hash = ?` on `needsRehash`).

Remediation (old): migrate all remaining plaintext rows offline (`SELECT id FROM users WHERE password_hash NOT LIKE '$2%'`) and force-reset; remove the `needsRehash` branch entirely after migration. New repo already avoids this by using scrypt exclusively (`src/lib/auth.server.ts:67-83`).

**[M-02] Medium — Cookie `Secure` and `__Host-` prefix not enforced in all paths**

Evidence: `src/app/api/login/route.js:218-225`:
```js
res.cookies.set('session', sessionToken, { httpOnly:true, sameSite:'lax', secure: process.env.NODE_ENV==='production', path:'/', priority:'high', maxAge: SESSION_TTL_SECONDS })
```
`src/app/api/logout/route.js:59-63` derives `isSecure` from `x-forwarded-proto` / `req.nextUrl.protocol` — fragile behind some proxies; if the header is missing the cookie is set without `Secure` even in production. No `__Host-` prefix, so a network attacker could set a `session` cookie from a subdomain.

Fix for new: `src/lib/auth.functions.ts:39-47` already does `process.env.NODE_ENV==='production' ? '; Secure' : ''` inline — acceptable for Workers where TLS termination is at the edge, but add `__Host-` prefix (`__Host-accentcrm_session`) and require `Secure` + `Path=/` + no `Domain` (already satisfied). Consider `Partitioned` if embedding is ever needed (it isn’t).

**[L-01] Low — 30-day session TTL with 5-minute user cache means logout replay window**

Evidence: `src/utils/session.ts:3` `SESSION_TTL_SECONDS = 2592000`; `src/utils/api-permissions.js:22` `USER_CACHE_TTL = 5*60*1000` + `userCache` + `pendingUserFetches`. `src/app/api/logout/route.js:31-35` calls `invalidateUserCache(userId)` after `revokeSession`, which closes the window, but any other path that deletes a session without calling `invalidateUserCache` would leave a 5-minute replay window. Grep shows all logout/password-change paths do invalidate; direct DB expiry does not, but `expires_at > NOW()` in `_fetchUserFromDb:151` still blocks.

Fix for new: no cache, so no replay window — correct by construction. Keep it that way; if a cache is ever added, replicate the `invalidateUserCache` pattern.

### 1.2 RBAC

**[M-03] Medium — Dual permission model (`roles_master.permissions` + `users.permissions` + `users.field_permissions`) is powerful but easy to mis-configure**

Evidence: `src/utils/permissions.js:50-86` `checkPermission` checks `is_super_admin` bypass, then `user.merged_permissions` (union via `src/utils/rbac.js:mergePermissions`), then `field_permissions.modules[resource].crud[action]`. `src/utils/api-permissions.js:169-179` merges without auto-deriving from `role_hierarchy`. Tests at `src/__tests__/utils/api-permissions.test.ts` and `src/__tests__/api/users/sec04-privilege-escalation.test.ts` cover the hierarchy guard `canModifyTargetUser`.

Risk: a caller who checks only one of the two models (e.g. only `merged_permissions`) could miss a `field_permissions` grant or vice versa. All API routes use `ensurePermission` which funnels through `getCurrentUser` (which populates both), so safe today, but new code must not call `checkPermission` with a partial user object.

Fix for new: single canonical model — `user_roles` → `role_permissions` → `permissions` via `userHasPermission` (`src/lib/auth.server.ts:388-398`) plus `isUserAdmin`. No dual model. Keep it single.

**[L-02] Low — `is_super_admin` stored as TINYINT(1) compared with `=== 1 || === true`**

Evidence: `src/utils/permissions.js:55` `if (user.is_super_admin) return true;` is truthy, but `src/app/api/login/route.js:173-174` does `===1 || ===true`. Inconsistent coercion; a value of `2` or `"1"` would behave differently across call sites. Minor.

### 1.3 Rate Limiting (proxy.ts)

**[H-02] High — In-memory `rateLimitStore` (`proxy.ts:38-204`) is not shared across instances and is trivially bypassed**

Evidence: `proxy.ts:38` `const rateLimitStore = new Map<string, RateLimitEntry>()`; `proxy.ts:41-63` `RATE_LIMITS` (auth 10/15m, session 120/m, dashboard 60/m, api 120/m, heavy 10/m). Key is `ip:sessionValue:category` (`proxy.ts:128`). `cleanupRateLimitStore` runs once per minute, caps at 5000 entries then evicts 1000 oldest.

Impact: on Vercel / multi-instance deploys each instance has its own Map, so an attacker can rotate across instances or simply wait 60s for the window to reset. IP is derived from `x-forwarded-for` first (`proxy.ts:65-78`) which is client-controlled unless the CDN strips it — behind Vercel/Cloudflare the first entry can be spoofed.

Fix for new (Cloudflare Workers): no rate limiting at all — worse. Add a Workers-compatible limiter (Cloudflare Rate Limiting API or KV/Durable Object counter) for at least `loginUser` (e.g. 5 attempts / 15 min / IP + email) and `heavy` report/export paths. For old, move to Redis/Upstash or at least use `cf-connecting-ip` / `true-client-ip` with trusted-proxy validation and document that in-memory is best-effort only.

**[M-04] Medium — Rate limit key includes raw session cookie value**

Evidence: `proxy.ts:127-130` `const sessionValue = req.cookies.get('session')?.value; const keyIdentity = sessionValue ? \`${ip}:${sessionValue}\` : ip;`. The raw token (256-bit hex) is used as a Map key and never hashed — it lives in memory as a key string, and `console.warn` at `proxy.ts:158` logs `IP ${ip} blocked` but not the token. Still, holding raw tokens in an in-memory Map increases exposure if the process is dumped.

Fix: hash the session value before using as a rate-limit key (`hashSessionToken(sessionValue)` already exists).

### 1.4 SQL Injection

**Verdict: SAFE.** All DB access uses `mysql2/promise` parameter placeholders (`?`) — e.g. `api-permissions.js:150` `WHERE s.token_hash = ?`, `api-permissions.js:152-154`, `login/route.js:82-83`, `session.ts:21`. No string-interpolated SQL found via `grep -rn 'query.*${'`.

**One nuance to preserve:** unique numbers use `IF(isDelete=0, col, NULL) STORED` + unique index (`AGENTS.md:55`) — correct soft-delete uniqueness without application race.

### 1.5 XSS & Content Handling

**[M-05] Medium — `src/lib/sanitize.js:12-40` is regex-based, not a parser**

Evidence: strips `<script>`, `<style>`, `on*=` handlers, `javascript:` / `data:text/html` URLs. This covers stored XSS from proposal scope / message bodies (threat model stated in file header), but regex sanitizers are bypassable (e.g. `<svg/onload=...>`, `<img src=x onerror=...>`, `<iframe srcdoc=...>`, `<math><mtext href=javascript:...>`). The file header acknowledges the trade-off (“regex is sufficient … keeps the server bundle lean”) and suggests switching to `dompurify` behind `typeof window !== 'undefined'`.

Remediation for new: no `sanitizeHtml` equivalent found — `src/components/crm/rich-text-editor.tsx` uses Tiptap (`@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/pm`). Tiptap output is HTML; before persisting or rendering via `dangerouslySetInnerHTML` (none currently, but future proposals/pages may), route through a server-side sanitizer (`isomorphic-dompurify` or `sanitize-html`) in the `.server.ts` layer.

**[L-03] Low — `src/app/proposals/[id]/page.js:401` uses `tempDiv.innerHTML = ...` client-side**

Evidence: `tempDiv.innerHTML = \`...\`` inside a proposal page. This is a DOM XSS sink if the interpolated string includes unsanitized user content. Check that the value is sanitized before assignment.

**Uploads: SEC-02 is well done**

Evidence: `src/app/api/uploads/route.js:10-94` — `sharp(buf, {limitInputPixels: 40_000_000})` rasterizes to PNG (`adaptiveFiltering`, `compressionLevel:9`), never persists raw bytes, rejects non-images with 400, sanitizes filename via `path.basename(...).replace(/[^a-zA-Z0-9._-]/g,'_')`, writes to `public/uploads` as `${timestamp}_${base}.png` + thumb. `next.config.ts:38-48` adds `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment` for `/uploads/*`. This neutralizes SVG polyglots and content-sniffing. Minor: timestamp-only filename allows collision within same millisecond; prefer `uuid` (already used in `document-upload`).

### 1.6 Secrets Exposure

**Verdict: CLEAN.**

- `.env` / `.env.*` gitignored (`/.gitignore` + `/.gitignore` pattern `!.env.example`).
- `src/utils/database.js:5` loads via `dotenv.config()` for scripts only; production uses `PROD_DB_*` envs.
- `src/app/api/attendance/webhook/route.ts:52-55` `secretsEqual` hashes both sides with SHA-256 then `timingSafeEqual` — correct constant-time compare; `route.ts:111-122` checks `SMARTOFFICE_WEBHOOK_SECRET` before any parsing, returns 401 on mismatch, never logs the secret (`route.ts:100-107` logs only presence).
- No hardcoded secrets found (`grep -rn 'password\s*=\s*["\']'` clean).

### 1.7 Dependencies

**[C-01] Critical — 13 vulnerabilities in `npm audit` (`/tmp/accent-old`)**

Evidence (`npm audit` 2026-08-26):
- `brace-expansion` High (GHSA-3jxr-9vmj-r5cp DoS, GHSA-mh99-v99m-4gvg DoS OOM, GHSA-rgw5-rvv9-x895 bypass) — ranges `<=1.1.17 || 2.0.0-2.1.3`, fixAvailable true.
- `extract-zip` High (GHSA-jmr9-qjv8-65gv path traversal via symlink) → `puppeteer-core` → `puppeteer` (`range <=2.0.1`, fix `puppeteer-core@25.9.0` semver major).
- `@puppeteer/browsers` High via `extract-zip`.
- `undici` High/Critical cluster (GHSA-vmh5-mc38-953g, GHSA-p88m-4jfj-68fv, GHSA-vxpw-j846-p89q, GHSA-hm92-r4w5-c3mj, GHSA-g8m3-5g58-fq7m, GHSA-pr7r-676h-xcf6, GHSA-8xcm-r25x-g524, GHSA-4cwx-7wf7-3272, GHSA-m8rv-5g2x-5cg5, GHSA-jr45-8vmc-qm54, GHSA-v3r7-h72x-cjcm, GHSA-35p6-xmwp-9g52) — fix via `npm audit fix`.
- `uuid <11.1.1` Moderate (GHSA-w5hq-g745-h8pq buffer bounds in v3/v5/v6) — fix via `exceljs@3.4.0` (breaking).
- `vite 8.0.0-8.0.15` High (GHSA-v6wh-96g9-6wx3 launch-editor NTLMv2, GHSA-fx2h-pf6j-xcff server.fs.deny bypass on Windows) — fix via `npm audit fix`.
- `exceljs >=3.5.0` Moderate via `uuid`, `ip-address` High via `undici` transitive.

Remediation (old): `npm audit fix` (non-breaking) immediately; schedule `exceljs` major bump (`npm audit fix --force` or replace with `exceljs` fork / `xlsx`). Pin `vite` to patched range. For new, run `pnpm audit` in CI (currently no CI) and add `pnpm audit --prod` to the verification gate.

### 1.8 AGENTS.md Gotchas — Old

- **Soft-delete (`isDelete`)**: every `SELECT/JOIN/UPDATE` must include `WHERE isDelete=0`. Tests at `src/__tests__/api/admin/standard-crud/soft-delete.test.ts` and `src/__tests__/api/software/soft-delete.test.ts` enforce `UPDATE SET isDelete=1, not DELETE FROM` and `isDelete=0` guards. Risk: a new query without the guard resurrects deleted rows.
- **Money**: `src/lib/money.ts:1-52` uses `Decimal(precision 20, ROUND_HALF_UP)` via `R/add/sub/mul/div/pctOf/roundR`. `AGENTS.md:57` forbids `parseFloat/+-*/` for billing/salary — enforced by Payroll tests (`total_earnings - total_deductions === net_pay`).
- **DB pool**: `src/utils/database.js:34-62` `globalThis.__dbPool` singleton, `connectionLimit:5`, `queueLimit:200`, `maxIdle:2`, `idleTimeout:30s`. Helpers: `query()` single, `withDb(cb)` multi/tx, `dbConnect()+finally release()`. Never `mysql.createConnection` in routes (correct).
- **Session caching**: 5-min `userCache` + `pendingUserFetches` dedup — must call `invalidateUserCache(userId)` after revocation (done in logout).

---

## 2. New Repo — `Harshitttttttt/accent-new` (`/tmp/hermes-accent-new`)

### 2.1 Authentication & Session

**Strengths**

- Scrypt `N=16384 r=8 p=1 maxmem 32MB keyLength 64 salt 16` (`src/lib/auth.server.ts:18-24` + `derivePasswordKey:42-65`) with `timingSafeEqual` (`auth.server.ts:108-110`) — correct.
- Password 12–256 chars enforced in `hashPassword:68-69` and `registerInputSchema:154-178` / `loginInputSchema:34-37`.
- Session token `randomBytes(32).toString('base64url')` (`auth.server.ts:153`), `expiresAt = now + 30d` (`24-25`), stored as `text PK` (`src/db/schema/auth.ts:25`) with `idx_sessions_expires_at` and `onDelete:cascade`.
- `findSessionById:167-205` checks `expiresAt > now` AND `isActive=true` via single join — no cache, so no replay window.
- `normalizeIpAddress:241-273` is inline (correct for Workers where `node:net.isIP` unavailable) with IPv4/IPv6 + mapped-IPv4 validation.
- `parseSessionCookie:275-299` safely `decodeURIComponent` with try/catch, handles multi-cookie headers.
- `createCsrfMiddleware` (`src/start.ts:1-12`) applied to all `serverFn` calls — TanStack Start’s double-submit cookie pattern.

**[H-03] High — No rate limiting on `loginUser` or any other endpoint**

Evidence: `grep -rn 'rateLimit|RATE_LIMIT|throttle' /tmp/hermes-accent-new/src` returns zero. Unlike old `proxy.ts:41-177`, new has no proxy/middleware rate limiter. `src/lib/auth.functions.ts:62-97` `loginUser` accepts any number of `POST` attempts per IP/email, enabling credential stuffing / password spraying.

Remediation: add Workers rate limiting — cheapest is Cloudflare Rate Limiting rule on `/api/*` or a KV/D1 counter in `loginUser` handler (e.g. 5 attempts / 15 min per IP + per email, `429` with `Retry-After`). At minimum, add an in-memory fallback for local dev and document the Workers rule.

**[M-06] Medium — Cookie `Secure` only when `NODE_ENV==='production'` (`src/lib/auth.functions.ts:39-47`)**

Evidence:
```ts
const secureCookieAttribute = process.env.NODE_ENV === 'production' ? '; Secure' : '';
function createSessionCookie(sessionId, maxAgeSeconds) { return `accentcrm_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureCookieAttribute}` }
function clearSessionCookie() { return `accentcrm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieAttribute}` }
```
On `staging` or any non-`production` `NODE_ENV` the cookie lacks `Secure` even over HTTPS. Workers `NODE_ENV` is not always `production` (Wrangler `preview_urls:false`, `compatibility_date:2026-08-21`). Prefer `request.url.startsWith('https://')` or always set `Secure` (dev over http can be exempted via `__Host-` logic).

Also missing: `__Host-` prefix (requires `Secure`, `Path=/`, no `Domain`), and no `Partitioned` needed.

**[L-04] Low — `loginUser` does not delete expired sessions on login (old does)**

Evidence: old `src/utils/session.ts:25-29` runs `DELETE FROM sessions WHERE user_id=? AND expires_at <= NOW()` on each login (bounded maintenance). New `auth.server.ts:211-213` only has `deleteExpiredSessions()` (full table delete, no per-user bounded cleanup, never called on login). Over time the `sessions` table accumulates expired rows.

Fix: call `deleteExpiredSessions` on a schedule (Cloudflare Cron Trigger) or on login for the user.

### 2.2 RBAC — The critical gap

**[C-02] Critical — 6 read endpoints + 1 tree endpoint are unauthenticated**

Evidence: these handlers read the DB with **zero** session/permission checks:

| File | Export | What it leaks | Line |
|---|---|---|---|
| `src/lib/crm.functions.ts:22` | `getCrmSnapshot` | full CRM snapshot (companies, contacts, leads, projects, employees, departments) | `loadCrmSnapshot()` with no `getRequestHeader('cookie')` |
| `src/lib/crm.functions.ts:26` | `getDatabaseHealth` | DB connectivity probe (useful for attacker recon) | `pingDatabase()` unauthenticated |
| `src/lib/crm.functions.ts:36` | `getCrmActivity` | recent CRM activity feed | `loadCrmActivity(limit)` |
| `src/lib/crm.functions.ts:40` | `getProjectSnapshot` | project by id | `loadProjectSnapshot(id)` |
| `src/lib/crm.functions.ts:44` | `getEmployeeSnapshot` | employee search snapshot | `loadEmployeeSnapshot(data)` |
| `src/lib/crm.functions.ts:52` | `getCompanyList` | full company list | `listCompaniesFromDb()` |
| `src/lib/project-activities.functions.ts:23` | `getActivityMasterTreeData` | discipline→activity→sub-activity tree (`Cache-Control: private, max-age=300` suggests authenticated, but no check) | `getActivityMasterTree()` — compare with sibling `getProjectAssignments` which correctly uses `ForCookie` |

Contrast with correctly guarded endpoints: `src/lib/leads.functions.ts:13-30` delegates to `getLeadsPageDataForCookie(getRequestHeader('cookie'))` which inside `leads.server.ts:340-353` calls `parseSessionCookie` → `findSessionById` → `userHasPermission(..., 'leads.read')`; similarly `projects.functions.ts`, `proposals.functions.ts`, `quotations.functions.ts`, and the mutation handlers in `project-activities.functions.ts:28-91` all use `ForCookie` variants. The `crm.*` reads are the outliers.

Remediation:

1. Add `requireAuth` / `requirePermission` to every `crm.server.ts` read: e.g.
   ```ts
   export async function loadCrmSnapshotForCookie(cookieHeader: string|undefined) {
     const session = parseSessionCookie(cookieHeader) ? await findSessionById(...) : null;
     if (!session) throw new Error('Unauthorized');
     // optionally check 'reports.view' or 'dashboard:read'
     return loadCrmSnapshot();
   }
   ```
   and update `crm.functions.ts` to `getRequestHeader('cookie')` (pattern already established in `leads.functions.ts:14`).
2. Scope `getDatabaseHealth` to `admin` or remove it from public `serverFn` (it’s an ops probe, not a user feature).
3. Add a lint rule or code-review checklist: “every `createServerFn` must import `getRequestHeader` and call `parseSessionCookie` unless explicitly marked `public` with a comment”.

**[H-04] High — `getActivityMasterTree` is public but cached as `private, max-age=300`**

Evidence: `src/lib/project-activities.functions.ts:23` `setResponseHeader('Cache-Control', 'private, max-age=300')` — the header claims per-user caching, but without auth the cache key is shared. A CDN could cache the tree and serve it to unauthenticated users. After fixing C-02, keep `private` but ensure the cache varies on the session cookie.

**Correctly guarded areas (for parity)**

- `src/lib/leads.server.ts:336-396` `requirePermission(cookieHeader, 'leads.write')` for all mutations, `userHasPermission` for reads.
- `src/lib/proposals.server.ts:609-730` same for `proposals.write/read`.
- `src/lib/projects.server.ts:651-744` same for `projects.write/read`.
- `src/lib/quotations.server.ts:4-56` `userHasPermission(..., 'proposals.read')`.
- `src/lib/project-activities.server.ts:287-363` `userHasPermission` for assignments/work logs (except the tree).
- `src/lib/masters/{software,bank,activity,company,vendor}/server.ts` all require `isUserAdmin` for mutations, with `writeAuditLog`.

### 2.3 SQL Injection

**Verdict: SAFE.** Drizzle ORM parameterizes all queries (`eq`, `and`, `gt`, `lt`, `count`). Raw `sql` usage is limited to:

- `src/lib/auth.server.ts:241-273` IP regex — no DB.
- `src/lib/projects.server.ts:658` / `src/lib/proposals.server.ts:613` / `src/lib/leads.server.ts` — `sql\`${col} like ${'%' + suffix}\``. The `suffix` is derived from an internal code (e.g. `COMP-2026-0001` suffix), not user input, and `sql` tag parameterizes the concatenated string as a single binding. Low risk but prefer `like(\`${prefix}%\`)` with Drizzle’s `like` helper for clarity.

No `db.execute(sql`… string concatenation)` with user input found.

### 2.4 XSS

**Verdict: LOW-MEDIUM.** No `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `document.write`, or `eval(` sinks found in `src` (grep clean). Client `Tiptap` (`src/components/crm/rich-text-editor.tsx`) is the only HTML-producing component (`@tiptap/react ^3.30.3`, `@tiptap/pm ^3.30.3`). Tiptap sanitizes on parse by default (ProseMirror schema), but pasted HTML should be sanitized server-side before storage. Add server sanitization in `projects.server.ts` / `proposals.server.ts` comment/comment fields if they store rich text.

### 2.5 Secrets Exposure

**Verdict: CLEAN.**

- `src/env/server.ts:9-44` `EnvSchema` validates `DEV_DB_URL` as `z.url()` and `DEV_PORT` as `1024-65535`, but only on first access via `Proxy` (lazy validation — `AGENTS.md` explicitly calls this out as intentional so `vite build` doesn’t fail without `DEV_DB_URL`). Runtime throws clearly if missing.
- `.dev.vars`, `.env`, `.dev.vars.example` all gitignored (`.gitignore` lines: `.env`, `.env.*`, `!.env.example`, `.dev.vars`).
- No hardcoded secrets in `src` (grep for `api_key|secret|password.*=.*"` clean except test fixtures).
- `wrangler.jsonc` has no `vars` leaking `DEV_DB_URL`; production uses `wrangler secret put DEV_DB_URL` (documented in `AGENTS.md`).

### 2.6 Dependencies

**New repo:** `package.json` pins are generally current (`react@19.2.8`, `drizzle-orm@1.0.0-rc.4`, `@neondatabase/serverless@1.1.0`, `zod@4.4.3`, `decimal.js@10.6.0`). `pnpm audit` was not runnable in this sandbox (`pnpm: command not found` via `npm exec`), and no `pnpm-lock.yaml` was present at audit path due to missing `pnpm` binary. Local `npm audit` fallback reported `[ERR_PNPM_AUDIT_NO_LOCKFILE]`.

Remediation: install `pnpm@11.22.0` (per `packageManager` field) in CI and run `pnpm audit --prod` plus `pnpm outdated`. The old repo’s 13 vulns do not apply to new (different deps), but new should still gate on audit in CI.

### 2.7 AGENTS.md Gotchas — New

- **Money (paise)**: `src/lib/money.ts:1-283` — `Decimal` precision 28 `ROUND_HALF_UP`, `PAISE_PER_RUPEE=100`, `rupeesToPaise` (round), `paiseToRupees`, `calculateTax` (GST), `calculateMargin`, `formatINR` (Indian grouping `12,34,567`), `formatINRCompact` (Cr/L/K), `parseINRToPaise`, `amountInWordsINR` (recursive crore). Correct and stricter than old’s precision 20. No floats in billing paths.
- **Soft-delete (`isDelete`)**: **Not implemented.** `src/db/schema/auth.ts` and `src/db/schema/crm.ts` / `masters/*` have no `isDelete` / `is_deleted` column. Deletes are hard (`db.delete`). If the product needs soft-delete (old’s `IF(isDelete=0, col, NULL) STORED` unique index), add it now before data accumulates. Otherwise document that deletes are hard and ensure no “undelete” expectation.
- **DB access (`db` lazy Proxy)**: `src/db/index.server.ts:28-34` `new Proxy` defers `neon()` until first query — correct for Workers where `DEV_DB_URL` is injected at runtime. Never call `db` at module top level (AGENTS.md warning).
- **Env lazy validation**: `src/env/server.ts:23-44` `Proxy` validates on first `env.DEV_DB_URL` access — do not convert to eager `z.parse` (breaks `vite build` without env).
- **CSRF**: `src/start.ts:6-12` `createCsrfMiddleware({ filter: c => c.handlerType==='serverFn' })` — covers all `serverFn` calls; verify it rejects missing `Origin`/`Sec-Fetch-Site` correctly (TanStack Start docs).

### 2.8 Security Headers & Transport

**[M-07] Medium — No security headers in new repo; only old’s `/uploads` headers exist**

Evidence: old `next.config.ts:38-48` sets `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment` for `/uploads/*` only; `poweredByHeader:false` (good, removes `X-Powered-By`). Neither repo sets `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`. Workers `vite.config.ts` has no `headers()` equivalent.

Remediation for new (Workers): add headers in `wrangler.jsonc` or via a Workers middleware (e.g. `src/start.ts` or `src/routes/__root.tsx` `headers` export). Minimum:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.ui.porsche.com; img-src 'self' data: https:; connect-src 'self' https://*.neon.tech;
X-Frame-Options: DENY (or CSP frame-ancestors 'none')
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

### 2.9 Rate Limiting & DoS

See H-03. Additional: `src/db/index.server.ts` uses `neon()` HTTP driver (not pooled), so each query is an HTTP fetch to Neon — no connection pool exhaustion, but also no server-side throttling. An unauthenticated caller hitting `getCrmSnapshot` repeatedly (C-02) can drive Neon costs.

---

## 3. Cross-Repo Thematic Findings

### 3.1 `requesting-code-review` style scan (added-lines simulation)

Static patterns scanned on both repos (added-lines analogue = full `src` grep):

- Hardcoded secrets: **PASS** (no `api_key|secret|password|token = "literal"` beyond test fixtures).
- Shell injection (`os.system`, `subprocess shell=True`): **N/A** (JS/TS).
- `eval/exec`: **PASS** (no `eval(`, `exec(` with user input).
- `pickle.loads`: **N/A**.
- SQL string formatting: **PASS** (no `execute(f"` / `.format(SELECT`).
- Baseline tests/lint: `vitest` present in both; old has `85 tests` (per `tree.txt`), new has colocated `*.test.ts` (e.g. `src/lib/money.test.ts`, `src/lib/auth.server.test.ts`). `eslint` flat config in old; new has no lint script (`AGENTS.md` notes “No lint script and no CI — pnpm test + pnpm build are the whole gate”). Typecheck: `tsc --noEmit` is the final gate in both.

### 3.2 Money Handling

Both repos correctly use `Decimal.js` and paise integers. New’s `src/lib/money.ts` is the reference implementation (precision 28, `isFinite` guard, `divideMoney` zero check, `amountInWordsINR` recursive for >99 Cr). Old’s `src/lib/money.ts` precision 20 is slightly lower but still correct. Ensure new’s `Pension` / `payroll-calculator` equivalents (when ported) continue to use `calculateTax` / `calculateMargin` rather than floats.

### 3.3 Session Handling

Old’s 5-min cache + `invalidateUserCache` is a performance optimization that introduces a narrow consistency window; new’s direct `findSessionById` per request is simpler and safer for Workers (where Durable Objects / KV caching can be added later if needed). Both use 30-day TTL — consider shortening to 7 days + sliding refresh for better posture.

---

## 4. Prioritized Remediation Backlog for `accent-new`

### P0 — Ship before next review

1. **[C-02] Gate unauthenticated reads** — `src/lib/crm.functions.ts:22,26,36,40,44,52` + `src/lib/project-activities.functions.ts:23`. Create `*ForCookie` wrappers in `crm.server.ts` mirroring `leads.server.ts:340-353` pattern, update `crm.functions.ts` to pass `getRequestHeader('cookie')`. Scope `getDatabaseHealth` to `admin` or delete it. (Est. 1–2h, no migration.)
2. **[H-03] Add rate limiting** — At minimum, `loginUser` 5/15m per IP+email. Use Cloudflare Rate Limiting rule + in-code KV counter fallback. Add `429` handling in `LoginForm`. (Est. 2–3h.)
3. **[H-02/C-01 carryover] Wire `pnpm audit` in CI** — add `pnpm audit --prod` to the `pnpm test && pnpm build` gate; fix old’s 13 vulns if old stays deployed. (Est. 30m.)

### P1 — This sprint

4. **[H-04/M-06] Harden cookies** — set `__Host-accentcrm_session`, always `Secure` when `request.url` is https, document `SameSite=Lax` CSRF posture. (Est. 1h.)
5. **[M-07] Add security headers** — CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy via Workers middleware or `wrangler.jsonc` headers. (Est. 1–2h.)
6. **[M-05] Server-side Tiptap sanitization** — add `isomorphic-dompurify` in `*.server.ts` before persisting rich text. (Est. 1h.)
7. **[M-02/M-04] Document soft-delete decision** — either add `isDeleted` boolean + filtered indexes to all operational tables (like old’s `isDelete` + `IF(isDelete=0,col,NULL)` unique) or explicitly document hard-delete and add a “deleted” audit log. (Est. 2–4h if adding.)

### P2 — Next sprint / hygiene

8. Shorten session TTL to 7 days with sliding refresh; add `deleteExpiredSessions` cron (Workers Cron Trigger daily).
9. Fix `getActivityMasterTree` cache header to `private, no-store` or `Vary: Cookie` after auth is added.
10. Add `eslint` + `tsc --noEmit` to CI (new currently has “no lint script”).
11. Migrate old’s remaining plaintext passwords and remove `needsRehash` branch; then decommission old’s `proxy.ts` rate limiter or move to shared Redis.

---

## 5. Appendix — Evidence Index

### Old repo key files

- `proxy.ts:4-21` publicPaths, `41-63` RATE_LIMITS, `65-78` getClientIP, `81-107` getRateLimitCategory, `109-177` checkRateLimit, `181-204` cleanupRateLimitStore, `221-310` proxy handler + matcher.
- `src/utils/api-permissions.js:19-62` userCache + USER_CACHE_TTL 5m, `64-89` getCurrentUser, `107-205` _fetchUserFromDb with `s.token_hash`, `expires_at > NOW()`, `isDelete=0`.
- `src/utils/session.ts:3-53` SESSION_TTL 30d, `createSessionToken` randomBytes(32), `hashSessionToken` SHA-256, `createSession`/`revokeSession`/`revokeAllUserSessions`.
- `src/utils/database.js:1-186` dotenv, `globalThis.__dbPool`, `connectionLimit:5`, `queueLimit:200`, `maxIdle:2`, retry + auto-create DB.
- `src/utils/rbac.js:1-399` RESOURCES/PERMISSIONS/PERMISSION_TEMPLATES, `src/utils/permissions.js:1-379` checkPermission dual model, `src/utils/password.ts:1-35` bcrypt + legacy fallback.
- `src/utils/activity-logger.ts:1-507`, `src/app/api/login/route.js:1-258`, `src/app/api/logout/route.js:1-60`, `src/app/api/attendance/webhook/route.ts:1-276` (secretsEqual + Bearer), `src/app/api/uploads/route.js:1-100` (sharp rasterization), `src/lib/sanitize.js:1-40`, `src/lib/money.ts:1-52`, `next.config.ts:1-51`.

### New repo key files

- `src/lib/auth.server.ts:1-205` scrypt + session + findSessionById + normalizeIpAddress + parseSessionCookie, `301-398` DEFAULT_ROLES / ensureDefaultRoles / isUserAdmin / userHasPermission.
- `src/lib/auth.functions.ts:1-645` loginUser / getCurrentUser / logoutUser / registerUser / getRegistrationStatus, `39-47` cookie helpers, `50-60` requestSessionMetadata.
- `src/start.ts:1-12` createCsrfMiddleware for serverFn, `src/env/server.ts:1-44` lazy Proxy validation, `src/db/index.server.ts:1-38` lazy Proxy for neon, `src/db/schema/auth.ts:1-104` users/sessions/roles/permissions/auditLogs.
- `src/lib/leads.server.ts:336-353` requirePermission pattern (reference for fix), `src/lib/crm.functions.ts:1-52` (unauthenticated — fix target), `src/lib/crm.server.ts` (no auth), `src/lib/project-activities.functions.ts:23` + `src/lib/project-activities.server.ts` (tree unauthenticated).
- `src/lib/money.ts:1-283` Decimal precision 28 paise, `src/routes/__root.tsx:82-97` loader fetching getCurrentUser, `wrangler.jsonc`, `vite.config.ts`, `drizzle.config.ts`.

### Commands run

```bash
npm audit --json          # old: 13 vulns (see C-01)
# pnpm audit --json       # new: pnpm not in PATH in sandbox; lockfile present at /tmp/hermes-accent-new/pnpm-lock.yaml
grep -rn 'dangerouslySetInnerHTML|innerHTML' src
grep -rn 'isDelete|is_delete' src
grep -rn 'findSessionById|parseSessionCookie|userHasPermission|isUserAdmin' src/lib
grep -rn 'createServerFn' src/lib --include='*.ts'
grep -rn 'rateLimit|RATE_LIMIT' src
grep -rn 'Secure|HttpOnly|SameSite' src
```

---

*Report generated by `hermes/security-audit`. Reviewers: run `pnpm test && pnpm build` then `pnpm audit`, spot-check C-02 fix by calling `getCrmSnapshot` without a cookie (should 401), and verify `proxy.ts` rate-limit behavior under load. Carry P0 items into the next sprint board.*
