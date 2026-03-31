# API Patterns — Dashboard

## Formato de Respuesta Estándar

**SIEMPRE usar este formato exacto**:
```typescript
// Éxito
{ success: true, data: any, message?: string }

// Error
{ success: false, error: string, code?: string }
```

**Status codes**:
- `200` — GET / UPDATE exitoso
- `201` — POST exitoso (creación de recurso)
- `400` — Validación fallida (campo faltante, formato inválido)
- `401` — No autenticado (sin token o token inválido)
- `403` — No autorizado (rol insuficiente)
- `404` — Recurso no encontrado
- `500` — Error interno del servidor

---

## Estructura Completa de un Endpoint

```typescript
// src/pages/api/orders/index.ts
import type { APIRoute } from 'astro';
import { withAuth } from '@/middleware/auth';
import { OrderService } from '@/services/orderService';

export const GET: APIRoute = withAuth(async ({ request, locals }) => {
  // 1. Validar query params
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  if (isNaN(page) || page < 1) {
    return new Response(
      JSON.stringify({ success: false, error: 'Parámetro page inválido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Llamar al Service
  try {
    const result = await OrderService.getAll(page, limit);
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GET /api/orders] Error:', { error, userId: locals.user?.id });
    return new Response(
      JSON.stringify({ success: false, error: 'Error al obtener las órdenes' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

export const POST: APIRoute = withAuth(async ({ request, locals }) => {
  // 1. Validar body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'JSON inválido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!body.customer_id || !body.order_fecha_inicio) {
    return new Response(
      JSON.stringify({ success: false, error: 'Campos requeridos: customer_id, order_fecha_inicio' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Llamar al Service
  try {
    const order = await OrderService.createOrder(body);
    return new Response(
      JSON.stringify({ success: true, data: order }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[POST /api/orders] Error:', { error, body });
    return new Response(
      JSON.stringify({ success: false, error: 'Error al crear la orden' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Middleware Patterns

### `withAuth` — Proteger endpoints que requieren admin

```typescript
import { withAuth } from '@/middleware/auth';

export const GET: APIRoute = withAuth(async (context) => {
  const { user, adminSession } = context; // user tiene: id, email, role
  // user.role === 'admin' | 'super_admin'

  // Verificar rol específico si es necesario
  if (user.role !== 'super_admin') {
    return new Response(
      JSON.stringify({ success: false, error: 'Permisos insuficientes' }),
      { status: 403 }
    );
  }
  // ...
});
```

### `withCors` — CORS está manejado por middleware global

```typescript
// NO agregar withCors en endpoints individuales
// El middleware global en src/middleware/index.ts maneja CORS para todas las rutas /api/*
// Comentar en el endpoint: "// CORS handled by global middleware"
```

### Composición de middleware

```typescript
import { withAuth, withMiddleware } from '@/middleware/auth';

export const GET: APIRoute = withMiddleware([withAuth], async (context) => {
  // Múltiples middlewares compuestos
});
```

---

## Validación de Parámetros

```typescript
// IDs en URL params
const id = parseInt(context.params.id as string);
if (isNaN(id) || id <= 0) {
  return new Response(
    JSON.stringify({ success: false, error: 'ID de orden inválido' }),
    { status: 400 }
  );
}

// Enums
const validStatuses = ['on-hold', 'reviewing', 'processing', 'preparing', 'delivering', 'completed', 'paid', 'failed'];
if (!validStatuses.includes(body.status)) {
  return new Response(
    JSON.stringify({ success: false, error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}` }),
    { status: 400 }
  );
}

// Fechas
const startDate = new Date(body.order_fecha_inicio);
if (isNaN(startDate.getTime())) {
  return new Response(
    JSON.stringify({ success: false, error: 'Fecha de inicio inválida (formato ISO 8601)' }),
    { status: 400 }
  );
}
```

---

## Logging Conventions

```typescript
// Prefijos estándar con contexto
console.log('[OrderService] Orden creada:', { orderId: order.id, customerId: order.customer_id });
console.log('[PDF] Presupuesto generado para orden:', orderId);
console.log('[Email] Enviando notificación a:', customerEmail);
console.error('[Auth] Token inválido:', { endpoint: '/api/orders', timestamp: new Date().toISOString() });
console.error('[WarrantyPhotos] Error subiendo foto:', { orderId, error: error.message });
```

**Siempre incluir** en logs de error: endpoint o servicio, IDs relevantes, mensaje de error.
**Nunca incluir**: passwords, tokens, service role keys.

---

## Rutas API Existentes

```
/api/auth/          login, logout, me, session
/api/orders/        CRUD + stats + check-conflicts + status + email + PDF + warranty-photos
/api/order-items/   Items de órdenes
/api/products/      CRUD + search + batch + stats + stock + duplicate
/api/categories/    CRUD + reorder
/api/users/         CRUD + stats + eligible + by-auth-uid
/api/admin/         Gestión de usuarios admin
/api/coupons/       CRUD + stats + apply + validate
/api/shipping/      Methods CRUD + stats
/api/analytics/     advanced + product-rentals
/api/dashboard/     Stats generales + filtradas
/api/budget/        generate-pdf
/api/contracts/     generate-pdf + validate
/api/order/         generate-budget/contract/processing-pdf
/api/emails/        send-budget/contract/order/welcome-notification
/api/external/      generate-budget/contract-pdf (acceso desde frontend)
/api/health         Health check
```
