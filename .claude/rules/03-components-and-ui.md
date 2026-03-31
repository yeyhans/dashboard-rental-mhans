# Componentes y UI — Dashboard (React 18 + shadcn/ui)

## Patrón Astro Page → React Component

```astro
---
// src/pages/orders/index.astro
import { getServerAdmin } from '@/lib/supabase';
import { OrderService } from '@/services/orderService';
import OrdersDashboard from '@/components/orders/OrdersDashboard';
import Base from '@/layout/Base.astro';

const adminUser = await getServerAdmin(Astro);
if (!adminUser) return Astro.redirect('/');

const initialData = await OrderService.getAll(1, 20);
---
<Base title="Órdenes">
  <OrdersDashboard
    initialData={initialData}
    sessionToken={adminUser.token}
    client:load
  />
</Base>
```

El Astro page hace el fetch server-side y pasa datos como props al React component.
React component maneja la interactividad client-side.

---

## Estructura de Props

```typescript
// SIEMPRE definir interface para props
interface OrdersDashboardProps {
  initialData: { orders: Order[]; total: number; page: number };
  sessionToken: string;
  onOrderCreated?: (order: Order) => void;  // opcional
  loading?: boolean;                         // opcional
}

function OrdersDashboard({ initialData, sessionToken }: OrdersDashboardProps) {
  // ...
}
```

---

## State Management (solo hooks nativos)

```typescript
// BIEN: hooks de React
const [orders, setOrders] = useState<Order[]>(initialData.orders);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
const [filters, setFilters] = useState<OrderFilters>({ status: '', page: 1 });

// MAL: NO usar Redux, Zustand, Jotai, etc.
```

---

## Forms: Estado Manual vs react-hook-form

**Estado manual** (formularios simples, 2-4 campos):
```typescript
const [formData, setFormData] = useState({ nombre: '', email: '' });

const handleChange = (field: string, value: string) => {
  setFormData(prev => ({ ...prev, [field]: value }));
};
```

**react-hook-form + Zod** (formularios complejos, con validación):
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  nombre: z.string().min(2, 'Nombre muy corto'),
  email: z.string().email('Email inválido'),
  rut: z.string().regex(/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/, 'RUT inválido'),
});

const { register, handleSubmit, formState: { errors }, reset } = useForm({
  resolver: zodResolver(schema),
  defaultValues: { nombre: '', email: '', rut: '' }
});
```

---

## Patrones shadcn/ui

### Dialog (Modales)
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader>
      <DialogTitle>Crear Orden</DialogTitle>
      <DialogDescription>Completa los datos del arriendo</DialogDescription>
    </DialogHeader>
    {/* contenido */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      <Button onClick={handleSubmit}>Guardar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Sheet (Paneles laterales para formularios largos)
```tsx
<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent className="w-[95vw] sm:max-w-2xl overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Editar Producto</SheetTitle>
    </SheetHeader>
    {/* formulario */}
  </SheetContent>
</Sheet>
```

### Table
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Cliente</TableHead>
      <TableHead>Estado</TableHead>
      <TableHead className="text-right">Acciones</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {orders.map(order => (
      <TableRow key={order.id}>
        <TableCell>{order.customer_name}</TableCell>
        <TableCell><OrderStatusBadge status={order.status} /></TableCell>
        <TableCell className="text-right">
          <Button size="sm" variant="ghost" onClick={() => handleEdit(order)}>
            Editar
          </Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Card
```tsx
<Card>
  <CardHeader>
    <CardTitle>Órdenes del Mes</CardTitle>
    <CardDescription>Comparado con el mes anterior</CardDescription>
  </CardHeader>
  <CardContent>
    {/* contenido */}
  </CardContent>
  <CardFooter className="justify-between">
    <span className="text-muted-foreground text-sm">Actualizado hace 5 min</span>
    <Button variant="outline" size="sm">Ver todas</Button>
  </CardFooter>
</Card>
```

### Badge (estados de órdenes)
```tsx
const statusColors: Record<string, string> = {
  'on-hold': 'bg-yellow-100 text-yellow-800',
  'processing': 'bg-blue-100 text-blue-800',
  'completed': 'bg-green-100 text-green-800',
  'failed': 'bg-red-100 text-red-800',
  'paid': 'bg-emerald-100 text-emerald-800',
};

<Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
  {order.status}
</Badge>
```

### Tabs
```tsx
<Tabs defaultValue="general">
  <TabsList>
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="pagos">Pagos</TabsTrigger>
    <TabsTrigger value="documentos">Documentos</TabsTrigger>
  </TabsList>
  <TabsContent value="general">{/* ... */}</TabsContent>
  <TabsContent value="pagos">{/* ... */}</TabsContent>
  <TabsContent value="documentos">{/* ... */}</TabsContent>
</Tabs>
```

---

## Loading, Empty y Error States

```tsx
// SIEMPRE incluir los tres estados
function OrdersList({ sessionToken }: Props) {
  const [state, setState] = useState<'loading' | 'empty' | 'error' | 'data'>('loading');

  if (state === 'loading') {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error al cargar las órdenes</p>
        <Button variant="outline" className="mt-4" onClick={retry}>Reintentar</Button>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p>No hay órdenes todavía</p>
        <Button className="mt-4" onClick={() => setCreateOpen(true)}>Crear primera orden</Button>
      </div>
    );
  }

  return <OrdersTable orders={orders} />;
}
```

---

## Toasts con Sonner

```typescript
import { toast } from 'sonner';

toast.success('Orden creada exitosamente');
toast.error('Error al actualizar la orden');
toast.info('Procesando...');
toast.warning('Recuerda coordinar el retiro');

// Con descripción
toast.success('PDF generado', {
  description: 'El presupuesto fue enviado al cliente'
});
```

---

## Nombres de Componentes (Sufijos)

| Sufijo | Tipo | Ejemplo |
|--------|------|---------|
| `*Dialog` | Modales | `CreateOrderDialog.tsx` |
| `*Form` | Formularios | `EditProductForm.tsx` |
| `*Dashboard` | Containers | `OrdersDashboard.tsx` |
| `*Card` | Tarjetas display | `OrderSummaryCard.tsx` |
| `*Selector` | Selección | `ProductSelector.tsx` |
| `*Table` | Tablas | `PaymentsTable.tsx` |
| `*View` | Variantes display | `UserCardView.tsx`, `UserTableView.tsx` |
| `*Stats` | Estadísticas | `OrderSummaryStats.tsx` |
