--
-- 0015_site_settings.down.sql
--
-- Rollback for 0015_site_settings.sql (ADR-D5 `.down.sql` convention).
--
-- DATA LOSS: dropping the table deletes every saved setting, including the signature URL.
-- Readers fall back to `DEFAULT_SETTINGS` (the old hardcoded constants), so nothing breaks, but
-- edits made from the dashboard are gone. Export `SELECT data FROM public.site_settings` first if
-- they matter. The uploaded signature file itself lives in R2 and is not touched.
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

DROP TABLE IF EXISTS public.site_settings;

COMMIT;
