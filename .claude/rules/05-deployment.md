# Deployment — Dashboard (Vercel)

## Stack de Deploy

- **Plataforma**: Vercel (serverless)
- **Adapter**: `@astrojs/vercel` (output: server)
- **Dominio**: `dashboard-rental-mhans.vercel.app` (dev) / `dashboard.mariohans.cl` (prod)
- **Config**: `vercel.json` — CORS headers para todas las rutas `/api/*`

---

## Variables de Entorno Requeridas

```env
# Supabase (obligatorias)
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...   # NUNCA exponer al cliente

# URLs
PUBLIC_SITE_URL=https://dashboard.mariohans.cl
PUBLIC_FRONTEND_URL=https://rental.mariohans.cl
ALLOWED_ORIGINS=https://rental.mariohans.cl,https://dashboard.mariohans.cl

# Seguridad
JWT_SECRET=una-clave-secreta-larga

# Email (Resend)
RESEND_API_KEY=re_xxxx
PUBLIC_EMAIL_DOMAIN=mail.mariohans.cl

# Storage (Cloudflare R2)
PUBLIC_CLOUDFLARE_WORKER_URL=https://workers.mariohans.cl

# Google Calendar (opcional)
GOOGLE_CALENDAR_ID=
GOOGLE_SERVICE_ACCOUNT_KEY=   # JSON completo del service account
# O alternativamente:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=

# WhatsApp Business (Meta Cloud API) (opcional)
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ENABLED=false
WHATSAPP_SEND_TO_ADMIN=false
WHATSAPP_ADMIN_PHONE=

# Servidor
PORT=4321
NODE_ENV=production
```

Las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `NODE_ENV`, `PUBLIC_FRONTEND_URL`, `ALLOWED_ORIGINS`, `JWT_SECRET` son **validadas en startup** por el schema de env en `astro.config.mjs`.

---

## Comandos

```bash
cd dashboard

# Desarrollo local
npm install
npm run dev              # localhost:4321 con hot reload

# Verificar TypeScript
npx astro check          # Type check de archivos .astro

# Build y preview
npm run build            # genera dist/ para Vercel
npm run preview          # preview del build localmente

# Formatear código
npm run format           # Prettier con plugin astro
```

---

## Configuración CORS (`vercel.json`)

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "https://rental.mariohans.cl" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, DELETE, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" }
      ]
    }
  ]
}
```

**Nota**: El middleware global (`src/middleware/index.ts`) también maneja CORS dinámicamente según `ALLOWED_ORIGINS`. No duplicar headers CORS en endpoints individuales.

---

## Archivos Críticos (No Modificar Sin Revisión)

| Archivo | Razón | Riesgo si se rompe |
|---------|-------|--------------------|
| `src/lib/pdfService.ts` | Puppeteer optimizado para Vercel serverless (timeouts 7-8s, flags específicos) | PDFs no se generan |
| `src/lib/budgetGenerationService.ts` | Workflow completo presupuesto: PDF + R2 + DB + email | Presupuestos no funcionan |
| `src/lib/emailService.ts` | Sistema emails con fallback y copias admin | Emails no se envían |
| `src/middleware/index.ts` | Auth + CORS para toda la app | Acceso sin auth a todo |
| `src/types/database.ts` | Schema auto-generado de Supabase (NO editar a mano) | Tipos rotos en toda la app |
| `astro.config.mjs` | Config Vercel adapter + env schema validation | App no buildea |

---

## Supabase Migrations

```bash
# Ver migraciones
ls supabase/migrations/

# Aplicar nueva migración
npx supabase db push

# Generar tipos después de cambios al schema
npx supabase gen types typescript --local > src/types/database.ts
```

Migración existente: `supabase/migrations/20260203_admin_create_user_profile.sql`
Crea función `admin_create_user_profile()` que bypassa RLS para crear perfiles desde el admin.

---

## Proceso de Deploy a Vercel

1. Push a rama main (o PR merge)
2. GitHub Actions / Vercel auto-deploy detecta cambios
3. Vercel ejecuta `npm run build` (`astro build`)
4. Se genera `dist/` con la función serverless
5. Variables de entorno se aplican desde el dashboard de Vercel
6. Health check: `GET /api/health` debe retornar 200
