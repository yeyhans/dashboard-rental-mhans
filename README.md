# Backend API - Sistema de Alquiler

Backend independiente construido con Astro y Supabase para el sistema de gestión de usuarios y contratos.

## 🏗️ Arquitectura

Este backend es completamente independiente del frontend y utiliza:
- **Astro** como framework principal
- **Supabase** con service role key para operaciones administrativas
- **TypeScript** para type safety
- **API Routes** para endpoints REST

## 🔧 Configuración

### Variables de Entorno

Copia `.env.example` a `.env.local` y configura:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Backend Configuration
PORT=4000
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:4321
ALLOWED_ORIGINS=http://localhost:4321,http://localhost:3000

# JWT Configuration
JWT_SECRET=your-jwt-secret-key
```

### Instalación

```bash
npm install
npm run dev
```

## 📁 Estructura del Proyecto

```text
backend/
├── src/
│   ├── lib/
│   │   └── supabase.ts          # Cliente Supabase con service role
│   ├── services/
│   │   ├── userService.ts       # Gestión de usuarios
│   │   ├── adminService.ts      # Gestión de administradores
│   │   └── backendApiService.ts # Integración con frontend
│   ├── middleware/
│   │   └── auth.ts              # Autenticación y CORS
│   ├── types/
│   │   └── database.ts          # Tipos de Supabase
│   └── pages/api/
│       ├── users/               # CRUD de usuarios
│       ├── admin/               # Gestión de admins
│       ├── stats/               # Estadísticas
│       ├── sync/                # Sincronización con frontend
│       ├── contracts/           # Validación de contratos
│       └── health/              # Health check
└── package.json
```

## 🚀 API Endpoints

### Usuarios
- `GET /api/users` - Listar usuarios (con paginación y búsqueda)
- `POST /api/users` - Crear usuario
- `GET /api/users/[id]` - Obtener usuario por ID
- `PUT /api/users/[id]` - Actualizar usuario
- `DELETE /api/users/[id]` - Eliminar usuario
- `GET /api/users/eligible` - Usuarios elegibles para pedidos

### Órdenes y Productos
- `GET /api/orders` - Listar órdenes
- `GET /api/orders/[id]` - Obtener orden por ID
- `PUT /api/orders/update/[id]` - Actualizar orden
- `POST /api/orders/check-conflicts` - **🆕 Verificar conflictos de productos**
- `POST /api/products/batch` - Obtener productos por lote

### Administradores
- `GET /api/admin` - Listar administradores
- `POST /api/admin` - Agregar administrador
- `GET /api/admin/[userId]` - Obtener admin por user_id
- `DELETE /api/admin/[userId]` - Remover administrador

### Contratos
- `GET /api/contracts/validate/[userId]` - Validar contrato de usuario
- `PUT /api/contracts/validate/[userId]` - Actualizar estado de contrato

### Sincronización
- `POST /api/sync/user` - Sincronizar usuario desde frontend

### Sistema
- `GET /api/stats` - Estadísticas del sistema
- `GET /api/health` - Health check

## 🔐 Autenticación

Todos los endpoints (excepto `/health`) requieren:
1. Token JWT válido en header `Authorization: Bearer <token>`
2. Usuario debe estar en la tabla `admin_users`

## 🔄 Integración con Frontend

El backend se integra con el frontend a través de:

1. **Sincronización de usuarios**: Cuando el frontend crea/actualiza usuarios
2. **Validación de contratos**: Verificar elegibilidad para pedidos
3. **Gestión administrativa**: Panel de administración independiente

## 📊 Base de Datos

Utiliza las siguientes tablas de Supabase:
- `user_profiles` - Perfiles de usuarios del frontend
- `admin_users` - Usuarios con acceso administrativo

## 🧞 Comandos

| Comando | Acción |
|---------|--------|
| `npm install` | Instalar dependencias |
| `npm run dev` | Servidor de desarrollo (puerto 4000) |
| `npm run build` | Construir para producción |
| `npm run preview` | Vista previa de producción |

## 🔍 Funcionalidades Principales

### Gestión de Usuarios
- CRUD completo de usuarios
- Búsqueda y filtrado
- Paginación
- Estadísticas

### 🆕 Detección de Conflictos de Productos
- **Verificación Automática**: Detecta productos ocupados en múltiples órdenes
- **Análisis de Fechas**: Identifica solapamientos en períodos de alquiler
- **Alertas Visuales**: Badges rojos con detalles expandibles
- **Información Detallada**: Muestra órdenes conflictivas, clientes y fechas
- **Prevención de Doble Reserva**: Evita conflictos operacionales

### Validación de Contratos
- Verificar contratos firmados
- Validar términos aceptados
- Elegibilidad para pedidos

### Administración
- Gestión de usuarios admin
- Control de acceso
- Auditoría de operaciones

### Sincronización
- Mantener consistencia con frontend
- Actualizaciones bidireccionales
- Resolución de conflictos

## 🛡️ Seguridad

- Service role key para operaciones administrativas
- Validación JWT en todos los endpoints
- CORS configurado para frontend específico
- Row Level Security en Supabase