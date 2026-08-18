--
-- 0000_baseline.down.sql
--
-- Rollback for 0000_baseline.sql (ADR-D5 `.down.sql` convention).
--
-- Data-loss note: NONE. 0000_baseline is descriptive-only — it is never applied against
-- production (production already carries this schema natively; production's applied
-- migration chain starts at 0001). This down script exists solely to make the
-- restore-onto-a-fresh-instance rehearsal (T-005) apply -> down -> re-apply cyclable, per
-- proposal.md's rollback table ("0000_baseline ... no runtime change to roll back").
--
-- Idempotent: every statement uses IF EXISTS.
--

BEGIN;

-- Views first (depend on tables/functions below)
DROP VIEW IF EXISTS public.products_with_categories;
DROP VIEW IF EXISTS public.order_summary;

-- Triggers (must precede dropping their functions)
DROP TRIGGER IF EXISTS trg_hermes_notify_new_order ON public.orders;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Tables (CASCADE clears dependent policies, indexes, FKs, and the trigger above if it
-- somehow survived — belt and suspenders, the explicit DROP TRIGGER above is authoritative)
DROP TABLE IF EXISTS public.coupon_usage CASCADE;
DROP TABLE IF EXISTS public.shipping_usage CASCADE;
DROP TABLE IF EXISTS public.order_communications CASCADE;
DROP TABLE IF EXISTS public.hermes_pending_writes CASCADE;
DROP TABLE IF EXISTS public.hermes_notifications CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.shipping_methods CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.admin_users CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Functions. Full 29-function inventory with exact argument signatures, generated from
-- production via `pg_get_function_identity_arguments` (2026-08-18) — CASCADE alone from the
-- table drops above is NOT sufficient: plpgsql function bodies are opaque to Postgres's
-- dependency tracker, so functions like `apply_coupon`/`validate_coupon`/
-- `admin_create_user_profile` that only reference tables inside their body (not via a
-- declared FK/view dependency) survive a `DROP TABLE ... CASCADE` and must be dropped
-- explicitly, or a re-apply fails with "function already exists with same argument types"
-- (found during the T-005 rehearsal apply -> down -> reapply cycle).
DROP FUNCTION IF EXISTS public.admin_create_user_profile(uuid, text, text, text, text, text, text, text, text, text, text, date, text, text, text, text, text, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.apply_coupon(character varying, integer, numeric, integer) CASCADE;
DROP FUNCTION IF EXISTS public.apply_shipping_method(integer, integer, integer, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_iva(numeric) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_order_subtotal(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_shipping_cost(integer, numeric, character varying) CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile_manual(uuid, text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_available_shipping_methods(numeric, character varying) CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_stats() CASCADE;
DROP FUNCTION IF EXISTS public.get_products_by_category(integer, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_smart_related_products(integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_coupon_history(integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_profile_by_auth_uid(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_shipping_history(integer) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.hermes_notify_new_order() CASCADE;
DROP FUNCTION IF EXISTS public.migrate_existing_users_to_profiles() CASCADE;
DROP FUNCTION IF EXISTS public.search_coupons(character varying, character varying) CASCADE;
DROP FUNCTION IF EXISTS public.search_products_advanced(text, integer, numeric, numeric, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.trigger_update_category_counts() CASCADE;
DROP FUNCTION IF EXISTS public.update_all_category_counts() CASCADE;
DROP FUNCTION IF EXISTS public.update_categories_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_category_count(integer) CASCADE;
DROP FUNCTION IF EXISTS public.update_date_modified_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_order_communications_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_profile_admin(integer, text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_user_profile_admin_full(integer, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.update_user_profile_securely(integer, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.validate_coupon(character varying, integer, numeric) CASCADE;

-- Hermes roles are intentionally NOT dropped here. Roles are cluster-scoped, not
-- database-scoped: `hermes_ro`/`hermes_rw`/`hermes_notifier` are shared across every database
-- in the cluster, including production (`postgres`) and staging (`mhans_staging`) when this
-- down script is rehearsed on the same cluster. `DROP ROLE` was attempted here during the
-- T-005 rehearsal (2026-08-18) and correctly failed — Postgres reported 18 dependent objects
-- in database `postgres` (production) and 17 in `mhans_staging` — proving a database-scoped
-- down script must never drop a cluster-scoped role. `DROP OWNED BY ... CASCADE; DROP ROLE`
-- would have force-dropped grants this connection's database cannot see the blast radius of.
-- If a role genuinely needs removal, that is a separate, manually-reviewed cluster
-- administration action, never part of an automated per-database rollback.

COMMIT;
