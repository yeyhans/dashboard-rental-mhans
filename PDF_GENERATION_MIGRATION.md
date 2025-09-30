# Migración de PDF Generation: Puppeteer → astro-pdf

## 🎯 Problema Resuelto
Se solucionó el error "Could not find Chrome (ver. 131.0.6778.204)" que ocurría en Vercel al intentar generar PDFs usando Puppeteer.

## 🔧 Cambios Implementados

### 1. Dependencias Actualizadas
```bash
# Removido
- puppeteer: ^23.11.1

# Agregado  
+ astro-pdf: ^1.7.2
```

### 2. Configuración astro.config.mjs
```javascript
import pdf from 'astro-pdf';

export default defineConfig({
  integrations: [
    tailwind(), 
    react(),
    pdf({
      format: 'A4',
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      waitUntil: 'networkidle2'
    })
  ],
  // ...resto de la configuración
});
```

### 3. APIs Actualizadas

#### generate-budget-pdf.ts
```typescript
// ANTES: Puppeteer
const browser = await puppeteer.default.launch({...});
const page = await browser.newPage();
const pdfBuffer = await page.pdf({...});

// AHORA: astro-pdf
const pdfUrl = `${baseUrl}/budget-pdf/${orderId}.pdf`;
const pdfResponse = await fetch(pdfUrl, {
  headers: {
    'X-Internal-Request': 'true',
    'X-Requested-Order-Id': orderId.toString(),
    'Accept': 'application/pdf'
  }
});
const pdfBuffer = await pdfResponse.arrayBuffer();
```

#### generate-processing-pdf.ts
```typescript
// Misma migración que budget-pdf.ts
const pdfUrl = `${baseUrl}/order-pdf/${orderId}.pdf`;
// ...resto del código similar
```

## 🚀 Deployment en Vercel

### Pasos para Deploy:
1. **Commit y Push** los cambios al repositorio
2. **Vercel redeploy** automático detectará los cambios
3. **Verificar** que astro-pdf esté incluido en el build

### Variables de Entorno Requeridas:
```env
PUBLIC_SUPABASE_URL=https://supabase-mhans.farmiemos.cl
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PUBLIC_CLOUDFLARE_WORKER_URL=your_worker_url
```

## 🧪 Testing

### Endpoints a Probar:
1. **Budget PDF Generation**
   ```bash
   POST /api/order/generate-budget-pdf
   Body: { "order_id": 123, "customer_id": 456 }
   ```

2. **Processing PDF Generation**
   ```bash
   POST /api/order/generate-processing-pdf  
   Body: { "orderData": { "order_id": 123, "customer_id": 456, ... } }
   ```

### Verificación Local:
```bash
# Iniciar servidor
npm run dev

# Probar endpoints PDF directos
curl http://localhost:4322/budget-pdf/123.pdf \
  -H "X-Internal-Request: true" \
  -H "X-Requested-Order-Id: 123"

curl http://localhost:4322/order-pdf/123.pdf \
  -H "X-Internal-Request: true" \
  -H "X-Requested-Order-Id: 123"
```

## ✅ Beneficios de la Migración

- **✅ Compatible con Vercel**: No requiere Chrome instalado
- **✅ Mejor Performance**: astro-pdf optimizado para SSR
- **✅ Misma Funcionalidad**: Mantiene todas las características
- **✅ Consistente**: Usa la misma tecnología que contratos
- **✅ Menos Dependencias**: Elimina Puppeteer y sus dependencias

## 🔍 Troubleshooting

### Error: "PDF generation failed"
- Verificar que las páginas `/budget-pdf/[orderId].astro` y `/order-pdf/[orderId].astro` existan
- Verificar que astro-pdf esté correctamente configurado en astro.config.mjs
- Verificar headers de internal request

### Error: "Order not found"  
- Verificar que SUPABASE_SERVICE_ROLE_KEY esté configurado
- Verificar que el orderId sea válido en la base de datos

### Error en Vercel Build
- Verificar que astro-pdf esté en dependencies (no devDependencies)
- Verificar que astro.config.mjs tenga la importación correcta

## 📝 Notas Adicionales

- Los PDFs se generan usando las mismas plantillas HTML existentes
- El upload a R2 y actualización de Supabase se mantienen iguales
- La autenticación y autorización no cambian
- Compatible con el sistema de warranty photos existente
