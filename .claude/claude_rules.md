# Dashboard Rental MHANS - Claude Development Rules

## 📋 Descripción del Proyecto

**Sistema de gestión de alquiler de equipos para el mercado chileno**

- **Framework**: Astro 5.9.2 + React 18.3.1 con TypeScript estricto
- **Base de Datos**: Supabase (PostgreSQL) con tipos auto-generados
- **Arquitectura**: SSR con API routes, desplegado en Vercel
- **UI**: Tailwind CSS + shadcn/ui (Radix UI primitives)
- **Autenticación**: JWT con cookies HTTP-only, sesiones extendidas (30 días)
- **Servicios**: PDF generation (Puppeteer), Email (Resend), Real-time updates

## 🏗️ Arquitectura

**Patrón MVC-like con Service Layer:**
- **Pages** (`src/pages/`): Astro pages + API routes
- **Components** (`src/components/`): React components (UI)
- **Services** (`src/services/`): Business logic y database operations
- **Lib** (`src/lib/`): Utilities, Supabase client, error handling
- **Middleware** (`src/middleware/`): Auth y CORS
- **Types** (`src/types/`): TypeScript definitions + Supabase schema

**Flujo de datos:**
```
UI Component → API Endpoint → Service Layer → Supabase → Response
```

## 🔑 API Development Patterns (PRIORIDAD MÁXIMA)

### Estructura Estándar de Response

**SIEMPRE usar este formato:**
```typescript
// Success
{ success: true, data: any, message?: string }

// Error
{ success: false, error: string, code?: string }
```

**Status codes:**
- `200` - GET/UPDATE exitoso
- `201` - POST exitoso (creación)
- `400` - Validación fallida
- `401` - No autenticado
- `403` - No autorizado (sin permisos)
- `404` - Recurso no encontrado
- `500` - Error del servidor

### Patrón de Endpoint Completo

**SIEMPRE seguir este orden:**
1. Validación de parámetros
2. Verificación de autenticación (si aplica)
3. Llamada a Service
4. Manejo de respuesta
5. Error handling con try-catch

**Validación de parámetros:**
- Validar IDs con `parseInt()` y verificar `isNaN()`
- Validar campos requeridos antes de llamar Services
- Retornar 400 con mensaje específico si falla validación

**Autenticación:**
- Usar `withAuth` middleware para endpoints protegidos
- El middleware agrega `context.user` y `context.adminSession`
- Verificar roles si es necesario: `if (adminUser.role === 'super_admin')`

**Llamadas a Services:**
- NUNCA hacer queries Supabase directamente en endpoints
- SIEMPRE delegar a Services
- Services retornan datos o lanzan errores

**Error Handling:**
- SIEMPRE envolver lógica en try-catch
- Loggear errores con `console.error()` incluyendo contexto
- NUNCA exponer detalles internos al cliente
- Retornar mensajes user-friendly en español

### CRUD Patterns con Services

**Service Class Structure:**
```typescript
class ResourceService {
  private static ensureSupabaseAdmin() {
    // Verificar cliente Supabase disponible
  }

  static async getAll(page: number, limit: number) {
    // Paginación estándar
  }

  static async getById(id: number): Promise<Type | null> {
    // Single resource, retorna null si no existe
  }

  static async create(data: InsertType): Promise<Type> {
    // Crear recurso
  }

  static async update(id: number, data: UpdateType): Promise<Type> {
    // Actualizar recurso
  }

  static async delete(id: number): Promise<boolean> {
    // Eliminar recurso
  }
}
```

**SIEMPRE:**
- Usar métodos estáticos
- Llamar `ensureSupabaseAdmin()` antes de queries
- Tipar retornos con Promises
- Re-throw errors para manejo en endpoints

### Queries Supabase - Patterns Estándar

**Paginación:**
```typescript
const offset = (page - 1) * limit;
const { data, error, count } = await client
  .from('table')
  .select('*', { count: 'exact' })
  .range(offset, offset + limit - 1)
  .order('created_at', { ascending: false });
```

**Retornar:**
```typescript
{
  [resources]: data,
  total: count || 0,
  page,
  limit,
  totalPages: Math.ceil((count || 0) / limit)
}
```

**Single Resource:**
```typescript
const { data, error } = await client
  .from('table')
  .select('*')
  .eq('id', id)
  .single();

// Error PGRST116 = no encontrado
if (error?.code === 'PGRST116') return null;
if (error) throw error;
return data;
```

**Búsqueda:**
```typescript
.ilike('name', `%${searchTerm}%`)  // Case-insensitive
```

**Filtros:**
```typescript
.eq('status', 'publish')
.in('id', [1, 2, 3])
```

**Joins:**
```typescript
.select(`
  id,
  name,
  user_profiles (user_id, nombre, email)
`)
```

### Middleware Patterns

**withAuth:**
- Valida sesión JWT via cookies
- Verifica usuario en tabla `admin_users`
- Agrega `context.user` y `context.adminSession`
- Retorna 401 si no autenticado

**withCors:**
- Ahora manejado por middleware global
- NO incluir en endpoints individuales (comentado como "global middleware handles CORS")

**Composición:**
```typescript
export const GET: APIRoute = withAuth(async (context) => {
  // Handler con autenticación
});
```

### Logging y Error Handling

**Console Logging:**
- `console.log()` para info: ✅ success, 📦 data, 🔄 changes
- `console.error()` para errores: ❌ failures
- SIEMPRE incluir contexto: endpoint, userId, timestamp

**Error Responses:**
- Mensajes en español
- User-friendly (no stack traces)
- Específicos pero no exponen lógica interna

### Validación de Entrada

**SIEMPRE validar:**
- IDs numéricos: `parseInt()` + `isNaN()` check
- Campos required: verificar presencia y no-vacío
- Enums: verificar valores válidos
- Rangos: min/max para números y fechas

**Retornar 400 con:**
- Mensaje específico del campo que falla
- En español
- Sin revelar estructura interna

## 💾 Database & Type System (PRIORIDAD ALTA)

### Tablas Principales

**user_profiles** (57 campos)
- PK: `user_id` (number)
- FK: `auth_uid` → Supabase Auth
- Campos clave: email, nombre, apellido, rut, empresa_rut
- Documents: url_rut_anverso, url_rut_reverso, url_firma, url_user_contrato
- Compliance: tipo_cliente, terminos_aceptados

**products** (30 campos)
- PK: `id` (number)
- Campos: name, slug, sku, price, regular_price, sale_price
- Inventory: stock_status
- Metadata JSON: images, categories_ids, tags
- Media: collage_image_url

**orders** (45+ campos)
- PK: `id` (number)
- FK: `customer_id` → user_profiles.user_id
- Status: pending, processing, on-hold, completed, cancelled
- Financials: calculated_subtotal, calculated_discount, calculated_iva, calculated_total
- Project: order_proyecto, order_fecha_inicio, order_fecha_termino, num_jornadas
- JSON fields: line_items, fotos_garantia, shipping_lines, coupon_lines
- Documents: orden_compra, numero_factura, PDF URLs

**categories**
- PK: `id` (number)
- Self-join: `parent` (jerarquía)
- Campos: name, slug, description, count

**coupons**
- PK: `id` (number)
- FK: `created_by` → users
- Campos: code, amount, discount_type (percent | fixed_cart)
- Constraints: minimum_amount, maximum_amount, individual_use
- Usage: usage_count, usage_limit, usage_limit_per_user

**admin_users**
- PK: `id` (number)
- FK: `user_id` → auth
- Campos: email, role (admin | super_admin)

**shipping_methods**
- PK: `id` (number)
- Type: shipping_type (free | flat_rate | local_pickup | calculated | express)
- Campos: cost, available_regions, estimated_days

### Type Generation Pattern

**Supabase Types:**
```typescript
Database['public']['Tables']['table_name']['Row']      // SELECT
Database['public']['Tables']['table_name']['Insert']   // INSERT
Database['public']['Tables']['table_name']['Update']   // UPDATE
```

**En Services:**
```typescript
type Resource = Database['public']['Tables']['table']['Row'];
type ResourceInsert = Database['public']['Tables']['table']['Insert'];
type ResourceUpdate = Database['public']['Tables']['table']['Update'];
```

**SIEMPRE:**
- Usar tipos generados desde `src/types/database.ts`
- Actualizar tipos cuando cambia schema
- Tipar parámetros y retornos de funciones

### Convenciones de Campos Database

**Naming:**
- snake_case para todo (tablas y columnas)
- Fechas: `date_created`, `date_modified`, `date_completed`, `date_paid`
- Booleanos: `featured`, `on_sale`, `correo_enviado`, `pago_completo`
- Foreign Keys: `[table]_id` (customer_id, product_id, user_id)
- URLs: `*_url` (collage_image_url, url_rut_anverso, new_pdf_on_hold_url)
- Calculados: `calculated_*` (calculated_subtotal, calculated_iva, calculated_total)
- Company: `empresa_*` o `company_*` (empresa_nombre, company_rut)
- Order metadata: `order_*` (order_proyecto, order_fecha_inicio)
- Billing: `billing_*` (billing_first_name, billing_address_1)

**Campos Comunes:**
- `created_at`: timestamp de creación
- `updated_at`: timestamp de última actualización
- `status`: estado del recurso
- `id`: primary key numérica

### Relaciones

```
auth.users → user_profiles → orders → order_items → products
                  ↓              ↓
            coupon_usage    shipping_methods
                  ↓
              coupons
```

## 📛 Naming Conventions

### Archivos y Componentes

- **Componentes React**: PascalCase
  - `UserTableView.tsx`, `CreateOrderForm.tsx`, `OrderStatusManager.tsx`
- **Sufijos de componentes**:
  - `*Dialog.tsx` - Modales
  - `*Form.tsx` - Formularios
  - `*Dashboard.tsx` - Containers
  - `*Card.tsx` - Display components
  - `*Selector.tsx` - Selection components
  - `*Table.tsx` - Tables

- **Services**: camelCase + sufijo Service
  - `userService.ts`, `orderService.ts`, `productService.ts`

- **API Routes**: kebab-case
  - `/api/orders/check-conflicts`, `/api/products/by-category`

- **Utilities**: camelCase
  - `userUtils.ts`, `dateHelpers.ts`, `apiClient.ts`

### Código

- **Variables/Funciones**: camelCase descriptivo
  - `calculateCompletionPercentage()`, `enhanceUser()`, `formatDate()`

- **Booleanos**: prefijos is/has/should
  - `hasContract`, `isAdmin`, `hasAcceptedTerms`, `isExtended`

- **Callbacks**: prefijo on
  - `onUserUpdated`, `onOrderCreated`, `onFiltersChange`

- **Constantes**: UPPER_SNAKE_CASE
  - `CACHE_TTL`, `IVA_RATE`, `MAX_FILE_SIZE`

- **Database**: snake_case
  - Tablas: `user_profiles`, `order_items`, `shipping_methods`
  - Columnas: `date_created`, `customer_id`, `calculated_total`

## 💼 Business Logic Específico

### Órdenes - Estados y Flujo

**Estados válidos:**
- `pending` - Orden creada, esperando pago
- `processing` - Pagada, en preparación
- `on-hold` - Pausada temporalmente
- `completed` - Completada y cerrada
- `cancelled` - Cancelada

**Flujo típico:**
```
pending → processing → completed
   ↓           ↓
cancelled   on-hold → processing
```

**Cálculos Financieros:**
- Subtotal: suma de line_items (price × quantity)
- Descuento: aplicar cupón si existe
- IVA: 19% sobre subtotal - descuento (si apply_iva = true)
- Shipping: según shipping_method seleccionado
- Total: subtotal - descuento + IVA + shipping

**Campos calculated_*:**
- `calculated_subtotal` - Antes de descuentos e impuestos
- `calculated_discount` - Valor del descuento aplicado
- `calculated_iva` - 19% sobre base imponible
- `calculated_total` - Total final a pagar

**Metadata de Proyecto:**
- `order_proyecto` - Nombre/descripción del proyecto
- `order_fecha_inicio` - Fecha inicio alquiler (ISO 8601)
- `order_fecha_termino` - Fecha fin alquiler (ISO 8601)
- `num_jornadas` - Número de días de alquiler
- `company_rut` - RUT de empresa (formato chileno)

**Documentos:**
- Presupuesto PDF (generado al crear orden)
- Contrato PDF (generado cuando cliente acepta)
- Orden de compra (upload por cliente)
- Factura (número asignado por admin)
- Fotos de garantía (JSON array de URLs)

### Productos

**Stock Status:**
- `instock` - Disponible
- `outofstock` - No disponible
- `onbackorder` - Bajo pedido

**Pricing:**
- `price` - Precio actual (el que se muestra)
- `regular_price` - Precio regular
- `sale_price` - Precio en oferta (si existe)
- `on_sale` - Booleano (derived: sale_price existe)

**Imágenes:**
- JSON array: `[{ id, src, alt }]`
- `collage_image_url` - Imagen principal para collages

**Categorías:**
- Jerarquía via campo `parent`
- `categories_ids` - JSON array de IDs

### Cupones

**Tipos de descuento:**
- `percent` - Porcentaje (ej: 10 = 10%)
- `fixed_cart` - Monto fijo (ej: 5000 = $5000)

**Validaciones:**
- `minimum_amount` - Monto mínimo del carrito
- `maximum_amount` - Monto máximo de descuento
- `usage_limit` - Usos totales permitidos
- `usage_limit_per_user` - Usos por usuario
- `individual_use` - No combinable con otros cupones
- `exclude_sale_items` - No aplica a productos en oferta

**Tracking:**
- `usage_count` - Contador de usos
- Tabla `coupon_usage` - Audit trail (coupon_id, user_id, order_id, used_at, discount_amount)

### Contexto Chileno

**RUT (Rol Único Tributario):**
- Campos: `rut`, `empresa_rut`, `company_rut`
- Formato: 12.345.678-9
- Validar formato si es necesario

**IVA:**
- Tasa: 19%
- Campo: `calculated_iva`
- Toggle: `apply_iva` (boolean en metadata)

**Documentos Legales:**
- Cédula de identidad (RUT): anverso y reverso
- RUT empresa (e-RUT)
- Firma digital
- Contratos
- Órdenes de compra
- Facturas

**Idioma:**
- UI en español
- Mensajes de error en español
- Comentarios de negocio en español
- Código en inglés (variables, funciones, etc.)

## ⚛️ Component Patterns

### Props Interfaces

**SIEMPRE definir interface para props:**
```typescript
interface ComponentProps {
  resource: ResourceType;
  onUpdate: (resource: ResourceType) => void;
  sessionToken: string;
  loading?: boolean;
}
```

**Callbacks:**
- Prefijo `on*`: onUserUpdated, onOrderCreated, onSuccess
- Incluir tipo de dato que pasan: `(data: Type) => void`
- Opcional si no siempre se usa: `onSuccess?: () => void`

### State Management

**SIEMPRE usar hooks nativos de React:**
- `useState` para estado local
- `useEffect` para side effects
- `useCallback` para memoización (si es necesario)

**NO usar:**
- Redux
- Zustand
- Otros state managers globales

**Pattern:**
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [data, setData] = useState<Type[]>([]);
```

### Form Handling

**Dos approaches:**

1. **Estado manual** (formularios simples):
```typescript
const [formData, setFormData] = useState<FormType>({ ... });

const handleInputChange = (field: keyof FormType, value: any) => {
  setFormData(prev => ({ ...prev, [field]: value }));
};
```

2. **react-hook-form + Zod** (formularios complejos):
```typescript
const schema = z.object({
  field: z.string().min(1, 'Requerido'),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
  defaultValues: { ... }
});
```

**Validación:**
- En submit handler (manual)
- Con Zod schemas (react-hook-form)
- Mostrar errores con toast (Sonner)

### UI Patterns con shadcn/ui

**Dialog** - Modales:
- Controlled: `<Dialog open={open} onOpenChange={setOpen}>`
- Trigger, Content, Header, Footer
- Max height con scroll: `max-h-[90vh] overflow-y-auto`

**Sheet** - Paneles laterales:
- Para formularios extensos
- `<Sheet open={isOpen} onOpenChange={setIsOpen}>`
- Width responsive: `w-[95vw] sm:max-w-2xl`

**Table** - Listados:
- Table, TableHeader, TableBody, TableRow, TableCell
- Actions en última columna (text-right)

**Card** - Secciones:
- CardHeader con CardTitle y CardDescription
- CardContent con contenido
- CardFooter para actions

**Badge** - Estados:
- Colores dinámicos según status
- Clases tailwind custom

**Tabs** - Organización:
- TabsList con TabsTrigger
- TabsContent para cada tab
- defaultValue para tab inicial

### Data Fetching

**SIEMPRE usar fetch nativo:**
```typescript
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(data)
});
```

**Auth headers:**
- Extraer de cookies: `document.cookie`
- O de sessionData si disponible
- O de Supabase session como fallback

**Error handling:**
```typescript
try {
  setLoading(true);
  const response = await fetch(...);

  if (!response.ok) throw new Error(`Error: ${response.status}`);

  const data = await response.json();

  if (data.success) {
    toast.success('Operación exitosa');
    onSuccess();
  } else {
    toast.error(data.error || 'Error desconocido');
  }
} catch (err) {
  toast.error(err instanceof Error ? err.message : 'Error');
} finally {
  setLoading(false);
}
```

### Loading & Empty States

**SIEMPRE incluir:**
- Loading state visual (Loader2 icon animado)
- Empty state cuando no hay datos
- Error state si falla carga

## 🛡️ Development Rules

### SIEMPRE

- ✅ Validar entrada de usuario antes de procesar
- ✅ Loggear errores con contexto (userId, endpoint, timestamp)
- ✅ Usar tipos de TypeScript para todo
- ✅ Mantener separación: Services (lógica) / Components (UI) / API (endpoints)
- ✅ Incluir loading y error states en componentes
- ✅ Seguir naming conventions establecidas
- ✅ Comentar en español para contexto de negocio chileno
- ✅ Usar Edit tool para modificar archivos existentes
- ✅ Leer archivos antes de modificarlos
- ✅ Delegar DB operations a Services
- ✅ Usar withAuth middleware para endpoints protegidos
- ✅ Retornar status codes HTTP apropiados
- ✅ Mensajes de error user-friendly en español

### NUNCA

- ❌ Queries Supabase directamente en endpoints (usar Services)
- ❌ Exponer detalles de errores internos al cliente
- ❌ Usar emojis en código (salvo logs de desarrollo)
- ❌ Crear archivos .md sin solicitud explícita
- ❌ Modificar git config o force push sin permiso
- ❌ Usar Redux/Zustand (hooks nativos solamente)
- ❌ Hardcodear valores que deberían estar en env
- ❌ Ignorar validación de entrada
- ❌ Retornar errores sin logging
- ❌ Usar axios u otras libs HTTP (usar fetch nativo)

### PREFERIR

- ⭐ Edit sobre Write para archivos existentes
- ⭐ Múltiples tool calls en paralelo cuando sea posible
- ⭐ Explore agent para búsquedas complejas de código
- ⭐ Validación con Zod para formularios críticos
- ⭐ Type-safe todo (interfaces, types, generics)
- ⭐ Código autodocumentado sobre comentarios excesivos
- ⭐ Composición sobre herencia
- ⭐ Inmutabilidad (spread operator para updates)

### Seguridad

**SIEMPRE validar y sanitizar:**
- IDs numéricos
- Emails (formato válido)
- Fechas (formato ISO 8601)
- Archivos upload (tipo, tamaño)
- Inputs de texto (no SQL injection, no XSS)

**Autenticación:**
- Verificar token JWT válido
- Verificar usuario en admin_users
- Verificar permisos/rol si es necesario
- NUNCA confiar en datos del cliente sin validar

**Secrets:**
- NUNCA hardcodear API keys
- Usar variables de entorno
- NO commitear .env files

## 📁 Critical Files Reference

### Configuración
- [astro.config.mjs](astro.config.mjs) - Config Astro + Vercel adapter
- [tailwind.config.mjs](tailwind.config.mjs) - Tema UI
- [tsconfig.json](tsconfig.json) - TypeScript + path aliases (@/*)
- [vercel.json](vercel.json) - CORS headers + deploy config

### Core Services
- [src/services/authService.ts](src/services/authService.ts) - Autenticación
- [src/services/orderService.ts](src/services/orderService.ts) - Lógica órdenes
- [src/services/productService.ts](src/services/productService.ts) - Lógica productos
- [src/services/couponService.ts](src/services/couponService.ts) - Cupones
- [src/services/userService.ts](src/services/userService.ts) - Usuarios
- [src/services/categoryService.ts](src/services/categoryService.ts) - Categorías

### Utilities
- [src/lib/supabase.ts](src/lib/supabase.ts) - Cliente Supabase
- [src/lib/errorHandler.ts](src/lib/errorHandler.ts) - Error handling
- [src/lib/logger.ts](src/lib/logger.ts) - Logging
- [src/lib/authService.ts](src/lib/authService.ts) - Auth utilities

### Types & Middleware
- [src/types/database.ts](src/types/database.ts) - Supabase schema (auto-generado)
- [src/middleware/auth.ts](src/middleware/auth.ts) - Auth middleware
- [src/middleware/index.ts](src/middleware/index.ts) - Global middleware

### UI Core
- [src/components/ui/](src/components/ui/) - shadcn/ui components
- [src/components/DashboardContainer.tsx](src/components/DashboardContainer.tsx) - Main container

### API Routes
- [src/pages/api/](src/pages/api/) - Todos los endpoints REST
  - [auth/](src/pages/api/auth/) - Login, logout, session
  - [orders/](src/pages/api/orders/) - Gestión órdenes
  - [products/](src/pages/api/products/) - Gestión productos
  - [users/](src/pages/api/users/) - Gestión usuarios
  - [coupons/](src/pages/api/coupons/) - Cupones
  - [categories/](src/pages/api/categories/) - Categorías

---

**Última actualización**: 2025-12-28
**Versión**: 1.0.0
