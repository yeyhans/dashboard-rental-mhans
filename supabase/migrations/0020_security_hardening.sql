--
-- 0020_security_hardening.sql — close findings F2-F5 of the 2026-10-13 cutover audit.
--
-- WHY. Re-verified on supabase-stg-db (consolidado) on 2026-10-13, read-only:
--   F2  `authenticated` holds INSERT and UPDATE on public.orders, and two policies
--       ("Customers can create/update their own orders") only check `customer_id`. A logged-in
--       customer holding the public anon key plus their own JWT could create orders or rewrite
--       totals, status and line items of their own orders straight through PostgREST.
--   F3  The "Users can update their own profile" policy lets the owner set `url_user_contrato`
--       and `terminos_aceptados` on their own row, i.e. fake a signed contract — the gate that
--       must hold before an order is created.
--   F4  SECURITY DEFINER `search_coupons`, `validate_coupon`, `calculate_shipping_cost` and
--       `get_available_shipping_methods` run with no fixed `search_path` (proconfig NULL) and are
--       executable by PUBLIC/anon. `search_coupons` lets anyone enumerate published coupons.
--   F5  pg_default_acl on `public` grants EXECUTE on every future function to anon and
--       authenticated (grantors postgres and supabase_admin). anon and authenticated hold
--       TRUNCATE, REFERENCES and TRIGGER on several relations; TRUNCATE ignores RLS, so anon
--       could empty user_profiles, admin_users, coupon_usage and shipping_usage.
--
-- SHAPE.
--   F2  REVOKE INSERT, UPDATE ON orders FROM authenticated (anon never had them) and drop the two
--       customer write policies. SELECT and "Customers can read their own orders" stay. hermes_rw
--       policies are untouched.
--   F3  BEFORE INSERT OR UPDATE trigger on user_profiles. When the request comes through
--       PostgREST as `anon` or `authenticated` (auth.role(), read from the JWT claims — it stays
--       correct inside SECURITY DEFINER RPCs such as update_user_profile_securely, where
--       current_user is the function owner) and the caller is not in admin_users, it rejects
--       an INSERT that sets the contract URL or the acceptance flag, and an UPDATE that changes
--       either. service_role, direct DB sessions (no JWT: migrations, GoTrue's handle_new_user,
--       Hermes) and dashboard admins are unaffected. Writing an unchanged value passes, so the
--       COALESCE-style RPC bodies keep working when they do not receive these keys.
--   F4  ALTER FUNCTION ... SET search_path = public, pg_temp on all four (their bodies reference
--       only public objects and built-ins — checked via prosrc). EXECUTE is revoked from PUBLIC on
--       all four. anon/authenticated keep EXECUTE only where the browser calls the function:
--         validate_coupon                 frontend src/services/couponService.ts:96 (anon client,
--                                         OrderConfirmationForm) and src/pages/api/supabase/
--                                         validate-coupon.ts (anon client)
--         get_available_shipping_methods  frontend src/services/shippingService.ts:76 (anon,
--                                         ShippingSelector)
--       and lose it where no caller exists:
--         search_coupons                  only reachable via couponService.getCoupon, which has
--                                         no caller
--         calculate_shipping_cost         ShippingService.calculateShippingCost has no caller
--       The dashboard calls validate_coupon with supabaseAdmin (service_role), which keeps it.
--   F5  ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated for
--       both grantors, and REVOKE TRUNCATE, REFERENCES, TRIGGER from anon/authenticated on every
--       relation in public (no app path uses them: PostgREST never issues TRUNCATE, and FKs and
--       triggers are created by migrations as supabase_admin).
--
--       LIMITATION, stated so nobody over-reads F5: PostgreSQL's built-in default still grants
--       EXECUTE on new functions to PUBLIC, and anon/authenticated inherit it. A per-schema
--       ALTER DEFAULT PRIVILEGES can only ADD to the global default, never remove from it. The
--       only removal is a global `ALTER DEFAULT PRIVILEGES FOR ROLE ... REVOKE EXECUTE ON
--       FUNCTIONS FROM PUBLIC` (no IN SCHEMA), which would also strip PUBLIC EXECUTE from every
--       function those roles create in auth/storage/extensions on future Supabase upgrades or
--       CREATE EXTENSION — a breakage risk out of scope here. Until then, every new public
--       function must still `REVOKE EXECUTE ... FROM PUBLIC` explicitly (as 0014 does).
--
-- PRIVILEGES. Run as supabase_admin: it owns every relation and function in public and is a
-- grantor in pg_default_acl. As postgres, REVOKE on supabase_admin-granted privileges is a
-- silent no-op (see 0014).
--
-- COMPATIBILITY — DEPLOY ORDER. F3 breaks the consolidado frontend build deployed before
-- 2026-10-13 if that build still writes `terminos_aceptados` through
-- update_user_profile_securely as `authenticated` (contract step 2, /api/users/profile). The
-- frontend change (S-3) moves that write to a service-role update inside the route and drops
-- `url_user_contrato` from the user-writable allowlist. Deploy that frontend FIRST (or together),
-- then apply this migration. Every other verified writer of these columns is service_role
-- (dashboard supabaseAdmin, /api/external/generate-contract-pdf). F2 has no frontend dependency:
-- every orders write in both apps uses the service role (frontend budget-pdf/[orderId].astro
-- update included).
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- Idempotent: REVOKE/ALTER are no-ops when applied, DROP ... IF EXISTS, CREATE OR REPLACE, and
-- the trigger is dropped before it is created, so a partial apply can be replayed.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Esta migracion debe ejecutarse como supabase_admin (rol actual: %). Los objetos de public '
      'pertenecen a supabase_admin: REVOKE/GRANT como postgres no tiene el efecto esperado.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

-- =========================================================================
-- F2 — orders: no customer writes through PostgREST.
-- =========================================================================
REVOKE INSERT, UPDATE ON public.orders FROM authenticated;
REVOKE INSERT, UPDATE ON public.orders FROM anon;

DROP POLICY IF EXISTS "Customers can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can update their own orders" ON public.orders;

-- =========================================================================
-- F3 — user_profiles: the contract URL and the terms flag are server-owned.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.guard_user_profiles_server_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $guard_user_profiles_server_columns$
DECLARE
  request_role text := auth.role();
BEGIN
  -- Only PostgREST requests carry a JWT role; service_role and direct sessions pass.
  IF request_role IS NULL OR request_role NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  -- Dashboard admins keep the "Admins can update all user_profiles" policy semantics.
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.url_user_contrato IS NOT NULL OR COALESCE(NEW.terminos_aceptados, false) THEN
      RAISE EXCEPTION 'El contrato y la aceptacion de terminos solo los registra el servidor'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.url_user_contrato IS DISTINCT FROM OLD.url_user_contrato
     OR NEW.terminos_aceptados IS DISTINCT FROM OLD.terminos_aceptados THEN
    RAISE EXCEPTION 'El contrato y la aceptacion de terminos solo los registra el servidor'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$guard_user_profiles_server_columns$;

REVOKE ALL ON FUNCTION public.guard_user_profiles_server_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_user_profiles_server_columns ON public.user_profiles;
CREATE TRIGGER guard_user_profiles_server_columns
    BEFORE INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_user_profiles_server_columns();

-- =========================================================================
-- F4 — SECURITY DEFINER coupon/shipping functions: pinned search_path, least privilege.
-- =========================================================================
ALTER FUNCTION public.search_coupons(character varying, character varying)
    SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_coupon(character varying, integer, numeric)
    SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_shipping_cost(integer, numeric, character varying)
    SET search_path = public, pg_temp;
ALTER FUNCTION public.get_available_shipping_methods(numeric, character varying)
    SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.search_coupons(character varying, character varying) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_coupon(character varying, integer, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_shipping_cost(integer, numeric, character varying) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_available_shipping_methods(numeric, character varying) FROM PUBLIC;

-- No browser or server caller: service_role only.
REVOKE EXECUTE ON FUNCTION public.search_coupons(character varying, character varying) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_shipping_cost(integer, numeric, character varying) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_coupons(character varying, character varying) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_shipping_cost(integer, numeric, character varying) TO service_role;

-- Called from the browser (anon client): keep.
GRANT EXECUTE ON FUNCTION public.validate_coupon(character varying, integer, numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_available_shipping_methods(numeric, character varying) TO anon, authenticated, service_role;

-- =========================================================================
-- F5 — default privileges and unused table privileges.
-- =========================================================================
ALTER DEFAULT PRIVILEGES FOR ROLE postgres       IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

DO $revoke_unused_table_privileges$
DECLARE
  rel record;
BEGIN
  FOR rel IN
    SELECT c.relname
      FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
     ORDER BY c.relname
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon, authenticated',
      rel.relname
    );
  END LOOP;
END
$revoke_unused_table_privileges$;

COMMIT;

-- Post-apply checks (all must return the commented result):
--
--   -- F2: f, f / no rows
--   SELECT has_table_privilege('authenticated', 'public.orders', 'INSERT'),
--          has_table_privilege('authenticated', 'public.orders', 'UPDATE');
--   SELECT policyname FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'orders' AND policyname LIKE 'Customers can %'
--      AND cmd <> 'SELECT';
--
--   -- F3: one row
--   SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'public.user_profiles'::regclass AND tgname = 'guard_user_profiles_server_columns';
--
--   -- F4: four rows with search_path set; anon: t for validate_coupon and
--   --     get_available_shipping_methods, f for the other two
--   SELECT p.oid::regprocedure, p.proconfig, has_function_privilege('anon', p.oid, 'EXECUTE')
--     FROM pg_proc p
--    WHERE p.pronamespace = 'public'::regnamespace
--      AND p.proname IN ('search_coupons', 'validate_coupon', 'calculate_shipping_cost',
--                        'get_available_shipping_methods');
--
--   -- F5: no anon/authenticated in the 'f' rows for schema public; zero rows below
--   SELECT defaclrole::regrole, defaclacl FROM pg_default_acl
--    WHERE defaclnamespace = 'public'::regnamespace AND defaclobjtype = 'f';
--   SELECT c.relname, a.grantee::regrole, a.privilege_type
--     FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
--    WHERE c.relnamespace = 'public'::regnamespace
--      AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
--      AND a.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER');
--
