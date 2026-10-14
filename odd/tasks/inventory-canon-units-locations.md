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
- [ ] T2 Dashboard services: unit update/archive/bulk create, locations CRUD, relocation, counts; tests.
- [ ] T3 Dashboard UI: product list Stock/Disp/Arriendo + KPIs, product detail "Inventario" tab per canon.
- [ ] T4 Ops: ported validations + services + write APIs (role-gated), SSE inventory feed.
- [ ] T5 Ops UI: 2D plan editor + 3D warehouse with units by location; button check-in/out/relocate.
- [ ] T6 Integration verification (tests/builds both repos), commits per work unit.
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

## Next step
Run workflow.
