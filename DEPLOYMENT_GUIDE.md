# Guía de Despliegue - Arquitectura Profesional

## Arquitectura de Producción

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │    Supabase     │
│   (VPS Privado) │◄──►│    (Vercel)      │◄──►│   (Database)    │
│   - Astro/React │    │   - API REST     │    │ - PostgreSQL    │
│   - UI/UX       │    │   - Service Role │    │ - Auth          │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Pasos de Despliegue

### 1. Configurar Supabase

1. **Crear tabla admin_users:**
```sql
-- Ejecutar en el SQL Editor de Supabase
CREATE TABLE IF NOT EXISTS public.admin_users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to admins" 
ON public.admin_users 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

2. **Obtener credenciales:**
   - `SUPABASE_URL`: Desde Settings > API
   - `SUPABASE_ANON_KEY`: Desde Settings > API  
   - `SUPABASE_SERVICE_ROLE_KEY`: Desde Settings > API (¡Mantener secreto!)

### 2. Desplegar Backend en Vercel

1. **Conectar repositorio a Vercel:**
   - Importar proyecto desde GitHub
   - Seleccionar carpeta `backend/`
   - Framework: Astro

2. **Configurar variables de entorno en Vercel:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=https://your-frontend-domain.com
```

3. **Verificar despliegue:**
   - URL del backend: `https://your-backend.vercel.app`
   - Probar: `GET /api/admin/users` (debe devolver 401 sin auth)

### 3. Configurar Frontend en VPS

1. **Variables de entorno (.env):**
```bash
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PUBLIC_BACKEND_URL=https://your-backend.vercel.app
PUBLIC_CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev
PUBLIC_SITE_URL=https://your-frontend-domain.com
```

2. **Instalar dependencias y construir:**
```bash
npm install
npm run build
```

3. **Configurar servidor web (Nginx ejemplo):**
```nginx
server {
    listen 80;
    server_name your-frontend-domain.com;
    
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Configurar HTTPS con Let's Encrypt
}
```

### 4. Crear Primer Administrador

1. **Registrar usuario en frontend:**
   - Ir a `/register`
   - Crear cuenta con email/password

2. **Agregar a admin_users manualmente:**
```sql
-- En Supabase SQL Editor
INSERT INTO admin_users (user_id, email, role)
SELECT id, email, 'admin'
FROM auth.users 
WHERE email = 'tu-email@ejemplo.com';
```

3. **Verificar acceso:**
   - Login en `/login` del frontend
   - Acceder a `/admin/users`
   - Debería mostrar la interfaz de administración

### 5. Configuración de Seguridad

1. **CORS en Vercel:**
   - Ya configurado en `vercel.json`
   - Verificar que `FRONTEND_URL` sea correcto

2. **RLS en Supabase:**
   - Políticas ya creadas para `admin_users`
   - Solo `service_role` puede acceder

3. **HTTPS obligatorio:**
   - Frontend: Configurar SSL en VPS
   - Backend: Automático en Vercel
   - Supabase: Siempre HTTPS

## Flujo de Autenticación

```
1. Usuario → Frontend (/login)
2. Frontend → Supabase Auth (signInWithPassword)
3. Supabase → Frontend (JWT token)
4. Frontend → Backend API (Authorization: Bearer <token>)
5. Backend → Supabase (verificar token + admin_users)
6. Backend → Frontend (respuesta API)
```

## Monitoreo y Logs

### Backend (Vercel)
- Logs automáticos en dashboard de Vercel
- Logging estructurado implementado
- Errores capturados y formateados

### Frontend (VPS)
- Logs del servidor web (Nginx/Apache)
- Logs de aplicación en consola del navegador
- Monitoreo de uptime recomendado

## Troubleshooting

### Error: "Token de autorización requerido"
- Verificar que el token JWT se esté enviando
- Comprobar formato: `Authorization: Bearer <token>`

### Error: "Acceso denegado. Permisos de administrador requeridos"
- Usuario no está en tabla `admin_users`
- Agregar manualmente o usar interfaz de admin

### Error: CORS
- Verificar `FRONTEND_URL` en variables de entorno
- Comprobar configuración en `vercel.json`

### Error: "Cannot find module 'astro'"
- Instalar dependencias: `npm install`
- Verificar que Astro esté en `package.json`

## Escalabilidad

### Base de Datos
- Supabase maneja escalabilidad automáticamente
- Considerar índices para tablas grandes

### Backend
- Vercel escala automáticamente
- Considerar Edge Functions para mejor latencia

### Frontend
- CDN recomendado para assets estáticos
- Caché de navegador configurado

## Backup y Recuperación

### Base de Datos
- Backups automáticos en Supabase
- Exportar esquema regularmente

### Código
- Repositorio Git como backup
- Tags para versiones estables

### Configuración
- Documentar variables de entorno
- Backup de configuraciones de servidor
