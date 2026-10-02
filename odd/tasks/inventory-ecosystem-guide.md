# Inventory ecosystem guide (dashboard consolidado)

Branch: consolidado-web-2027 (worktree dashboard-worktrees/consolidado). Site: dash-consolidado-mhans.vercel.app.

## Objective

Admins and warehouse operators can open an in-app guide that explains the whole equipment ecosystem:
how a product (SKU) links to physical units (asset tag, serial number), how QR and Code 128 labels
are generated and printed, how stock is configured, and what the operator does on mobile in /bodega.

## Problem

The "configurar stock" flow is unclear. /products (models, SKU) and /inventory (physical units,
asset tag MH-00000) are linked only by product_id, and nothing explains it. Orders cannot be
validated by the operator until units exist for the ordered products.

## Scope (authorized)

- A visible "Guia del inventario" button (opens a dialog or sheet) on /inventory and /products.
- Guide content in Spanish, accurate to the real implementation (read the code, do not invent).
- No schema changes, no new API routes, no behavior changes elsewhere.
  Out of scope: operator account creation, label printing changes, bulk/stock-by-date features.

## Constraints

- Dashboard: Astro 5.9 + React 18, Tailwind 3 (HSL vars), shadcn/ui, lucide-react. White theme only.
- UI copy Spanish, code identifiers English, no emojis, mobile-first (guide must read well at 390 px).

## Tasks

- [x] G-1 Map: SKU (products.sku), serialised_assets (asset_tag, serial_number), label page, bodega flow.
- [x] G-2 Guide component + button on /inventory and /products.
- [x] G-3 Tests for any extracted logic; pnpm test and pnpm build green.
- [ ] G-4 Deploy dashboard to Vercel consolidado project after owner approval; verify in browser.

## TDD / checks

TDD mode: enabled (global CLAUDE.md). Runner: pnpm test (vitest run). Pure copy/markup has no
unit-testable logic; add tests only for extracted helpers or data-driven content.
Closure: pnpm test, pnpm build, browser check at 1280 and 390 px.

## Route declaration

Mapping and writing delegated to one writer (preparation trigger).

## Progress

- G-1..G-3 done in commit 85c7d30 (feat(inventory): add ecosystem guide dialog on inventory and products).
  Route: inline single writer. TDD: RED observed (test failed, content module missing) then GREEN.
  Checks observed: pnpm test = 162 files / 1782 tests passed (one earlier full run showed 1 transient
  failure that did not reproduce on two reruns); pnpm build = Complete.
  Code vs brief: location is REQUIRED (not optional); serial_number is unique case-insensitively;
  no UI to mark damage or change condition after registration (scanner sends no condition_notes);
  scanner does not check condition; no code gate links order approval to unit existence.
  Browser check at 1280 and 390 px: pending (G-4).
