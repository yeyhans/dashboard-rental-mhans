# Backend API Documentation

## Arquitectura

Este backend está diseñado para ser completamente independiente utilizando **Astro** y **Supabase** con `service_role` para operaciones administrativas seguras.

### Tecnologías
- **Framework**: Astro
- **Base de datos**: Supabase (PostgreSQL)
- **Autenticación**: JWT tokens de Supabase
- **Despliegue**: Vercel
- **CORS**: Configurado para frontend

## Configuración de Variables de Entorno

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CORS Configuration
FRONTEND_URL=https://your-frontend-domain.com
```

## Autenticación

Todos los endpoints de administración requieren:
- Header `Authorization: Bearer <jwt_token>`
- El usuario debe existir en la tabla `admin_users`

## Endpoints

### Health Check

#### GET `/api/health`
Verifica el estado del servidor y conectividad con Supabase.

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00Z",
    "database": "connected",
    "version": "1.0.0"
  }
}
```

### Dashboard

#### GET `/api/dashboard`
Obtiene métricas generales del sistema para el dashboard administrativo.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 150,
      "totalOrders": 45,
      "totalProducts": 25,
      "totalRevenue": "15750.00",
      "monthlyRevenue": "3200.00",
      "revenueGrowth": "15.2%",
      "averageOrderValue": "350.00",
      "conversionRate": "30.0%"
    },
    "orders": {
      "total": 45,
      "pending": 5,
      "processing": 8,
      "completed": 30,
      "cancelled": 2,
      "monthly": 12,
      "statusDistribution": {
        "pending": 5,
        "processing": 8,
        "completed": 30,
        "cancelled": 2
      }
    },
    "products": {
      "total": 25,
      "published": 20,
      "draft": 3,
      "outOfStock": 2,
      "lowStock": 5,
      "featured": 8
    },
    "users": {
      "total": 150,
      "active": 120,
      "verified": 140,
      "withContracts": 100,
      "monthly": 15
    },
    "coupons": {
      "total": 10,
      "active": 7,
      "used": 25,
      "expired": 2,
      "totalDiscount": "1250.00",
      "usageRate": "70.0"
    }
  }
}
```

### Autenticación

#### POST `/api/auth/login`
Autentica un usuario administrador y devuelve tokens de sesión.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "admin@example.com",
      "role": "admin"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": 1640995200
    }
  },
  "message": "Inicio de sesión exitoso"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Credenciales inválidas"
}
```

#### POST `/api/auth/logout`
Cierra la sesión del usuario actual.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Sesión cerrada exitosamente"
}
```

#### GET `/api/auth/me`
Obtiene información del usuario autenticado actual.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "email": "admin@example.com",
    "role": "admin",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Gestión de Administradores

#### GET `/api/admin`
Obtiene la lista de todos los usuarios administradores.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (Success):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "uuid-string",
      "email": "admin@example.com",
      "role": "admin",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST `/api/admin`
Crea un nuevo usuario administrador.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newadmin@example.com",
  "role": "admin"
}
```

#### GET `/api/admin/[userId]`
Obtiene información de un administrador específico.

#### DELETE `/api/admin/[userId]`
Elimina un usuario administrador.

### Gestión de Usuarios

#### GET `/api/users`
Obtiene lista de usuarios con paginación y filtros.

**Query Parameters:**
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 10)
- `search`: Término de búsqueda

#### POST `/api/users`
Crea un nuevo usuario.

#### GET `/api/users/[id]`
Obtiene un usuario específico.

#### PUT `/api/users/[id]`
Actualiza un usuario.

#### DELETE `/api/users/[id]`
Elimina un usuario.

#### GET `/api/users/eligible`
Obtiene usuarios elegibles para órdenes.

### Gestión de Productos

#### GET `/api/products`
Obtiene lista de productos con paginación y filtros.

**Query Parameters:**
- `page`: Número de página
- `limit`: Elementos por página
- `categoryId`: Filtrar por categoría
- `status`: Filtrar por estado
- `search`: Término de búsqueda
- `featured`: Solo productos destacados (true/false)

#### POST `/api/products`
Crea un nuevo producto.

#### GET `/api/products/[id]`
Obtiene un producto específico.

#### PUT `/api/products/[id]`
Actualiza un producto.

#### DELETE `/api/products/[id]`
Elimina un producto.

#### GET `/api/products/stats`
Obtiene estadísticas de productos.

#### PUT `/api/products/stock/[id]`
Actualiza el stock de un producto.

#### POST `/api/products/duplicate/[id]`
Duplica un producto existente.

### Gestión de Categorías

#### GET `/api/categories`
Obtiene lista de categorías.

**Query Parameters:**
- `hierarchical`: Devolver estructura jerárquica (true/false)
- `search`: Término de búsqueda

#### POST `/api/categories`
Crea una nueva categoría.

#### GET `/api/categories/[id]`
Obtiene una categoría específica.

#### PUT `/api/categories/[id]`
Actualiza una categoría.

#### DELETE `/api/categories/[id]`
Elimina una categoría.

#### PUT `/api/categories/reorder`
Reordena categorías.

### Gestión de Órdenes

#### GET `/api/orders`
Obtiene lista de órdenes con filtros.

**Query Parameters:**
- `page`: Número de página
- `limit`: Elementos por página
- `status`: Filtrar por estado
- `search`: Término de búsqueda
- `userId`: Filtrar por usuario
- `startDate`: Fecha inicial
- `endDate`: Fecha final

#### POST `/api/orders`
Crea una nueva orden.

#### GET `/api/orders/[id]`
Obtiene una orden específica.

#### PUT `/api/orders/[id]`
Actualiza una orden.

#### DELETE `/api/orders/[id]`
Elimina una orden.

#### GET `/api/orders/stats`
Obtiene estadísticas de órdenes.

#### PUT `/api/orders/status/[id]`
Actualiza el estado de una orden.

### Gestión de Items de Orden

#### GET `/api/order-items/[orderId]`
Obtiene items de una orden específica.

#### POST `/api/order-items/[orderId]`
Crea items para una orden.

#### DELETE `/api/order-items/[orderId]`
Elimina todos los items de una orden.

#### GET `/api/order-items/item/[id]`
Obtiene un item específico.

#### PUT `/api/order-items/item/[id]`
Actualiza un item.

#### DELETE `/api/order-items/item/[id]`
Elimina un item.

#### PUT `/api/order-items/quantity/[id]`
Actualiza la cantidad de un item.

### Gestión de Cupones

#### GET `/api/coupons`
Obtiene lista de cupones.

#### POST `/api/coupons`
Crea un nuevo cupón.

#### GET `/api/coupons/[id]`
Obtiene un cupón específico.

#### PUT `/api/coupons/[id]`
Actualiza un cupón.

#### DELETE `/api/coupons/[id]`
Elimina un cupón.

#### POST `/api/coupons/validate/[code]`
Valida un cupón.

#### POST `/api/coupons/apply/[code]`
Aplica un cupón.

#### GET `/api/coupons/stats`
Obtiene estadísticas de cupones.

### Integración con Frontend

#### POST `/api/sync/user`
Sincroniza datos de usuario desde el frontend.

#### GET `/api/contracts/validate/[userId]`
Valida el estado del contrato de un usuario.

#### PUT `/api/contracts/validate/[userId]`
Actualiza el estado del contrato.

#### GET `/api/stats`
Obtiene estadísticas generales del sistema.

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| `AUTHENTICATION_ERROR` | Token faltante o inválido |
| `AUTHORIZATION_ERROR` | Permisos insuficientes |
| `VALIDATION_ERROR` | Datos de entrada inválidos |
| `NOT_FOUND` | Recurso no encontrado |
| `CONFLICT_ERROR` | Conflicto (ej: usuario ya existe) |
| `DUPLICATE_ENTRY` | Entrada duplicada en base de datos |
| `FOREIGN_KEY_VIOLATION` | Violación de clave foránea |
| `DATABASE_ERROR` | Error de base de datos |
| `INTERNAL_ERROR` | Error interno del servidor |

## Middleware

### Autenticación (`withAuth`)
- Valida JWT tokens de Supabase
- Verifica que el usuario sea administrador
- Agrega información del usuario al contexto

### CORS (`withCors`)
- Maneja preflight requests
- Configura headers CORS apropiados
- Permite requests desde el frontend configurado

### Manejo de Errores (`withErrorHandler`)
- Captura y formatea errores
- Logging automático
- Respuestas consistentes

## Logging

El sistema incluye logging estructurado con los siguientes tipos:
- `http_request`: Requests HTTP entrantes
- `http_response`: Respuestas HTTP con tiempo de duración
- `database_operation`: Operaciones de base de datos
- `authentication`: Eventos de autenticación
- Errores y warnings con contexto completo

## Despliegue en Vercel

1. Conectar el repositorio a Vercel
2. Configurar las variables de entorno
3. El proyecto se desplegará automáticamente

### Variables de Entorno en Vercel:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=https://your-frontend-domain.com
```

## Seguridad

- **Service Role**: El backend usa `service_role` para operaciones administrativas
- **JWT Validation**: Todos los endpoints protegidos validan tokens JWT
- **CORS**: Configurado específicamente para el frontend
- **Rate Limiting**: Implementar en Vercel si es necesario
- **HTTPS**: Obligatorio en producción
