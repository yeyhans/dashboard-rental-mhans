--
-- 0000_baseline.sql — CONSOLIDADO WEB 2027
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (outside this repo, see R2-003).
--
-- Generated per ADR-D5 (design.md) from:
--   pg_dump --schema-only --no-owner --no-privileges  (structural diff check)
--   pg_dump --schema-only --no-owner                  (ACL-retaining source of this file)
-- against supabase-9cd8-db (postgres 15.8.1.060) on hermes-vps, 2026-08-18.
--
-- Normalization applied to the raw dump (see design.md ADR-D5 table):
--   * Hermes login roles are emitted below as DO $$ ... IF NOT EXISTS blocks WITHOUT
--     literal passwords. Passwords are provisioned out-of-band after restore — see
--     RESTORE_RUNBOOK.md. This file is safe to commit to the repository.
--   * Grants are the enumerated, per-object list pg_dump emits (never
--     "GRANT ... ON ALL TABLES"), so future tables are not silently included.
--   * `ALTER DEFAULT PRIVILEGES ... TO hermes_ro` is captured AS-IS below (two entries,
--     granted by roles `postgres` and `supabase_admin`) and is intentionally NOT revoked
--     here — migration 0002_hermes_least_privilege.sql revokes it later so the revoke is
--     a reviewable diff (ADR-D8).
--   * `trg_hermes_notify_new_order` is preceded by `DROP TRIGGER IF EXISTS` (see below)
--     matching hermes-mhans/scripts/setup-notifications.sh:88, so a re-apply of this file
--     never produces two triggers on `orders`.
--   * `on_auth_user_created` on `auth.users` (calls `public.handle_new_user()`) is NOT
--     emitted by `pg_dump -n public` — it lives in the `auth` schema, not `public` — but it
--     was found to CASCADE-drop during the T-005 rehearsal (dropping `public.handle_new_user`
--     drops any trigger that calls it) and its absence breaks new-user signup. It is appended
--     at the end of this file, after `handle_new_user()` is defined, with the same
--     `DROP TRIGGER IF EXISTS` convention as the Hermes trigger.
--

-- Hermes login roles (ADR-D5). No PASSWORD literal — see RESTORE_RUNBOOK.md for the
-- out-of-band `ALTER ROLE ... PASSWORD` step required before these roles can authenticate.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hermes_ro') THEN
    CREATE ROLE hermes_ro WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hermes_rw') THEN
    CREATE ROLE hermes_rw WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hermes_notifier') THEN
    CREATE ROLE hermes_notifier WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--
-- `CREATE SCHEMA public;` intentionally omitted here: a freshly bootstrapped Supabase-image
-- Postgres instance already has the `public` schema (schema-baseline spec requirement —
-- "does not itself create the `auth` schema or those extensions", same reasoning applies to
-- the `public` schema Supabase provisions by default). Re-adding it would error
-- `schema "public" already exists` on any real restore target.
--

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    user_id integer NOT NULL,
    auth_uid uuid NOT NULL,
    email text,
    nombre text,
    apellido text,
    usuario text,
    rut text,
    direccion text,
    ciudad text,
    pais text,
    tipo_cliente text,
    telefono text,
    instagram text,
    fecha_nacimiento date,
    empresa_nombre text,
    empresa_rut text,
    empresa_ciudad text,
    empresa_direccion text,
    url_empresa_erut text,
    new_url_e_rut_empresa text,
    url_rut_anverso text,
    url_rut_reverso text,
    url_firma text,
    terminos_aceptados boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    url_user_contrato text,
    CONSTRAINT user_profiles_tipo_cliente_check CHECK ((tipo_cliente = ANY (ARRAY['natural'::text, 'empresa'::text])))
);


--
-- Name: TABLE user_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_profiles IS 'User profile information linked to auth.users via auth_uid';


--
-- Name: COLUMN user_profiles.auth_uid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_profiles.auth_uid IS 'Foreign key reference to auth.users.id (Supabase Auth UUID)';


--
-- Name: admin_create_user_profile(uuid, text, text, text, text, text, text, text, text, text, text, date, text, text, text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text DEFAULT NULL::text, p_apellido text DEFAULT NULL::text, p_rut text DEFAULT NULL::text, p_telefono text DEFAULT NULL::text, p_direccion text DEFAULT NULL::text, p_ciudad text DEFAULT NULL::text, p_pais text DEFAULT NULL::text, p_tipo_cliente text DEFAULT NULL::text, p_instagram text DEFAULT NULL::text, p_fecha_nacimiento date DEFAULT NULL::date, p_usuario text DEFAULT NULL::text, p_empresa_nombre text DEFAULT NULL::text, p_empresa_rut text DEFAULT NULL::text, p_empresa_ciudad text DEFAULT NULL::text, p_empresa_direccion text DEFAULT NULL::text, p_terminos_aceptados boolean DEFAULT false) RETURNS SETOF public.user_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Validaciones
    IF p_auth_uid IS NULL THEN
        RAISE EXCEPTION 'El auth_uid es requerido';
    END IF;

    IF p_email IS NULL OR p_email = '' THEN
        RAISE EXCEPTION 'El email es requerido';
    END IF;

    IF EXISTS (SELECT 1 FROM user_profiles WHERE email = p_email) THEN
        RAISE EXCEPTION 'Ya existe un usuario con el email: %', p_email;
    END IF;

    IF EXISTS (SELECT 1 FROM user_profiles WHERE auth_uid = p_auth_uid) THEN
        RAISE EXCEPTION 'Ya existe un perfil para este auth_uid';
    END IF;

    -- Insertar el nuevo usuario
    RETURN QUERY
    INSERT INTO user_profiles (
        auth_uid,
        email,
        nombre,
        apellido,
        rut,
        telefono,
        direccion,
        ciudad,
        pais,
        tipo_cliente,
        instagram,
        fecha_nacimiento,
        usuario,
        empresa_nombre,
        empresa_rut,
        empresa_ciudad,
        empresa_direccion,
        terminos_aceptados,
        created_at,
        updated_at
    ) VALUES (
        p_auth_uid,
        p_email,
        p_nombre,
        p_apellido,
        p_rut,
        p_telefono,
        p_direccion,
        p_ciudad,
        p_pais,
        p_tipo_cliente,
        p_instagram,
        p_fecha_nacimiento,
        p_usuario,
        p_empresa_nombre,
        p_empresa_rut,
        p_empresa_ciudad,
        p_empresa_direccion,
        p_terminos_aceptados,
        NOW(),
        NOW()
    )
    RETURNING *;
END;
$$;


--
-- Name: FUNCTION admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text, p_apellido text, p_rut text, p_telefono text, p_direccion text, p_ciudad text, p_pais text, p_tipo_cliente text, p_instagram text, p_fecha_nacimiento date, p_usuario text, p_empresa_nombre text, p_empresa_rut text, p_empresa_ciudad text, p_empresa_direccion text, p_terminos_aceptados boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text, p_apellido text, p_rut text, p_telefono text, p_direccion text, p_ciudad text, p_pais text, p_tipo_cliente text, p_instagram text, p_fecha_nacimiento date, p_usuario text, p_empresa_nombre text, p_empresa_rut text, p_empresa_ciudad text, p_empresa_direccion text, p_terminos_aceptados boolean) IS 'Crea un perfil de usuario desde el panel de administración.
Requiere auth_uid de un usuario previamente creado en auth.users.
Usa SECURITY DEFINER para bypasear RLS.';


--
-- Name: apply_coupon(character varying, integer, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer DEFAULT NULL::integer) RETURNS TABLE(success boolean, message text, usage_id integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: FUNCTION apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer) IS 'Registra el uso de un cupón y actualiza los contadores';


--
-- Name: apply_shipping_method(integer, integer, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb DEFAULT NULL::jsonb) RETURNS TABLE(success boolean, message text, shipping_usage_id integer, shipping_cost numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: FUNCTION apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb) IS 'Aplica un método de envío a una orden específica';


--
-- Name: calculate_iva(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_iva(subtotal numeric) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN ROUND(subtotal * 0.19, 2);
END;
$$;


--
-- Name: calculate_order_subtotal(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_order_subtotal(line_items_json jsonb) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    item JSONB;
    subtotal DECIMAL(12,2) := 0;
BEGIN
    FOR item IN SELECT jsonb_array_elements(line_items_json)
    LOOP
        subtotal := subtotal + ((item->>'price')::DECIMAL * (item->>'quantity')::INTEGER);
    END LOOP;
    RETURN subtotal;
END;
$$;


--
-- Name: calculate_shipping_cost(integer, numeric, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_shipping_cost(p_shipping_method_id integer, p_cart_total numeric DEFAULT NULL::numeric, p_region character varying DEFAULT NULL::character varying) RETURNS TABLE(shipping_cost numeric, is_available boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
    v_shipping_method RECORD;
BEGIN
    -- Obtener el método de envío
    SELECT * INTO v_shipping_method
    FROM public.shipping_methods
    WHERE id = p_shipping_method_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::DECIMAL, FALSE, 'Método de envío no encontrado'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar si está habilitado
    IF NOT v_shipping_method.enabled THEN
        RETURN QUERY SELECT NULL::DECIMAL, FALSE, 'Método de envío no disponible'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar monto mínimo
    IF v_shipping_method.min_amount IS NOT NULL AND p_cart_total IS NOT NULL AND p_cart_total < v_shipping_method.min_amount THEN
        RETURN QUERY SELECT NULL::DECIMAL, FALSE, 
            FORMAT('Monto mínimo requerido: $%s', v_shipping_method.min_amount);
        RETURN;
    END IF;
    
    -- Verificar monto máximo
    IF v_shipping_method.max_amount IS NOT NULL AND p_cart_total IS NOT NULL AND p_cart_total > v_shipping_method.max_amount THEN
        RETURN QUERY SELECT NULL::DECIMAL, FALSE, 
            FORMAT('Monto máximo permitido: $%s', v_shipping_method.max_amount);
        RETURN;
    END IF;
    
    -- Verificar región
    IF p_region IS NOT NULL THEN
        -- Verificar si está en regiones disponibles
        IF v_shipping_method.available_regions != '[]'::jsonb AND 
           NOT (v_shipping_method.available_regions @> to_jsonb(p_region)) THEN
            RETURN QUERY SELECT NULL::DECIMAL, FALSE, 'No disponible en tu región'::TEXT;
            RETURN;
        END IF;
        
        -- Verificar si está en regiones excluidas
        IF v_shipping_method.excluded_regions != '[]'::jsonb AND 
           (v_shipping_method.excluded_regions @> to_jsonb(p_region)) THEN
            RETURN QUERY SELECT NULL::DECIMAL, FALSE, 'No disponible en tu región'::TEXT;
            RETURN;
        END IF;
    END IF;
    
    -- Si llegamos aquí, el método está disponible
    RETURN QUERY SELECT v_shipping_method.cost, TRUE, 'Disponible'::TEXT;
END;
$_$;


--
-- Name: FUNCTION calculate_shipping_cost(p_shipping_method_id integer, p_cart_total numeric, p_region character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.calculate_shipping_cost(p_shipping_method_id integer, p_cart_total numeric, p_region character varying) IS 'Calcula el costo de envío para un método específico';


--
-- Name: create_user_profile_manual(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_user_profile_manual(user_auth_uid uuid, user_email text DEFAULT ''::text, user_nombre text DEFAULT ''::text, user_apellido text DEFAULT ''::text, user_usuario text DEFAULT ''::text) RETURNS public.user_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  new_profile user_profiles;
BEGIN
  -- Verificar que el usuario auth existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_auth_uid) THEN
    RAISE EXCEPTION 'Auth user with UUID % does not exist', user_auth_uid;
  END IF;
  
  -- Verificar que no existe ya un perfil para este usuario
  IF EXISTS (SELECT 1 FROM user_profiles WHERE auth_uid = user_auth_uid) THEN
    RAISE EXCEPTION 'Profile already exists for user %', user_auth_uid;
  END IF;
  
  -- Crear el perfil
  INSERT INTO user_profiles (
    auth_uid,
    email,
    nombre,
    apellido,
    usuario,
    pais,
    tipo_cliente,
    terminos_aceptados
  ) VALUES (
    user_auth_uid,
    COALESCE(user_email, ''),
    COALESCE(user_nombre, ''),
    COALESCE(user_apellido, ''),
    COALESCE(NULLIF(user_usuario, ''), SPLIT_PART(user_email, '@', 1)),
    'Chile',
    'natural',
    FALSE
  ) RETURNING * INTO new_profile;
  
  RETURN new_profile;
END;
$$;


--
-- Name: FUNCTION create_user_profile_manual(user_auth_uid uuid, user_email text, user_nombre text, user_apellido text, user_usuario text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_user_profile_manual(user_auth_uid uuid, user_email text, user_nombre text, user_apellido text, user_usuario text) IS 'Crea manualmente un perfil de usuario vinculado a auth.users';


--
-- Name: get_available_shipping_methods(numeric, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_available_shipping_methods(p_cart_total numeric DEFAULT NULL::numeric, p_region character varying DEFAULT NULL::character varying) RETURNS TABLE(id integer, name character varying, description text, cost numeric, shipping_type character varying, estimated_days_min integer, estimated_days_max integer, requires_address boolean, requires_phone boolean, metadata jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.id,
        sm.name,
        sm.description,
        sm.cost,
        sm.shipping_type,
        sm.estimated_days_min,
        sm.estimated_days_max,
        sm.requires_address,
        sm.requires_phone,
        sm.metadata
    FROM public.shipping_methods sm
    WHERE 
        sm.enabled = TRUE
        -- Verificar monto mínimo
        AND (sm.min_amount IS NULL OR p_cart_total IS NULL OR p_cart_total >= sm.min_amount)
        -- Verificar monto máximo
        AND (sm.max_amount IS NULL OR p_cart_total IS NULL OR p_cart_total <= sm.max_amount)
        -- Verificar región disponible
        AND (
            p_region IS NULL OR
            sm.available_regions = '[]'::jsonb OR
            sm.available_regions @> to_jsonb(p_region)
        )
        -- Verificar que no esté en regiones excluidas
        AND (
            p_region IS NULL OR
            sm.excluded_regions = '[]'::jsonb OR
            NOT (sm.excluded_regions @> to_jsonb(p_region))
        )
    ORDER BY sm.cost ASC, sm.name ASC;
END;
$$;


--
-- Name: FUNCTION get_available_shipping_methods(p_cart_total numeric, p_region character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_available_shipping_methods(p_cart_total numeric, p_region character varying) IS 'Obtiene métodos de envío disponibles según monto y región';


--
-- Name: get_dashboard_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_stats() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_products', (SELECT COUNT(*) FROM products),
        'published_products', (SELECT COUNT(*) FROM products WHERE status = 'publish'),
        'featured_products', (SELECT COUNT(*) FROM products WHERE featured = true),
        'in_stock_products', (SELECT COUNT(*) FROM products WHERE stock_status = 'instock'),
        'total_categories', (SELECT COUNT(*) FROM categories),
        'categories_with_products', (SELECT COUNT(*) FROM categories WHERE count > 0),
        'avg_price', (SELECT ROUND(AVG(price), 2) FROM products WHERE status = 'publish' AND price > 0),
        'most_popular_category', (
            SELECT jsonb_build_object('name', name, 'count', count)
            FROM categories 
            WHERE count > 0 
            ORDER BY count DESC 
            LIMIT 1
        )
    ) INTO result;
    
    RETURN result;
END;
$$;


--
-- Name: get_products_by_category(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_products_by_category(category_id integer, page_limit integer DEFAULT 20, page_offset integer DEFAULT 0) RETURNS TABLE(data jsonb, total integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    total_count INTEGER;
BEGIN
    -- Contar total de productos en la categoría
    SELECT COUNT(*)
    INTO total_count
    FROM products p
    CROSS JOIN LATERAL jsonb_array_elements_text(p.categories_ids) as cat_id
    WHERE cat_id::int = category_id
    AND p.status = 'publish';
    
    -- Obtener productos con paginación
    RETURN QUERY
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'slug', p.slug,
                'short_description', p.short_description,
                'price', p.price,
                'stock_status', p.stock_status,
                'categories_ids', p.categories_ids,
                'categories_name', p.categories_name,
                'images', p.images
            )
        ) as data,
        total_count as total
    FROM products p
    CROSS JOIN LATERAL jsonb_array_elements_text(p.categories_ids) as cat_id
    WHERE cat_id::int = category_id
    AND p.status = 'publish'
    ORDER BY p.created_at DESC
    LIMIT page_limit
    OFFSET page_offset;
END;
$$;


--
-- Name: get_smart_related_products(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_smart_related_products(product_id integer, max_results integer DEFAULT 4) RETURNS TABLE(id integer, name character varying, slug character varying, short_description text, price numeric, stock_status character varying, categories_ids jsonb, categories_name character varying, images jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH product_categories AS (
        SELECT categories_ids
        FROM products 
        WHERE products.id = product_id
    ),
    related_by_category AS (
        SELECT DISTINCT p.*
        FROM products p, product_categories pc
        CROSS JOIN LATERAL jsonb_array_elements_text(p.categories_ids) as p_cat_id
        CROSS JOIN LATERAL jsonb_array_elements_text(pc.categories_ids) as pc_cat_id
        WHERE p.id != product_id
        AND p.status = 'publish'
        AND p_cat_id = pc_cat_id
    ),
    related_by_related_ids AS (
        SELECT p.*
        FROM products p, products main_p
        WHERE main_p.id = product_id
        AND p.id = ANY(SELECT jsonb_array_elements_text(main_p.related_ids)::int)
        AND p.status = 'publish'
    )
    SELECT r.id, r.name, r.slug, r.short_description, r.price, 
           r.stock_status, r.categories_ids, r.categories_name, r.images
    FROM (
        SELECT *, 1 as priority FROM related_by_related_ids
        UNION ALL
        SELECT *, 2 as priority FROM related_by_category
    ) r
    ORDER BY r.priority, r.created_at DESC
    LIMIT max_results;
END;
$$;


--
-- Name: get_user_coupon_history(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_coupon_history(p_user_id integer) RETURNS TABLE(coupon_code character varying, discount_amount numeric, used_at timestamp with time zone, order_id integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: FUNCTION get_user_coupon_history(p_user_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_coupon_history(p_user_id integer) IS 'Obtiene el historial de cupones usados por un usuario';


--
-- Name: get_user_profile_by_auth_uid(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_profile_by_auth_uid(user_auth_uid uuid) RETURNS public.user_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_profile user_profiles;
BEGIN
  SELECT * INTO user_profile
  FROM user_profiles
  WHERE auth_uid = user_auth_uid;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for auth_uid %', user_auth_uid;
  END IF;
  
  RETURN user_profile;
END;
$$;


--
-- Name: FUNCTION get_user_profile_by_auth_uid(user_auth_uid uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_profile_by_auth_uid(user_auth_uid uuid) IS 'Obtiene el perfil completo de un usuario por su auth_uid';


--
-- Name: get_user_shipping_history(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_shipping_history(p_user_id integer) RETURNS TABLE(order_id integer, shipping_method_name character varying, shipping_cost numeric, status character varying, tracking_number character varying, created_at timestamp with time zone, shipped_at timestamp with time zone, delivered_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: FUNCTION get_user_shipping_history(p_user_id integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_shipping_history(p_user_id integer) IS 'Obtiene el historial de envíos de un usuario';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Crear perfil automáticamente cuando se crea un nuevo usuario en auth.users
  INSERT INTO user_profiles (
    auth_uid,
    email,
    nombre,
    apellido,
    usuario,
    pais,
    tipo_cliente,
    terminos_aceptados
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    COALESCE(NEW.raw_user_meta_data->>'usuario', SPLIT_PART(NEW.email, '@', 1)),
    'Chile',
    'natural',
    FALSE
  );
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Si ya existe el perfil, no hacer nada
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error pero no fallar la creación del usuario auth
    RAISE LOG 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION handle_new_user(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function que crea automáticamente un perfil cuando se registra un nuevo usuario';


--
-- Name: hermes_notify_new_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hermes_notify_new_order() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    BEGIN
        INSERT INTO public.hermes_notifications (order_id)
        VALUES (NEW.id)
        ON CONFLICT (order_id) DO NOTHING;

        -- pg_notify: wakeup al servicio notifier. El payload es solo un hint;
        -- el notifier SIEMPRE redrena la tabla completa al despertar.
        PERFORM pg_notify('hermes_new_order', NEW.id::text);
    EXCEPTION WHEN OTHERS THEN
        -- Loguear en stderr del postmaster sin propagar el error.
        RAISE WARNING 'hermes_notify_new_order: ignorando error (orden segura): %', SQLERRM;
        RETURN NEW;
    END;
    RETURN NEW;
END;
$$;


--
-- Name: migrate_existing_users_to_profiles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migrate_existing_users_to_profiles() RETURNS TABLE(migrated_count integer, error_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  migrated_count INTEGER := 0;
  error_count INTEGER := 0;
  user_record RECORD;
BEGIN
  -- Migrar usuarios de auth.users que no tengan perfil
  FOR user_record IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN user_profiles up ON up.auth_uid = au.id
    WHERE up.auth_uid IS NULL
  LOOP
    BEGIN
      INSERT INTO user_profiles (
        auth_uid,
        email,
        nombre,
        apellido,
        usuario,
        pais,
        tipo_cliente,
        terminos_aceptados
      ) VALUES (
        user_record.id,
        user_record.email,
        COALESCE(user_record.raw_user_meta_data->>'nombre', ''),
        COALESCE(user_record.raw_user_meta_data->>'apellido', ''),
        COALESCE(user_record.raw_user_meta_data->>'usuario', SPLIT_PART(user_record.email, '@', 1)),
        'Chile',
        'natural',
        FALSE
      );
      
      migrated_count := migrated_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE LOG 'Error migrating user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT migrated_count, error_count;
END;
$$;


--
-- Name: FUNCTION migrate_existing_users_to_profiles(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.migrate_existing_users_to_profiles() IS 'Migra usuarios existentes de auth.users a user_profiles';


--
-- Name: search_coupons(character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_coupons(p_search_term character varying DEFAULT NULL::character varying, p_status character varying DEFAULT 'publish'::character varying) RETURNS TABLE(id integer, code character varying, amount numeric, discount_type character varying, description text, date_expires timestamp with time zone, usage_limit_per_user integer, status character varying, minimum_amount numeric, maximum_amount numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.code,
        c.amount,
        c.discount_type,
        c.description,
        c.date_expires,
        c.usage_limit_per_user,
        c.status,
        c.minimum_amount,
        c.maximum_amount
    FROM public.coupons c
    WHERE 
        (p_status IS NULL OR c.status = p_status) AND
        (p_search_term IS NULL OR c.code ILIKE '%' || p_search_term || '%')
    ORDER BY c.date_created DESC;
END;
$$;


--
-- Name: FUNCTION search_coupons(p_search_term character varying, p_status character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.search_coupons(p_search_term character varying, p_status character varying) IS 'Busca cupones por código o término de búsqueda';


--
-- Name: search_products_advanced(text, integer, numeric, numeric, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_products_advanced(search_query text, category_filter integer DEFAULT NULL::integer, min_price numeric DEFAULT NULL::numeric, max_price numeric DEFAULT NULL::numeric, page_limit integer DEFAULT 20, page_offset integer DEFAULT 0) RETURNS TABLE(data jsonb, total integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    total_count INTEGER;
    where_clause TEXT := 'WHERE p.status = ''publish''';
BEGIN
    -- Construir cláusula WHERE dinámicamente
    IF search_query IS NOT NULL AND search_query != '' THEN
        where_clause := where_clause || 
            ' AND (p.name ILIKE ''%' || search_query || '%'' OR ' ||
            'p.short_description ILIKE ''%' || search_query || '%'' OR ' ||
            'p.description ILIKE ''%' || search_query || '%'')';
    END IF;
    
    IF category_filter IS NOT NULL THEN
        where_clause := where_clause || 
            ' AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(p.categories_ids) as cat_id WHERE cat_id::int = ' || category_filter || ')';
    END IF;
    
    IF min_price IS NOT NULL THEN
        where_clause := where_clause || ' AND p.price >= ' || min_price;
    END IF;
    
    IF max_price IS NOT NULL THEN
        where_clause := where_clause || ' AND p.price <= ' || max_price;
    END IF;
    
    -- Contar total
    EXECUTE 'SELECT COUNT(*) FROM products p ' || where_clause INTO total_count;
    
    -- Obtener productos con paginación
    RETURN QUERY
    EXECUTE 'SELECT 
        jsonb_agg(
            jsonb_build_object(
                ''id'', p.id,
                ''name'', p.name,
                ''slug'', p.slug,
                ''short_description'', p.short_description,
                ''price'', p.price,
                ''stock_status'', p.stock_status,
                ''categories_ids'', p.categories_ids,
                ''categories_name'', p.categories_name,
                ''images'', p.images
            )
        ) as data,
        ' || total_count || ' as total
    FROM products p ' || where_clause || '
    ORDER BY p.created_at DESC
    LIMIT ' || page_limit || '
    OFFSET ' || page_offset;
END;
$$;


--
-- Name: trigger_update_category_counts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_update_category_counts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_categories INTEGER[];
    new_categories INTEGER[];
    category_id INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Obtener categorías del producto eliminado
        SELECT ARRAY(SELECT jsonb_array_elements_text(OLD.categories_ids)::int) INTO old_categories;
        
        -- Actualizar contadores de las categorías afectadas
        FOREACH category_id IN ARRAY old_categories LOOP
            PERFORM update_category_count(category_id);
        END LOOP;
        
        RETURN OLD;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        -- Obtener categorías antiguas y nuevas
        SELECT ARRAY(SELECT jsonb_array_elements_text(OLD.categories_ids)::int) INTO old_categories;
        SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.categories_ids)::int) INTO new_categories;
        
        -- Actualizar contadores de todas las categorías afectadas
        FOREACH category_id IN ARRAY (old_categories || new_categories) LOOP
            PERFORM update_category_count(category_id);
        END LOOP;
        
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'INSERT' THEN
        -- Obtener categorías del nuevo producto
        SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.categories_ids)::int) INTO new_categories;
        
        -- Actualizar contadores de las categorías afectadas
        FOREACH category_id IN ARRAY new_categories LOOP
            PERFORM update_category_count(category_id);
        END LOOP;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;


--
-- Name: update_all_category_counts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_all_category_counts() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    cat_record RECORD;
BEGIN
    FOR cat_record IN SELECT id FROM categories LOOP
        PERFORM update_category_count(cat_record.id);
    END LOOP;
END;
$$;


--
-- Name: update_categories_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_categories_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_category_count(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_category_count(category_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    product_count INTEGER;
BEGIN
    -- Contar productos que pertenecen a esta categoría
    SELECT COUNT(*)
    INTO product_count
    FROM products p
    CROSS JOIN LATERAL jsonb_array_elements_text(p.categories_ids) as cat_id
    WHERE cat_id::int = category_id
    AND p.status = 'publish';
    
    -- Actualizar el contador
    UPDATE categories 
    SET count = product_count
    WHERE id = category_id;
END;
$$;


--
-- Name: update_date_modified_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_date_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.date_modified = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_order_communications_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_order_communications_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_user_profile_admin(integer, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_profile_admin(p_user_id integer, p_url_rut_anverso text DEFAULT NULL::text, p_url_rut_reverso text DEFAULT NULL::text, p_url_firma text DEFAULT NULL::text, p_new_url_e_rut_empresa text DEFAULT NULL::text) RETURNS SETOF public.user_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- This function runs with SECURITY DEFINER, so it bypasses RLS
  RETURN QUERY
  UPDATE public.user_profiles
  SET
    url_rut_anverso = COALESCE(p_url_rut_anverso, url_rut_anverso),
    url_rut_reverso = COALESCE(p_url_rut_reverso, url_rut_reverso),
    url_firma = COALESCE(p_url_firma, url_firma),
    new_url_e_rut_empresa = COALESCE(p_new_url_e_rut_empresa, new_url_e_rut_empresa),
    updated_at = NOW()
  WHERE
    user_id = p_user_id
  RETURNING *;
END;
$$;


--
-- Name: update_user_profile_admin_full(integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_profile_admin_full(p_user_id integer, p_updates jsonb) RETURNS SETOF public.user_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- This function runs with SECURITY DEFINER, so it bypasses RLS
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
    fecha_nacimiento = COALESCE((p_updates->>'fecha_nacimiento')::DATE, fecha_nacimiento),
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
    terminos_aceptados = COALESCE((p_updates->>'terminos_aceptados')::BOOLEAN, terminos_aceptados),
    updated_at = NOW()
  WHERE
    user_id = p_user_id
  RETURNING *;
END;
$$;


--
-- Name: update_user_profile_securely(integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_profile_securely(p_user_id integer, p_updates jsonb) RETURNS SETOF public.user_profiles
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: validate_coupon(character varying, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_coupon(p_coupon_code character varying, p_user_id integer, p_cart_total numeric DEFAULT NULL::numeric) RETURNS TABLE(is_valid boolean, coupon_data jsonb, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
    v_coupon RECORD;
    v_usage_count INTEGER;
    v_user_usage_count INTEGER;
BEGIN
    -- Buscar el cupón
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE code = p_coupon_code AND status = 'publish';
    
    -- Verificar si el cupón existe
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::JSONB, 'Cupón no encontrado'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar si el cupón ha expirado
    IF v_coupon.date_expires IS NOT NULL AND v_coupon.date_expires < NOW() THEN
        RETURN QUERY SELECT FALSE, NULL::JSONB, 'Este cupón ha expirado'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar monto mínimo
    IF v_coupon.minimum_amount IS NOT NULL AND p_cart_total IS NOT NULL AND p_cart_total < v_coupon.minimum_amount THEN
        RETURN QUERY SELECT FALSE, NULL::JSONB, 
            FORMAT('El monto mínimo para usar este cupón es $%s', v_coupon.minimum_amount);
        RETURN;
    END IF;
    
    -- Verificar monto máximo
    IF v_coupon.maximum_amount IS NOT NULL AND p_cart_total IS NOT NULL AND p_cart_total > v_coupon.maximum_amount THEN
        RETURN QUERY SELECT FALSE, NULL::JSONB, 
            FORMAT('El monto máximo para usar este cupón es $%s', v_coupon.maximum_amount);
        RETURN;
    END IF;
    
    -- Verificar límite de uso total
    IF v_coupon.usage_limit IS NOT NULL THEN
        SELECT COUNT(*) INTO v_usage_count FROM public.coupon_usage WHERE coupon_id = v_coupon.id;
        IF v_usage_count >= v_coupon.usage_limit THEN
            RETURN QUERY SELECT FALSE, NULL::JSONB, 'Este cupón ha alcanzado su límite de uso'::TEXT;
            RETURN;
        END IF;
    END IF;
    
    -- Verificar límite de uso por usuario
    IF v_coupon.usage_limit_per_user IS NOT NULL AND p_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_user_usage_count 
        FROM public.coupon_usage 
        WHERE coupon_id = v_coupon.id AND user_id = p_user_id;
        
        IF v_user_usage_count >= v_coupon.usage_limit_per_user THEN
            RETURN QUERY SELECT FALSE, NULL::JSONB, 'Ya has utilizado este cupón anteriormente'::TEXT;
            RETURN;
        END IF;
    END IF;
    
    -- Si llegamos aquí, el cupón es válido
    RETURN QUERY SELECT TRUE, 
        jsonb_build_object(
            'id', v_coupon.id,
            'code', v_coupon.code,
            'amount', v_coupon.amount,
            'discount_type', v_coupon.discount_type,
            'description', v_coupon.description,
            'date_expires', v_coupon.date_expires,
            'usage_limit_per_user', v_coupon.usage_limit_per_user,
            'status', v_coupon.status,
            'minimum_amount', v_coupon.minimum_amount,
            'maximum_amount', v_coupon.maximum_amount
        ),
        NULL::TEXT;
END;
$_$;


--
-- Name: FUNCTION validate_coupon(p_coupon_code character varying, p_user_id integer, p_cart_total numeric); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.validate_coupon(p_coupon_code character varying, p_user_id integer, p_cart_total numeric) IS 'Valida si un cupón puede ser usado por un usuario específico';


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id bigint NOT NULL,
    user_id uuid,
    email text NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE admin_users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.admin_users IS 'Tabla para gestionar los usuarios con acceso al panel de administración (backend).';


--
-- Name: admin_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.admin_users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    parent integer,
    description text,
    count integer DEFAULT 0,
    image_src text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: coupon_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_usage (
    id integer NOT NULL,
    coupon_id integer NOT NULL,
    user_id integer NOT NULL,
    order_id integer,
    used_at timestamp with time zone DEFAULT now(),
    discount_amount numeric(10,2) NOT NULL
);


--
-- Name: TABLE coupon_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.coupon_usage IS 'Tabla para rastrear el uso de cupones por usuario';


--
-- Name: coupon_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coupon_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coupon_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coupon_usage_id_seq OWNED BY public.coupon_usage.id;


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    discount_type character varying(20) NOT NULL,
    description text,
    date_created timestamp with time zone DEFAULT now(),
    date_modified timestamp with time zone DEFAULT now(),
    date_expires timestamp with time zone,
    usage_count integer DEFAULT 0,
    usage_limit integer,
    usage_limit_per_user integer DEFAULT 1,
    status character varying(20) DEFAULT 'publish'::character varying,
    minimum_amount numeric(10,2),
    maximum_amount numeric(10,2),
    individual_use boolean DEFAULT false,
    exclude_sale_items boolean DEFAULT false,
    created_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT coupons_amount_positive CHECK ((amount > (0)::numeric)),
    CONSTRAINT coupons_code_length CHECK ((length((code)::text) >= 3)),
    CONSTRAINT coupons_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['percent'::character varying, 'fixed_cart'::character varying, 'fixed_product'::character varying])::text[]))),
    CONSTRAINT coupons_status_check CHECK (((status)::text = ANY ((ARRAY['publish'::character varying, 'draft'::character varying, 'trash'::character varying])::text[]))),
    CONSTRAINT coupons_usage_limits CHECK ((((usage_limit IS NULL) OR (usage_limit > 0)) AND ((usage_limit_per_user IS NULL) OR (usage_limit_per_user > 0))))
);


--
-- Name: TABLE coupons; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.coupons IS 'Tabla principal para almacenar cupones de descuento';


--
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coupons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coupons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;


--
-- Name: hermes_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hermes_notifications (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    event text DEFAULT 'new_order'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notified_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text
);


--
-- Name: hermes_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hermes_notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hermes_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hermes_notifications_id_seq OWNED BY public.hermes_notifications.id;


--
-- Name: hermes_pending_writes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hermes_pending_writes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action text NOT NULL,
    plan_json jsonb NOT NULL,
    confirmation_token text NOT NULL,
    bound_user text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    note text
);


--
-- Name: order_communications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_communications (
    id bigint NOT NULL,
    order_id integer NOT NULL,
    user_id text NOT NULL,
    user_type text NOT NULL,
    message text NOT NULL,
    message_type text DEFAULT 'text'::text NOT NULL,
    file_url text,
    file_name text,
    is_read boolean DEFAULT false NOT NULL,
    user_name text,
    user_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_communications_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'image'::text, 'file'::text]))),
    CONSTRAINT order_communications_user_type_check CHECK ((user_type = ANY (ARRAY['customer'::text, 'admin'::text])))
);


--
-- Name: TABLE order_communications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.order_communications IS 'Tabla para almacenar comunicaciones en tiempo real entre clientes y administradores sobre órdenes específicas';


--
-- Name: COLUMN order_communications.order_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_communications.order_id IS 'ID de la orden a la que pertenece la comunicación';


--
-- Name: COLUMN order_communications.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_communications.user_id IS 'ID del usuario que envía el mensaje (puede ser customer_id o admin_id)';


--
-- Name: COLUMN order_communications.user_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_communications.user_type IS 'Tipo de usuario: customer o admin';


--
-- Name: COLUMN order_communications.message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_communications.message IS 'Contenido del mensaje';


--
-- Name: COLUMN order_communications.message_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_communications.message_type IS 'Tipo de mensaje: text, image, o file';


--
-- Name: COLUMN order_communications.file_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_communications.file_url IS 'URL del archivo adjunto (si aplica)';


--
-- Name: COLUMN order_communications.file_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_communications.file_name IS 'Nombre original del archivo adjunto (si aplica)';


--
-- Name: COLUMN order_communications.is_read; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_communications.is_read IS 'Indica si el mensaje ha sido leído por el destinatario';


--
-- Name: COLUMN order_communications.user_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_communications.user_name IS 'Nombre del usuario que envía el mensaje (para display)';


--
-- Name: COLUMN order_communications.user_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_communications.user_email IS 'Email del usuario que envía el mensaje (para display)';


--
-- Name: order_communications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_communications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_communications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_communications_id_seq OWNED BY public.order_communications.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    status text DEFAULT 'on-hold'::text NOT NULL,
    currency text DEFAULT 'CLP'::text,
    date_created timestamp with time zone DEFAULT now(),
    date_modified timestamp with time zone DEFAULT now(),
    date_completed timestamp with time zone,
    date_paid timestamp with time zone,
    customer_id integer NOT NULL,
    calculated_subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    calculated_discount numeric(12,2) DEFAULT 0 NOT NULL,
    calculated_iva numeric(12,2) DEFAULT 0 NOT NULL,
    calculated_total numeric(12,2) DEFAULT 0 NOT NULL,
    shipping_total numeric(12,2) DEFAULT 0,
    cart_tax numeric(12,2) DEFAULT 0,
    total numeric(12,2),
    total_tax numeric(12,2),
    billing_first_name text NOT NULL,
    billing_last_name text NOT NULL,
    billing_company text,
    billing_address_1 text NOT NULL,
    billing_city text NOT NULL,
    billing_email text NOT NULL,
    billing_phone text NOT NULL,
    order_proyecto text NOT NULL,
    order_fecha_inicio date NOT NULL,
    order_fecha_termino date NOT NULL,
    num_jornadas integer DEFAULT 1 NOT NULL,
    company_rut text NOT NULL,
    order_retire_name text,
    order_retire_phone text,
    order_retire_rut text,
    order_comments text,
    line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    payment_method text,
    payment_method_title text,
    transaction_id text,
    order_key text,
    customer_ip_address inet,
    customer_user_agent text,
    created_via text DEFAULT 'web'::text,
    customer_note text,
    correo_enviado boolean DEFAULT false,
    pago_completo boolean DEFAULT false,
    is_editable boolean DEFAULT true,
    needs_payment boolean DEFAULT true,
    needs_processing boolean DEFAULT true,
    fotos_garantia jsonb DEFAULT '[]'::jsonb,
    orden_compra text,
    numero_factura text,
    new_pdf_on_hold_url text,
    new_pdf_processing_url text,
    tax_lines jsonb DEFAULT '[]'::jsonb,
    shipping_lines jsonb DEFAULT '[]'::jsonb,
    fee_lines jsonb DEFAULT '[]'::jsonb,
    coupon_lines jsonb DEFAULT '[]'::jsonb,
    refunds jsonb DEFAULT '[]'::jsonb,
    pago_reserva boolean DEFAULT false NOT NULL,
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'on-hold'::text, 'completed'::text, 'cancelled'::text, 'refunded'::text, 'failed'::text]))),
    CONSTRAINT valid_dates CHECK ((order_fecha_termino >= order_fecha_inicio)),
    CONSTRAINT valid_jornadas CHECK ((num_jornadas > 0)),
    CONSTRAINT valid_totals CHECK (((calculated_total >= (0)::numeric) AND (calculated_subtotal >= (0)::numeric)))
);


--
-- Name: TABLE orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.orders IS 'Customer orders with complete transaction details and relationships to user_profiles';


--
-- Name: COLUMN orders.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.customer_id IS 'Foreign key reference to user_profiles.user_id';


--
-- Name: order_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.order_summary AS
 SELECT o.id,
    o.status,
    o.date_created,
    ((o.billing_first_name || ' '::text) || o.billing_last_name) AS customer_name,
    o.billing_email,
    o.billing_company,
    o.order_proyecto,
    o.order_fecha_inicio,
    o.order_fecha_termino,
    o.num_jornadas,
    o.calculated_subtotal,
    o.calculated_iva,
    o.calculated_total,
    jsonb_array_length(o.line_items) AS items_count,
    ((up.nombre || ' '::text) || up.apellido) AS profile_name,
    up.rut AS profile_rut
   FROM (public.orders o
     LEFT JOIN public.user_profiles up ON ((o.customer_id = up.user_id)))
  ORDER BY o.date_created DESC;


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(255),
    slug character varying(255),
    type character varying(255),
    status character varying(255),
    featured boolean,
    catalog_visibility character varying(255),
    description text,
    short_description text,
    sku character varying(255),
    price numeric(10,2),
    regular_price numeric(10,2),
    sale_price numeric(10,2),
    on_sale boolean,
    total_sales integer,
    sold_individually boolean,
    related_ids jsonb,
    stock_status character varying(255),
    brands text,
    dimensions_length integer,
    dimensions_width integer,
    dimensions_height integer,
    seo_title character varying(255),
    seo_description text,
    seo_keywords text,
    primary_term_product_cat text,
    images jsonb,
    categories_ids jsonb,
    categories_name character varying(255),
    tags jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    collage_image_url text
);


--
-- Name: COLUMN products.collage_image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.collage_image_url IS 'URL de la imagen collage del producto para la galería';


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: products_with_categories; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.products_with_categories AS
SELECT
    NULL::integer AS id,
    NULL::character varying(255) AS name,
    NULL::character varying(255) AS slug,
    NULL::character varying(255) AS type,
    NULL::character varying(255) AS status,
    NULL::boolean AS featured,
    NULL::character varying(255) AS catalog_visibility,
    NULL::text AS description,
    NULL::text AS short_description,
    NULL::character varying(255) AS sku,
    NULL::numeric(10,2) AS price,
    NULL::numeric(10,2) AS regular_price,
    NULL::numeric(10,2) AS sale_price,
    NULL::boolean AS on_sale,
    NULL::integer AS total_sales,
    NULL::boolean AS sold_individually,
    NULL::jsonb AS related_ids,
    NULL::character varying(255) AS stock_status,
    NULL::text AS brands,
    NULL::integer AS dimensions_length,
    NULL::integer AS dimensions_width,
    NULL::integer AS dimensions_height,
    NULL::character varying(255) AS seo_title,
    NULL::text AS seo_description,
    NULL::text AS seo_keywords,
    NULL::text AS primary_term_product_cat,
    NULL::jsonb AS images,
    NULL::jsonb AS categories_ids,
    NULL::character varying(255) AS categories_name,
    NULL::jsonb AS tags,
    NULL::timestamp with time zone AS created_at,
    NULL::timestamp with time zone AS updated_at,
    NULL::text AS collage_image_url,
    NULL::jsonb AS category_details;


--
-- Name: shipping_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_methods (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    cost numeric(10,2) DEFAULT 0 NOT NULL,
    shipping_type character varying(30) NOT NULL,
    enabled boolean DEFAULT true,
    min_amount numeric(10,2),
    max_amount numeric(10,2),
    available_regions jsonb DEFAULT '[]'::jsonb,
    excluded_regions jsonb DEFAULT '[]'::jsonb,
    estimated_days_min integer DEFAULT 1,
    estimated_days_max integer DEFAULT 7,
    requires_address boolean DEFAULT true,
    requires_phone boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT shipping_methods_amounts_valid CHECK ((((min_amount IS NULL) OR (min_amount >= (0)::numeric)) AND ((max_amount IS NULL) OR (max_amount > (0)::numeric)) AND ((min_amount IS NULL) OR (max_amount IS NULL) OR (max_amount > min_amount)))),
    CONSTRAINT shipping_methods_cost_positive CHECK ((cost >= (0)::numeric)),
    CONSTRAINT shipping_methods_days_valid CHECK (((estimated_days_min > 0) AND (estimated_days_max >= estimated_days_min))),
    CONSTRAINT shipping_methods_shipping_type_check CHECK (((shipping_type)::text = ANY ((ARRAY['free'::character varying, 'flat_rate'::character varying, 'local_pickup'::character varying, 'calculated'::character varying, 'express'::character varying])::text[])))
);


--
-- Name: TABLE shipping_methods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.shipping_methods IS 'Tabla principal para almacenar métodos de envío disponibles';


--
-- Name: shipping_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shipping_methods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shipping_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shipping_methods_id_seq OWNED BY public.shipping_methods.id;


--
-- Name: shipping_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_usage (
    id integer NOT NULL,
    shipping_method_id integer NOT NULL,
    order_id integer NOT NULL,
    user_id integer,
    shipping_cost numeric(10,2) NOT NULL,
    shipping_address jsonb,
    tracking_number character varying(100),
    status character varying(30) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    shipped_at timestamp with time zone,
    delivered_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT shipping_usage_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'shipped'::character varying, 'delivered'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE shipping_usage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.shipping_usage IS 'Tabla para rastrear el uso de métodos de envío en órdenes';


--
-- Name: shipping_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shipping_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shipping_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shipping_usage_id_seq OWNED BY public.shipping_usage.id;


--
-- Name: user_profiles_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_profiles_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_profiles_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_profiles_user_id_seq OWNED BY public.user_profiles.user_id;


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: coupon_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usage ALTER COLUMN id SET DEFAULT nextval('public.coupon_usage_id_seq'::regclass);


--
-- Name: coupons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons ALTER COLUMN id SET DEFAULT nextval('public.coupons_id_seq'::regclass);


--
-- Name: hermes_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hermes_notifications ALTER COLUMN id SET DEFAULT nextval('public.hermes_notifications_id_seq'::regclass);


--
-- Name: order_communications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_communications ALTER COLUMN id SET DEFAULT nextval('public.order_communications_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: shipping_methods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_methods ALTER COLUMN id SET DEFAULT nextval('public.shipping_methods_id_seq'::regclass);


--
-- Name: shipping_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_usage ALTER COLUMN id SET DEFAULT nextval('public.shipping_usage_id_seq'::regclass);


--
-- Name: user_profiles user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles ALTER COLUMN user_id SET DEFAULT nextval('public.user_profiles_user_id_seq'::regclass);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_key UNIQUE (user_id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: coupon_usage coupon_usage_coupon_id_user_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usage
    ADD CONSTRAINT coupon_usage_coupon_id_user_id_order_id_key UNIQUE (coupon_id, user_id, order_id);


--
-- Name: coupon_usage coupon_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usage
    ADD CONSTRAINT coupon_usage_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: hermes_notifications hermes_notifications_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hermes_notifications
    ADD CONSTRAINT hermes_notifications_order_id_key UNIQUE (order_id);


--
-- Name: hermes_notifications hermes_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hermes_notifications
    ADD CONSTRAINT hermes_notifications_pkey PRIMARY KEY (id);


--
-- Name: hermes_pending_writes hermes_pending_writes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hermes_pending_writes
    ADD CONSTRAINT hermes_pending_writes_pkey PRIMARY KEY (id);


--
-- Name: order_communications order_communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_communications
    ADD CONSTRAINT order_communications_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_key_key UNIQUE (order_key);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: shipping_methods shipping_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_methods
    ADD CONSTRAINT shipping_methods_pkey PRIMARY KEY (id);


--
-- Name: shipping_usage shipping_usage_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_usage
    ADD CONSTRAINT shipping_usage_order_id_key UNIQUE (order_id);


--
-- Name: shipping_usage shipping_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_usage
    ADD CONSTRAINT shipping_usage_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_auth_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_auth_uid_key UNIQUE (auth_uid);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: idx_categories_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_name ON public.categories USING btree (name);


--
-- Name: idx_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent ON public.categories USING btree (parent) WHERE (parent IS NOT NULL);


--
-- Name: idx_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);


--
-- Name: idx_coupon_usage_coupon_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupon_usage_coupon_id ON public.coupon_usage USING btree (coupon_id);


--
-- Name: idx_coupon_usage_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupon_usage_user_id ON public.coupon_usage USING btree (user_id);


--
-- Name: idx_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_code ON public.coupons USING btree (code);


--
-- Name: idx_coupons_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_expires ON public.coupons USING btree (date_expires);


--
-- Name: idx_coupons_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_status ON public.coupons USING btree (status);


--
-- Name: idx_hermes_notifications_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hermes_notifications_pending ON public.hermes_notifications USING btree (created_at) WHERE (notified_at IS NULL);


--
-- Name: idx_order_communications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_communications_created_at ON public.order_communications USING btree (created_at);


--
-- Name: idx_order_communications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_communications_is_read ON public.order_communications USING btree (is_read);


--
-- Name: idx_order_communications_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_communications_order_id ON public.order_communications USING btree (order_id);


--
-- Name: idx_order_communications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_communications_user_id ON public.order_communications USING btree (user_id);


--
-- Name: idx_orders_billing_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_billing_email ON public.orders USING btree (billing_email);


--
-- Name: idx_orders_calculated_total; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_calculated_total ON public.orders USING btree (calculated_total);


--
-- Name: idx_orders_company_rut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_company_rut ON public.orders USING btree (company_rut);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_customer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_status ON public.orders USING btree (customer_id, status);


--
-- Name: idx_orders_date_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_date_created ON public.orders USING btree (date_created);


--
-- Name: idx_orders_fecha_inicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_fecha_inicio ON public.orders USING btree (order_fecha_inicio);


--
-- Name: idx_orders_fecha_termino; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_fecha_termino ON public.orders USING btree (order_fecha_termino);


--
-- Name: idx_orders_order_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_order_key ON public.orders USING btree (order_key);


--
-- Name: idx_orders_order_proyecto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_order_proyecto ON public.orders USING btree (order_proyecto);


--
-- Name: idx_orders_proyecto_fechas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_proyecto_fechas ON public.orders USING btree (order_proyecto, order_fecha_inicio, order_fecha_termino);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status_date ON public.orders USING btree (status, date_created);


--
-- Name: idx_products_categories_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_categories_gin ON public.products USING gin (categories_ids);


--
-- Name: idx_products_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_created_at_desc ON public.products USING btree (created_at DESC) WHERE ((status)::text = 'publish'::text);


--
-- Name: idx_products_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_featured ON public.products USING btree (featured);


--
-- Name: idx_products_images_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_images_gin ON public.products USING gin (images);


--
-- Name: idx_products_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_price ON public.products USING btree (price) WHERE ((status)::text = 'publish'::text);


--
-- Name: idx_products_related_ids_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_related_ids_gin ON public.products USING gin (related_ids);


--
-- Name: idx_products_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_slug ON public.products USING btree (slug);


--
-- Name: idx_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_status ON public.products USING btree (status);


--
-- Name: idx_products_stock_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_stock_status ON public.products USING btree (stock_status);


--
-- Name: idx_products_tags_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_tags_gin ON public.products USING gin (tags);


--
-- Name: idx_products_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_type ON public.products USING btree (type);


--
-- Name: idx_shipping_methods_cost; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_methods_cost ON public.shipping_methods USING btree (cost);


--
-- Name: idx_shipping_methods_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_methods_enabled ON public.shipping_methods USING btree (enabled);


--
-- Name: idx_shipping_methods_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_methods_type ON public.shipping_methods USING btree (shipping_type);


--
-- Name: idx_shipping_usage_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_usage_order_id ON public.shipping_usage USING btree (order_id);


--
-- Name: idx_shipping_usage_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_usage_status ON public.shipping_usage USING btree (status);


--
-- Name: idx_shipping_usage_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_usage_user_id ON public.shipping_usage USING btree (user_id);


--
-- Name: idx_user_profiles_auth_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_auth_uid ON public.user_profiles USING btree (auth_uid);


--
-- Name: idx_user_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_email ON public.user_profiles USING btree (email);


--
-- Name: idx_user_profiles_rut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_rut ON public.user_profiles USING btree (rut);


--
-- Name: products_with_categories _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.products_with_categories AS
 SELECT p.id,
    p.name,
    p.slug,
    p.type,
    p.status,
    p.featured,
    p.catalog_visibility,
    p.description,
    p.short_description,
    p.sku,
    p.price,
    p.regular_price,
    p.sale_price,
    p.on_sale,
    p.total_sales,
    p.sold_individually,
    p.related_ids,
    p.stock_status,
    p.brands,
    p.dimensions_length,
    p.dimensions_width,
    p.dimensions_height,
    p.seo_title,
    p.seo_description,
    p.seo_keywords,
    p.primary_term_product_cat,
    p.images,
    p.categories_ids,
    p.categories_name,
    p.tags,
    p.created_at,
    p.updated_at,
    p.collage_image_url,
    COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'parent', c.parent)) FILTER (WHERE (c.id IS NOT NULL)), '[]'::jsonb) AS category_details
   FROM (public.products p
     LEFT JOIN LATERAL ( SELECT c_1.id,
            c_1.name,
            c_1.slug,
            c_1.parent,
            c_1.description,
            c_1.count,
            c_1.image_src,
            c_1.created_at,
            c_1.updated_at
           FROM (public.categories c_1
             CROSS JOIN LATERAL jsonb_array_elements_text(p.categories_ids) cat_id(value))
          WHERE (c_1.id = (cat_id.value)::integer)) c ON (true))
  WHERE ((p.status)::text = 'publish'::text)
  GROUP BY p.id;


--
-- Name: products products_category_count_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER products_category_count_trigger AFTER INSERT OR DELETE OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.trigger_update_category_counts();


--
-- Name: orders trg_hermes_notify_new_order; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trg_hermes_notify_new_order ON public.orders;
CREATE TRIGGER trg_hermes_notify_new_order AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.hermes_notify_new_order();


--
-- Name: order_communications trigger_update_order_communications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_order_communications_updated_at BEFORE UPDATE ON public.order_communications FOR EACH ROW EXECUTE FUNCTION public.update_order_communications_updated_at();


--
-- Name: categories update_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_categories_updated_at_column();


--
-- Name: orders update_orders_date_modified; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_date_modified BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_date_modified_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shipping_methods update_shipping_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_shipping_methods_updated_at BEFORE UPDATE ON public.shipping_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_profiles update_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin_users admin_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: coupon_usage coupon_usage_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usage
    ADD CONSTRAINT coupon_usage_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE;


--
-- Name: coupon_usage coupon_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usage
    ADD CONSTRAINT coupon_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;


--
-- Name: coupons coupons_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: categories fk_categories_parent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT fk_categories_parent FOREIGN KEY (parent) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: order_communications order_communications_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_communications
    ADD CONSTRAINT order_communications_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.user_profiles(user_id);


--
-- Name: shipping_methods shipping_methods_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_methods
    ADD CONSTRAINT shipping_methods_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: shipping_usage shipping_usage_shipping_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_usage
    ADD CONSTRAINT shipping_usage_shipping_method_id_fkey FOREIGN KEY (shipping_method_id) REFERENCES public.shipping_methods(id) ON DELETE CASCADE;


--
-- Name: shipping_usage shipping_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_usage
    ADD CONSTRAINT shipping_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE SET NULL;


--
-- Name: user_profiles user_profiles_auth_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_auth_uid_fkey FOREIGN KEY (auth_uid) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_profiles Admins can read all user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all user_profiles" ON public.user_profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));


--
-- Name: user_profiles Admins can update all user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all user_profiles" ON public.user_profiles FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));


--
-- Name: admin_users Allow service_role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow service_role full access" ON public.admin_users TO service_role USING (true) WITH CHECK (true);


--
-- Name: user_profiles Allow service_role full access to user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow service_role full access to user_profiles" ON public.user_profiles TO service_role USING (true) WITH CHECK (true);


--
-- Name: admin_users Allow users to read own admin record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to read own admin record" ON public.admin_users FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: coupons Anyone can read active coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read active coupons" ON public.coupons FOR SELECT USING (((status)::text = 'publish'::text));


--
-- Name: shipping_methods Anyone can read active shipping methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read active shipping methods" ON public.shipping_methods FOR SELECT USING ((enabled = true));


--
-- Name: coupon_usage Authenticated users can record coupon usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can record coupon usage" ON public.coupon_usage FOR INSERT WITH CHECK ((user_id IN ( SELECT user_profiles.user_id
   FROM public.user_profiles
  WHERE (user_profiles.auth_uid = auth.uid()))));


--
-- Name: shipping_usage Authenticated users can record shipping usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can record shipping usage" ON public.shipping_usage FOR INSERT WITH CHECK ((user_id IN ( SELECT user_profiles.user_id
   FROM public.user_profiles
  WHERE (user_profiles.auth_uid = auth.uid()))));


--
-- Name: user_profiles Hermes agents can read user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Hermes agents can read user_profiles" ON public.user_profiles FOR SELECT TO hermes_notifier, hermes_ro, hermes_rw USING (true);


--
-- Name: coupons Only admins can manage coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can manage coupons" ON public.coupons USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.auth_uid = auth.uid()) AND (((coupons.metadata ->> 'role'::text) = 'admin'::text) OR ((coupons.metadata ->> 'role'::text) = 'manager'::text))))));


--
-- Name: user_profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.user_profiles FOR INSERT WITH CHECK ((auth_uid = auth.uid()));


--
-- Name: user_profiles Users can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own profile" ON public.user_profiles FOR SELECT USING ((auth.uid() = auth_uid));


--
-- Name: coupon_usage Users can see their own coupon usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see their own coupon usage" ON public.coupon_usage FOR SELECT USING ((user_id IN ( SELECT user_profiles.user_id
   FROM public.user_profiles
  WHERE (user_profiles.auth_uid = auth.uid()))));


--
-- Name: shipping_usage Users can see their own shipping usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see their own shipping usage" ON public.shipping_usage FOR SELECT USING ((user_id IN ( SELECT user_profiles.user_id
   FROM public.user_profiles
  WHERE (user_profiles.auth_uid = auth.uid()))));


--
-- Name: user_profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR UPDATE USING ((auth.uid() = auth_uid)) WITH CHECK ((auth.uid() = auth_uid));


--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: order_communications allow_all_for_testing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all_for_testing ON public.order_communications USING (true) WITH CHECK (true);


--
-- Name: coupon_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO hermes_ro;
GRANT USAGE ON SCHEMA public TO hermes_rw;
GRANT USAGE ON SCHEMA public TO hermes_notifier;


--
-- Name: TABLE user_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_profiles TO postgres;
GRANT ALL ON TABLE public.user_profiles TO anon;
GRANT ALL ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;
GRANT SELECT ON TABLE public.user_profiles TO hermes_ro;
GRANT SELECT ON TABLE public.user_profiles TO hermes_rw;
GRANT SELECT ON TABLE public.user_profiles TO hermes_notifier;


--
-- Name: FUNCTION admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text, p_apellido text, p_rut text, p_telefono text, p_direccion text, p_ciudad text, p_pais text, p_tipo_cliente text, p_instagram text, p_fecha_nacimiento date, p_usuario text, p_empresa_nombre text, p_empresa_rut text, p_empresa_ciudad text, p_empresa_direccion text, p_terminos_aceptados boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text, p_apellido text, p_rut text, p_telefono text, p_direccion text, p_ciudad text, p_pais text, p_tipo_cliente text, p_instagram text, p_fecha_nacimiento date, p_usuario text, p_empresa_nombre text, p_empresa_rut text, p_empresa_ciudad text, p_empresa_direccion text, p_terminos_aceptados boolean) TO postgres;
GRANT ALL ON FUNCTION public.admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text, p_apellido text, p_rut text, p_telefono text, p_direccion text, p_ciudad text, p_pais text, p_tipo_cliente text, p_instagram text, p_fecha_nacimiento date, p_usuario text, p_empresa_nombre text, p_empresa_rut text, p_empresa_ciudad text, p_empresa_direccion text, p_terminos_aceptados boolean) TO anon;
GRANT ALL ON FUNCTION public.admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text, p_apellido text, p_rut text, p_telefono text, p_direccion text, p_ciudad text, p_pais text, p_tipo_cliente text, p_instagram text, p_fecha_nacimiento date, p_usuario text, p_empresa_nombre text, p_empresa_rut text, p_empresa_ciudad text, p_empresa_direccion text, p_terminos_aceptados boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_create_user_profile(p_auth_uid uuid, p_email text, p_nombre text, p_apellido text, p_rut text, p_telefono text, p_direccion text, p_ciudad text, p_pais text, p_tipo_cliente text, p_instagram text, p_fecha_nacimiento date, p_usuario text, p_empresa_nombre text, p_empresa_rut text, p_empresa_ciudad text, p_empresa_direccion text, p_terminos_aceptados boolean) TO service_role;


--
-- Name: FUNCTION apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer) TO postgres;
GRANT ALL ON FUNCTION public.apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer) TO anon;
GRANT ALL ON FUNCTION public.apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.apply_coupon(p_coupon_code character varying, p_user_id integer, p_discount_amount numeric, p_order_id integer) TO service_role;


--
-- Name: FUNCTION apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb) TO postgres;
GRANT ALL ON FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb) TO anon;
GRANT ALL ON FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.apply_shipping_method(p_shipping_method_id integer, p_order_id integer, p_user_id integer, p_shipping_address jsonb) TO service_role;


--
-- Name: FUNCTION calculate_iva(subtotal numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_iva(subtotal numeric) TO postgres;
GRANT ALL ON FUNCTION public.calculate_iva(subtotal numeric) TO anon;
GRANT ALL ON FUNCTION public.calculate_iva(subtotal numeric) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_iva(subtotal numeric) TO service_role;


--
-- Name: FUNCTION calculate_order_subtotal(line_items_json jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_order_subtotal(line_items_json jsonb) TO postgres;
GRANT ALL ON FUNCTION public.calculate_order_subtotal(line_items_json jsonb) TO anon;
GRANT ALL ON FUNCTION public.calculate_order_subtotal(line_items_json jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_order_subtotal(line_items_json jsonb) TO service_role;


--
-- Name: FUNCTION calculate_shipping_cost(p_shipping_method_id integer, p_cart_total numeric, p_region character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_shipping_cost(p_shipping_method_id integer, p_cart_total numeric, p_region character varying) TO postgres;
GRANT ALL ON FUNCTION public.calculate_shipping_cost(p_shipping_method_id integer, p_cart_total numeric, p_region character varying) TO anon;
GRANT ALL ON FUNCTION public.calculate_shipping_cost(p_shipping_method_id integer, p_cart_total numeric, p_region character varying) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_shipping_cost(p_shipping_method_id integer, p_cart_total numeric, p_region character varying) TO service_role;


--
-- Name: FUNCTION create_user_profile_manual(user_auth_uid uuid, user_email text, user_nombre text, user_apellido text, user_usuario text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_user_profile_manual(user_auth_uid uuid, user_email text, user_nombre text, user_apellido text, user_usuario text) TO postgres;
GRANT ALL ON FUNCTION public.create_user_profile_manual(user_auth_uid uuid, user_email text, user_nombre text, user_apellido text, user_usuario text) TO anon;
GRANT ALL ON FUNCTION public.create_user_profile_manual(user_auth_uid uuid, user_email text, user_nombre text, user_apellido text, user_usuario text) TO authenticated;
GRANT ALL ON FUNCTION public.create_user_profile_manual(user_auth_uid uuid, user_email text, user_nombre text, user_apellido text, user_usuario text) TO service_role;


--
-- Name: FUNCTION get_available_shipping_methods(p_cart_total numeric, p_region character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_available_shipping_methods(p_cart_total numeric, p_region character varying) TO postgres;
GRANT ALL ON FUNCTION public.get_available_shipping_methods(p_cart_total numeric, p_region character varying) TO anon;
GRANT ALL ON FUNCTION public.get_available_shipping_methods(p_cart_total numeric, p_region character varying) TO authenticated;
GRANT ALL ON FUNCTION public.get_available_shipping_methods(p_cart_total numeric, p_region character varying) TO service_role;


--
-- Name: FUNCTION get_dashboard_stats(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_dashboard_stats() TO postgres;
GRANT ALL ON FUNCTION public.get_dashboard_stats() TO anon;
GRANT ALL ON FUNCTION public.get_dashboard_stats() TO authenticated;
GRANT ALL ON FUNCTION public.get_dashboard_stats() TO service_role;


--
-- Name: FUNCTION get_products_by_category(category_id integer, page_limit integer, page_offset integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_products_by_category(category_id integer, page_limit integer, page_offset integer) TO postgres;
GRANT ALL ON FUNCTION public.get_products_by_category(category_id integer, page_limit integer, page_offset integer) TO anon;
GRANT ALL ON FUNCTION public.get_products_by_category(category_id integer, page_limit integer, page_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_products_by_category(category_id integer, page_limit integer, page_offset integer) TO service_role;


--
-- Name: FUNCTION get_smart_related_products(product_id integer, max_results integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_smart_related_products(product_id integer, max_results integer) TO postgres;
GRANT ALL ON FUNCTION public.get_smart_related_products(product_id integer, max_results integer) TO anon;
GRANT ALL ON FUNCTION public.get_smart_related_products(product_id integer, max_results integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_smart_related_products(product_id integer, max_results integer) TO service_role;


--
-- Name: FUNCTION get_user_coupon_history(p_user_id integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_coupon_history(p_user_id integer) TO postgres;
GRANT ALL ON FUNCTION public.get_user_coupon_history(p_user_id integer) TO anon;
GRANT ALL ON FUNCTION public.get_user_coupon_history(p_user_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_coupon_history(p_user_id integer) TO service_role;


--
-- Name: FUNCTION get_user_profile_by_auth_uid(user_auth_uid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_profile_by_auth_uid(user_auth_uid uuid) TO postgres;
GRANT ALL ON FUNCTION public.get_user_profile_by_auth_uid(user_auth_uid uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_profile_by_auth_uid(user_auth_uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_profile_by_auth_uid(user_auth_uid uuid) TO service_role;


--
-- Name: FUNCTION get_user_shipping_history(p_user_id integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_shipping_history(p_user_id integer) TO postgres;
GRANT ALL ON FUNCTION public.get_user_shipping_history(p_user_id integer) TO anon;
GRANT ALL ON FUNCTION public.get_user_shipping_history(p_user_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_shipping_history(p_user_id integer) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO postgres;
GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION hermes_notify_new_order(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.hermes_notify_new_order() TO postgres;
GRANT ALL ON FUNCTION public.hermes_notify_new_order() TO anon;
GRANT ALL ON FUNCTION public.hermes_notify_new_order() TO authenticated;
GRANT ALL ON FUNCTION public.hermes_notify_new_order() TO service_role;


--
-- Name: FUNCTION migrate_existing_users_to_profiles(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.migrate_existing_users_to_profiles() TO postgres;
GRANT ALL ON FUNCTION public.migrate_existing_users_to_profiles() TO anon;
GRANT ALL ON FUNCTION public.migrate_existing_users_to_profiles() TO authenticated;
GRANT ALL ON FUNCTION public.migrate_existing_users_to_profiles() TO service_role;


--
-- Name: FUNCTION search_coupons(p_search_term character varying, p_status character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_coupons(p_search_term character varying, p_status character varying) TO postgres;
GRANT ALL ON FUNCTION public.search_coupons(p_search_term character varying, p_status character varying) TO anon;
GRANT ALL ON FUNCTION public.search_coupons(p_search_term character varying, p_status character varying) TO authenticated;
GRANT ALL ON FUNCTION public.search_coupons(p_search_term character varying, p_status character varying) TO service_role;


--
-- Name: FUNCTION search_products_advanced(search_query text, category_filter integer, min_price numeric, max_price numeric, page_limit integer, page_offset integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_products_advanced(search_query text, category_filter integer, min_price numeric, max_price numeric, page_limit integer, page_offset integer) TO postgres;
GRANT ALL ON FUNCTION public.search_products_advanced(search_query text, category_filter integer, min_price numeric, max_price numeric, page_limit integer, page_offset integer) TO anon;
GRANT ALL ON FUNCTION public.search_products_advanced(search_query text, category_filter integer, min_price numeric, max_price numeric, page_limit integer, page_offset integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_products_advanced(search_query text, category_filter integer, min_price numeric, max_price numeric, page_limit integer, page_offset integer) TO service_role;


--
-- Name: FUNCTION trigger_update_category_counts(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trigger_update_category_counts() TO postgres;
GRANT ALL ON FUNCTION public.trigger_update_category_counts() TO anon;
GRANT ALL ON FUNCTION public.trigger_update_category_counts() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_update_category_counts() TO service_role;


--
-- Name: FUNCTION update_all_category_counts(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_all_category_counts() TO postgres;
GRANT ALL ON FUNCTION public.update_all_category_counts() TO anon;
GRANT ALL ON FUNCTION public.update_all_category_counts() TO authenticated;
GRANT ALL ON FUNCTION public.update_all_category_counts() TO service_role;


--
-- Name: FUNCTION update_categories_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_categories_updated_at_column() TO postgres;
GRANT ALL ON FUNCTION public.update_categories_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_categories_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_categories_updated_at_column() TO service_role;


--
-- Name: FUNCTION update_category_count(category_id integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_category_count(category_id integer) TO postgres;
GRANT ALL ON FUNCTION public.update_category_count(category_id integer) TO anon;
GRANT ALL ON FUNCTION public.update_category_count(category_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.update_category_count(category_id integer) TO service_role;


--
-- Name: FUNCTION update_date_modified_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_date_modified_column() TO postgres;
GRANT ALL ON FUNCTION public.update_date_modified_column() TO anon;
GRANT ALL ON FUNCTION public.update_date_modified_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_date_modified_column() TO service_role;


--
-- Name: FUNCTION update_order_communications_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_order_communications_updated_at() TO postgres;
GRANT ALL ON FUNCTION public.update_order_communications_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_order_communications_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_order_communications_updated_at() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO postgres;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION update_user_profile_admin(p_user_id integer, p_url_rut_anverso text, p_url_rut_reverso text, p_url_firma text, p_new_url_e_rut_empresa text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_user_profile_admin(p_user_id integer, p_url_rut_anverso text, p_url_rut_reverso text, p_url_firma text, p_new_url_e_rut_empresa text) TO postgres;
GRANT ALL ON FUNCTION public.update_user_profile_admin(p_user_id integer, p_url_rut_anverso text, p_url_rut_reverso text, p_url_firma text, p_new_url_e_rut_empresa text) TO anon;
GRANT ALL ON FUNCTION public.update_user_profile_admin(p_user_id integer, p_url_rut_anverso text, p_url_rut_reverso text, p_url_firma text, p_new_url_e_rut_empresa text) TO authenticated;
GRANT ALL ON FUNCTION public.update_user_profile_admin(p_user_id integer, p_url_rut_anverso text, p_url_rut_reverso text, p_url_firma text, p_new_url_e_rut_empresa text) TO service_role;


--
-- Name: FUNCTION update_user_profile_admin_full(p_user_id integer, p_updates jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_user_profile_admin_full(p_user_id integer, p_updates jsonb) TO postgres;
GRANT ALL ON FUNCTION public.update_user_profile_admin_full(p_user_id integer, p_updates jsonb) TO anon;
GRANT ALL ON FUNCTION public.update_user_profile_admin_full(p_user_id integer, p_updates jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.update_user_profile_admin_full(p_user_id integer, p_updates jsonb) TO service_role;


--
-- Name: FUNCTION update_user_profile_securely(p_user_id integer, p_updates jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_user_profile_securely(p_user_id integer, p_updates jsonb) TO postgres;
GRANT ALL ON FUNCTION public.update_user_profile_securely(p_user_id integer, p_updates jsonb) TO anon;
GRANT ALL ON FUNCTION public.update_user_profile_securely(p_user_id integer, p_updates jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.update_user_profile_securely(p_user_id integer, p_updates jsonb) TO service_role;


--
-- Name: FUNCTION validate_coupon(p_coupon_code character varying, p_user_id integer, p_cart_total numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_coupon(p_coupon_code character varying, p_user_id integer, p_cart_total numeric) TO postgres;
GRANT ALL ON FUNCTION public.validate_coupon(p_coupon_code character varying, p_user_id integer, p_cart_total numeric) TO anon;
GRANT ALL ON FUNCTION public.validate_coupon(p_coupon_code character varying, p_user_id integer, p_cart_total numeric) TO authenticated;
GRANT ALL ON FUNCTION public.validate_coupon(p_coupon_code character varying, p_user_id integer, p_cart_total numeric) TO service_role;


--
-- Name: TABLE admin_users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_users TO postgres;
GRANT ALL ON TABLE public.admin_users TO anon;
GRANT ALL ON TABLE public.admin_users TO authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;
GRANT SELECT ON TABLE public.admin_users TO hermes_ro;
GRANT SELECT ON TABLE public.admin_users TO hermes_rw;


--
-- Name: SEQUENCE admin_users_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.admin_users_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.admin_users_id_seq TO anon;
GRANT ALL ON SEQUENCE public.admin_users_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.admin_users_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.admin_users_id_seq TO hermes_rw;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.categories TO postgres;
GRANT ALL ON TABLE public.categories TO anon;
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;
GRANT SELECT ON TABLE public.categories TO hermes_ro;
GRANT SELECT ON TABLE public.categories TO hermes_rw;


--
-- Name: SEQUENCE categories_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.categories_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.categories_id_seq TO anon;
GRANT ALL ON SEQUENCE public.categories_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.categories_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.categories_id_seq TO hermes_rw;


--
-- Name: TABLE coupon_usage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.coupon_usage TO postgres;
GRANT ALL ON TABLE public.coupon_usage TO anon;
GRANT ALL ON TABLE public.coupon_usage TO authenticated;
GRANT ALL ON TABLE public.coupon_usage TO service_role;
GRANT SELECT ON TABLE public.coupon_usage TO hermes_ro;
GRANT SELECT ON TABLE public.coupon_usage TO hermes_rw;


--
-- Name: SEQUENCE coupon_usage_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.coupon_usage_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.coupon_usage_id_seq TO anon;
GRANT ALL ON SEQUENCE public.coupon_usage_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.coupon_usage_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.coupon_usage_id_seq TO hermes_rw;


--
-- Name: TABLE coupons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.coupons TO postgres;
GRANT ALL ON TABLE public.coupons TO anon;
GRANT ALL ON TABLE public.coupons TO authenticated;
GRANT ALL ON TABLE public.coupons TO service_role;
GRANT SELECT ON TABLE public.coupons TO hermes_ro;
GRANT SELECT ON TABLE public.coupons TO hermes_rw;


--
-- Name: SEQUENCE coupons_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.coupons_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.coupons_id_seq TO anon;
GRANT ALL ON SEQUENCE public.coupons_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.coupons_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.coupons_id_seq TO hermes_rw;


--
-- Name: TABLE hermes_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hermes_notifications TO postgres;
GRANT ALL ON TABLE public.hermes_notifications TO anon;
GRANT ALL ON TABLE public.hermes_notifications TO authenticated;
GRANT ALL ON TABLE public.hermes_notifications TO service_role;
GRANT SELECT ON TABLE public.hermes_notifications TO hermes_ro;
GRANT SELECT,UPDATE ON TABLE public.hermes_notifications TO hermes_notifier;


--
-- Name: SEQUENCE hermes_notifications_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.hermes_notifications_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.hermes_notifications_id_seq TO anon;
GRANT ALL ON SEQUENCE public.hermes_notifications_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.hermes_notifications_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.hermes_notifications_id_seq TO hermes_notifier;


--
-- Name: TABLE hermes_pending_writes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hermes_pending_writes TO postgres;
GRANT ALL ON TABLE public.hermes_pending_writes TO anon;
GRANT ALL ON TABLE public.hermes_pending_writes TO authenticated;
GRANT ALL ON TABLE public.hermes_pending_writes TO service_role;
GRANT SELECT ON TABLE public.hermes_pending_writes TO hermes_ro;
GRANT SELECT,INSERT,UPDATE ON TABLE public.hermes_pending_writes TO hermes_rw;


--
-- Name: TABLE order_communications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_communications TO postgres;
GRANT ALL ON TABLE public.order_communications TO anon;
GRANT ALL ON TABLE public.order_communications TO authenticated;
GRANT ALL ON TABLE public.order_communications TO service_role;
GRANT SELECT ON TABLE public.order_communications TO hermes_ro;
GRANT SELECT ON TABLE public.order_communications TO hermes_rw;


--
-- Name: SEQUENCE order_communications_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.order_communications_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.order_communications_id_seq TO anon;
GRANT ALL ON SEQUENCE public.order_communications_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.order_communications_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.order_communications_id_seq TO hermes_rw;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.orders TO postgres;
GRANT ALL ON TABLE public.orders TO anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;
GRANT SELECT ON TABLE public.orders TO hermes_ro;
GRANT SELECT,INSERT,UPDATE ON TABLE public.orders TO hermes_rw;
GRANT SELECT ON TABLE public.orders TO hermes_notifier;


--
-- Name: TABLE order_summary; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_summary TO postgres;
GRANT ALL ON TABLE public.order_summary TO anon;
GRANT ALL ON TABLE public.order_summary TO authenticated;
GRANT ALL ON TABLE public.order_summary TO service_role;
GRANT SELECT ON TABLE public.order_summary TO hermes_ro;
GRANT SELECT ON TABLE public.order_summary TO hermes_rw;


--
-- Name: SEQUENCE orders_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.orders_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.orders_id_seq TO anon;
GRANT ALL ON SEQUENCE public.orders_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.orders_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.orders_id_seq TO hermes_rw;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.products TO postgres;
GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;
GRANT SELECT ON TABLE public.products TO hermes_ro;
GRANT SELECT ON TABLE public.products TO hermes_rw;


--
-- Name: SEQUENCE products_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.products_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.products_id_seq TO anon;
GRANT ALL ON SEQUENCE public.products_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.products_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.products_id_seq TO hermes_rw;


--
-- Name: TABLE products_with_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.products_with_categories TO postgres;
GRANT ALL ON TABLE public.products_with_categories TO anon;
GRANT ALL ON TABLE public.products_with_categories TO authenticated;
GRANT ALL ON TABLE public.products_with_categories TO service_role;
GRANT SELECT ON TABLE public.products_with_categories TO hermes_ro;
GRANT SELECT ON TABLE public.products_with_categories TO hermes_rw;


--
-- Name: TABLE shipping_methods; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shipping_methods TO postgres;
GRANT ALL ON TABLE public.shipping_methods TO anon;
GRANT ALL ON TABLE public.shipping_methods TO authenticated;
GRANT ALL ON TABLE public.shipping_methods TO service_role;
GRANT SELECT ON TABLE public.shipping_methods TO hermes_ro;
GRANT SELECT ON TABLE public.shipping_methods TO hermes_rw;


--
-- Name: SEQUENCE shipping_methods_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.shipping_methods_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.shipping_methods_id_seq TO anon;
GRANT ALL ON SEQUENCE public.shipping_methods_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.shipping_methods_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.shipping_methods_id_seq TO hermes_rw;


--
-- Name: TABLE shipping_usage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shipping_usage TO postgres;
GRANT ALL ON TABLE public.shipping_usage TO anon;
GRANT ALL ON TABLE public.shipping_usage TO authenticated;
GRANT ALL ON TABLE public.shipping_usage TO service_role;
GRANT SELECT ON TABLE public.shipping_usage TO hermes_ro;
GRANT SELECT ON TABLE public.shipping_usage TO hermes_rw;


--
-- Name: SEQUENCE shipping_usage_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.shipping_usage_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.shipping_usage_id_seq TO anon;
GRANT ALL ON SEQUENCE public.shipping_usage_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.shipping_usage_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.shipping_usage_id_seq TO hermes_rw;


--
-- Name: SEQUENCE user_profiles_user_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.user_profiles_user_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.user_profiles_user_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_profiles_user_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_profiles_user_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.user_profiles_user_id_seq TO hermes_rw;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES  TO hermes_ro;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES  TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON TABLES  TO hermes_ro;


--
-- PostgreSQL database dump complete
--


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
-- Not emitted by `pg_dump -n public` (lives in `auth`, not `public`) — appended per the
-- normalization note above.
--

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
