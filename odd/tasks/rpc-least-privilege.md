# rpc-least-privilege — close anon access to SECURITY DEFINER RPC functions

Created: 2026-10-01. Branch: `consolidado-web-2027` (dashboard worktree). Engram mirror: `odd/rpc-least-privilege/tasks`.

## Objective

Stop anyone holding the public anon key from reading or rewriting arbitrary `user_profiles` rows
(and from applying coupons / shipping to arbitrary orders) through `SECURITY DEFINER` functions
in schema `public`.

## Problem

Verified 2026-10-01 (read-only MCP, both databases): 17 `SECURITY DEFINER` functions carry an
explicit `GRANT ... TO anon, authenticated` (plus `PUBLIC`) inherited from `0000_baseline.sql`
(lines 3012-3015 and following), and none checks `auth.uid()`. `update_user_profile_securely`,
`update_user_profile_admin_full`, `update_user_profile_admin`, `admin_create_user_profile` and
`get_user_profile_by_auth_uid` therefore allow full profile read/write with a sequential
`user_id`. Same state in PRODUCTION (`supabase-9cd8-db`) and CONSOLIDADO (`supabase-stg-db`);
function bodies identical (md5 verified). ~150 profiles, 108 with signature, 104 with ID-card
photos. Ley 21.719 Art. 14 quinquies.

## Scope (approved by the user 2026-10-01)

Migration `0014_rpc_least_privilege.sql` + `.down.sql` + vitest static test, following
`0013_coupon_usage_lifecycle.sql` conventions (role guard, timeouts, BEGIN/COMMIT, idempotent).

| Group                               | Functions                                                                                                                                                                                                                    | EXECUTE kept for                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A — service_role only               | update_user_profile_admin, update_user_profile_admin_full, admin_create_user_profile, create_user_profile_manual, migrate_existing_users_to_profiles, get_user_profile_by_auth_uid, handle_new_user, hermes_notify_new_order | service_role (+ postgres, supabase_admin)                                                                                       |
| B — authenticated + ownership guard | update_user_profile_securely, apply_coupon, apply_shipping_method, get_user_coupon_history, get_user_shipping_history                                                                                                        | authenticated, service_role; body gains `auth_uid = auth.uid()` ownership check on `p_user_id`; service_role bypasses the guard |
| C — unchanged                       | validate_coupon, calculate_shipping_cost, get_available_shipping_methods, search_coupons                                                                                                                                     | anon (read-only pricing/catalogue)                                                                                              |

Out of scope (recorded for the compliance report): PII CSVs tracked in the frontend repo
(`src/utils/users.csv`, `orders.csv`, commit bf3bd55); migrations 0001/0005 not yet applied to
production.

## Constraints

- Apply as `supabase_admin` (`psql -U supabase_admin -v ON_ERROR_STOP=1 -f`). `postgres` is not
  owner in production; REVOKE as postgres silently no-ops.
- Trigger functions (`handle_new_user`, `hermes_notify_new_order`) run as their owner; revoking
  EXECUTE from anon does not affect trigger firing.
- Frontend call sites for group B run with the logged-in user's JWT (`persistSession: true`,
  `frontend/src/lib/supabase.ts:54-57`): `ContractContent.tsx:435`, `documentUploadService.ts:92`,
  `contractGenerationService.ts:580`, `couponService.ts:170/222`, `shippingService.ts:163/213`.
- Dashboard call sites all use `supabaseAdmin` (service_role) — unaffected.
- TDD: strict, source = session config. Runner: `pnpm test` (vitest run) in this worktree.
  Static SQL assertions only (no DB in vitest); runtime proof = apply on consolidado + browser check.
- RDD: on (global). Review candidate = the work-unit commit.

## Tasks

- [x] T1 — Write `0014_rpc_least_privilege.sql`, `.down.sql`, `__tests__/0014_rpc_least_privilege.test.ts` (RED first), run `pnpm test` + `lint-chain.sh`. Route: delegated writer (writer trigger: 3 non-trivial files). Commit on `consolidado-web-2027`.
- [ ] T2 — Apply 0014 on CONSOLIDADO (`supabase-stg-db`) as supabase_admin; post-apply privilege assertions via MCP; browser check on new.mariohans.cl: login, upload document / sign contract, checkout with coupon + shipping.
- [ ] T3 — Apply 0014 on PRODUCTION in a user-authorized window; same assertions; read-only browser check on rental.mariohans.cl.
- [ ] T4 — Resume `/compliance-cl` (Fase 2 onward) with this remediation recorded.

## Delivery

Forecast ≈ 350 authored lines (migration + down + test). Strategy: `ask-on-risk`.

## Progress / evidence

### T1 — done 2026-10-01, commit `2bf283b`

- Route: delegated writer (sonnet), writer trigger (3 non-trivial files). Parent spot check:
  structural readback of `apply_coupon` body and of every REVOKE/GRANT line.
- Parent correction before commit: guard read `current_setting('request.jwt.claim.role')`,
  which current PostgREST no longer sets (claims arrive as `request.jwt.claims` JSON) — would have
  blocked the dashboard's service_role calls to `apply_coupon`/`get_user_coupon_history`.
  Replaced with `auth.role()` (verified: identical helper in prod and consolidado, md5
  f31486fe…, reads both forms). Test updated to require `auth.role()` and forbid the raw setting.
- TDD: RED `Tests 5 failed | 1639 passed` → GREEN `Test Files 146 passed, Tests 1644 passed`.
- `bash supabase/migrations/lint-chain.sh`: `0 findings — 33 sequenced migration(s)`, exit 0.
- RDD: assess `medium` / `review_due: slice_budget_reached` (1002 lines) → consent granted by
  user → lens `review-reliability` → approved → acknowledged
  (`gentle-ai.review-acknowledged/v1`, target `sha256:25448d54…`). Reviewed boundary = `2bf283b`.
- Authored lines so far: 933 (migration 457 + down 255 + test 221). Over the ~400 heuristic
  because the five group-B bodies must be restated verbatim in both up and down; splitting
  would leave the exposure half-closed between commits.
