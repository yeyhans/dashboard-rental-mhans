--
-- 0016_data_consents.sql — append-only record of explicit data-protection consents (Ley 21.719).
--
-- WHY. The contract flow needs a consent that is separate from the terms and conditions: personal
-- data is stored and processed on a server located in Sao Paulo, Brazil (international transfer,
-- art. 27), and identity documents are read by an in-house OCR (art. 8 bis, suggestions only). Each
-- acceptance must be provable: text version, purpose, timestamp and user.
--
-- SHAPE. Append-only: a withdrawal is a new row with granted = false, never an UPDATE. The latest
-- row per (auth_uid, purpose) is the current state. `auth_uid` has no FK to auth.users on purpose:
-- the evidence of a consent must outlive the deletion of the account.
--
-- PURPOSES. international_transfer (mandatory to continue), ocr_processing (optional; the manual
-- path stays available).
--
-- PRIVILEGES. Deny-by-default (0005 convention): reached solely through the application's
-- service-role client after authenticating the user. `hermes_ro` is absent by construction and not
-- granted; a grant needs an ADR-D8 allowlist change. No UPDATE, no DELETE.
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

CREATE TABLE IF NOT EXISTS public.data_consents (
    id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    auth_uid        uuid        NOT NULL,
    purpose         text        NOT NULL CHECK (purpose IN ('international_transfer', 'ocr_processing')),
    consent_version text        NOT NULL CHECK (length(consent_version) BETWEEN 1 AND 64),
    granted         boolean     NOT NULL,
    ip_address      inet,
    user_agent      text        CHECK (user_agent IS NULL OR length(user_agent) <= 512),
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.data_consents IS
    'Append-only log of explicit consents (Ley 21.719). Latest row per (auth_uid, purpose) is the current state; withdrawal = new row with granted = false.';

CREATE INDEX IF NOT EXISTS idx_data_consents_user_purpose
    ON public.data_consents (auth_uid, purpose, created_at DESC);

REVOKE ALL ON TABLE public.data_consents FROM PUBLIC;
REVOKE ALL ON TABLE public.data_consents FROM anon, authenticated;
-- Supabase default privileges hand service_role every right on new tables; append-only means it
-- must lose UPDATE/DELETE/TRUNCATE explicitly.
REVOKE ALL ON TABLE public.data_consents FROM service_role;
GRANT SELECT, INSERT ON TABLE public.data_consents TO service_role;
GRANT USAGE ON SEQUENCE public.data_consents_id_seq TO service_role;

ALTER TABLE public.data_consents ENABLE ROW LEVEL SECURITY;

-- Grant and policy must both exist or the read is a silent zero-row result (F-3 from the 0002
-- audit). service_role bypasses RLS; the policy keeps the table from being policy-less.
DROP POLICY IF EXISTS "Allow service_role full access to data_consents" ON public.data_consents;
CREATE POLICY "Allow service_role full access to data_consents"
    ON public.data_consents
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;

-- Post-apply assertion: all four must read `false`.
--
--   SELECT has_table_privilege('hermes_ro', 'public.data_consents', 'SELECT') AS ro_select,
--          has_table_privilege('anon',      'public.data_consents', 'SELECT') AS anon_select,
--          has_table_privilege('authenticated', 'public.data_consents', 'SELECT') AS auth_select,
--          has_table_privilege('service_role', 'public.data_consents', 'UPDATE') AS svc_update;
