# PDF y Email — Dashboard

## Sistema de PDFs: Un Solo Enfoque

### @react-pdf/renderer (Componentes React → PDF)

Todos los PDFs se generan server-side, en proceso, como Response. No hay una segunda vía.

```typescript
// src/lib/pdf/core/pdfService.ts
import { renderToBuffer } from '@react-pdf/renderer';
import { BudgetDocument } from '@/lib/pdf/components/budget/BudgetDocument';

async function generateBudgetPdf(orderData: Order): Promise<Buffer> {
  const buffer = await renderToBuffer(<BudgetDocument order={orderData} />);
  return buffer;
}
```

**Estructura del sistema PDF**:
```
src/lib/pdf/
  core/
    pdfService.ts       # Servicio principal de generación
    fonts.ts            # Carga de fuentes custom
    types.ts            # Tipos para PDF
  components/
    budget/BudgetDocument.tsx      # Presupuesto
    contract/ContractDocument.tsx  # Contrato
    contract/UserContractDocument.tsx  # Contrato de usuario
    processing/ProcessingDocument.tsx  # Orden de procesamiento
    common/
      Header.tsx         # Header compartido
      CompanyInfo.tsx    # Info de la empresa
      InfoRow.tsx        # Fila de datos
  utils/
    calculations.ts     # Cálculos financieros para PDF
    formatters.ts       # Formateo de fechas, moneda
    styles.ts           # Estilos base para PDF
    svgToReactPdf.ts    # Conversión SVG → react-pdf
```

### Flujo completo

```
Trigger (cambio de estado) → API Route → generatePdfBuffer(<Documento />)
    ↓
PDF Buffer → Cloudflare R2 (/upload-pdf-only)
    ↓
Actualizar orden en DB (new_pdf_on_hold_url / new_pdf_processing_url)
    ↓
Enviar email con PDF adjunto (Resend)
```

Las cinco rutas que generan PDF (`/api/order/generate-budget-pdf`,
`/api/order/generate-processing-pdf`, `/api/order/generate-contract-pdf`,
`/api/contracts/generate-pdf`, `/api/budget/generate-pdf`) importan todas
`generatePdfBuffer` de `src/lib/pdf/core/pdfService.ts` y su componente React
correspondiente. Ninguna hace fetch de una página Astro.

### NO existe un pipeline Puppeteer

No hay `puppeteer`, `@sparticuz/chromium` ni `playwright` en `package.json`, y **no existe
`src/lib/pdfService.ts`** (el servicio real es `src/lib/pdf/core/pdfService.ts`). Documentación
previa describía un pipeline "template Astro → HTML → headless Chrome" que este código nunca
tuvo; se corrigió el 2026-08-18.

### Las páginas Astro son vistas para humanos, no destinos de render

- `src/pages/budget-pdf/[orderId].astro` — vista del presupuesto
- `src/pages/order-pdf/[orderId].astro` — vista de la orden de procesamiento
- `src/pages/contract-pdf/[userId].astro` — vista del contrato de usuario

Se abren desde el enlace que `api/order/generate-budget-pdf.ts` incluye en el email al cliente.
**Requieren sesión y verifican propiedad** vía `src/lib/pdfPageAuth.ts`; ningún proceso interno
las visita, así que no necesitan (ni deben tener) ninguna vía de acceso por header o secreto.

**Archivos críticos** (no modificar sin revisión):
- `src/lib/pdf/core/pdfService.ts` — `generatePdfBuffer`, render con `renderToBuffer`
- `src/lib/budgetGenerationService.ts` — Workflow completo budget

**Timeout**: Vercel limita la ejecución de la función serverless, así que la generación debe
mantenerse rápida. No hay `maxDuration` configurado en el proyecto.

---

## Cuándo Se Genera Cada PDF

| PDF | Trigger | Endpoint | Campo en DB |
|-----|---------|----------|-------------|
| Presupuesto | Estado cambia a `on-hold` | `POST /api/order/generate-budget-pdf` | `new_pdf_on_hold_url` |
| Orden procesamiento | Estado cambia a `processing` | `POST /api/order/generate-processing-pdf` | `new_pdf_processing_url` |
| Contrato usuario | Usuario completa perfil + firma | `POST /api/contracts/generate-pdf` | `user_profiles.url_user_contrato` |

---

## Sistema de Emails (Resend)

```typescript
// src/lib/emailService.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBudgetEmail(to: string, orderData: Order, pdfUrl: string) {
  const { data, error } = await resend.emails.send({
    from: 'presupuestos@mail.mariohans.cl',
    to: [to],
    cc: ['rental.mariohans@gmail.com'], // SIEMPRE copia a admin
    subject: `Presupuesto Mario Hans Rental #${orderData.id}`,
    html: budgetEmailTemplate(orderData, pdfUrl),
    attachments: [{
      filename: `presupuesto-${orderData.id}.pdf`,
      path: pdfUrl,
    }],
  });

  if (error) {
    console.error('[Email] Error enviando presupuesto:', { to, orderId: orderData.id, error });
    // Implementar fallback (ej: guardar en cola para reintento)
    throw error;
  }
}
```

**Direcciones de email**:
| Propósito | Dirección |
|-----------|-----------|
| Presupuestos | `presupuestos@mail.mariohans.cl` |
| Contratos | `contratos@mail.mariohans.cl` |
| Admin / Notificaciones | `admin@mail.mariohans.cl` |
| Backup | `rental.mariohans@gmail.com` |

**Tipos de email**:
| Tipo | Template | Cuándo |
|------|----------|--------|
| Presupuesto generado | `src/templates/emails/budget-generated.html` | on-hold |
| Contrato generado | `src/templates/emails/contract-completed.html` | contrato firmado |
| Orden completada | `src/templates/order-completed.html` | completed |
| Orden fallida (cliente) | `src/templates/order-failed.html` | failed |
| Orden fallida (admin) | `src/templates/order-failed-admin.html` | failed |

**Regla crítica**: Todos los emails deben tener:
1. Fallback en caso de error (log + retry o notificación manual)
2. Copia a admin (`rental.mariohans@gmail.com`)
3. Manejo de errores con logging completo

---

## Fotos de Garantía (Warranty Photos)

Documentan el estado del equipo antes/después del arriendo.

```typescript
// src/services/warrantyImageService.ts
// Límites: máx 10 fotos por orden, 5MB por foto, JPEG/PNG/WebP

async function uploadWarrantyPhoto(orderId: number, file: File): Promise<string> {
  // 1. Validar tamaño y tipo
  if (file.size > 5 * 1024 * 1024) throw new Error('Foto excede 5MB');

  // 2. Convertir a WebP (85% calidad, máx 1920px)
  const optimized = await optimizeToWebP(file);

  // 3. Subir a R2
  const formData = new FormData();
  formData.append('file', optimized, `warranty-${orderId}-${Date.now()}.webp`);
  const { url } = await uploadToR2('/upload-warranty-photos', formData);

  // 4. Actualizar DB
  await OrderService.addWarrantyPhoto(orderId, url);
  return url;
}
```

**Componente**: `src/components/orders/WarrantyImageUpload.tsx`
**Almacenamiento en DB**: `orders.fotos_garantia` (JSON array de URLs)

---

## Notificaciones WhatsApp (Meta Cloud API)

Variables de entorno para WhatsApp Business:
```env
WHATSAPP_API_TOKEN=         # Meta Cloud API token
WHATSAPP_PHONE_NUMBER_ID=   # ID del número de WhatsApp Business
WHATSAPP_ENABLED=true
WHATSAPP_SEND_TO_ADMIN=true
WHATSAPP_ADMIN_PHONE=       # +56XXXXXXXXX
```

Actualmente usado para notificaciones internas al admin.
