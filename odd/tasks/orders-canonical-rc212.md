# Orders list: canonical RC2.1.2 visual design

## Objective

Make the dashboard "Pedidos" list (`src/pages/orders/index.astro`, `src/components/orders/OrdersDashboard.tsx`) look like the client's canonical design `CONSOLIDADO WEB YEYSON/Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_Pedidos_Canonical_RC2.1.2.html` while keeping the content the screen shows today (user request 2026-10-14).

## Context

- Since the 2026-10-14 go-live this branch (`consolidado-web-2027`) equals production `main`; production dashboard = Vercel `dashboard-rental-mhans` (`dashboard.mariohans.cl`).
- Exploration (2026-10-14): content already follows the canon (4 KPIs, tabs, IVA·Neto amount, tone badges, palette tokens in `globals.css`). The gap is visual/layout. `tailwind.config.mjs` has no `fontFamily`, so `font-mono` is not JetBrains Mono.

## Decisions (derived from "keep today's content")

- Keep the "Cancelados" tab, the product summary in Productos, the delivery select and Actualizar (styled like the canon's Filtros control).
- Do not add new content: no hito chip (no delivery time in data), no "Próximas Entregas" panel.
- The ⋯ menu's state action opens `ProcessOrder` as today (no direct status change from the list).
- Canon badge typography (uppercase, 10px) only in Pedidos, via a prop/variant; shared `StatusBadge`, `KpiCard`, `PageHeader` defaults unchanged (used by Delivery, Profitability, Products).
- Empty/loading states are not designed in the canon: `Loader2` + message + action (rule 04).

## Tasks

- [x] T1 Header + KPIs + tabs: actions in `PageHeader` actions slot; KPI canon variant (28px value, 30px icon, meta line) and click-to-filter tab; canon tab count pills (black when active).
- [x] T2 Table: presentational `OrdersTable.tsx`; canon columns (Nº with badge stacked, Cliente name+email, Proyecto, Inicio·Término, Jornadas "N días", Monto total + IVA·Neto, Productos summary, ⋯ menu with Ver pedido / PDFs / Cambiar estado → ProcessOrder); mono uppercase header; bordered radius-10 wrapper; row hover; `fontFamily.mono` in tailwind config.
- [x] T3 Mobile + pagination + search/filter + states: CSS card mode at ≤768px replacing JS `isMobileView`; canon square pagination with "Mostrando a–b de N"; search ≤340px; `Loader2` loading and empty state with action.

## Route

Delegated: one writer for T1–T3 (multi-file, sequential commits). Exploration evidence held by the parent.

## Checks per task

RED→GREEN where deterministic (source-assertion and component tests under `src/components/orders/__tests__`, `src/components/shared/__tests__`, `src/lib/__tests__`); full `pnpm test`; `pnpm build`; prettier on touched files only. Browser check of the result after an authorized deploy.

## Progress / evidence

- T1 `53a9f3e`, T2 `46a5c92`, T3 `723e80d` (delegated writer). RED→GREEN per task; full suite 2772/2772 (one unrelated timeout flake on first run, green on rerun); build ok each task. Parent re-ran orders tests: 103/103. Deviations: H1 20px (PageHeader default kept), sticky actions column, delivery select + Actualizar instead of "Filtros", Ver pedido opens new tab. RDD: assess → high/review_due (pending: native review after the detail slice). Not pushed (main auto-deploys production).
- 2026-10-14 (user): apply a workflow for the changes, make the order DETAIL similar to the canon, verify navigating with Playwright. Session for Playwright saved after manual user login (local dev → consolidado DB).
- [x] T4 Order detail `/orders/[id]` with canon RC2.1.2 detail screen, today's content kept.
- [x] T5 Playwright verification (list + detail, 1440 and 375) against the canon + one correction pass.
- T4 (workflow wf_b6fc6ff4-4f7, delegated writer): `fb444be` detail view-model + presentational cards, `54ec008` detail layout in ProcessOrder. RED→GREEN (36 new tests); full suite 2808/2808; build ok. Omitted for missing data: Categoría column, order history timeline, per-version budget metadata, photo stage split/lightbox metadata, payment entry/partial tag, hito badge, Rechazada step, revert links, cross-module top buttons. Behaviour notes for the user: no status-change buttons added to Acciones (status changes from Editar pedido); row Subtotal now price × qty × jornadas so the table total equals "Subtotal arriendo".
- T5 Playwright (Chrome channel, user-provided session, local dev → consolidado DB): round 1 found F1 high (detail scrollWidth 559 at 375px, communications block) and F2 medium (list without #). Fix pass `3e20743`, `242e420`; round 2 confirmed both resolved but found R1 high regression (fixed h-[500px] clipped the composer at 375px). Parent fix `5d2496d` (RED→GREEN in adminCommunicationsLayout.test.ts): Playwright check composer bottom 2070 < card 2122 at 375px, desktop 1653 < 1689, scrollWidth = clientWidth, 0 console errors. Full suite after: 253 files passed. Screenshots: scratchpad/pw/shots/round1, round2, r1-detail-*.png. Low findings left as polish (F3 dates with dashes, F4 weekday spelled out, F5 IVA line, F6 customer link, F7 KPI padding, F8 menu glyph/header, F9 mobile card density, V1 stepper style).
- RDD (user granted all 4 slices; whole range exceeded the reviewer budget): S1 224350b..46a5c92, S2 46a5c92..723e80d, S3 723e80d..fb444be, S4 fb444be..5d2496d (S1-S3 in temporary detached worktrees). All approved and acknowledged (authority burned); 17 non-blocking advisories, mostly test coverage (e.g. R3-unpaid-balance-excludes-pending-reserve, R3-duplicate-budget-urls, R3-conflict-date-tz, R3-font-stack-no-fallback) → follow-ups. Final build ok, full suite 2813/2813.
- 2026-10-14 (user): publish to production. origin/main still 224350b (inventory not landed) → fast-forward main to consolidado-web-2027.
- Delivered 2026-10-14: main protected (required check `pytest`, runs only on pull_request) → PR #4 opened from consolidado-web-2027, pytest green on c5bbd55, main fast-forwarded 224350b → c5bbd55 (PR auto-marked merged). Vercel auto-deployed production (dashboard-rental-mhans-lgb8jh8df, READY, aliased dashboard.mariohans.cl). Smoke: / 200, /orders and /orders/1 302 without session, health 200, check-conflicts 401. Inventory session notified to rebase onto c5bbd55.
