# Tech debt log

One entry per finding: `file:line`, what's wrong, why it matters, suggested fix, date found.

- `src/lib/proposals.server.ts:348` — `amountPaise: line.quantity * line.unitPricePaise` derives line amounts with bare `number` multiplication. Both operands are schema-capped integers, but `quantity ≤ 100 000` × `unitPricePaise ≤ Number.MAX_SAFE_INTEGER` can exceed 2^53, silently losing paise precision before the value is persisted (`proposals.ts:92-96` caps each side independently). Fix: clamp via `Math.min(Number.MAX_SAFE_INTEGER, …)` or compute with Decimal.js and validate the product fits, mirroring the ROUND_HALF_UP discipline used everywhere else in `money.ts`. Found 2026-08-26 while rebuilding the quotations module.
- `src/routes/admin/index.tsx:6` — the `/admin/` index redirected to `/admin/$module` with `module: 'quotations'`, relying on dynamic-route fallback config instead of the real page. Now points at the dedicated `/admin/quotations` route; flagged as the pattern to avoid when other admin modules graduate from placeholder pages. Found 2026-08-26.
