# Quotation printing — redesign spec (Task 2)

Date: 2026-08-27 · Owner: hermes/feat-quotation-print · Base: `dev` → `hermes/feat-quotation-print`

## 1. Goals / non-goals

- **Goal:** replace the ad-hoc old-CRM quotation print flow (puppeteer + scattered `window.print()` + mixed rupee/paise arithmetic) with a single professional B2B engineering-services document that is (a) WYSIWYG on screen and paper via CSS `@media print`, (b) deterministic paise-integer money, and (c) reusable as a `@react-pdf/renderer` or `jspdf` target without rewriting layout tokens.
- **Non-goal:** e-sign, DOCX export, or server-side headless-Chrome PDF service in this PR — those stay as follow-ups. The POC ships a client-side print path (`window.print()`) plus a framework-agnostic React component (`src/components/crm/QuotationPDF.tsx`) that can be wrapped by either `react-pdf` or `jspdf` later.

## 2. Template research — 3 stolen references

Screenshots are best viewed live; the links + the stolen token survive in the spec.

| # | Template | Stack | Why it fits Accent Techno | Link | Stolen idea |
|---|----------|-------|---------------------------|------|-------------|
| 1 | **Anvil HTML Invoice Template** — vanilla HTML+CSS with `invoice-pdf.css` overrides + `react-pdf/` (styled-components) variant. 300+ stars. Clean “header bar + meta grid + line table + totals rail” silhouette used by Stripe/Notion invoices. | HTML/CSS → `html2pdf`/`@anvilco` API; React variant via `styled-components` | Closest to a B2B *engineering consultancy* letterhead: single accent border on the header, grid metadata (proposal no / date / validity / status), tabular scope-of-work lines, and a right-aligned totals rail. Print CSS is already canonical. | https://github.com/anvilco/html-pdf-invoice-template — HTML: [`invoice.html`](https://github.com/anvilco/html-pdf-invoice-template/blob/main/invoice.html) / [`invoice.css`](https://github.com/anvilco/html-pdf-invoice-template/blob/main/invoice.css) / [`invoice-pdf.css`](https://github.com/anvilco/html-pdf-invoice-template/blob/main/invoice-pdf.css) — React: [`react-pdf/README.md`](https://github.com/anvilco/html-pdf-invoice-template/blob/main/react-pdf/README.md) ![browser render](https://user-images.githubusercontent.com/69169/115467239-0ac27c00-a1e6-11eb-836b-190bf0ab264d.png) | Header: 2 px brand rule + company name/role left, document type + serial right. Totals rail: subtotal → GST row → bold total row with top border. Captured as design tokens `--brand-primary`, `--border`, `--surface-secondary`. |
| 2 | **edisonneza/jspdf-invoice-template** — props-driven `jsPDF` template (1.4.x, ~400 stars, npm `jspdf-invoice-template`). `jsPDF` is already a dep in old accent (`jspdf@^4.0.0` in `/tmp/accent-old/package.json`) but was never wired to quotations. | `jspdf@^4` imperative drawing | Proves the *imperative* PDF path can share the same data contract as the HTML print path. Its `props: { business, contact, invoice, logo, ... }` maps 1-1 to the new paise contract. Adopted its config schema (margins, table column widths, footer terms) while keeping the anvil visual. | https://github.com/edisonneza/jspdf-invoice-template — npm: https://www.npmjs.com/package/jspdf-invoice-template | Props schema: `business { name, address } / invoice { header, table columns { Sr, Description, Qty, Unit price, Amount }, totals: { subtotal, gst, total } }`. Adopted as `<QuotationPDF>` prop types. GST row labelled `GST @ 18%` with paise → formatted INR (`formatPaise`). |
| 3 | **sparksuite/simple-html-invoice-template** (+ `htmldocs-js/htmldocs`) — minimal responsive invoice, the canonical “modern alternative to LaTeX” (Tailwind + JSX → PDF). Used as the *fallback lightweight* template when `puppeteer` is undesirable on Cloudflare Workers. | HTML/Tailwind/JSX → `@htmldocs/js` | Demonstrates the path already viable on `accent-new`’s Workers runtime: no headless browser. `htmldocs` renders JSX + Tailwind to PDF directly. Kept as appendix — POC does not add the dep, but layout tokens were chosen to be Tailwind-compatible. | https://github.com/sparksuite/simple-html-invoice-template — https://github.com/htmldocs-js/htmldocs | Tailwind tokens: `max-w-[860px] mx-auto border rounded-xl p-10 print:border-0 print:shadow-none`. PDF-specific reset (remove shadows, flatten backgrounds) via `@media print`. |

**Chosen template for the POC:** **Anvil (1) for the visual**, with **edisonneza (2) props contract** as the API validation. Rationale: `accent-new` already ships a `QuotationDocument.tsx` that is 90 % of the anvil layout (brand header rule, meta grid, line table, totals rail, amount-in-words, terms sections) — upgrading it is lower-risk than introducing `puppeteer`/`@react-pdf/renderer` as a new prod dep on Workers. `htmldocs` (3) is noted for a future `POST /quotations/:id/pdf` without Chrome.

## 3. Old accent print flow — evaluation

### 3.1 File map (accent-old)

- **List page:** `src/app/admin/quotation/page.jsx:29` — fetches with `limit=0`, unions two MySQL tables at runtime (`src/app/api/admin/quotations/route.js:34-93`). No print path here; only table/screen.
- **View (print-adjacent):** `src/app/admin/quotation/[id]/view/page.jsx:15` — screen rendering of a quotation; print is implicit (`window.print()` button where present). Fetches either `/api/admin/standalone-quotations/:id` or `/api/admin/quotations/:id?source=…` (line 65, `source='project'|'quotations'`). Normalizes `scope_items` JSON (line 75) with a try-parse fallback.
- **Edit + preview:** `src/app/admin/quotation/[id]/edit/page.jsx:25` — imports `R, add, mul, pctOf, toNumber` from `src/lib/money.ts:1` (Decimal.js wrapper). Also `formatCurrency` from `src/lib/format.js:27` (plain `Intl.NumberFormat` with 2 dp, no paise discipline). ** paise code lives only in the edit form and download route, not in the view. **
- ** Download (the real PDF path):** `src/app/api/admin/quotations/download/route.js:15` — `runtime='nodejs'`, guarded by `ensurePermission(RESOURCES.PROPOSALS, READ)`. Loads `puppeteer` + `@sparticuz/chromium` (lines 4-5), reads `project_quotations` → hydrates `projects` → optionally `proposals` and `companies` (lines 43-180). ** 940 lines, 4 nested try/catch fallback queries, duplicated annexure mapping for 14 fields ** (scope, input document, deliverables, software, duration, site visit, validity, mode of delivery, revision, exclusions, billing/payment terms, taxation, payment milestone, confidentiality/codes/dispute). Generates HTML string inline then `page.setContent` → `page.pdf()`. Slow on Workers, hard to test.
- ** Proposal PDF sibling:** `src/app/api/proposals/pdf/route.js` and `src/app/reports/project-activities/pdf-template.ts` — same puppeteer pattern.
- ** Money helpers:** `src/lib/money.ts:11` (`R`, `add`, `sub`, `mul`, `div`, `pctOf`, `toNumber`) — Decimal with `precision:20` but the view/edit pages still do ad-hoc `Math.round((netAmount-rupees)*100)` and `numberToWords` per route (see `src/app/admin/quotation/[id]/edit/page.jsx: ~320` and `src/app/api/admin/quotations/download/route.js: ~520`). `src/lib/format.js:1` formats raw floats with `en-IN` — not paise-safe.

### 3.2 Pain points

1. **No single money canonical.** Paise integers are computed in some places and re-rounded in others; display mixes `formatCurrency(float)` and per-route `amountToWords` copies (3 duplicates across quotations/invoices/purchase-orders). Floating GST (`netAmount * 0.18`) drifts on edge amounts.
2. **Split document model.** `quotations` vs `project_quotations` vs `proposals` — the download route unions them at query time with column-alias tricks; the view page branches on `source` query param (antipattern: doc identity should not depend on URL).
3. **Unstyled annexures.** View page renders 14 annexure fields as `flex items-start gap-3` label/value divs (line ~400 of view) — not print-bounded, no widows/orphans control, no header/footer repeat, no `thead` repeat on page break.
4. **No design tokens.** Tailwind + inline `var(--brand-primary)` is used elsewhere, but the quotation view hard-codes a mix of Tailwind classes and ad-hoc `style=`. Header rule is `border-b-2 border-brand` in some places, missing in others.
5. **Print is an afterthought.** Only a bare `window.print()` call; no `@media print` overrides (hide toolbar, collapse shadow, repeat `thead`, suppress URL footers), no `@page { margin }` guidance, no `break-inside: avoid` on totals.

## 4. New design (accent-new)

### 4.1 Design tokens & layout

Reuses the existing CRM tokens (see `src/styles/crm.css` and `src/styles/index.css`):

| Token | Value | Role |
|-------|-------|------|
| `--brand-primary` | `#64126D` | Header rule, doc title accent, total row emphasis |
| `--brand-secondary` | `#86288F` | Badge / focus ring |
| `--surface` | `#FFFFFF` | Paper |
| `--surface-secondary` | `#F3F4F8` | Table head + muted sections |
| `--border` / `--border-subtle` | `#E5E7EB` / `#F1F5F9` | Grid + row rules |
| `--text-primary` / `--secondary` / `--muted` | `#0F172A` / `#475569` / `#94A3B8` | Copy hierarchy |

**Page geometry:** `maxWidth: 860`, `margin: 24px auto 48px`, `padding: 40 48`, `border: 1px solid var(--border)`, `borderRadius: 10`, `background: var(--surface)`. On print: `@media print { max-width:none; margin:0; border:0; border-radius:0; box-shadow:none; background:#fff }`, `@page { size: A4; margin: 14mm 12mm 16mm 12mm }`, `thead { display: table-header-group }`, `tfoot { display: table-footer-group }`, `.no-print { display:none !important }`.

**Font:** `Inter` (already imported in `src/styles/index.css:1` — `@fontsource/inter`), `tabular-nums` for amount columns, `letterSpacing: 0.4-0.6` on caps headings.

### 4.2 Component hierarchy

```
src/components/crm/QuotationPDF.tsx          ← NEW — presentational, framework-agnostic
  props: { quotation: ProposalDetail, totals: QuotationTotals, displayCompany?: { name, address, gstin } }
  sections, in order:
    1. Header — letterhead (company name + "Engineering Consultants" subhead | QUOTATION label + proposalNumber tabular)
    2. Meta grid — two columns: "Quotation details" (Date / Valid until / Status badge) + "Prepared for" (companyName, Kind attn, city/siteLocation, email)
    3. Subject + Scope of work (htmlToPlainText — block closer → \n, <li> → •, script/style stripped, entities decoded)  [src/lib/quotations.ts:htmlToPlainText]
    4. Line table — thead [ Sr | Description | Qty | Unit price | Amount ] with right-aligned numerics, repeating header on paged media; tbody with amountPaise bold; fallback single row for lumpsum (valuePaise) when lines empty
    5. Totals rail — flex-end 280 px dl: Subtotal | GST @ 18% | Total (bold, top border) — all via formatPaise() [src/lib/money.ts:formatPaise]
    6. Amount in words — italic, muted, `amountInWordsINR(totalPaise)` [src/lib/money.ts:amountInWordsINR] — throws on negative
    7. Terms — Payment terms + Other terms (plain pre-wrap)
    8. Footer — 2-line small muted legal footer (validity note + page number via CSS counter) — `counter(page) / counter(pages)` in print footer
    9. Annexure appendix — collapsible on screen (details/summary with print: open), only the annexure fields that are non-empty are rendered to avoid 14 empty sections
```

**Reuse in routes:** `src/crm/pages/QuotationDocument.tsx` (print document) and `src/crm/pages/ProposalDetail.tsx` (proposal detail → "View quotation" link, plus embedded `QuotationPDF` in a print-only modal in future) import `QuotationPDF`. No duplication.

### 4.3 Data contract (paise-first)

- **Input:** `ProposalDetail` as returned by `src/lib/quotations.server.ts` (already authoritative) — `quotationLines: { id, description, quantity, unitPricePaise, amountPaise }`, `valuePaise: number | null`, `status`, `proposalNumber`, `companyName`, `contactName/designation/city/siteLocation/contactEmail`, `title`, `scopeOfWork`, `paymentTerms`, `otherTerms`, `validityDays`, `createdAt`.
- **Totals:** `computeQuotationTotals({ lines, valuePaise })` from `src/lib/quotations.ts:computeQuotationTotals` — precedence is `lines.length > 0 ? Σ qty×unitPricePaise : max(0, valuePaise)`. GST = `calculateTax(subtotalPaise/100, 18).taxPaise` using `src/lib/money.ts:calculateTax` → single HALF_UP rounding into whole paise, `totalPaise = taxablePaise + taxPaise`. No floating intermediary leaks into the view.
- **Formatting:** all INR strings go through `formatPaise(paise, { showSymbol:true })` (`src/lib/money.ts:formatPaise` → `formatINR(..., { fromPaise:true })` → `paiseToRupees` → `Intl.NumberFormat('en-IN')`). `amountInWordsINR` spells `Rupees … and … Paise Only` via the Indian crore/lakh/thousand recursion.
- **Validation:** `src/lib/proposals.ts:proposalQuotationLineInputSchema` (qty ≥1, unitPricePaise ≥0, description required) — unchanged; the PDF component throws `RangeError` on negative paise as a guard.

### 4.4 Header / footer

- **Header (screen + print):** same 2 px `--brand-primary` rule + flex `space-between`. Left: `Accent Techno Solutions Pvt Ltd` (800/20 px) + `Engineering Consultants` (muted 12 px). Right: `QUOTATION` (800/15 px, tracking 1 px) + `proposalNumber` (700/12.5 px, tabular). Company address/phone/email/GSTIN injected via optional `displayCompany` prop (future: `src/db/schema/masters/company.ts` → server loads by `companyId`). Logo placeholder line reserved (16 × 16) — not fetched in POC to avoid remote image CORS on print.
- **Footer:** two tiers: (a) static line in the document flow — `"Quoted prices are valid until {validUntil} · GST 18% extra as applicable · This is a computer-generated document."` — (b) paged-media footer via CSS `@page: @bottom-right { content: "Page " counter(page) " of " counter(pages); }` with fallback `.print-footer` element fixed at bottom on print using `position: running(footer)`. Brand footer color stays muted so it never competes with the totals rail.

### 4.5 Table

- **Columns:** `Sr (40 px) | Description (flex) | Qty (60 px, right) | Unit price (110 px, right, tabular) | Amount (120 px, right, bold, tabular)`. Header row: `--surface-secondary` bg, `1 px solid var(--border)` bottom, caps 10.5 px/700/muted/uppercase/0.4 tracking. Body rows: `1 px solid var(--border-subtle)` separator, `8 px 10 px` cell, `verticalAlign: top`, `break-inside: avoid` per `<tr>` so a line never splits across pages.
- **Empty / lumpsum state:** single row with `— | Quoted as a lump sum — itemized lines are being prepared. | 1 | formatPaise(valuePaise) | formatPaise(valuePaise)` — same as current `QuotationDocument.tsx` but extracted into the shared component for testability.
- **Number discipline:** table cells receive *already-rounded* paise integers; no `Number.toFixed` in the view layer.

### 4.6 Terms / annexures

- Rendered as `whiteSpace: 'pre-wrap'` paragraphs under caps headings (11 px/700/uppercase/0.6 tracking/muted). Only non-empty terms emitted (`paymentTerms`, `otherTerms` today; annexure expansion — `inputDocuments`, `deliverables`, `exclusions`, `siteVisitNotes`, `software` — is a follow-up that slots under the same renderer with `position`-ordered lists). On print, no collapse — all terms are open; on screen they are collapsible `<details>` with `print: open`.

### 4.7 GST & money

- Rate constant: `QUOTATION_GST_RATE_PCT = 18` from `src/lib/quotations.ts:QUOTATION_GST_RATE_PCT`.
- `computeQuotationTotals` is the single source of truth; `QuotationPDF` receives `totals` as a prop and never recomputes it with floats.
- Display: `Subtotal`, `GST @ 18%`, `Total` rail with `formatPaise`. CGST/SGST vs IGST split is *not* rendered in the POC (single GST row) — spec reserves a follow-up prop `gstBreakdown: { cgstPaise, sgstPaise } | { igstPaise }` mutually exclusive, conditioned on intra-/inter-state flag on the company/customer GSTIN prefix comparison.
- **Tests:** paise invariants exercised in `src/lib/quotations.test.ts` and `src/lib/money.test.ts` (HALF_UP at 999.99 → 18000 paise GST).

### 4.8 Print / PDF paths

| Path | How | Status |
|------|-----|--------|
| `window.print()` (ship in POC) | Toolbar button `Print / Save PDF` calls `window.print()`; `@media print` hides `.no-print` toolbar, flattens container, repeats headers, adds page numbers. Zero new runtime deps, works on Workers. | Implemented. |
| `@react-pdf/renderer` wrapper | `QuotationPDF` is pure inline-style React; a thin wrapper can map its sections to `<Document><Page><View><Text>` using the same tokens — dep addition + snapshot test is a follow-up. | Spec only. |
| `jspdf` wrapper | Map props to `jspdf-invoice-template` `props.invoice.table/bottomTotals` — same paise contract — for environments where PDF bytes must be returned from an API route. | Spec only. |
| Headless Chrome (`puppeteer`) | Dropped in favor of CSS print; kept as escape hatch for server-side PDF if Workers ever allow it. | Deprecated. |

### 4.9 Accessibility & i18n

- `<article aria-label="Quotation {proposalNumber}">`, section `aria-label`s, `<table><caption class="sr-only">`, `<th scope="col">`, tabular amounts with `aria-describedby` on the totals rail, and `formatPaise` already emits a deterministic `₹` string.
- Locale fixed to `en-IN`; numbering follows Indian grouping (lakh/crore in words).

## 5. Implementation checklist (what the POC PR does)

1. New presentational component: `src/components/crm/QuotationPDF.tsx` — extracts and polishes the current `src/crm/pages/QuotationDocument.tsx` inline styles into a standalone, testable component with props `{ quotation, totals, validUntil, displayCompany? }` and print CSS via a colocated `<style>` (`@media print` + `@page` + `.no-print`).
2. Refactor `QuotationDocument.tsx` to compose `QuotationPDF` (no visual regression; toolbar stays).
3. No new prod dependency; `src/lib/money.ts` and `src/lib/quotations.ts` remain the single source for paise/GST/words.
4. Component test: `src/components/crm/QuotationPDF.test.tsx` — renders with mock proposal, asserts formatted INR (via paise), GST row, words, and a11y labels.
5. Build + tests: `pnpm test` + `pnpm build` (`vite build && tsc --noEmit`) must pass.
6. Branch `hermes/feat-quotation-print` from `dev`; draft PR `hermes/feat-quotation-print → dev`.

## 6. File:line references to accent-new conventions

- Money canonical: `src/lib/money.ts:14` (`toDecimal`), `rupeesToPaise:20`, `paiseToRupees:24`, `calculateTax:47`, `formatPaise:92`, `amountInWordsINR:182` (+ `Decimal` global config at `src/lib/money.ts:3`).
- Proposal/quotation vocabulary + validators: `src/lib/proposals.ts:5` (`PROPOSAL_STATUSES`), `proposalQuotationLineInputSchema` (~line 84), `quotationLinesTotalPaise`, `src/lib/quotations.ts:14` (`QUOTATION_GST_RATE_PCT=18`), `computeQuotationTotals:57`, `htmlToPlainText:118`.
- Current document: `src/crm/pages/QuotationDocument.tsx:17` (header rule), `Quotation details / Prepared for` grid, `Sr/Description/Qty/Unit price/Amount` table (line ~90), totals rail (line ~165), words (line ~200), terms (line ~210).
- Proposal detail interop: `src/crm/pages/ProposalDetail.tsx:1` (`formatPaise`, `quotationLinesTotalPaise` usage) — POC adds a `View quotation` → `/admin/quotations/:id` affordance reusing the same helpers.
- CRM tokens: `src/styles/crm.css:1` (`--brand-primary: #64126D`), `src/styles/index.css:18` (Inter + Tailwind theme wiring).
- DB canonical: `src/db/schema/proposals.ts:28` (`proposalsTable` with `valuePaise: bigint`, `proposalNumber: varchar(24)` format `P-NNN-MM-YYYY`) and child `proposal_quotation_lines` normalized from the old JSON `scope_items`.

## 7. Open questions / follow-ups

- **Company header data:** wire real `companiesTable` (address, GSTIN, phone, logo) via `getProposalDetailData` → `displayCompany` instead of the static Accent name. Requires a DB join + a logo object-storage URL.
- **CGST/SGST vs IGST:** derive from customer GSTIN state code vs company GSTIN; render two rows (`CGST 9%`, `SGST 9%`) when intrastate, single `IGST 18%` when interstate. Need a GSTIN parser helper.
- **Server-side PDF bytes:** add `@htmldocs/js` or `@react-pdf/renderer` and a `POST /api/quotations/:id/pdf` route that renders `QuotationPDF` to bytes — keeps the same tokens, no `puppeteer`.
- **Annexure expansion:** surface `proposalInputDocuments`, `proposalDeliverables`, `proposalSoftware`, `siteVisitNotes`, `exclusions` as numbered appendix sections (1–14 from the old 14-field annexure) when non-empty; reuse the old download route's field map but from normalized child tables.

## 8. Risks

- `@media print` fidelity varies by browser; the POC keeps the layout single-column to minimize fragmentation and verifies in Chrome/Edge.
- Amount-in-words casing: `amountInWordsINR` returns `Rupees … Only` title-cased — keep it italic/muted so casing mismatch is not visually harsh.
