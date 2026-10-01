--
-- 0014_rpc_least_privilege.down.sql
--
-- SDD artifacts live at ../../../openspec/changes/consolidado-web-2027/ (outside this repo,
-- see R2-003).
--
-- Rollback for 0014_rpc_least_privilege.sql (ADR-D5 `.down.sql` convention).
--
-- THIS DELIBERATELY RE-OPENS THE EXPOSURE 0014 CLOSED. It restores the five group-B function
-- bodies to their pre-migration form (no ownership guard, no pinned `search_path`) and re-grants
-- EXECUTE to anon and authenticated on all thirteen functions (group A and group B). Anyone
-- holding the public anon key regains the ability to read or rewrite arbitrary `user_profiles`
-- rows and to apply coupons/shipping to orders that are not theirs — exactly the Ley 21.719
-- exposure described in the header of the forward migration. Roll back ONLY to unblock an apply
-- that is failing for an unrelated reason, and re-apply forward immediately after.
--
-- NO DATA LOSS: this migration only changes function bodies and privileges, never table data.
-- `coupon_usage`, `shipping_usage` and `user_profiles` rows are untouched either way.
--
-- `validate_coupon`, `calculate_shipping_cost`, `get_available_shipping_methods` and
-- `search_coupons` (group C) are not touched here: the forward migration never revoked anon from
-- them, so there is nothing to restore.
--
-- Idempotent: `CREATE OR REPLACE FUNCTION` and REVOKE/GRANT are no-ops when already applied.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD. Same reasoning as the forward migration.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- =========================================================================
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

-- =========================================================================
-- GROUP B — restore the original bodies verbatim: no ownership guard, no pinned search_path.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.update_user_profile_securely(p_user_id integer, p_updates jsonb)
RETURNS SETOF user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $update_user_profile_securely$
BEGIN
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
AS $apply_coupon$
DECLARE
    v_coupon_id INTEGER;
    v_new_usage_id INTEGER;
BEGIN
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

EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT FALSE, 'Este cupón ya fue usado en esta orden'::TEXT, NULL::INTEGER;
WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'Error al aplicar el cupón'::TEXT, NULL::INTEGER;
END;
$apply_coupon$;

CREATE OR REPLACE FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb DEFAULT NULL::jsonb)
RETURNS TABLE(success boolean, message text, shipping_usage_id integer, shipping_cost numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $apply_shipping_method$
DECLARE
    v_shipping_method RECORD;
    v_new_usage_id INTEGER;
BEGIN
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

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'Error al aplicar el método de envío'::TEXT, NULL::INTEGER, NULL::DECIMAL;
END;
$apply_shipping_method$;

CREATE OR REPLACE FUNCTION public.get_user_coupon_history(p_user_id integer)
RETURNS TABLE(coupon_code character varying, discount_amount numeric, used_at timestamp with time zone, order_id integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $get_user_coupon_history$
BEGIN
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
AS $get_user_shipping_history$
BEGIN
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
-- RE-GRANT anon, authenticated on all thirteen functions (group A + group B). This is the exact
-- re-opening the header warns about.
-- =========================================================================

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_notify_new_order() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile_admin(p_user_id integer, p_url_rut_anverso text, p_url_rut_reverso text, p_url_firma text, p_new_url_e_rut_empresa text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile_admin_full(p_user_id integer, p_updates jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text, p_apellido text, p_rut text, p_telefono text, p_direccion text, p_ciudad text, p_pais text, p_tipo_cliente text, p_instagram text, p_fecha_nacimiento date, p_usuario text, p_empresa_nombre text, p_empresa_rut text, p_empresa_ciudad text, p_empresa_direccion text, p_terminos_aceptados boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(user_auth_uid uuid, user_email text, user_nombre text, user_apellido text, user_usuario text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_existing_users_to_profiles() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile_by_auth_uid(user_auth_uid uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_user_profile_securely(p_user_id integer, p_updates jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_coupon_history(p_user_id integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_shipping_history(p_user_id integer) TO anon, authenticated;

COMMIT;
