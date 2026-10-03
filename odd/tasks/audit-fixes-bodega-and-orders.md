# Audit fixes: bodega operator board and dashboard orders (dashboard consolidado)

Branch: consolidado-web-2027 (worktree dashboard-worktrees/consolidado). Audit source:
frontend-worktrees/consolidado/odd/audit/2026-10-02-consolidado-audit.md (findings A-xx).

## Owner decisions (2026-10-02)

- Bodega Salida (checkout) requires at most that the order is confirmed by the admin. It does not
  depend on payment or on other system states.
- The operator sees ALL orders confirmed by the admin, and can change order status to prepare them.
- Passing an order to Preparacion WITHOUT the reserve paid is allowed (A-06 accepted, no guard).
- Pickup person (quien retira) is NOT required (A-07 accepted, no change).

## Tasks (priority order)

- [x] D-1 (A-16) Salida gate: scanning Salida is allowed only when order status is confirmed,
      preparation or in-rental; blocked for request, evaluation, return, completed, cancelled with a
      clear Spanish error. Entrada has no status gate.
- [x] D-2 (A-15) Retiros board: list every order whose status is confirmed or preparation (admin
      confirmed) and that still has units to take out, independent of shipping_usage and of dates;
      soonest start date first. Devoluciones logic unchanged.
- [x] D-3 Operator status change on the bodega order sheet: forward-only buttons confirmed ->
      preparation -> in-rental -> return (one step at a time). Operator cannot set completed or
      cancelled, cannot go backwards. Endpoint authorizes admin, super_admin and operator; operator
      limited to this allowlist; operator cannot reach other admin routes.
- [x] D-4 (A-03) Find the root cause of saving status "Completado" freezing the tab on the order
      edit screen (orders/[id]); fix it; cover with a test.
- [x] D-5 (A-04) Find the cause of React hydration errors #418/#423/#425 on dashboard pages (suspect:
      header clock/date rendered differently on server (UTC) and client (America/Santiago)); fix;
      test the pure logic.
- [x] D-6 (A-05) Budget PDF is stored with a `contract_<customer>_...` file name; name it as a budget.
- [x] D-7 (A-17) /inventory progress counter must refresh after registering a unit.
- [x] D-8 (A-01) Trace where orders.reserve_value is defaulted (order #1575 got 20, #1576 got 25);
      report; fix only if the dashboard side causes it.
- [x] D-9 (blocking) Completing/cancelling an order no longer depends on email delivery: update route saves first, then sends the email best effort (20 s bound); failure/timeout returns 200 with `warning`; ProcessOrder shows a warning toast; EditOrderForm duplicate client-side email sends removed.
- [x] D-10 Retiros order: start today-or-later first (asc), then past starts flagged `late` ("Atrasado" badge, asc); start == today is not late.

## Constraints

Astro 5.9 + React 18, Tailwind 3, shadcn/ui, services layer (no queries in routes), response shape
{ success, data } / { success, error }, UI Spanish, code English, no emojis, mobile-first for /bodega.
No schema changes unless unavoidable (report first). No writes to the database from the agent.

## TDD / checks

TDD mode: enabled. Runner: pnpm test (vitest run). RED observed, then GREEN, then refactor.
Closure: pnpm test, pnpm build.

## Progress

- D-1 6318b98: Salida gate (confirmed/preparation/in-rental) in AssetMovementService + 409/404 mapping. RED observed (23 failing), GREEN.
- D-2 ef7a511: Retiros = orders confirmed|preparation with units left, no shipping_usage, no dates. RED observed, GREEN.
- D-3 c2e4b23: operatorOrderStatus allowlist, PUT status for operator (accessControl + endpoint), BodegaOrderStatus UI. RED observed, GREEN.
- D-4 8ddc49a: cause = update route awaited an unbounded email hop (before saving) and the client used blocking alert() while loading=true; added fetchWithTimeout (20s/12s), 504, toasts. Production hang itself not reproduced (hypothesis on which hop failed).
- D-5 caa5ebe: cause = local Date getters on timestamptz in ProcessOrder/OrderEstado/AdminCommunications (UTC SSR vs Santiago client); now formatBusinessDate*/Full. Topbar clock is not React, not the cause.
- D-6 df1dd99: generate-budget-pdf sent no filePath so the worker used contracts/contract_...; now budgets/budget_<customer>_<date>_<ts>.pdf.
- D-7 e7ce040: dashboard only bumped total_assets; now re-reads /api/inventory/progress after each unit (latest-wins).
- D-8 no code change: dashboard never writes reserve on create; DB default is 25 percent (0008). #1575=20 was set by an explicit reserve save (not provable from DB); no dashboard default of 20 exists.
- Checks: pnpm test 1884 passed 0 failed; pnpm build Complete.
- D-9 9557099: RED observed (5 route tests failing), GREEN. Old 502/504 tests rewritten to the new contract. EditOrderForm.handleSave sent the same email again from the browser, even if the save failed: plainly a duplicate, removed. Root cause of the email hop failing for order 1575 is still unknown (needs the worker/Resend logs).
- D-10 cf19223: RED observed (2 failing), GREEN. New `late` field on BodegaCard (Devoluciones `overdue` untouched); pickupCards takes `today`.
- Checks (D-9/D-10): pnpm test 1891 passed (one earlier run: generate-pdf.test.ts "rejects generic Supabase bearer tokens before reading JSON" timed out at 5.5 s, passed on rerun); pnpm build Complete.
