# Services y Datos — Dashboard

## Estructura de Service Class

```typescript
// src/services/orderService.ts
import { supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderUpdate = Database['public']['Tables']['orders']['Update'];

export class OrderService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) throw new Error('supabaseAdmin no está inicializado');
  }

  static async getAll(page = 1, limit = 20, filters?: OrderFilters) {
    OrderService.ensureSupabaseAdmin();
    const offset = (page - 1) * limit;
    const query = supabaseAdmin!
      .from('orders')
      .select('id, status, customer_id, calculated_total, date_created', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('date_created', { ascending: false });

    if (filters?.status) query.eq('status', filters.status);

    const { data, error, count } = await query;
    if (error) throw error;
    return { orders: data, total: count || 0, page, limit, totalPages: Math.ceil((count || 0) / limit) };
  }

  static async getById(id: number): Promise<Order | null> {
    OrderService.ensureSupabaseAdmin();
    const { data, error } = await supabaseAdmin!
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error?.code === 'PGRST116') return null; // Not found
    if (error) throw error;
    return data;
  }

  static async create(data: OrderInsert): Promise<Order> {
    OrderService.ensureSupabaseAdmin();
    const { data: order, error } = await supabaseAdmin!
      .from('orders')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return order;
  }

  static async update(id: number, data: OrderUpdate): Promise<Order> {
    OrderService.ensureSupabaseAdmin();
    const { data: order, error } = await supabaseAdmin!
      .from('orders')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return order;
  }

  static async delete(id: number): Promise<boolean> {
    OrderService.ensureSupabaseAdmin();
    const { error } = await supabaseAdmin!.from('orders').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}
```

---

## Clientes Supabase en el Dashboard

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// supabaseAdmin — service role, bypassa RLS, solo server-side
export const supabaseAdmin = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// supabase — anon key, para auth de usuarios
export const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
```

**Regla crítica**: `supabaseAdmin` NUNCA se expone al cliente. Solo en módulos server-side (services, API routes, middleware).

---

## Tipos TypeScript desde Supabase

```typescript
// Importar siempre desde src/types/database.ts (auto-generado)
import type { Database } from '@/types/database';

// Row = SELECT
type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

// Insert = INSERT (todos los campos opcionales excepto NOT NULL sin default)
type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];

// Update = UPDATE (todos los campos opcionales)
type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

// Tipos de funciones stored
type CreateUserProfileArgs = Database['public']['Functions']['create_user_profile_manual']['Args'];
```

**NO modificar** `src/types/database.ts` a mano. Se genera con: `npx supabase gen types typescript`.

---

## Servicio ApiClient (para componentes React)

```typescript
// src/services/apiClient.ts — singleton con token caching
import { ApiClient } from '@/services/apiClient';

const apiClient = ApiClient.getInstance();

// Hacer requests autenticados
const { data, success, error } = await apiClient.get('/api/orders?page=1&limit=20');
const { data: order } = await apiClient.post('/api/orders', orderData);
const { data: updated } = await apiClient.put(`/api/orders/${id}`, updateData);
await apiClient.delete(`/api/orders/${id}`);
```

El ApiClient maneja automáticamente: token de auth de cookies, headers JSON, error categorization.

---

## Servicios Existentes

```
src/services/
  apiClient.ts              # Cliente HTTP singleton para React components
  orderService.ts           # CRUD + workflow de órdenes
  productService.ts         # CRUD + stock + búsqueda
  userService.ts            # CRUD + stats + usuarios elegibles
  categoryService.ts        # CRUD + reordenamiento
  couponService.ts          # CRUD + validación + aplicación
  shippingService.ts        # CRUD de métodos de envío
  dashboardService.ts       # Stats agregadas del dashboard
  advancedAnalyticsService.ts # Analytics avanzados
  adminService.ts           # Gestión de usuarios admin
  communicationsService.ts  # Comunicaciones de órdenes
  manualEmailService.ts     # Emails manuales desde admin
  orderItemService.ts       # Items individuales de órdenes
  orderNotificationService.ts # Notificaciones de órdenes
  productImageService.ts    # Upload y gestión de imágenes
  warrantyImageService.ts   # Upload de fotos de garantía
  warrantyPhotosService.ts  # Gestión de fotos de garantía
  documentUploadService.ts  # Upload de documentos de usuario
  backendApiService.ts      # Cliente para llamadas externas
```

---

## Cálculos Financieros (en Services)

```typescript
// src/lib/pdf/utils/calculations.ts (referencia)
const IVA_RATE = 0.19;
const RESERVE_RATE = 0.25;

function calculateOrderTotals(lineItems: LineItem[], shippingTotal: number, discount: number, applyIva: boolean) {
  const subtotal = lineItems.reduce((sum, item) => sum + (item.price * item.quantity * item.dias), 0);
  const calculatedSubtotal = subtotal + shippingTotal - discount;
  const calculatedIva = applyIva ? calculatedSubtotal * IVA_RATE : 0;
  const calculatedTotal = calculatedSubtotal + calculatedIva;
  const reserve = calculatedTotal * RESERVE_RATE;

  return { subtotal, calculatedSubtotal, calculatedIva, calculatedTotal, reserve };
}
```

---

## Detección de Conflictos de Fechas

```typescript
// /api/orders/check-conflicts — verificar disponibilidad antes de crear orden
const conflictCheck = await fetch('/api/orders/check-conflicts', {
  method: 'POST',
  body: JSON.stringify({
    product_ids: [1, 2, 3],
    fecha_inicio: '2026-04-01',
    fecha_termino: '2026-04-03',
    exclude_order_id: null // para ediciones
  })
});
// Retorna: { success: true, data: { hasConflicts: boolean, conflicts: Order[] } }
```

---

## EnhancedUser (Tipo Especial de Usuario)

```typescript
// src/types/user.ts
interface EnhancedUser extends UserProfile {
  fullName: string;                // nombre + apellido
  completionPercentage: number;    // % de perfil completado
  registrationStatus: 'complete' | 'incomplete' | 'pending';
  hasContract: boolean;            // !!url_user_contrato
  hasSignature: boolean;           // !!url_firma
  hasRutDocuments: boolean;        // !!url_rut_anverso && !!url_rut_reverso
}

// Generado en userService.ts con enhanceUser(userProfile)
```
