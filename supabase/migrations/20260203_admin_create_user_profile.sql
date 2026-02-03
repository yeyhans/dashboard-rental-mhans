-- ============================================================================
-- Función para crear usuarios desde el panel de administración
-- Esta función usa SECURITY DEFINER para bypasear las políticas RLS
-- ============================================================================

-- Eliminar la función si ya existe
DROP FUNCTION IF EXISTS admin_create_user_profile(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
);

-- Crear función para insertar usuarios que bypasa RLS
CREATE OR REPLACE FUNCTION admin_create_user_profile(
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
SECURITY DEFINER -- IMPORTANTE: Esto bypasa RLS
SET search_path = public
AS $$
BEGIN
    -- Verificar que el email no esté vacío
    IF p_email IS NULL OR p_email = '' THEN
        RAISE EXCEPTION 'El email es requerido';
    END IF;

    -- Verificar que el email no exista ya
    IF EXISTS (SELECT 1 FROM user_profiles WHERE email = p_email) THEN
        RAISE EXCEPTION 'Ya existe un usuario con el email: %', p_email;
    END IF;

    -- Insertar el nuevo usuario y retornarlo
    RETURN QUERY
    INSERT INTO user_profiles (
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

-- Dar permisos de ejecución a service_role y authenticated
GRANT EXECUTE ON FUNCTION admin_create_user_profile TO service_role;
GRANT EXECUTE ON FUNCTION admin_create_user_profile TO authenticated;

-- Comentario explicativo
COMMENT ON FUNCTION admin_create_user_profile IS 
'Función para crear usuarios desde el panel de administración. 
Usa SECURITY DEFINER para bypasear las políticas RLS.';
