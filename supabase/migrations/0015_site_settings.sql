--
-- 0015_site_settings.sql — single-row business settings (site-settings feature).
--
-- WHY. Company, legal representative (with signature image URL), bank account, contact channels,
-- pickup addresses, default reserve and policy copy were hardcoded across the PDF generators, the
-- notification emails and the layout. This table holds them so a super_admin can edit them from
-- the dashboard. `data` is validated by `src/lib/siteSettings.ts` (zod) and merged over
-- `DEFAULT_SETTINGS`, so an empty row or a missing row behaves like the old constants.
--
-- SHAPE. One row, enforced by `CHECK (id = 1)`. The payload is jsonb on purpose: sections evolve
-- without a migration per field, and the application schema is the contract.
--
-- PRIVILEGES. Deny-by-default (0005 convention): admin-only, reached solely through the
-- dashboard's service-role client. `hermes_ro` is absent by construction and deliberately not
-- granted; a grant needs an ADR-D8 allowlist change. No DELETE: the row is created once and
-- updated.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS, so a partial apply can be replayed.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Esta migracion debe ejecutarse como supabase_admin (rol actual: %). Las relaciones de public '
      'pertenecen a supabase_admin: como postgres, REVOKE informa exito y no revoca nada.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

CREATE TABLE IF NOT EXISTS public.site_settings (
    id         smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    data       jsonb       NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text
);

COMMENT ON TABLE public.site_settings IS
    'Single-row business settings (company, representative, bank, contact, pickup, reserve, policies) edited from the dashboard.';

DROP TRIGGER IF EXISTS site_settings_set_updated_at ON public.site_settings;
CREATE TRIGGER site_settings_set_updated_at
    BEFORE UPDATE ON public.site_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON TABLE public.site_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.site_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Grant and policy must both exist or the read is a silent zero-row result (F-3 from the 0002
-- audit). service_role bypasses RLS; the policy keeps the table from being policy-less.
DROP POLICY IF EXISTS "Allow service_role full access to site_settings" ON public.site_settings;
CREATE POLICY "Allow service_role full access to site_settings"
    ON public.site_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;

-- Post-apply assertion: all three must read `false`.
--
--   SELECT has_table_privilege('hermes_ro', 'public.site_settings', 'SELECT') AS ro_select,
--          has_table_privilege('anon',      'public.site_settings', 'SELECT') AS anon_select,
--          has_table_privilege('authenticated', 'public.site_settings', 'SELECT') AS auth_select;
