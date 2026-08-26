# Plan — Replicate accent (tzevk/accent) Pages in accent-new (Harshitttttttt/accent-new) — Option A (Full Inventory)

> **Date:** 2026-08-27 · **Branch:** `hermes/plan-replicate-pages` → `dev` · **Author:** Hermes Agent  
> **Repos:** `tzevk/accent` (`/tmp/accent-old`, Next.js + MySQL/Knex) · `Harshitttttttt/accent-new` (`/tmp/hermes-accent-new`, TanStack Start + Postgres/Neon + Drizzle 1.0-rc)  
> **Stack rules (AGENTS.md):** `pnpm`, paise integers + `Decimal.js`, `createServerFn`, `~/` alias, Drizzle modular schema under `src/db/schema/*`, `src/lib/<domain>.server.ts` never imported client-side.

---

## 0 · Executive Summary

- **Old:** 104 `src/app/**/page.jsx|tsx` pages + 211 `src/app/api/**/route.*` handlers across ~44 API groups; 110 MySQL tables (baseline) + ~7 later tables (bank_documents, payment_issues, deliverables, sessions, attendance_logs, leave_system).
- **New:** 23 route files (`src/routes/*`) + 20 CRM page components (`src/crm/pages/*`); 48 Drizzle `pgTable` tables + 21 `pgEnum` types; Neon Postgres + Drizzle-kit migrations in `drizzle/`.
- **Implemented (real, not stub):** Dashboard, Projects + ProjectDetail, Proposals + ProposalDetail, Leads, 5 masters (Activity, Bank, Company, Software, Vendor), EmployeeDirectory + EmployeeProfile, Finance, Messages, Tasks, Reports (shell), Quotations (quotation document), generic Admin/Master shells — roughly **~40–45 old pages** have a functional equivalent; **~60 pages** remain as `GenericPage` stubs or are entirely absent.
- **Biggest gaps:** Admin finance suite (invoices, POs, cash vouchers, expenses, payroll, material requisitions, salary sheets), 8+ masters (account-heads, holidays, descriptions, documents, roles/permissions, deliverables, categories, deliverable-categories), all 10 report drill-downs, employee operational pages (attendance/contract/leaves/payroll), tickets, work-logs, live-monitoring, gate/profile, audit logs.
- **Recommendation:** 4 phases (P1 core → P2 masters → P3 reports → P4 admin/finance) over ~8–12 weeks for a solo engineer, or 5–6 weeks with 2 engineers in parallel after P1.

---

## 1 · Route Map — Old `src/app/**/page` → New `src/routes` / `src/crm/pages`

### 1.1 Conventions

| Concern | Old (Next.js) | New (TanStack Start) |
|---|---|---|
| Routing | `src/app/<segment>/page.jsx` + folder-based layouts, `src/app/api/**/route.js` | `src/routes/<file>.tsx` (file-based), `$param.tsx` for dynamics, `src/lib/*.functions.ts` (`createServerFn`) for RPC |
| Auth guard | `src/app/admin/layout.tsx` (`getServerAuth()` + redirect), per-page checks | `src/routes/__root.tsx` loader (`currentUser`), `PorscheDesignSystemProvider` shell; CRM vs standalone shells |
| Nav coupling | Sidebar links hard-coded | `src/crm/navigation.ts` (`pageFromPath` + `useCrmNavigation`) — adding a route requires updating this mapping |
| Shells | Separate `/admin`, `/user`, `/gate` layouts | Unified CRM shell under `__root.tsx`; role-aware `Sidebar.tsx`/`TopBar.tsx` |

### 1.2 Full Page Table (104 rows)

Legend: **Status** — ✅ Done (real component) · 🟡 Stub (GenericPage / mock data) · ⬜ Not started (no route, no component). **New Target** shows the TanStack route file or CRM page that should own the feature.

| # | Old page (Next.js) | Purpose | New route / CRM page | Status | Notes / Gap |
|---|---|---|---|---|---|
| 1 | `/` (`src/app/page.jsx`) | Landing / redirect to dashboard/signin | `src/routes/index.tsx` + `Dashboard.tsx` | ✅ | Root redirect + dashboard charts done |
| 2 | `/dashboard` | Main CRM dashboard (KPIs, charts, activities) | `/` (`Dashboard.tsx`) | ✅ | Recharts, mock KPIs; needs real `crm.functions` wiring |
| 3 | `/signin` | Login form | `src/routes/login.tsx` + `login-form.tsx` | ✅ | Scrypt auth, session cookie done |
| 4 | `/profile` | Current user profile | `/module/profile` (generic) or `EmployeeProfile.tsx` for self | 🟡 | No dedicated `/profile` route; add `src/routes/profile.tsx` |
| 5 | `/gate` | Employee gate check-in/out | `/module/gate` (generic) | ⬜ | No gate page; needs attendance gate UI + `employee_attendance` API |
| 6 | `/leads` (`page.js`) | Lead list | `src/routes/leads.tsx` + `Leads.tsx` | ✅ | Kanban+table, Drizzle `leads` + `lead_stage_history` done |
| 7 | `/leads/new` | Create lead | `leads.tsx` (modal/createServerFn inside page) | ✅ | Create path exists inside Leads page |
| 8 | `/leads/[id]` | Lead detail | `leads.tsx` (detail drawer/modal) | 🟡 | No `/leads/$leadId` deep link; add dynamic route |
| 9 | `/leads/[id]/edit` | Edit lead | same as above | 🟡 | Same — edit inside drawer |
| 10 | `/company` | Company list | `masters/company-master` → `CompanyMaster.tsx` | ✅ | `companies` + `contacts` + `company_emails` tables done |
| 11 | `/company/[id]` | Company detail | `CompanyMaster.tsx` detail drawer | 🟡 | No `$companyId` drill-down |
| 12 | `/company/[id]/edit` | Edit company | same | 🟡 | Inline edit |
| 13 | `/vendors` | Vendor list | `masters/vendor-master` → `VendorMaster.tsx` | ✅ | `vendors` + child tables done |
| 14 | `/vendors/new` | Create vendor | `VendorMaster.tsx` create | ✅ | In-page |
| 15 | `/vendors/[id]` | Vendor detail | `VendorMaster.tsx` detail | 🟡 | No `$vendorId` route |
| 16 | `/vendors/[id]/edit` | Edit vendor | same | 🟡 | Inline |
| 17 | `/projects` | Project list | `src/routes/projects/index.tsx` + `Projects.tsx` | ✅ | Full CRUD done, Drizzle `projects` + 9 child tables |
| 18 | `/projects/new` | Create project | `projects/index.tsx` (create form) | ✅ | Via `projects.functions` |
| 19 | `/projects/[id]` | Project detail | `projects/$projectId.tsx` + `ProjectDetail.tsx` | ✅ | Tabs (Overview, Members, Milestones, Risks, Scope, Comments, History) done |
| 20 | `/projects/[id]/edit` | Edit project | `ProjectDetail.tsx` edit mode | ✅ | In-page |
| 21 | `/proposals` (`page.jsx`) | Proposal list | `proposals/index.tsx` + `Proposals.tsx` | ✅ | List+filters done |
| 22 | `/proposals/[id]/edit` | Edit proposal | `proposals/$proposalId.tsx` edit | 🟡 | ProposalDetail is read+history; needs edit form |
| 23 | `/proposals/[id]` (`page.js`) | Proposal detail | `proposals/$proposalId.tsx` + `ProposalDetail.tsx` | ✅ | Status history, deliverables, quotation lines, follow-ups done |
| 24 | `/employees` (`page.jsx`) | Employee directory | `employees/index.tsx` + `EmployeeDirectory.tsx` | ✅ | `employees` + dept/designation/manager done |
| 25 | `/employees/attendance` | Attendance register | `reports/$report` (`reports-attendance`) or `employees` sub-tab | ⬜ | `computed_attendance`/`attendance_monthly` not ported |
| 26 | `/employees/contract` | Contracts | `masters` or `employees` sub-page | ⬜ | No contract table in new schema |
| 27 | `/employees/leaves` | My leaves | `module/leaves` | ⬜ | `holiday_master` + `leaves` family not ported (migrations 20260825 leave system) |
| 28 | `/employees/payroll` | My payroll | `module/payroll` / `finance` | ⬜ | Salary tables not ported |
| 29 | `/masters/users` | User master (RBAC) | `masters/users.tsx` + `UserMaster.tsx` | ✅ | `users` + `roles` + `permissions` + `user_roles` done; permissions UI partial |
| 30 | `/masters/users/[id]/permissions` | Per-user permissions | `masters/users.tsx` detail | 🟡 | Permissions per user needs dedicated route `masters/users.$userId.tsx` |
| 31 | `/masters/banks` | Bank master | `masters/bank-master` → `BankMaster.tsx` | ✅ | `banks` + `bank_contacts` done |
| 32 | `/masters/activities` | Activity master (functions/activities/sub-activities) | `masters/activity-master` → `ActivityMaster.tsx` | ✅ | `disciplines` → `discipline_activities` → `discipline_sub_activities` done |
| 33 | `/masters/software` | Software master | `masters/software-master` → `SoftwareMaster.tsx` | ✅ | `software_masters` done |
| 34 | `/masters/documents` | Documents master | `masters/deliverables-master` / `description-master` stubs | 🟡 | `documents_master` not ported; GenericPage |
| 35 | `/masters/deliverables` | Deliverables master | `masters/deliverables-master` → GenericPage | 🟡 | Needs `deliverables` table (created 20260804) |
| 36 | `/masters/deliverable-categories` | Deliverable categories | `masters/deliverables-master` (future split) | 🟡 | `deliverable_categories` table not ported |
| 37 | `/masters/descriptions` | Description master | `masters/description-master` → GenericPage | 🟡 | `description_master` not ported |
| 38 | `/masters/categories` | Category master | `masters/expense-category` → GenericPage | 🟡 | `category_master` not ported |
| 39 | `/masters/roles` | Roles master | `masters/users` + `UserMaster.tsx` (role tab) | 🟡 | RBAC role list inside UserMaster; needs standalone `masters/roles.tsx` |
| 40 | `/masters/holidays` | Holiday master | `masters/holiday-master` → GenericPage | 🟡 | `holiday_master` not ported |
| 41 | `/masters/account-heads` | Account heads | `masters/account-head` → GenericPage | 🟡 | `account_head_master` + `account_master` not ported |
| 42 | `/masters/accounts/account-heads` | Nested account heads | same as above | 🟡 | Duplicate; consolidate into `account-head` |
| 43 | `/masters/accounts/descriptions` | Account descriptions | same (`description-master`) | 🟡 | Duplicate |
| 44 | `/admin/dashboard` | Admin KPIs | `/admin` (`admin/index.tsx`) | 🟡 | `admin/index.tsx` exists but is minimal; needs real `admin/dashboard-stats` charts |
| 45 | `/admin/quotation` | Admin quotations table | `/admin/quotations.index.tsx` + `Quotations.tsx` | ✅ | Quotation list + `Quotations.tsx` (standalone quotation) partially overlaps proposals quotation lines |
| 46 | `/admin/quotation/[id]/view` | View quotation | `admin/quotations.$quotationId.tsx` + `QuotationDocument.tsx` | ✅ | Read-only quotation doc done |
| 47 | `/admin/quotation/[id]/edit` | Edit quotation | `admin/quotations.$quotationId.tsx` edit | 🟡 | Edit mode inside quotation doc needs form |
| 48 | `/admin/quotation-outgoing` | Outgoing quotations | `/admin/quotations` filtered (`outgoing_quotations`) | 🟡 | `outgoing_quotations` table not ported; currently part of proposal quotation lines |
| 49 | `/admin/invoice` | Sale invoices | `/admin/$module` (`sale-invoices`) → GenericPage | ⬜ | `invoices` table not ported; P4 |
| 50 | `/admin/invoice/create` | Create invoice | same → needs `admin/invoices` forms | ⬜ | No create route |
| 51 | `/admin/invoice/edit/[id]` | Edit invoice | `/admin/quotations.$quotationId` style edit | ⬜ | Not started |
| 52 | `/admin/purchase-order` | Purchase orders | `/admin/$module` (`purchase-orders`) → GenericPage | ⬜ | `purchase_orders` + `purchaseOrder` child not ported |
| 53 | `/admin/purchase-order/edit/[id]` | Edit PO | needs `admin/purchase-orders.$id.tsx` | ⬜ | Not started |
| 54 | `/admin/purchase-order/view/[id]` | View PO | needs same view | ⬜ | Not started |
| 55 | `/admin/outgoing-purchase-order` | Outgoing POs | `/admin/$module` (`purchase-orders` variant) | ⬜ | `outgoing_purchase_orders` not ported |
| 56 | `/admin/purchase-invoice` | Purchase invoices | `/admin/$module` (`purchase-invoices`) → GenericPage | ⬜ | `purchase_invoices` not ported |
| 57 | `/admin/accounts` | Accounts / ledger | `/admin/$module` (not mapped) → GenericPage | ⬜ | `account_transactions` + `account_master` not ported |
| 58 | `/admin/expenses` | Expenses | `/admin/$module` (`expenses`) → GenericPage | ⬜ | `expenses` not ported |
| 59 | `/admin/other-expenses` | Other expenses | `expenses` variant → GenericPage | ⬜ | `other_expenses` not ported |
| 60 | `/admin/petty-cash-expenses` | Petty cash | `cash-voucher` + `petty_cash_expenses` → GenericPage | ⬜ | `petty_cash_expenses` not ported |
| 61 | `/admin/cash-voucher` | Cash vouchers | `/admin/$module` (`cash-voucher`) → GenericPage | ⬜ | `cash_vouchers` not ported |
| 62 | `/admin/cash-voucher/new` | New voucher | needs dedicated form | ⬜ | Not started |
| 63 | `/admin/cash-voucher/edit/[id]` | Edit voucher | needs `$id` | ⬜ | Not started |
| 64 | `/admin/material-requisition` | Material reqs | `/admin/$module` (`material-req`) → GenericPage | ⬜ | `material_requisitions` not ported |
| 65 | `/admin/material-requisition/new` | New req | dedicated form | ⬜ | Not started |
| 66 | `/admin/payment-entry` | Payment entries (receipts/payments) | `/admin/$module` (`payment-received` / `payment-issued`) → GenericPage | ⬜ | `payment_entries` + `payment_payables`/`payment_receivables` not ported |
| 67 | `/admin/payment-issue` | Payment issues | same | ⬜ | `payment_issues` (migration 20260723) not ported |
| 68 | `/admin/payroll-schedules` | Payroll schedules | `/admin/$module` (`salary-sheet`/`salary-slip`) | ⬜ | `payroll_schedules` + `payroll_runs` not ported |
| 69 | `/admin/salary-sheet` | Salary sheet | `/admin/$module` (`salary-sheet`) → GenericPage | ⬜ | `salary_slips` + `employee_payroll` not ported |
| 70 | `/admin/salary-slip` | Salary slip | `/admin/$module` (`salary-slip`) | ⬜ | Same |
| 71 | `/admin/da-schedule` | DA schedule | module | ⬜ | `da_schedule` not ported |
| 72 | `/admin/live-monitoring` | Live monitoring | `/admin/$module` (`live-monitoring`) → GenericPage | ⬜ | `user_activity_logs` + `user_screen_time` + presence not ported |
| 73 | `/admin/live-monitoring/user/[id]` | User live view | `/admin/$module` + `$userId` | ⬜ | Not started |
| 74 | `/admin/activity-logs` | Activity logs | `/admin/$module` (`activity-logs`) → GenericPage | 🟡 | `audit_logs` ported but no UI filter/timeline |
| 75 | `/admin/audit-logs` | Audit logs (duplicate) | same as above | 🟡 | Same table; consolidate |
| 76 | `/admin/productivity` | Productivity | `/admin/$module` (`live-monitoring` variant) or `Reports.tsx` | ⬜ | `user_work_logs`/`work_logs` not ported |
| 77 | `/admin/todos` | Admin todos | `/admin/$module` (`todos`) → GenericPage | 🟡 | `todos` table not ported; `Tasks.tsx` exists as mock |
| 78 | `/admin/tickets` | Tickets | `/module/tickets` or `tasks` | ⬜ | `support_tickets` + `ticket_comments` not ported |
| 79 | `/reports` | Reports index | `src/routes/reports/index.tsx` + `Reports.tsx` | ✅ | Index with report cards done |
| 80 | `/reports/attendance-report` | Attendance report | `reports/$report` (`reports-attendance`) → GenericPage | 🟡 | Reports.tsx has mock chart; no Drizzle query |
| 81 | `/reports/client-balance` | Client balance | `reports/$report` (`reports-balances`) | 🟡 | Mock |
| 82 | `/reports/client-balance/[client]` | Client detail | `reports/$report` + drill | ⬜ | Not started |
| 83 | `/reports/employee-report` | Employee report | `reports/$report` (`reports-employee`) | 🟡 | Mock |
| 84 | `/reports/employee-project-cost` | Employee project cost | `reports/$report` (`reports-employee` variant) | 🟡 | Needs `project_daily_activity`/`project_manhours` |
| 85 | `/reports/manhours-billing` | Manhours billing | `reports/$report` (`reports-manhours`) | 🟡 | Mock |
| 86 | `/reports/project-status` | Project status | `reports/$report` (`reports-project-status`) | 🟡 | Mock |
| 87 | `/reports/project-activities` | Project activities | same | 🟡 | Needs `project_activities` join |
| 88 | `/reports/sales-register` | Sales register | `reports/$report` (new `reports-sales-register`) | ⬜ | Mock only |
| 89 | `/reports/timesheet-report` | Timesheet report | `reports/$report` (`reports-timesheet`) | 🟡 | Needs `work_logs` |
| 90 | `/tickets` | Tickets list | `/tasks` (shares) or dedicated `/tickets` | ⬜ | No tickets route; `Tasks.tsx` is mock |
| 91 | `/tickets/new` | New ticket | needs form | ⬜ | Not started |
| 92 | `/tickets/[id]` | Ticket detail | needs `$ticketId` | ⬜ | Not started |
| 93 | `/user/dashboard` | User personal dashboard | `/` (role-aware) or `/module/user-dashboard` | 🟡 | No separate user dashboard; CRM dashboard is unified |
| 94 | `/user/leaves` | Self-service leaves | `/module/leaves` | ⬜ | `leaves` family not ported |
| 95 | `/users/[id]/activity` | User activity timeline | `/employees/$employeeId` → `EmployeeProfile.tsx` tab | 🟡 | Profile exists but not activity timeline |
| 96 | `/work-logs` | Work logs | `/tasks` or `reports-timesheet` | ⬜ | `work_logs` + `user_work_logs` not ported |
| 97 | `/todos` (admin/todos duplicate) | Todos | `/tasks` + `GenericPage` todos | 🟡 | Mock |
| 98 | `/messages` | Chat / messages | `src/routes/messages.tsx` + `Messages.tsx` | ✅ | Shell done (mock threads); needs `messages` + `conversations` tables |
| 99 | `/admin/accounts` (duplicate) | Accounts list | same as #57 | ⬜ | Duplicate |
|100 | `/admin/expenses` (duplicate) | Expenses list | same as #58 | ⬜ | Duplicate (tsx vs jsx) |
|101 | `/admin/outgoing-purchase-order` (tsx) | Outgoing PO | same as #55 | ⬜ | Duplicate |
|102 | `/admin/quotationOut` (alias) | Outgoing quot. | same as #48 | 🟡 | Alias |
|103 | *(catch-all)* `/admin/*` other layouts | Admin guard layout | `src/routes/admin/$module.tsx` + `__root.tsx` | 🟡 | `getServerAuth` → `currentUser` ported but role check needs tighten |
|104 | *(catch-all)* `src/app/api/**` (211 handlers) | All REST endpoints | `src/lib/*.functions.ts` (`createServerFn`) | 🟡 | ~15 `*.functions.ts` exist; ~35 API groups still missing |

**Coverage summary:** ~22 ✅ · ~27 🟡 · ~55 ⬜ → **~21% fully done, ~26% stubbed, ~53% absent.**

> Note on API parity: the new repo deliberately replaces Next `route.js` handlers with `createServerFn` RPC (see AGENTS.md). Every row above marked ⬜ that requires data needs a matching `src/lib/<domain>.server.ts` + `src/lib/<domain>.functions.ts` pair with Zod validation, `private, max-age=300` reads / `no-store` mutations, and `{ ok, message?, data? }` mutation shape.

---

## 2 · Schema Delta — MySQL/Knex (old) vs Postgres/Drizzle (new)

### 2.1 Quantitative Overview

| Metric | Old (`tzevk/accent`) | New (`accent-new`) | Delta |
|---|---|---|---|
| **DB engine** | MySQL 8 (Knex migrations, `SET FOREIGN_KEY_CHECKS=0`) | Postgres 16 via Neon HTTP (`@neondatabase/serverless`) | Full platform switch; all migrations rewritten in `drizzle/*.sql` |
| **ORM / migrations** | Knex raw `knex.raw(CREATE TABLE…)` | Drizzle ORM `1.0.0-rc.4` + `drizzle-kit` | Typed `pgTable`, `pgEnum`, indexes in table callbacks |
| **PK strategy** | Mixed: `int AUTO_INCREMENT` (most), `char(36) DEFAULT uuid()` (some), `varchar(36)` | Uniform `uuid DEFAULT gen_random_uuid()` (one CRM legacy table uses `varchar(80)`) | Consistent distributed IDs, no integer exhaustion, join-safe |
| **FK discipline** | Many tables lack FKs; rest use `ON DELETE CASCADE/SET NULL` ad hoc | Every reference declared (`references(() => …)`), explicit `onDelete`, indexed | Reliable referential integrity; catch-alls removed |
| **Money type** | `decimal(15,2)` / `decimal(10,2)` floats in columns, JS float math | `bigint` paise (`mode: 'number'` or `integer` paise) + `Decimal.js` (precision 28, HALF_UP) | No rounding drift; `src/lib/money.ts` helpers + `formatINR`/`amountInWordsINR` |
| **Soft delete** | `isDelete tinyint(1) DEFAULT 0` (or `is_delete`) on ~5 tables (cash_vouchers, companies, etc.) | `deletedAt timestamp withTimezone` + `deletedBy uuid FK` + partial indexes `WHERE deleted_at IS NULL` | Queryable history, audit-friendly, hot-path indexes |
| **Timestamps** | `timestamp DEFAULT current_timestamp() ON UPDATE` (MySQL) | `timestamp({ withTimezone: true }).defaultNow()` (Postgres timestamptz) | TZ-aware |
| **List fields** | `longtext JSON` (`attachments`, `line_items`, `punch_details`, project `scope` blobs) | First-class child tables with `position` + `CHECK` + `UNIQUE` (e.g. `project_members`, `proposal_quotation_lines`) | Queryable, indexable, no JSON-valid-check hack |
| **Enums** | MySQL `enum('draft','sent',…)`, inconsistent naming | 21 `pgEnum`s (`proposal_status`, `lead_stage`, `project_lifecycle`, `assignment_status`, …) | Single source of truth, typo-proof |
| **Total tables** | **110 baseline** + 7 later (`bank_documents`, `payment_issues`, `deliverable_*`, `sessions`, `attendance_logs`, `leave_*`) ≈ **117** | **48 `pgTable`s** (+ 2 CRM mock tables `crm_projects`/`crm_activities`) | ~69 old tables not yet ported — intentional for phased cutover |
| **Migrations** | 21 Knex files (baseline + upgrades for soft-delete, invoice uniqueness, etc.) | 13 `drizzle/*_*.sql` migrations to date (seed RBAC, leads, projects, proposals, masters, etc.) | Knex history is the source of truth for what still needs porting |

### 2.2 Table-by-Table Comparison (representative; full baseline = 110)

| Old MySQL table | Old shape (notable) | New Drizzle table(s) | Status | Improvement |
|---|---|---|---|---|
| `users` | `int PK`, plain hash? | `users` (`uuid`, `passwordHash` scrypt N=16384, `isActive`, `lastLoginAt`) | ✅ Ported & hardened | UUID, scrypt, `idx_users_email/username`, session separation |
| `roles`, `roles_master` (duplicate) | `int PK`, no perms | `roles` (`uuid`, `code` unique), `permissions` (`code` unique), `user_roles`, `role_permissions` (composite PKs) | ✅ Consolidated | Deduplicated, normalized M:N, seeded via `onConflictDoNothing` |
| `user_permissions` | Direct user→perm link | `role_permissions` (role→perm) + `user_roles` | ✅ Replaced | RBAC via roles, not ad-hoc per-user rows |
| `sessions` | *not in baseline* (added 20260811) | `sessions` (`text PK`, `userId→users`, `expiresAt`, `ipAddress inet`, `userAgent`) | ✅ Ported | `inet` type, cascade, indexed expiry |
| `audit_logs` | `int PK`, `resource_id int`, `ip_address`, `user_agent` | `audit_logs` (`uuid`, `userId→users`, `resourceId text`, `oldValue/newValue jsonb`) | ✅ Improved | UUID, `jsonb` (not longtext JSON), better indexes, consistent FK |
| `companies` | `int PK`, flat address, `isDelete`, no FK | `companies` (`uuid`, `code` unique, `gstin` unique, `accountManagerId→employees`, `status` enum) + `contacts` + `company_emails` | ✅ Normalized | Proper children, enums, soft-delete via future `deletedAt` (needs add) — one gap |
| `vendors` | flat, `int PK` | `vendors` (`uuid`, `vendorCategory` enum, `status` enum, `rating`, `msmeNumber`) + `vendor_contacts` + `vendor_emails` | ✅ Normalized | Typed categories/status, rating, MSME, SNS |
| `employees` | `int PK`, single table | `employees` (`uuid`, `user_id` unique FK→users, `departmentId`, `designationId`, `managerId` self-FK, `employmentType`/`status` enums, `skills text[]`) + `departments` + `designations` | ✅ Normalized | Nullable user linkage (HR vs login split), self-FK manager hierarchy |
| `leads` | `int PK`, flat, `decimal` values | `leads` (`uuid`, `leadNumber` unique `NNN-MM-YYYY`, `companyId→companies`, `companyName` denormalized, `enquiryType`/`sourceCode`/`stage`/`priority` enums, `valuePaise bigint`, checks `>=0`, `0–100` ranges, partial indexes `WHERE deleted_at IS NULL`, `deletedAt/By`) + `lead_stage_history` + `lead_sources` | ✅ Major upgrade | Paise, partial indexes, stage history append-only, CC emails array |
| `proposals` | `int PK`, ~60 columns, many JSON `longtext` lists | `proposals` (`uuid`, `proposalNumber P-NNN-MM-YYYY`, enums, `valuePaise`/`estimatedCostPaise` bigint, checks, partial index, `deletedAt/By`) + 6 children: `proposal_input_documents`, `proposal_deliverables`, `proposal_software`, `proposal_exclusions`, `proposal_quotation_lines` (with `unitPricePaise`, `amountPaise`, `CHECK qty>0`), `proposal_follow_ups`, `proposal_comments`, `proposal_status_history` | ✅ Fully normalized | No JSON blobs; quote lines with server-computed `amountPaise`, ordered by `position` |
| `projects` | `int PK`, wide, `project_activities` etc. JSON-ish | `projects` (`uuid`, `projectNumber PRJ-NNN-MM-YYYY`, `proposalId`+`leadId` provenance, enums `project_lifecycle`/`priority`/`contract_type`, `progress 0–100`, `contractValuePaise` etc., partial index) + 9 children: `project_members` (unique `project+employee`), `project_milestones`, `project_risks`, `project_input_documents`, `project_deliverables`, `project_exclusions`, `project_software`, `project_comments`, `project_status_history`; plus `project_activity_assignments`/`project_activity_logs` | ✅ Fully normalized | Provenance chain, milestones/risks first-class, copy-on-conversion from proposal scope annexures |
| `bank_master` | `varchar(36) PK`, `BankCode` unique | `banks` (`uuid`, `code` unique, `accountNumber+ifscCode` unique, `bankName`/`accountType/status` enums, `openingBalancePaise/currentBalancePaise/overdraftLimitPaise integer`, address, contact) + `bank_contacts` | ✅ Upgraded | Paise balances, composite unique (acct+IFSC), contacts child, status enum |
| `activities_master`, `functions_master`, `sub_activities` | 3 tables, `char(36) FK` discipline→activity | `disciplines` → `discipline_activities` (unique `discipline+code`, FK `restrict`) → `discipline_sub_activities` (unique `activity+code`) with `isActive`, indexed | ✅ Upgraded | Restrict delete at discipline level, composite uniques, uniform UUID |
| `softwares`, `software_categories`, `software_versions` | 3 tables, loose | `software_masters` (`uuid`, `code` unique, `totalLicenses/usedLicenses`, `costPaise`, `currency`, `purchaseDate/expiryDate`, `isActive`) | ✅ Consolidated | Deduplicated; version tracking deferred to child if needed |
| `quotations`, `proposal_annexures`, `proposal_versions`, `approvals` | `int PK`, `proposals.quotations` JSON-ish | (absorbed into `proposal_quotation_lines` + `proposal_status_history`/`approvals` → status history) | 🟡 Superseded | Old `quotations` → new quotation-line model; `approvals`→`proposal_status_history` |
| `invoices`, `project_invoices` | `decimal(15,2)`, status enum, JSON attachments | *(not yet ported)* | ⬜ TODO P4 | Needs `invoices` + `invoice_lines` (tax/GST), `project_invoices` linkage |
| `purchase_orders`, `outgoing_purchase_orders`, `purchase_invoices` | `int PK`, duplicate groups | *(not yet ported)* | ⬜ TODO P4 | Unify into `purchase_orders` + `purchase_order_lines` + `purchase_invoices` |
| `payment_entries`, `payment_payables`, `payment_receivables`, `payment_issues` | 4 tables, subtle overlap | *(not yet ported)* | ⬜ TODO P4 | Needs clean ledger: `payment_entries` + `payables`/`receivables` distinct |
| `cash_vouchers` | `decimal`, duplicate unique keys ×63 (!), `isDelete` | *(not yet ported)* | ⬜ TODO P4 — high debt | Fix duplicate indexes; paise; `voucher_lines JSON` → child table |
| `expenses`, `other_expenses`, `petty_cash_expenses` | `decimal`, separate tables per type, `isDelete` | *(not yet ported)* | ⬜ TODO P4 | Unify under `expenses` + `expense_category` enum/table |
| `material_requisitions` | `int PK` | *(not yet ported)* | ⬜ TODO P4 | `material_requisitions` + lines |
| `attendance_monthly`, `computed_attendance`, `employee_attendance`, `employee_attendance_summary`, `attendance_settings`, `daily_work_hours`, `user_work_logs`, `work_logs`, `user_work_sessions`, `user_daily_summary` | 10 attendance/work tables, `decimal` hours, generated `lop_days` | *(not yet ported)* | ⬜ TODO P3 (reports) / P2 | Needs Biometric `biometric_code` model, `attendance_logs` (new migration 20260812) |
| `payroll_*` (8 tables: `payroll_runs`, `payroll_slips`, `payroll_schedules`, `da_schedule`, `salary_structures`, `salary_structure_components`, `salary_slips`, `employee_salary_profile`, etc.) | `int PK`, `decimal` salaries | *(not yet ported)* | ⬜ TODO P4 | Major effort; paise conversion critical |
| `holiday_master` | `int PK` | *(not yet ported)* | ⬜ TODO P2 | Simple `holidays` table (`date`, `type` enum) |
| `account_master`, `account_head_master`, `account_transactions` | `int PK`, `decimal(15,2) amount` | *(not yet ported)* | ⬜ TODO P2/P4 | Needs `account_heads` + `accounts` + `account_transactions` (paise, transfer/double-entry) |
| `category_master`, `description_master`, `deliverable_categories`, `deliverables_master` | lookup masters | *(not ported — GenericPage)* | 🟡 TODO P2 | Small tables; paise not needed |
| `documents_*` (5 tables: `documents_master`, `documents_issued`, `documents_received`, `entity_documents`, `project_documents`) | file meta | *(not ported)* | ⬜ TODO P2 | Needs `documents` + `document_uploads` + S3/R2 binding |
| `messages`, `message_threads`, `message_attachments`, `chat_threads`, `chat_messages`, `chat_participants`, `chat_message_reads`, `conversations`, `conversation_members` | 9 messaging tables, duplicated models | *(not ported; `Messages.tsx` is mock)* | ⬜ TODO P1 | Consolidate to `conversations` + `conversation_members` + `messages` + `message_attachments` + `message_reads` |
| `todos`, `support_tickets`, `ticket_comments`, `follow_ups`, `project_followups`, `proposal_followups` | task/ticket/followup blob | `proposal_follow_ups`, `project_comments` ported; `todos`/`tickets` not | 🟡 Partial | Port `todos` + `tickets` (`support_tickets`) + generic `follow_ups` |
| `user_activity_logs`, `user_screen_time`, `user_page_visits`, `user_interactions`, `user_work_logs`, `user_activity_assignments`, `activity_comments`, `activity_updates` | telemetry | `project_activity_assignments`, `project_activity_logs` ported; rest not | 🟡 Partial — P4 | Telemetry for live-monitoring |
| `department_master`, `designations` analogue | `department_master` old | `departments`, `designations` done | ✅ | Clean rename |
| `bank_documents` (migration 20260722), `payment_issues` (20260723), `leave_system` (20260825) | latest prod adds | *(not ported)* | ⬜ TODO P2/P4 | Add `bank_documents`, `payment_issues`, `leaves` + `leave_balances` + `leave_requests` |

### 2.3 Schema Improvements Inventory (cross-cutting)

1. **Paise everywhere** — `bigint`/`integer` paise + `src/lib/money.ts` (`rupeesToPaise`, `paiseToRupees`, `calculateTax` GST, `formatINR`, `amountInWordsINR`); eliminates `decimal` drift. Applies to: leads `valuePaise`, proposals/projects contract/cost, banks balances, quotation line `unitPricePaise/amountPaise`, software `costPaise`.
2. **Positional child tables** — every former `longtext JSON` list becomes a `pgTable` with `position integer DEFAULT 0` + `index(project, position)`, ordered on read; enables pagination/filtering.
3. **Append-only histories** — `lead_stage_history`, `proposal_status_history`, `project_status_history`, `project_activity_logs` — velocity/analytics without mutating the main row.
4. **Partial indexes for hot paths** — `WHERE deleted_at IS NULL` on `leads(stage)`, `proposals(createdAt)`, `projects(createdAt)` — the exact queries the list pages run.
5. **Composite uniques that matter** — `uq_banks_account_ifsc(accountNumber, ifscCode)`, `uq_project_members_project_employee`, `uq_*_company_email`, `uq_*_activity_code` — prevent real dupes the old schema allowed.
6. **Enum consolidation** — 21 `pgEnum`s including new lifecycle types (`project_lifecycle`, `proposal_status` 7 states, `assignment_status/priority`, `risk_*`, `lead_*`, `vendor_*`, `bank_*`).
7. **FK hygiene** — explicit `onDelete: cascade|set null|restrict` (e.g. discipline→activities `restrict` prevents accidental wipe; proposal/project children `cascade`).
8. **Arrays + inet** — `text[].array()` for `skills`, `ccEmails`; `inet` for session IP; `jsonb` for audit `old/newValue`.
9. **RBAC normalization** — `users` ↔ `user_roles` ↔ `roles` ↔ `role_permissions` ↔ `permissions` with seeded `admin/project_manager/accounts/hr/engineer` roles.
10. **Driver/latency win** — Neon HTTP (`@neondatabase/serverless`) works from Cloudflare Workers (no TCP pg driver); lazy `db` Proxy defers `neon()` until first query, so `pnpm build` passes without `DEV_DB_URL` (validated lazily via `src/env/server.ts` Proxy).

---

## 3 · Phased Implementation Order

### P1 · Core — Trust / Daily Use (Weeks 1–3)

> Goal: every user can log in, see dashboard, run the revenue pipeline, and message — the jobs that unblock all other work.

| Order | Feature | Old source | New route / page | Schema needed | API (`createServerFn`) | Effort |
|---|---|---|---|---|---|---|
| 1.1 | **Auth hardening** (scrypt done, but `register` gate + session rotation + `parseSessionCookie` edge cases) | `api/auth/login`, `api/session`, `api/login/logout` | `src/routes/login.tsx`, `__root.tsx` | `users`, `sessions` — done | `auth.functions.ts` — extend `register` admin-gate | S |
| 1.2 | **Leads deep-links** — `leads/$leadId` view/edit + stage history timeline | `leads/[id]`, `leads/[id]/edit`, `api/leads/*` | `src/routes/leads.tsx` + new `src/routes/leads.$leadId.tsx` | `leads`, `lead_stage_history` — done | `leads.functions.ts` — add `getLead`, `updateLeadStage` | M |
| 1.3 | **Proposals edit** + **quotation-line editing** + **convert→project** | `proposals/[id]/edit`, `api/proposals/*`, `api/proposals/convert` | `src/routes/proposals/$proposalId.tsx` | `proposals` + 6 children — done | `proposals.functions.ts` — add `updateProposal`, `convertProposal` | M |
| 1.4 | **Projects edit** + **member/milestone/risk/comments** mutations (currently read-ish) | `projects/[id]/edit`, `api/projects/[id]/{activities,work-logs,member-details}` | `src/routes/projects/$projectId.tsx` | `projects` + 9 children — done | `projects.functions.ts`, `project-activities.functions.ts` — flesh out mutations | M |
| 1.5 | **Messaging (real)** — threads, members, attachments, unread counts | `messages`, `api/messages/*`, `conversations`, `chat_*` | `src/routes/messages.tsx` + `Messages.tsx` | NEW `conversations`, `conversation_members`, `messages`, `message_attachments`, `message_reads` | `messages.functions.ts` (new) | L |
| 1.6 | **Dashboard live data** — wire mock charts to `admin/dashboard-stats`, `analytics/*`, `work-summary` | `admin/dashboard`, `api/admin/dashboard-stats`, `api/analytics/*` | `src/routes/index.tsx` + `Dashboard.tsx`, `FinancialDashboard.tsx` | existing mocks; optionally `audit_logs` aggregates | `crm.functions.ts` — `getDashboardStats` real query | M |
| 1.7 | **RBAC wiring** — route guards per role, `admin` vs `user` shell | `admin/layout.tsx` | `src/routes/__root.tsx`, `src/routes/admin/*` loaders | `roles/permissions/user_roles/role_permissions` — done | `auth.server.ts` `requireRole` helper | M |

**P1 exit criteria:** `pnpm test && pnpm build` green; leads→proposal→project→invoice happy path clickable; no mock-only core page remains; >80% of `Leads/Proposals/Projects` E2E covered.

---

### P2 · Masters — Reference Data (Weeks 3–5; can parallelize after P1.1)

| Order | Feature | Old source | New route | Schema needed | Effort |
|---|---|---|---|---|---|
| 2.1 | **Holidays** + **Documents master** | `masters/holidays`, `masters/documents` | `masters/holiday-master`, `masters/documents` | NEW `holidays`, `documents_master` | S |
| 2.2 | **Descriptions** + **Categories** + **Deliverables** + **Deliverable Categories** | `masters/descriptions`, `masters/categories`, `masters/deliverables`, `masters/deliverable-categories` | `masters/description-master`, `masters/expense-category`, `masters/deliverables-master` (split) | NEW `description_master`, `category_master`, `deliverables_master`, `deliverable_categories` | M |
| 2.3 | **Account Heads / Accounts** | `masters/account-heads`, `masters/accounts/*` | `masters/account-head` (+ nested) | NEW `account_heads`, `accounts` | M |
| 2.4 | **Roles & Permissions UI** — standalone list (currently inside UserMaster) | `masters/roles`, `api/roles`, `api/permissions` | `masters/roles` (new) + `masters/users.$userId.permissions` | existing `roles/permissions` — just UI | S |
| 2.5 | **Employee operational tabs** — attendance summary, leaves link, contract/payroll stub | `employees/attendance`, `employees/leaves`, `employees/payroll`, `employees/contract` | `employees/$employeeId.tsx` tabs | FK to future attendance/leave tables (nullable) | M |
| 2.6 | **Bank documents** | `bank_documents` migration (20260722) | `masters/bank-master` tab | NEW `bank_documents` | S |
| 2.7 | **Entity/batch imports** — `companies/import`, `employees/import`, `leads/import` (CSV) | `api/companies/import`, `leads/import`, etc. | Keep existing `createServerFn` import handlers; add UI buttons to each master | no new schema | S/M per master |

**P2 exit criteria:** every row in §1.2 with “masters/*” leaves 🟡/⬜ and enters ✅; `GenericPage` no longer used for any master; imports covered.

---

### P3 · Reports — Read-Only Analytics (Weeks 5–7; parallel with P2.5+)

| Order | Feature | Old API (16 handlers) | New route | Schema needed | Effort |
|---|---|---|---|---|---|
| 3.1 | **Report shell + shared filters** (date range, client/project/employee selectors, CSV/Excel download) | `api/reports/*` (all have `download` variants) | `src/routes/reports/index.tsx` + `reports/$report.tsx` + `Reports.tsx` | none (query layer only) | M |
| 3.2 | **Timesheet & Attendance reports** | `reports/timesheet-report`, `reports/attendance-report` | `reports/reports-timesheet`, `reports/reports-attendance` | Needs `work_logs` + `employee_attendance` family read (defer full write to P4) | M |
| 3.3 | **Manhours Billing & Project Activities** | `reports/manhours-billing`, `reports/project-activities` | `reports/reports-manhours`, `reports/reports-project-status` | `project_activity_assignments`/`project_manhours` reads | M |
| 3.4 | **Client Balance (+ detail)** & **Sales Register** | `reports/client-balance`, `reports/client-balance/detail`, `reports/sales-register` | `reports/reports-balances`, `reports/reports-sales-register` | `invoices`/`payment_receivables` (read; tolerate stubs until P4) | M/L |
| 3.5 | **Employee Report & Employee Project Cost** | `reports/employee-report`, `reports/employee-project-cost` | `reports/reports-employee` | `project_members` + payroll stub | M |
| 3.6 | **Project Status** (per-project) | `reports/project-status`, `reports/project-status/[projectId]` | `reports/reports-project-status` (reuse) + deep link | `project_status_history`, milestones/risks | S |

**Implementation notes for P3:** reports are read-heavy; build them as `createServerFn({ method:'GET' })` with `private, max-age=300` and parameter validation via Zod; implement `download` as a second `createServerFn` returning CSV (`Content-Disposition`) using the same query builder; add indexes on `(projectId, date)`, `(employeeId, date)`, `(client/companyId)` under the report queries.

---

### P4 · Admin & Finance — Money + Compliance (Weeks 7–12; heaviest phase)

| Order | Sub-phase | Feature | Old tables / APIs | New Drizzle target | Effort | Risk highlight |
|---|---|---|---|---|---|---|
| 4.1 | Invoicing | **Sale invoices** (list/create/edit/view, `next-number`, `download`, `po-balance`) | `invoices`, `quotations`, `api/admin/invoices/*`, `invoice-list` | NEW `invoices` + `invoice_lines` (tax/GST, HSN, paise, `CHECK amount>=0`), `invoice_payments` | L | Number-format uniqueness (`unique active index` pattern from migrations 20260803); paise regression risk |
| 4.2 | Procurement | **Purchase orders** + **Outgoing POs** + **Purchase invoices** | `purchase_orders`, `outgoing_purchase_orders`, `purchase_invoices`, `api/admin/purchase-orders/*`, `purchase-invoices/*` | NEW `purchase_orders` + `po_lines` + `purchase_invoices` + `grn` (if needed) | L | Duplicate logic in old schema; must deduplicate design before coding |
| 4.3 | Payments | **Payment entries / payables / receivables / issues / payee-list / receipt PDF** | `payment_entries`, `payment_payables`, `payment_receivables`, `payment_issues`, `api/admin/payment-*`, `payee-list`, `get-receipt-pdf` | NEW `payment_entries` + `payment_payables` + `payment_receivables` + `payment_issues` | L | Pdf rendering (`get-receipt-pdf`) needs `amountInWordsINR`; double-entry correctness |
| 4.4 | Cash & Expenses | **Cash vouchers** (with voucher-number ×63-duplicate debt), **Expenses / Other / Petty cash**, **Outgoing quotations** | `cash_vouchers`, `expenses`, `other_expenses`, `petty_cash_expenses`, `outgoing_quotations` | NEW `cash_vouchers` + `cash_voucher_lines` (replace JSON `line_items`) + unified `expenses` taxonomy + `outgoing_quotations` | L | Curing the 63-duplicate unique key; line-item JSON→table is a data migration |
| 4.5 | Materials | **Material requisitions** + **Project handover/MOM docs** | `material_requisitions`, `project_handover`, `kom_with_client`, `project_mom_documents` | NEW `material_requisitions` + `mr_lines` + `project_handovers` | M | Simple |
| 4.6 | Payroll | **Payroll runs/slips/schedules/DA schedule, salary structures/components, employee salary profiles, loans, statutory payments, manual overrides** | 8 payroll tables + `api/payroll/*` (11 handlers) | NEW `payroll_runs`, `payroll_slips`, `payroll_schedules`, `da_schedule`, `salary_structures`, `salary_structure_components`, `employee_salary_profile`, `employee_loans`, `loan_repayment_schedule`, `statutory_payments`, `salary_manual_overrides` | XL | Biggest single feature; `DECIMAL`→paise conversion, `generated lop_days/payable_days` → Drizzle `sql` expressions; pdf bulk (`bulk-pdf`, `export-sheet`) |
| 4.7 | Ledger | **Account heads/accounts/transactions** | `account_master`, `account_head_master`, `account_transactions` | NEW `account_heads` + `accounts` + `account_transactions` (transfer/income/expense enum) | M | Paise; keep double-entry invariants |
| 4.8 | Telemetry | **Live monitoring** (presence, screen-time, work sessions, activity logs) + **Productivity**, **Audit logs UI** | `user_activity_logs`, `user_screen_time`, `user_work_sessions`, `user_page_visits`, `user_interactions`, `audit_logs`, `api/active-users`, `user-status`, `screen-time` | NEW `user_presence`, `user_activity_logs`, `user_screen_time`, `user_work_logs` (+ `sessions.ipAddress inet` already) | M | Privacy/performance; aggregate, don't stream per keystroke |
| 4.9 | Tickets & Todos | **Todos** + **Support tickets** + **Follow-ups** | `todos`, `support_tickets`, `ticket_comments`, `follow_ups` + `api/todos`, `tickets/*`, `followups/*` | NEW `todos` + `support_tickets` + `ticket_comments` (generic `follow_ups` absorbed into proposal/project follow-ups where relevant) | M | Consolidate duplicate `follow_ups` concept |
| 4.10 | Docs & Compliance | **Entity/project documents, documents issued/received**, uploads | `entity_documents`, `project_documents`, `documents_*` + `api/document-upload/*`, `project-docs`, `uploads` | NEW `documents` + `document_uploads` + R2/presigned-URL flow (Cloudflare) | M | File storage binding (Workers `R2` vs Neon) |
| 4.11 | Leaves | **Leave balances/requests, holiday master tie-in** | `leaves`, `holiday_master`, `api/leaves/*` (migr 20260825) | NEW `leave_types`, `leave_balances`, `leave_requests`, `holidays` | M | Approval workflow; half-day math; restore `grant_leaves` perms |

**P4 exit criteria:** every admin page in §1.2 leaves ⬜; `pnpm build` typing clean; zero `decimal` money fields remain; PDF/Excel exports parity with old `/api/.../download` routes.

---

## 4 · Effort & Risks

### 4.1 Effort Estimate

| Phase | Scope | Calendar (1 eng) | Calendar (2 eng) | Drizzle tables new | Routes/pages new or reworked | `createServerFn` groups new |
|---|---|---|---|---|---|---|
| **P1 Core** | 7 items | 2–3 wks | 1.5 wks (parallelize 1.5+1.6) | 3 (`conversations` family) | 3–4 (`leads.$leadId`, message real wiring, dashboard live) | ~5 |
| **P2 Masters** | 7 items | 1.5–2 wks | 1 wk | 7–8 | 5–6 | ~6 |
| **P3 Reports** | 6 items | 1.5–2 wks | 1 wk (parallel with P2) | 0 new (read existing + stubs) | 1 (`reports/$report` variants) | ~8 |
| **P4 Admin/Finance** | 11 items | 4–5 wks | 2.5–3 wks (split 4.1–4.4 / 4.5–4.11) | ~25 | 10–12 (`admin/*` forms, ticket/todo, docs) | ~18 |
| **Total** | | **~9.5–12 wks** | **~5.5–6.5 wks** | **~35 new tables** | **~20 route/files** | **~37 fn groups** |

Sizing key: **S** <1 day · **M** 1–3 days · **L** 3–7 days · **XL** >1 week. Estimates include Drizzle migration, `*.server.ts` + `*.functions.ts` + UI + `vitest` coverage, not legacy data migration.

### 4.2 Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Paise regression** — lingering `decimal`/`float` arithmetic in payroll/invoices/billing reports | High | High (money!) | Enforce `src/lib/money.ts` in code review (`requesting-code-review` skill); add `money.test.ts`-style round-trip tests per domain; Ban `parseFloat` on money paths via grep |
| 2 | **MySQL→Postgres semantic drift** — `ON UPDATE current_timestamp`, generated columns (`lop_days`), `json_valid` checks, duplicate unique keys | Medium | High | Keep baseline migration as read-only spec; each port adds `CHECK`/`sql` expressions explicitly; audit the 63-duplicate `cash_vouchers` indexes first |
| 3 | **Child-table data migration** — old `longtext JSON` lists (`line_items`, `punch_details`) must split into rows with correct `position` | Medium | High | Write one-off `scripts/migrate-old-json.ts` per table with `tsx`; verify row counts before/after; keep old JSON column read-only during cutover |
| 4 | **Report perf** — 10 reports with date/client/project filters over large `work_logs`/`computed_attendance` | Medium | Medium | Add `(projectId, date)` / `(employeeId, date)` indexes in the same migration as the report query; use `private, max-age=300` + `staleTime 5m` (already in `__root.tsx` QueryClient); paginate |
| 5 | **Auth/RBAC gaps** — `admin/layout.tsx` guard is stricter than new `__root` loader; role checks missing on new `admin/*` | High | High | Add `requireRole('admin')` / `requirePermission(code)` server helper called at the top of every `createServerFn` and route `loader`; add negative tests |
| 6 | **File storage binding** — old `uploads` / `document-upload` used local FS; Workers need R2 | Medium | Medium | Decide R2 binding in `wrangler.jsonc` early (P2); stub with in-memory upload in `messages/attachments` so P1 isn't blocked |
| 7 | **Navigation drift** — `pageFromPath` / `useCrmNavigation` must be updated for every new route or sidebar highlighting breaks | High | Low | Make it a PR checklist item; add `navigation.test.ts` case per new route (see `src/crm/navigation.test.ts`) |
| 8 | **Test/build gate** — no CI in repo; P4 payroll regressions can slip | Medium | Medium | Keep `pnpm test && pnpm build` as the merge gate (already AGENTS.md); add payroll `money` snapshot tests; `pnpm typecheck` in pre-push hook |
| 9 | **Scope creep — “replicate 1:1” vs “re-think”** — old schema has 3 overlapping payment tables, 4 expense tables, duplicate account heads | Medium | Medium | Prefer **unify** over replicate (see §2.2 “Superseded” rows); document each unification decision in the PR description so product can affirm |
| 10 | **Concurrent branch churn** — `dev` is shared, `hermes/*` branches live long | Medium | Low | Rebase `hermes/plan-replicate-pages` on `dev` weekly; keep each P-phase in its own `hermes/phase-N-*` branch off this plan branch |

### 4.3 Key Decisions Required Before Coding (please confirm)

1. **Messaging data model** — keep 9 old tables or consolidate to `conversations`/`messages` as proposed? (Recommend consolidate.)
2. **Payment/Expense unification** — one `expenses` taxonomy vs three tables? one `payment_entries` ledger vs four?
3. **Payroll provider** — re-use old `payroll_*` semantics or adopt a new `salary_structures` model from scratch? (Old `lop_days` generated column must be reproduced as a Drizzle `sql` expression or a computed view.)
4. **File storage** — Cloudflare R2 (`wrangler.jsonc` `r2_buckets` binding) or keep Neon/HTTP for files? Needed before P1.5 attachments.
5. **Scheduling** — 1-engineer 10-week or 2-engineer 6-week track? Determines whether P2/P3 run in parallel.

### 4.4 Verification Checklist (per phase)

- [ ] `pnpm test` (Vitest + Testing Library, `src/test/setup.ts` mocks DB/env) — add at least one `*.functions.test.ts` per new domain.
- [ ] `pnpm build` (`vite build && tsc --noEmit`) — must pass without `DEV_DB_URL` (lazy env/db Proxy invariant).
- [ ] `pnpm typecheck` — strict, `noEmit`.
- [ ] New route added to `src/crm/navigation.ts` + `src/crm/navigation.test.ts`.
- [ ] `drizzle-kit generate` → `drizzle/<migration>.sql` committed; `drizzle.config.ts` untouched.
- [ ] Paise path uses `src/lib/money.ts` only (grep `parseFloat\|Number(.*amount` on touched files).

---

## 5 · Appendix

### A · Inventory Sources

- Old pages: `find /tmp/accent-old/src/app -name 'page.jsx' -o -name 'page.tsx' -o -name 'page.js' -o -name 'page.ts'` → **104 files** (listed in §1.2).
- Old APIs: `find /tmp/accent-old/src/app/api -name 'route.js' -o -name 'route.ts'` → **211 files**, 44 groups (top: `admin` 49, `reports` 16, `projects` 15, etc.).
- Old tables: `20260722080106_baseline_schema.js` → **110 `CREATE TABLE`** + 7 later migrations → **≈117**.
- New routes: `ls src/routes/**/*.tsx` → **23 files** (incl. `__root.tsx`); `src/crm/pages` → **20 components**; `src/db/schema/**/*.ts` → **48 `pgTable`s** + **21 `pgEnum`s**.

### B · Out-of-Scope / Intentionally Dropped

- `knexfile.js`, `query_log`, `softwares` legacy tri-table (replaced by `software_masters`), duplicate `roles_master` (merged into `roles`), `chat_threads`/`chat_*` legacy split (consolidated into `conversations`), MySQL `ENUM` string drift.

### C · Branch & PR

- **Branch:** `hermes/plan-replicate-pages` (off `dev`) — contains only this plan file.
- **PR:** draft `hermes/plan-replicate-pages → dev` (title: `docs: plan — replicate accent pages in accent-new (Option A)`).
- **Build gate:** `pnpm build` must still pass (lazy env/db Proxy — no DB required at build time).

### D · References

- `AGENTS.md` — paise/Decimal.js, `createServerFn` domain trio, Neon lazy Proxy, `pageFromPath` coupling, testing mocks.
- `src/db/schema/index.ts` barrel → `auth.ts`, `employees.ts`, `crm.ts`, `masters/{bank,company,discipline,software,vendor}.ts`, `proposals.ts`, `projects.ts`.
- `src/lib/money.ts` — single money source of truth; `src/crm/navigation.ts` / `src/crm/navigation.test.ts`.
- Old migrations: `migrations/20260722080106_baseline_schema.js` (authoritative 110-table dump), plus `20260722–20260826` incremental files.

---

*Next step:* get product sign-off on §4.3 decisions, then open `hermes/phase-1-core` branched from this plan branch.
