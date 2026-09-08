--
-- 0004_serialised_assets.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0004_serialised_assets.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS, and the kind that cannot be re-derived from another table: this drops every
-- serialised asset the client entered during the physical count (ADR-003, O-5). The rows exist
-- nowhere else — `products` holds models, `orders.line_items` holds order contents. Take a dump
-- of `public.serialised_assets` before running this on any environment where the count has
-- started. On the T-037 staging rehearsal (apply -> down -> reapply) the table is empty by
-- definition, which is the only situation where this runs unguarded.
--
-- The trigger, indexes and policy all belong to the table and go with it; no separate DROP is
-- needed. Privileges disappear with the relation, so `hermes_ro`'s posture is unchanged by this
-- rollback in either direction (it never held any).
--
-- Idempotent: IF EXISTS, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

DROP TABLE IF EXISTS public.serialised_assets;

COMMIT;
