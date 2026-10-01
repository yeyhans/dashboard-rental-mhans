--
-- 0014_rpc_least_privilege.sql — close anon access to SECURITY DEFINER RPC functions.
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a clone
-- of `dashboard/` alone; see R2-003).
--
-- WHY. 17 SECURITY DEFINER functions in schema `public` carry an explicit
-- `GRANT ... TO anon, authenticated` (plus PUBLIC), inherited from `0000_baseline.sql` (lines
-- 3012-3015 and following), and none of them checks `auth.uid()`. Anyone holding the public anon
-- key can therefore read or rewrite ANY `user_profiles` row by guessing a sequential `user_id` —
-- through `update_user_profile_securely`, `update_user_profile_admin_full`,
-- `update_user_profile_admin`, `admin_create_user_profile` and `get_user_profile_by_auth_uid` —
-- and can apply a coupon or a shipping method to an order that is not theirs. Verified read-only
-- 2026-10-01 against both databases: identical state in PRODUCTION (`supabase-9cd8-db`) and
-- CONSOLIDADO (`supabase-stg-db`), function bodies identical (md5 of `prosrc` verified for the
-- five group-B functions). ~150 profiles exposed, 108 with a signature image, 104 with ID-card
-- photos. This is personal data under Ley 21.719 Art. 14 quinquides (duty to implement
-- appropriate technical measures), so closing it is not optional hardening.
--
-- WHAT.
--
--   GROUP A — service_role only. Eight functions have no legitimate anon or authenticated
--   caller at all: every live call site already uses `supabaseAdmin` (dashboard, service role),
--   or the function is a trigger that Postgres invokes as its owner regardless of grants
--   (`handle_new_user`, `hermes_notify_new_order` — see the note at each REVOKE below). EXECUTE
--   is revoked from PUBLIC and from anon/authenticated and kept for service_role (and the
--   superuser/owner roles postgres, supabase_admin, which never needed a grant to call it).
--
--   GROUP B — authenticated, with a per-call ownership guard. Five functions have a real
--   logged-in-user call site (frontend, JWT persisted — see Constraints below) and take
--   `p_user_id` as an explicit argument with no check that it is the caller's own row. Each
--   function is `CREATE OR REPLACE`d with its CURRENT body unchanged except for two additions:
--
--     1. An ownership guard at the top of BEGIN: `service_role` (the dashboard, which legitimately
--        acts on behalf of any user) bypasses it; everyone else may only act on the
--        `user_profiles` row whose `auth_uid` matches `auth.uid()` for the given `p_user_id`.
--        A refusal raises `insufficient_privilege` (SQLSTATE 42501), not a generic error, so a
--        caller can tell "not yours" from "something broke".
--
--     2. `SET search_path = public, pg_temp` — SECURITY DEFINER hardening per the 0013
--        convention: these functions run as their owner and must not resolve an unqualified
--        table name through a caller-supplied `search_path`. The live bodies never pinned it;
--        this migration is also the fix for that, not just the ownership gap.
--
--   `apply_coupon` and `apply_shipping_method` both end in `EXCEPTION WHEN OTHERS THEN RETURN
--   QUERY SELECT FALSE, ...` — a RAISE from the guard, placed inside that same BEGIN, would be
--   swallowed by that handler and turned into an indistinguishable "could not apply" row instead
--   of a refusal. Both gain a `WHEN insufficient_privilege THEN RAISE;` handler, ordered BEFORE
--   `WHEN OTHERS`, so the guard's exception is re-raised instead of absorbed. Chosen over wrapping
--   the original body in a nested BEGIN/EXCEPTION block because it is the smaller diff and
--   PostgreSQL dispatches EXCEPTION handlers by WHEN-clause match, not by position in the file —
--   an earlier, narrower handler for the same exception always wins over a later `WHEN OTHERS`.
--   `update_user_profile_securely`, `get_user_coupon_history` and `get_user_shipping_history`
--   have no EXCEPTION block at all, so the guard's RAISE propagates unchanged — nothing extra
--   needed there.
--
--   GROUP C — deliberately untouched. `validate_coupon`, `calculate_shipping_cost`,
--   `get_available_shipping_methods` and `search_coupons` stay anon-callable: they are read-only
--   pricing/catalogue lookups that the checkout flow calls before the customer logs in. None of
--   them is named in any REVOKE in this file.
--
-- CONSTRAINTS CHECKED BEFORE WRITING THIS. Frontend group-B call sites run with the logged-in
-- user's JWT (`persistSession: true`, `frontend/src/lib/supabase.ts:54-57`):
-- `ContractContent.tsx:435`, `documentUploadService.ts:92`, `contractGenerationService.ts:580`,
-- `couponService.ts:170/222`, `shippingService.ts:163/213`. All dashboard call sites use
-- `supabaseAdmin` (service_role) and are unaffected by the group-B guard.
--
-- PRIVILEGES. Apply as `supabase_admin` — see the role guard below, same reasoning as 0002/0004–
-- 0013: production's `public` objects are owned by `supabase_admin`, and `postgres` there is
-- neither superuser nor a member of that role, so REVOKE as postgres silently revokes nothing.
-- `hermes_ro` gains NOTHING here: it is read-only and was never granted EXECUTE on any of these.
--
-- Idempotent: group A is REVOKE/GRANT only (no-ops when already applied); group B is
-- `CREATE OR REPLACE FUNCTION` plus REVOKE/GRANT, also idempotent.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction. See 0002/0004–
-- 0013 for the full rationale.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Esta migracion debe ejecutarse como supabase_admin (rol actual: %). Los objetos de public '
      'pertenecen a supabase_admin: como postgres, REVOKE informa exito y no revoca nada.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

-- =========================================================================
-- GROUP B — CREATE OR REPLACE with the ownership guard and a pinned search_path. Bodies are the
-- CURRENT live definitions (verified identical in production and consolidado), unchanged except
-- for the guard and SET search_path.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.update_user_profile_securely(p_user_id integer, p_updates jsonb)
RETURNS SETOF user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $update_user_profile_securely$
BEGIN
  -- Ownership guard: service_role (dashboard) bypasses; everyone else may only act on the
  -- profile bound to their own JWT.
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.user_profiles up
        WHERE up.user_id = p_user_id AND up.auth_uid = auth.uid()
     ) THEN
    RAISE EXCEPTION 'No autorizado para operar sobre el perfil %', p_user_id
      USING ERRCODE = '42501';
  END IF;

  -- Actualizar perfil de usuario con validación y conversión de tipos correcta
  RETURN QUERY
  UPDATE public.user_profiles
  SET
    email = COALESCE((p_updates->>'email')::TEXT, email),
    nombre = COALESCE((p_updates->>'nombre')::TEXT, nombre),
    apellido = COALESCE((p_updates->>'apellido')::TEXT, apellido),
    usuario = COALESCE((p_updates->>'usuario')::TEXT, usuario),
    rut = COALESCE((p_updates->>'rut')::TEXT, rut),
    direccion = COALESCE((p_updates->>'direccion')::TEXT, direccion),
    ciudad = COALESCE((p_updates->>'ciudad')::TEXT, ciudad),
    pais = COALESCE((p_updates->>'pais')::TEXT, pais),
    tipo_cliente = COALESCE((p_updates->>'tipo_cliente')::TEXT, tipo_cliente),
    telefono = COALESCE((p_updates->>'telefono')::TEXT, telefono),
    instagram = COALESCE((p_updates->>'instagram')::TEXT, instagram),

    -- CORREGIDO: Maneja la actualización opcional y convierte el texto a DATE
    fecha_nacimiento = CASE
      WHEN p_updates ? 'fecha_nacimiento' THEN (p_updates->>'fecha_nacimiento')::DATE
      ELSE fecha_nacimiento
    END,

    empresa_nombre = COALESCE((p_updates->>'empresa_nombre')::TEXT, empresa_nombre),
    empresa_rut = COALESCE((p_updates->>'empresa_rut')::TEXT, empresa_rut),
    empresa_ciudad = COALESCE((p_updates->>'empresa_ciudad')::TEXT, empresa_ciudad),
    empresa_direccion = COALESCE((p_updates->>'empresa_direccion')::TEXT, empresa_direccion),
    url_empresa_erut = COALESCE((p_updates->>'url_empresa_erut')::TEXT, url_empresa_erut),
    new_url_e_rut_empresa = COALESCE((p_updates->>'new_url_e_rut_empresa')::TEXT, new_url_e_rut_empresa),
    url_rut_anverso = COALESCE((p_updates->>'url_rut_anverso')::TEXT, url_rut_anverso),
    url_rut_reverso = COALESCE((p_updates->>'url_rut_reverso')::TEXT, url_rut_reverso),
    url_firma = COALESCE((p_updates->>'url_firma')::TEXT, url_firma),
    url_user_contrato = COALESCE((p_updates->>'url_user_contrato')::TEXT, url_user_contrato),

    -- CORREGIDO: Maneja la actualización opcional y convierte el texto ('true'/'false') a BOOLEAN
    terminos_aceptados = CASE
      WHEN p_updates ? 'terminos_aceptados' THEN (p_updates->>'terminos_aceptados')::BOOLEAN
      ELSE terminos_aceptados
    END,

    updated_at = NOW()
  WHERE
    user_id = p_user_id
  RETURNING *;
END;
$update_user_profile_securely$;

CREATE OR REPLACE FUNCTION public.apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer DEFAULT NULL::integer)
RETURNS TABLE(success boolean, message text, usage_id integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $apply_coupon$
DECLARE
    v_coupon_id INTEGER;
    v_new_usage_id INTEGER;
BEGIN
    -- Ownership guard: service_role (dashboard) bypasses; everyone else may only act on the
    -- profile bound to their own JWT.
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles up
          WHERE up.user_id = p_user_id AND up.auth_uid = auth.uid()
       ) THEN
      RAISE EXCEPTION 'No autorizado para operar sobre el perfil %', p_user_id
        USING ERRCODE = '42501';
    END IF;

    -- Obtener el ID del cupón
    SELECT id INTO v_coupon_id
    FROM public.coupons
    WHERE code = p_coupon_code AND status = 'publish';

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Cupón no encontrado'::TEXT, NULL::INTEGER;
        RETURN;
    END IF;

    -- Registrar el uso del cupón
    INSERT INTO public.coupon_usage (coupon_id, user_id, order_id, discount_amount)
    VALUES (v_coupon_id, p_user_id, p_order_id, p_discount_amount)
    RETURNING id INTO v_new_usage_id;

    -- Actualizar contador de uso en la tabla de cupones
    UPDATE public.coupons
    SET usage_count = usage_count + 1,
        date_modified = NOW()
    WHERE id = v_coupon_id;

    RETURN QUERY SELECT TRUE, 'Cupón aplicado correctamente'::TEXT, v_new_usage_id;

EXCEPTION WHEN insufficient_privilege THEN
    -- Re-raise the ownership guard's refusal: an earlier, narrower handler wins over the WHEN
    -- OTHERS below, which would otherwise swallow it into an indistinguishable "could not apply"
    -- row and the caller would never see the 42501.
    RAISE;
WHEN unique_violation THEN
    RETURN QUERY SELECT FALSE, 'Este cupón ya fue usado en esta orden'::TEXT, NULL::INTEGER;
WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'Error al aplicar el cupón'::TEXT, NULL::INTEGER;
END;
$apply_coupon$;

CREATE OR REPLACE FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb DEFAULT NULL::jsonb)
RETURNS TABLE(success boolean, message text, shipping_usage_id integer, shipping_cost numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $apply_shipping_method$
DECLARE
    v_shipping_method RECORD;
    v_new_usage_id INTEGER;
BEGIN
    -- Ownership guard: service_role (dashboard) bypasses; everyone else may only act on the
    -- profile bound to their own JWT.
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles up
          WHERE up.user_id = p_user_id AND up.auth_uid = auth.uid()
       ) THEN
      RAISE EXCEPTION 'No autorizado para operar sobre el perfil %', p_user_id
        USING ERRCODE = '42501';
    END IF;

    -- Obtener el método de envío
    SELECT * INTO v_shipping_method
    FROM public.shipping_methods
    WHERE id = p_shipping_method_id AND enabled = TRUE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Método de envío no encontrado o no disponible'::TEXT, NULL::INTEGER, NULL::DECIMAL;
        RETURN;
    END IF;

    -- Registrar el uso del método de envío
    INSERT INTO public.shipping_usage (
        shipping_method_id,
        order_id,
        user_id,
        shipping_cost,
        shipping_address
    )
    VALUES (
        p_shipping_method_id,
        p_order_id,
        p_user_id,
        v_shipping_method.cost,
        p_shipping_address
    )
    ON CONFLICT (order_id)
    DO UPDATE SET
        shipping_method_id = EXCLUDED.shipping_method_id,
        shipping_cost = EXCLUDED.shipping_cost,
        shipping_address = EXCLUDED.shipping_address,
        created_at = NOW()
    RETURNING id INTO v_new_usage_id;

    RETURN QUERY SELECT TRUE, 'Método de envío aplicado correctamente'::TEXT, v_new_usage_id, v_shipping_method.cost;

EXCEPTION WHEN insufficient_privilege THEN
    -- Re-raise the ownership guard's refusal: see the identical note in apply_coupon above.
    RAISE;
WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'Error al aplicar el método de envío'::TEXT, NULL::INTEGER, NULL::DECIMAL;
END;
$apply_shipping_method$;

CREATE OR REPLACE FUNCTION public.get_user_coupon_history(p_user_id integer)
RETURNS TABLE(coupon_code character varying, discount_amount numeric, used_at timestamp with time zone, order_id integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $get_user_coupon_history$
BEGIN
    -- Ownership guard: service_role (dashboard) bypasses; everyone else may only act on the
    -- profile bound to their own JWT.
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles up
          WHERE up.user_id = p_user_id AND up.auth_uid = auth.uid()
       ) THEN
      RAISE EXCEPTION 'No autorizado para operar sobre el perfil %', p_user_id
        USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        c.code,
        cu.discount_amount,
        cu.used_at,
        cu.order_id
    FROM public.coupon_usage cu
    JOIN public.coupons c ON cu.coupon_id = c.id
    WHERE cu.user_id = p_user_id
    ORDER BY cu.used_at DESC;
END;
$get_user_coupon_history$;

CREATE OR REPLACE FUNCTION public.get_user_shipping_history(p_user_id integer)
RETURNS TABLE(order_id integer, shipping_method_name character varying, shipping_cost numeric, status character varying, tracking_number character varying, created_at timestamp with time zone, shipped_at timestamp with time zone, delivered_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $get_user_shipping_history$
BEGIN
    -- Ownership guard: service_role (dashboard) bypasses; everyone else may only act on the
    -- profile bound to their own JWT.
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles up
          WHERE up.user_id = p_user_id AND up.auth_uid = auth.uid()
       ) THEN
      RAISE EXCEPTION 'No autorizado para operar sobre el perfil %', p_user_id
        USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        su.order_id,
        sm.name,
        su.shipping_cost,
        su.status,
        su.tracking_number,
        su.created_at,
        su.shipped_at,
        su.delivered_at
    FROM public.shipping_usage su
    JOIN public.shipping_methods sm ON su.shipping_method_id = sm.id
    WHERE su.user_id = p_user_id
    ORDER BY su.created_at DESC;
END;
$get_user_shipping_history$;

-- =========================================================================
-- GROUP A — service_role only. No body changes: these are privilege-only statements.
-- =========================================================================

-- handle_new_user() fires on `on_auth_user_created` (AFTER INSERT on auth.users), as a trigger
-- function it always runs as its owner regardless of who holds EXECUTE — revoking anon/
-- authenticated here does not affect trigger firing, it only closes direct RPC calls.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- hermes_notify_new_order() fires on trg_hermes_notify_new_order (AFTER INSERT on orders); same
-- trigger-as-owner reasoning as handle_new_user() above.
REVOKE ALL ON FUNCTION public.hermes_notify_new_order() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hermes_notify_new_order() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_notify_new_order() TO service_role;

REVOKE ALL ON FUNCTION public.update_user_profile_admin(p_user_id integer, p_url_rut_anverso text, p_url_rut_reverso text, p_url_firma text, p_new_url_e_rut_empresa text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_profile_admin(p_user_id integer, p_url_rut_anverso text, p_url_rut_reverso text, p_url_firma text, p_new_url_e_rut_empresa text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile_admin(p_user_id integer, p_url_rut_anverso text, p_url_rut_reverso text, p_url_firma text, p_new_url_e_rut_empresa text) TO service_role;

REVOKE ALL ON FUNCTION public.update_user_profile_admin_full(p_user_id integer, p_updates jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_profile_admin_full(p_user_id integer, p_updates jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile_admin_full(p_user_id integer, p_updates jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text, p_apellido text, p_rut text, p_telefono text, p_direccion text, p_ciudad text, p_pais text, p_tipo_cliente text, p_instagram text, p_fecha_nacimiento date, p_usuario text, p_empresa_nombre text, p_empresa_rut text, p_empresa_ciudad text, p_empresa_direccion text, p_terminos_aceptados boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text, p_apellido text, p_rut text, p_telefono text, p_direccion text, p_ciudad text, p_pais text, p_tipo_cliente text, p_instagram text, p_fecha_nacimiento date, p_usuario text, p_empresa_nombre text, p_empresa_rut text, p_empresa_ciudad text, p_empresa_direccion text, p_terminos_aceptados boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text, p_apellido text, p_rut text, p_telefono text, p_direccion text, p_ciudad text, p_pais text, p_tipo_cliente text, p_instagram text, p_fecha_nacimiento date, p_usuario text, p_empresa_nombre text, p_empresa_rut text, p_empresa_ciudad text, p_empresa_direccion text, p_terminos_aceptados boolean) TO service_role;

REVOKE ALL ON FUNCTION public.create_user_profile_manual(user_auth_uid uuid, user_email text, user_nombre text, user_apellido text, user_usuario text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_user_profile_manual(user_auth_uid uuid, user_email text, user_nombre text, user_apellido text, user_usuario text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(user_auth_uid uuid, user_email text, user_nombre text, user_apellido text, user_usuario text) TO service_role;

REVOKE ALL ON FUNCTION public.migrate_existing_users_to_profiles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_existing_users_to_profiles() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_existing_users_to_profiles() TO service_role;

REVOKE ALL ON FUNCTION public.get_user_profile_by_auth_uid(user_auth_uid uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_profile_by_auth_uid(user_auth_uid uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile_by_auth_uid(user_auth_uid uuid) TO service_role;

-- =========================================================================
-- GROUP B — authenticated + service_role. anon is revoked; authenticated keeps EXECUTE because
-- the ownership guard inside each function body is now the real boundary.
-- =========================================================================

REVOKE ALL ON FUNCTION public.update_user_profile_securely(p_user_id integer, p_updates jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_profile_securely(p_user_id integer, p_updates jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_user_profile_securely(p_user_id integer, p_updates jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_user_coupon_history(p_user_id integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_coupon_history(p_user_id integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_coupon_history(p_user_id integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_user_shipping_history(p_user_id integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_shipping_history(p_user_id integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_shipping_history(p_user_id integer) TO authenticated, service_role;

-- =========================================================================
-- GROUP C — deliberately left anon-callable, read-only pricing/catalogue used by checkout
-- before login. Not touched by this migration: validate_coupon, calculate_shipping_cost,
-- get_available_shipping_methods, search_coupons.
-- =========================================================================

COMMIT;

-- =========================================================================
-- Post-apply assertions.
--
--   -- Group A: anon and authenticated lose EXECUTE, service_role keeps it.
--   SELECT has_function_privilege('anon',
--            'public.update_user_profile_admin(integer,text,text,text,text)', 'EXECUTE'),  -- false
--          has_function_privilege('authenticated',
--            'public.update_user_profile_admin(integer,text,text,text,text)', 'EXECUTE'),  -- false
--          has_function_privilege('service_role',
--            'public.update_user_profile_admin(integer,text,text,text,text)', 'EXECUTE');  -- true
--
--   -- Group B: anon loses EXECUTE, authenticated and service_role keep it.
--   SELECT has_function_privilege('anon',
--            'public.update_user_profile_securely(integer,jsonb)', 'EXECUTE'),             -- false
--          has_function_privilege('authenticated',
--            'public.update_user_profile_securely(integer,jsonb)', 'EXECUTE'),             -- true
--          has_function_privilege('service_role',
--            'public.update_user_profile_securely(integer,jsonb)', 'EXECUTE');             -- true
--
--   -- Group C unchanged: anon still executes.
--   SELECT has_function_privilege('anon', 'public.validate_coupon(character varying,integer,numeric)',
--            'EXECUTE');                                                                    -- true
--
-- PostgREST caches the schema; reload it so the RPCs are reachable through the API:
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
