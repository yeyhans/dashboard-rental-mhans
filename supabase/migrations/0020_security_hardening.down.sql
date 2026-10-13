--
-- 0020_security_hardening.down.sql
--
-- Rollback for 0020_security_hardening.sql (ADR-D5 `.down.sql` convention).
--
-- THIS DELIBERATELY RE-OPENS THE EXPOSURES 0020 CLOSED (F2-F5): customers regain INSERT/UPDATE
-- on their own orders, can set their own contract URL and terms flag, the four coupon/shipping
-- SECURITY DEFINER functions lose their pinned search_path and become PUBLIC-executable again,
-- and anon/authenticated regain TRUNCATE (which ignores RLS), REFERENCES and TRIGGER. Roll back
-- ONLY to unblock something failing for an unrelated reason, and re-apply forward right after.
--
-- The state restored below was captured from supabase-stg-db on 2026-10-13 (read-only), before
-- 0020 was applied:
--   * orders: authenticated had INSERT, UPDATE; anon had neither. Policy bodies verbatim below.
--   * search_coupons, validate_coupon, calculate_shipping_cost, get_available_shipping_methods:
--     proconfig NULL; EXECUTE to PUBLIC, anon, authenticated, service_role, postgres.
--   * pg_default_acl (public, functions): anon=X and authenticated=X from postgres and from
--     supabase_admin.
--   * REFERENCES and TRIGGER for anon and authenticated on the 14 relations listed in the loop;
--     TRUNCATE additionally on admin_users, coupon_usage, order_summary,
--     products_with_categories, shipping_usage and user_profiles. The other public relations
--     (asset_*, data_consents, expenses, serialised_assets, site_settings, backups) had no
--     anon/authenticated grants and get none back.
--
-- NO DATA LOSS: only privileges, policies, a trigger and function settings change.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- Idempotent: GRANT is a no-op when held; policies and trigger use DROP ... IF EXISTS first.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Este rollback debe ejecutarse como supabase_admin (rol actual: %). Los objetos de public '
      'pertenecen a supabase_admin: REVOKE/GRANT como postgres no tiene el efecto esperado.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

-- F2
GRANT INSERT, UPDATE ON public.orders TO authenticated;

DROP POLICY IF EXISTS "Customers can create their own orders" ON public.orders;
CREATE POLICY "Customers can create their own orders" ON public.orders
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (customer_id IN (SELECT user_profiles.user_id
                                  FROM public.user_profiles
                                 WHERE user_profiles.auth_uid = auth.uid()));

DROP POLICY IF EXISTS "Customers can update their own orders" ON public.orders;
CREATE POLICY "Customers can update their own orders" ON public.orders
    AS PERMISSIVE FOR UPDATE TO authenticated
    USING (customer_id IN (SELECT user_profiles.user_id
                             FROM public.user_profiles
                            WHERE user_profiles.auth_uid = auth.uid()))
    WITH CHECK (customer_id IN (SELECT user_profiles.user_id
                                  FROM public.user_profiles
                                 WHERE user_profiles.auth_uid = auth.uid()));

-- F3
DROP TRIGGER IF EXISTS guard_user_profiles_server_columns ON public.user_profiles;
DROP FUNCTION IF EXISTS public.guard_user_profiles_server_columns();

-- F4
ALTER FUNCTION public.search_coupons(character varying, character varying) RESET search_path;
ALTER FUNCTION public.validate_coupon(character varying, integer, numeric) RESET search_path;
ALTER FUNCTION public.calculate_shipping_cost(integer, numeric, character varying) RESET search_path;
ALTER FUNCTION public.get_available_shipping_methods(numeric, character varying) RESET search_path;

GRANT EXECUTE ON FUNCTION public.search_coupons(character varying, character varying) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_coupon(character varying, integer, numeric) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_shipping_cost(integer, numeric, character varying) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_shipping_methods(numeric, character varying) TO PUBLIC, anon, authenticated;

-- F5
ALTER DEFAULT PRIVILEGES FOR ROLE postgres       IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

DO $restore_table_privileges$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'admin_users', 'categories', 'coupon_usage', 'coupons', 'hermes_notifications',
    'hermes_pending_writes', 'order_communications', 'order_summary', 'orders', 'products',
    'products_with_categories', 'shipping_methods', 'shipping_usage', 'user_profiles'
  ]
  LOOP
    IF to_regclass(format('public.%I', rel)) IS NOT NULL THEN
      EXECUTE format('GRANT REFERENCES, TRIGGER ON public.%I TO anon, authenticated', rel);
    END IF;
  END LOOP;

  FOREACH rel IN ARRAY ARRAY[
    'admin_users', 'coupon_usage', 'order_summary', 'products_with_categories',
    'shipping_usage', 'user_profiles'
  ]
  LOOP
    IF to_regclass(format('public.%I', rel)) IS NOT NULL THEN
      EXECUTE format('GRANT TRUNCATE ON public.%I TO anon, authenticated', rel);
    END IF;
  END LOOP;
END
$restore_table_privileges$;

COMMIT;
