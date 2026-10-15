# Inventory canon: units per product + warehouse locations (dashboard + ops)

Locators:
- Dashboard: `dashboard-worktrees/inventory-ui/odd/tasks/inventory-canon-units-locations.md` (branch `ui-inventory-canon`)
- Ops: `mariohans-3d-ops` branch `feat/ops-bodega` (tasks mirrored in `odd/tasks/mariohans-3d-ops.md` T7)
- Engram mirror `odd/inventory-canon-units-locations/tasks`: PENDING (engram project ambiguous)

## Objective
Unify inventory: every catalog product has N physical units (serialised_assets) tracked end to end, with a
structured warehouse location model managed by admins (dashboard) and operators (ops.mariohans.cl), so client
requested products reconcile with real units. Dashboard follows canon RC2.1.3 "Catálogo de Equipos"
(`CONSOLIDADO WEB YEYSON/Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_Catalogo_Equipos_Canonical_RC2.1.3.html`);
ops shows the 5x5 m warehouse (4 walls with shelves/boxes/floor items, central rug) in 2D/3D with button-driven
check-in/check-out/relocation.

## Coordination (session mhans-50)
- mhans-50 owns `dashboard-worktrees/consolidado` (orders canon), src/components/orders/**, src/pages/orders/**, and
  shared files tailwind.config.mjs, src/components/shared/{StatusBadge,KpiCard,PageHeader}.tsx, src/styles/globals.css,
  src/lib/orderStatus.ts. This feature must NOT edit them.
- Migration number 0021 reserved for this feature. Never push main (auto-deploys production on Vercel).

## Constraints
- Production DB (supabase-9cd8-db) is live. 0021 is written + tested here; applying it to production requires a
  separate explicit user authorization. Rehearsal on a disposable DB also requires authorization (remote).
- Single model, one set of validations: ops mirrors dashboard services (ported pure libs with tests).
- Optimistic concurrency (row_version) on units and locations; "En arriendo" is derived, never stored.
- TDD for all pure logic and services. UI copy Spanish, code English.

## Tasks (route: Workflow, user-requested)
- [x] T1 Migration 0021 (+down, +tests): wear, blocked state, warehouse_locations, location_id + text sync,
      asset_relocations, row_version, incident_type, product_unit_counts view, RLS/grants.
      Route: delegated (workflow worker). Not applied to any database.
- [x] T2 Dashboard services: unit update/archive/bulk create, locations CRUD, relocation, counts; tests.
      Route: delegated (workflow worker).
- [ ] T3 Dashboard UI: product list Stock/Disp/Arriendo + KPIs, product detail "Inventario" tab per canon.
      PARTIAL, committed 8329a56: KPIs, detail tab, bulk dialog and /inventory/ubicaciones done; list table columns
      not wired (ProductsDashboard.tsx outside surface); per-location unit counts not served.
- [x] T4 Ops: ported validations + services + write APIs (role-gated), SSE inventory feed.
      Ops commit cec760a (mariohans-3d-ops feat/ops-bodega). Route: delegated.
- [x] T5 Ops UI: 2D plan editor + 3D warehouse with units by location; button check-in/out/relocate.
      Ops commit 9181ea3. Route: delegated.
- [x] T6 Integration verification (tests/builds both repos), commits per work unit. Route: delegated (verifier).
- [ ] T7 (later) Unit assignment at Confirmada→Preparación (order_asset_assignments).

## Progress / evidence
### T1 (2026-10-14)
- Files: `supabase/migrations/0021_warehouse_units_locations{,.down}.sql`,
  `supabase/migrations/__tests__/0021_warehouse_units_locations.test.ts`, `src/types/inventory.ts`
  (appended self-contained block "BEGIN/END SHARED INVENTORY CONTRACT" — ops copies that block only;
  legacy `ASSET_CONDITIONS`/`SerialisedAsset` left untouched so intake does not offer `blocked` before 0021 is applied).
- Baseline `pnpm test`: 2750 passed, 7 failed (all `src/components/orders/__tests__/OrdersDashboard.sourceAssertions.test.ts`, owned by mhans-50; not touched).
- RED: new test file failed with ENOENT on `0021_warehouse_units_locations.sql` (no tests collected).
- GREEN: 39/39 in the 0021 test; full suite 2789 passed, same 7 pre-existing failures. `lint-chain.sh`: 0 findings.
- Decisions: actor columns are uuid -> `admin_users(user_id)` ON DELETE SET NULL (both apps hold the auth uuid);
  relocation = INSERT into `asset_relocations` (AFTER INSERT trigger moves the unit, SQLSTATE PT409 / HTTP 409 when the unit
  is no longer at `from_location_id`); location text sync fires on every INSERT/UPDATE (not only UPDATE OF location_id) and
  location renames propagate; `asset_relocations` is append-only (SELECT, INSERT); view buckets are exclusive
  (total = available + in_rental + maintenance + damaged + blocked; maintenance includes cleaning).
- Pending: runtime rehearsal on a disposable DB (needs authorization); production apply (needs authorization).

### T2 (2026-10-14)
- Pure libs: `src/lib/inventoryUnits.ts` (InventoryError with status/code, deriveUnitStatus, sanitizeUnitPatch,
  planBulkUnits), `src/lib/warehouseLocations.ts` (parseLocationDraft, validateLocation with hard rules + overlap /
  outside-room warnings, buildLocationTree, describeLocation). `lib/assetMovements.ts`: validateIncidentType.
- Services: SerialisedAssetService.updateAsset/archiveAsset/bulkCreateAssets/listByProduct; new
  WarehouseLocationService, AssetRelocationService (single INSERT into asset_relocations; trigger moves the unit,
  PT409 -> 409), ProductUnitCountsService; AssetMovementService accepts incident_type on checkin only.
- API: locations (GET/POST, PUT/DELETE [id]), products/[productId]/units (GET/POST bulk), assets/[id] PUT,
  assets/[id]/archive, assets/[id]/relocate, counts. Operator allowlist: GET locations, POST relocate.
- RED: 6 new suites failed on missing modules + 8 assertions (incident, access control); route suites 25 failing.
  GREEN: full `pnpm test` 2917 passed, 7 failed (same pre-existing OrdersDashboard.sourceAssertions, mhans-50).
- Coordination: mhans-50 notified of accessControl.ts / movements.ts edits.

### T3 (2026-10-14) — partial, committed
- Route: delegated (workflow worker); resumed an interrupted run, kept its uncommitted work after review.
- Canon pieces (local, Tailwind arbitrary values, no shared canon variants): `components/inventory/canon/`
  (UnitStatusPill with 5px dot, InventoryKpi/InventoryKpiRow, unitStatus, inventoryKpis).
- Product list: `pages/products/index.astro` renders the 4 unit KPIs (Modelos Publicados + "N unidades en
  inventario", Disponibles Hoy %, En Arriendo, Mantención / Bloqueadas) from ProductUnitCountsService; on failure
  (DB without 0021) it falls back to the previous CatalogKpiRow. `ProductUnitCountCells` + `useProductUnitCounts` +
  `fetchProductUnitCounts` (GET /api/inventory/counts, chunked, all-or-nothing, "—" on failure) are built and tested
  but NOT wired into the table: the list lives in `src/components/ProductsDashboard.tsx`, outside the T3 edit surface.
- Product detail: view mode has tabs Ficha | Inventario (`#inventario` deep link); the edit-mode stock tab was
  renamed "Stock y medidas". `ProductInventoryTab` + `UnitsTable`: # | Código (mono) | N° de serie | Condición |
  Estado | Ubicación (tree select + legacy text) | Observaciones | Reubicar/Archivar; inline edit sends row_version,
  409 CONFLICT -> toast + quiet reload; footer count, Agregar unidad, Agregar varias (BulkUnitsDialog: cantidad,
  condición, estado, ubicación, prefijo), Imprimir etiquetas (/inventory/labels?tags=...), mobile cards "Unidad 001",
  empty state.
- `/inventory/ubicaciones` (admins; operators redirected): SVG 5x5 m plan with walls N/E/S/W, create shelf (levels),
  box, floor spot; drag with 0.1 m snap; arrow nudge (shift 0.5 m); edit name/code; deactivate. Unit count per location
  is supported by the component but the page passes `unitCounts={null}`: no service returns counts per location.
- Tests: no jsdom/@testing-library in this project (adding them is outside the surface); component tests use
  `react-dom/server` render + fetch-mocked api/edit modules. RED for the earlier work happened in the interrupted run
  and was not re-observed here.
- GREEN: `pnpm test` 2990 passed, 7 failed (OrdersDashboard.sourceAssertions, CRLF checkout `core.autocrlf=true`);
  `pnpm build` complete.

### T3 follow-up (2026-10-14) — catalog stock columns + unit counts per location
- Route: delegated (bounded writer); surface widened by the parent to `ProductsDashboard.tsx`, the
  location service/API and `ubicaciones.astro`.
- Catalog table (`src/components/ProductsDashboard.tsx`): `useProductUnitCounts(allProducts ids, accessToken)`
  feeds `ProductUnitCountCells`; headers Equipo | SKU | Ubicación | Estado | Stock | Disp. | Arriendo |
  Inventario | Precio/día | Acciones. Estado keeps the stock_status badge, sort and filter; the unit status pill
  sits under "Inventario" to avoid a second "Estado". Counts missing / endpoint failing -> "—" in all 4 cells.
- `WarehouseLocationService.countUnitsByLocation()`: `{location_id -> non-retired units}` (direct counts; the plan
  rolls children up), reads only `location_id`, pages by 1000 (PostgREST max-rows), throws on DB error.
  `GET /api/inventory/locations?with_counts=1` adds `unit_counts` (`null` on failure, list still 200).
  `/inventory/ubicaciones` reads the counts in their own try/catch and passes `unitCounts={unitCounts}`
  (null -> existing "aún no está disponible" notice).
- RED: 15 failing (4 service, 2 route, 3 page source, 5 dashboard wiring, 1 updated layout header assertion
  that used to forbid a "Stock" header). GREEN: targeted 22 files / 229 tests passed.
- Full `pnpm test`: 3002 passed, 10 failed = 7 OrdersDashboard.sourceAssertions (CRLF checkout,
  `core.autocrlf=true`) + 3 timeouts under load in `api/order/generate-contract-pdf`, `api/orders/create-pricing`,
  `api/orders/create-status`; `vitest run src/pages/api/order src/pages/api/orders` alone: 123/123 passed.
  `pnpm build`: Complete.
- Not done: no browser check of `/products` or `/inventory/ubicaciones` (no DB with 0021 reachable from here),
  so the T3 checkbox stays open until a visual pass.

### T4 + T5 ops (2026-10-14) — see `mariohans-3d-ops/odd/tasks/mariohans-3d-ops.md` (T7a, T7b)
- T4 cec760a: ported rules (inventoryRules/*), services, write APIs (movements, relocate, orders advance,
  locations CRUD), role gates, Origin check, 503 INVENTORY_UNAVAILABLE without 0021, SSE `inventory` snapshot.
  RED observed for the 4 bodega/checkIn/checkInReception/businessDay ports; inherited work not re-observed.
- T5 9181ea3: /bodega workspace (order queue, 2D plan, lazy 3D, scan bar, optimistic moves with 409 rollback,
  admin location editor). RED/GREEN observed per helper, store and UI suite.

### T6 verification (2026-10-14)
- Dashboard `pnpm test` (run 1, concurrent with the ops suite + build): 2986 passed, 11 failed = 7
  OrdersDashboard.sourceAssertions (CRLF checkout, `core.autocrlf=true`) + 4 in `src/pages/api/orders/__tests__`
  (create-status, create-warning, ...). Those 4 pass in isolation (`vitest run src/pages/api/orders`: 118/118) and
  in a clean full re-run, so they are load-related flakes, not inventory code; not fixed.
- Dashboard `pnpm test` (run 2, alone): 2990 passed, 7 failed (only the CRLF-caused OrdersDashboard.sourceAssertions).
- Dashboard `pnpm build`: Complete.
- Ops `pnpm test`: 56 files, 637 passed. `pnpm build`: Complete (Vite chunk-size warning, three/R3F).
  `pnpm exec tsc --noEmit -p .`: 0 errors.
- Port consistency: all 11 ops files with a "Ported from dashboard" header (assetMovements, assetTag, bodega,
  bodegaScan, businessDay, checkIn, checkInReception, inventoryUnits, movementTypes, operatorOrderStatus,
  warehouseLocations) diff to 0 lines against dashboard HEAD after ignoring the header, imports and whitespace;
  the 0239e92-tagged sources are unchanged since 0239e92. orderStatusCompat's LEGACY_TO_V12 map matches
  `src/lib/orderStatus.ts` entry for entry.
- Role matrix: same in both apps. Operator can look up assets/record movements/read locations/relocate/advance
  orders forward; locations create/edit/delete is admin and super_admin only. Ops also refuses cross-origin
  mutations (403). Error codes line up: 409 CONFLICT (stale row_version / PT409), 400 VALIDATION, 404 NOT_FOUND.
- 0021 down reverses up: drops view, asset_relocations (+trigger fn), sync/bump triggers, restores the 5-value
  condition CHECK (refuses while `blocked` rows exist), drops location_id/row_version/wear and incident_type, drops
  warehouse_locations (its triggers and seed row go with it) and the 3 helper functions; none of these objects
  exist in earlier migrations. Static review only; no runtime rehearsal.
- Hygiene: no edits to mhans-50 files in `git diff 46a5c92..HEAD` (67 files); no `variant="canon"` added in either
  repo; secret-pattern grep over both diffs found nothing; no remote ref contains any of the new commits (dashboard
  branch has no upstream; the ops repo has no remote).
- Ops demo smoke: an existing `astro dev` (PID 38996) already held port 4445, so my `pnpm dev` exited with
  "already running" and the checks hit that server (same repo, demo mode, no Supabase env): `/health` 200
  `{"ok":true}`; `/api/inventory/warehouse` 200 with the demo tree (dev-only DEV_DEMO_USER bypass, by design);
  `/bodega` 200. chrome-devtools at 1280x800: plan, rug, shelves and count badges render; 0 console errors/warnings;
  requests were /bodega 200 and /api/stream 200. Visual nit: the S-E2 count badge is half-covered by the S-P1 spot.

## Next step
- Production ship (parent; user decided dashboard `main` is the target, `consolidado-web-2027` no longer
  integrates): cherry-pick only 0239e92, fcf01e5, 8329a56 (+ this docs commit) onto origin/main 224350b in an LF
  checkout; full `pnpm test` + `pnpm build` there; backup + dry-run + apply 0021 on production as supabase_admin;
  push main; deploy ops (cec760a, 9181ea3).
- Browser pass of `/products` (Stock/Disp./Arriendo/Inventario) and `/inventory/ubicaciones` (count badges)
  against a database with 0021, then close T3. The ship cherry-pick list must include the T3 follow-up commit.
- Ops: badge overlap S-E2/S-P1 in the 2D plan; no unit create/edit API or UI ('manage_units' unused).
