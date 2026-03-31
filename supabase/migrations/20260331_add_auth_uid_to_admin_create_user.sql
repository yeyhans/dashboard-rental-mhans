-- ============================================================================
-- Agregar parámetro p_auth_uid a admin_create_user_profile
-- Necesario porque ahora el dashboard crea el auth user ANTES del perfil
-- ============================================================================

-- Eliminar versión anterior
DROP FUNCTION IF EXISTS admin_create_user_profile(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
);

-- Recrear con p_auth_uid como primer parámetro
CREATE OR REPLACE FUNCTION admin_create_user_profile(
    p_auth_uid UUID,
    p_email TEXT,
    p_nombre TEXT DEFAULT NULL,
    p_apellido TEXT DEFAULT NULL,
    p_rut TEXT DEFAULT NULL,
    p_telefono TEXT DEFAULT NULL,
    p_direccion TEXT DEFAULT NULL,
    p_ciudad TEXT DEFAULT NULL,
    p_pais TEXT DEFAULT NULL,
    p_tipo_cliente TEXT DEFAULT NULL,
    p_instagram TEXT DEFAULT NULL,
    p_fecha_nacimiento DATE DEFAULT NULL,
    p_usuario TEXT DEFAULT NULL,
    p_empresa_nombre TEXT DEFAULT NULL,
    p_empresa_rut TEXT DEFAULT NULL,
    p_empresa_ciudad TEXT DEFAULT NULL,
    p_empresa_direccion TEXT DEFAULT NULL,
    p_terminos_aceptados BOOLEAN DEFAULT FALSE
)
RETURNS SETOF user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION admin_create_user_profile TO service_role;
GRANT EXECUTE ON FUNCTION admin_create_user_profile TO authenticated;

COMMENT ON FUNCTION admin_create_user_profile IS
'Crea un perfil de usuario desde el panel de administración.
Requiere auth_uid de un usuario previamente creado en auth.users.
Usa SECURITY DEFINER para bypasear RLS.';
