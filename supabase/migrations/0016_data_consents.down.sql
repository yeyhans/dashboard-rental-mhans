--
-- 0016_data_consents.down.sql
--
-- Rollback for 0016_data_consents.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS: dropping the table deletes the legal evidence of every recorded consent. Export
-- `SELECT * FROM public.data_consents` first. Do not roll back once consents have been collected
-- in production unless the export is archived.
--
-- Idempotent: IF EXISTS, so a re-run is safe.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Este rollback debe ejecutarse como supabase_admin (rol actual: %). DROP TABLE exige ser dueno de la relacion.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

DROP TABLE IF EXISTS public.data_consents;

COMMIT;
