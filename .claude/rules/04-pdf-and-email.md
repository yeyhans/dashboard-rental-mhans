# PDF y Email — Dashboard

## Sistema de PDFs: Dos Enfoques

### 1. @react-pdf/renderer (Componentes React → PDF)

Para documentos con diseño complejo que se generan server-side como Response.

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

### 2. Templates Astro + Puppeteer (HTML → PDF)

Para PDFs que se sirven desde URL pública y se suben a R2.

```
Trigger (cambio de estado) → API Route → budgetGenerationService.ts
    ↓
Fetch template: GET /budget-pdf/[orderId] (Astro page renderizada como HTML)
    ↓
Puppeteer + @sparticuz/chromium (optimizado para Vercel serverless)
    ↓
PDF Buffer → Cloudflare R2 (/upload-pdf-only)
    ↓
Actualizar orden en DB (new_pdf_on_hold_url / new_pdf_processing_url)
    ↓
Enviar email con PDF adjunto (Resend)
```

**Templates Astro**:
- `src/pages/budget-pdf/[orderId].astro` — Presupuesto
- `src/pages/order-pdf/[orderId].astro` — Orden de procesamiento
- `src/pages/contract-pdf/[userId].astro` — Contrato de usuario

**Archivos críticos** (no modificar sin revisión):
- `src/lib/pdfService.ts` — Puppeteer configurado para Vercel (timeout 7-8s, headless, args específicos)
- `src/lib/budgetGenerationService.ts` — Workflow completo budget

**Timeout crítico**: Vercel tiene límite de 10 segundos. Los PDFs deben generarse en máximo 7-8s.

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
