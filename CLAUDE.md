# Dashboard — Mario Hans Rental Fotográfico

Panel de administración para gestionar todo el negocio del rental.
Ver contexto general del sistema en `../CLAUDE.md`.

## Identidad del Proyecto

- **Framework**: Astro 5.9 (SSR, `output: "server"`) + React 18.3 (islands `client:load`)
- **UI**: Tailwind CSS 3 + shadcn/ui (new-york, zinc) + Radix UI + Lucide icons
- **Database**: Supabase (PostgreSQL) via `supabaseAdmin` (service role, bypassa RLS)
- **Auth**: Supabase Auth + tabla `admin_users` + cookies HTTP-only (30 días)
- **PDFs**: `@react-pdf/renderer` (componentes React) + templates Astro para Puppeteer
- **Email**: Resend API (`mail.mariohans.cl`)
- **Charts**: Recharts
- **Deploy**: Vercel (serverless) — `@astrojs/vercel`
- **TypeScript**: `strictest` config, path alias `@/*` → `./src/*`

---

## Arquitectura (MVC-like con Service Layer)

```
Astro Page (SSR data fetch)
    ↓ props
React Component (client:load)
    ↓ fetch
API Route (/api/*)
    ↓ delegates
Service (business logic)
    ↓ queries
Supabase (PostgreSQL)
```

**Middleware global** (`src/middleware/index.ts`): CORS para `/api/*`, admin auth para rutas protegidas.

---

## Estructura de Directorios

```
src/
  components/
    ui/           # shadcn/ui primitives (30+ componentes)
    orders/       # Gestión completa de órdenes
    products/     # Catálogo de productos y categorías
    users/        # Gestión de usuarios (card/table view, filtros, paginación)
    analytics/    # KPI cards, gráficos
    coupons/      # Cupones de descuento
    shipping/     # Métodos de envío
    payments/     # Tabla de pagos
  pages/
    api/          # 50+ endpoints REST agrupados por dominio
    budget-pdf/   # Template Astro → PDF presupuesto
    order-pdf/    # Template Astro → PDF orden
    contract-pdf/ # Template Astro → PDF contrato
  services/       # 18 service classes (orderService, productService, etc.)
  lib/
    supabase.ts   # Clientes Supabase (admin + anon)
    pdf/          # Sistema PDF con @react-pdf/renderer
    emailService.ts
    budgetGenerationService.ts
  middleware/
    index.ts      # Auth + CORS global
    auth.ts       # withAuth, withCors, withMiddleware HOFs
  types/
    database.ts   # Schema Supabase (auto-generado, NO modificar a mano)
    order.ts      # Tipos Order, LineItem
    product.ts    # Tipos Product, ProductCategory
    user.ts       # Tipos UserProfile, EnhancedUser
```

---

## Patrón de API Routes

**Formato de respuesta** (siempre):
```typescript
{ success: true, data: any, message?: string }   // éxito
{ success: false, error: string, code?: string }  // error
```

**Estructura de un endpoint**:
```typescript
export const POST: APIRoute = withAuth(async ({ request, locals }) => {
  // 1. Validar parámetros
  const body = await request.json();
  if (!body.required_field) {
    return new Response(JSON.stringify({ success: false, error: 'Campo requerido' }), { status: 400 });
  }
  // 2. Llamar a Service (nunca queries directas aquí)
  try {
    const result = await SomeService.doWork(body);
    return new Response(JSON.stringify({ success: true, data: result }), { status: 201 });
  } catch (error) {
    console.error('[Endpoint] Error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500 });
  }
});
```

Ver patrones completos: `.claude/rules/01-api-patterns.md`

---

## Sistema de PDFs

**Dos sistemas distintos**:

1. **`@react-pdf/renderer`** — Componentes React que generan PDF directamente
   - Ubicación: `src/lib/pdf/` (core, components, utils)
   - Documentos: Budget (presupuesto), Contract (contrato), Processing (orden)

2. **Templates Astro + Puppeteer** — HTML → PDF via headless Chrome
   - Templates: `src/pages/{budget-pdf,order-pdf,contract-pdf}/[id].astro`
   - Servicio: `src/lib/pdfService.ts`
   - Workflow: datos → template Astro → HTML → Puppeteer → PDF → R2 → URL en DB → email

**No modificar sin revisión**: `src/lib/pdfService.ts`, `src/lib/budgetGenerationService.ts`

---

## Sistema de Emails (Resend)

```
presupuestos@mail.mariohans.cl  → al generar presupuesto (on-hold)
contratos@mail.mariohans.cl     → al generar contrato de usuario
admin@mail.mariohans.cl         → notificaciones internas
```

Templates: `src/templates/emails/` y `src/templates/`
Servicios: `src/lib/emailService.ts`, `src/lib/emailTemplateService.ts`

---

## Archivos Críticos (No Modificar Sin Revisión)

| Archivo | Razón |
|---------|-------|
| `src/lib/pdfService.ts` | PDF optimizado para Vercel (timeouts 7-8s) |
| `src/lib/budgetGenerationService.ts` | Workflow completo de presupuestos |
| `src/lib/emailService.ts` | Sistema de emails con fallback |
| `src/middleware/index.ts` | Autenticación y CORS global |
| `src/types/database.ts` | Schema auto-generado de Supabase |
| `src/lib/supabase.ts` | Clientes Supabase (admin + anon) |

---

## Variables de Entorno

```env
SUPABASE_URL=                    # URL del proyecto Supabase
SUPABASE_ANON_KEY=               # Clave pública anon
SUPABASE_SERVICE_ROLE_KEY=       # Clave service role (solo servidor)
PUBLIC_SITE_URL=                 # https://dashboard.mariohans.cl
PUBLIC_FRONTEND_URL=             # https://rental.mariohans.cl
ALLOWED_ORIGINS=                 # CORS origins permitidos
JWT_SECRET=                      # Secreto para JWT
RESEND_API_KEY=                  # API key de Resend
PUBLIC_EMAIL_DOMAIN=             # mail.mariohans.cl
PUBLIC_CLOUDFLARE_WORKER_URL=    # Worker de R2 para uploads
GOOGLE_CALENDAR_ID=              # ID del calendario de Google
WHATSAPP_API_TOKEN=              # Meta Cloud API token
```

---

## Comandos

```bash
cd dashboard
npm install
npm run dev      # localhost:4321
npm run build    # build para Vercel
npm run preview  # preview del build
```

---

## Rules Detalladas

- `.claude/rules/01-api-patterns.md` — Estructura API, responses, status codes, middleware
- `.claude/rules/02-services-and-data.md` — Service layer, Supabase queries, tipos
- `.claude/rules/03-components-and-ui.md` — React 18, shadcn/ui, state, forms
- `.claude/rules/04-pdf-and-email.md` — PDFs (Puppeteer + react-pdf), emails, warranty photos
- `.claude/rules/05-deployment.md` — Vercel, build, env vars
