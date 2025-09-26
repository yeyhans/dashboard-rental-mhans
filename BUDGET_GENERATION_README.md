# Sistema de Generación de Presupuestos - Backend

Este documento describe la implementación del sistema de generación de presupuestos en el backend, que utiliza los mismos componentes y funcionalidades que el frontend.

## 🚀 Funcionalidades Implementadas

### 1. **Generación de Presupuestos PDF**
- Generación de PDFs profesionales usando Puppeteer
- Template HTML con diseño responsive y profesional
- Soporte para múltiples productos y cupones de descuento
- Cálculos automáticos de subtotales, IVA y totales

### 2. **Envío de Correos Electrónicos**
- Notificación automática al cliente cuando se genera el presupuesto
- Integración con el servicio de email del frontend
- Fallback para envío directo en caso de fallas

### 3. **Almacenamiento en R2**
- Subida automática de PDFs a Cloudflare R2
- URLs seguras para acceso a los presupuestos
- Fallback a almacenamiento base64 si R2 falla

### 4. **Integración con CreateOrderForm**
- Botón "Generar Presupuesto" en el formulario de creación de órdenes
- Validación automática de datos requeridos
- Feedback visual del estado de generación

## 📁 Archivos Creados/Modificados

### Servicios Principales
- `src/lib/budgetGenerationService.ts` - Servicio principal de generación de presupuestos
- `src/lib/emailService.ts` - Servicio de envío de correos electrónicos
- `src/lib/supabase.ts` - Funciones de autenticación agregadas

### API Endpoints
- `src/pages/api/budget/generate-pdf.ts` - Endpoint para generar PDFs
- `src/pages/budget-pdf/[orderId].astro` - Template HTML para PDFs

### Componentes UI
- `src/components/orders/CreateOrderForm.tsx` - Formulario actualizado con funcionalidad de presupuesto

### Configuración
- `package.json` - Dependencia de Puppeteer agregada

## 🔧 Instalación y Configuración

### 1. Instalar Dependencias
```bash
cd backend
npm install
```

### 2. Variables de Entorno
Asegúrate de tener las siguientes variables en tu `.env`:

```env
# Supabase
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cloudflare Worker
PUBLIC_CLOUDFLARE_WORKER_URL=your_worker_url

# Frontend Email API (opcional)
FRONTEND_EMAIL_API_URL=http://localhost:4321/api/email/send-budget
```

### 3. Configuración de Puppeteer
Puppeteer se instala automáticamente con las dependencias. En producción, asegúrate de que el servidor tenga las dependencias necesarias para ejecutar Chrome headless.

## 🎯 Uso del Sistema

### Desde CreateOrderForm

1. **Seleccionar Cliente**: Elige un cliente existente del dropdown
2. **Agregar Productos**: Añade productos con cantidades
3. **Configurar Proyecto**: Completa información del proyecto (fechas, nombre, etc.)
4. **Generar Presupuesto**: Haz clic en "Generar Presupuesto"

El sistema automáticamente:
- Valida que todos los datos requeridos estén presentes
- Genera el PDF con la información del presupuesto
- Sube el PDF a R2 storage
- Envía un correo al cliente con el presupuesto
- Muestra confirmación de éxito o error

### Programáticamente

```typescript
import { generateBudgetWithOrderData } from '../lib/budgetGenerationService';

const budgetData = {
  order_id: 12345,
  customer_id: "user_123",
  status: "on-hold",
  billing: {
    first_name: "Juan",
    last_name: "Pérez",
    email: "juan@example.com",
    // ... otros campos
  },
  metadata: {
    order_proyecto: "Proyecto Ejemplo",
    calculated_total: "150000",
    // ... otros campos
  },
  line_items: [
    {
      product_id: "1",
      quantity: 2,
      name: "Canon EOS R5",
      price: "75000",
      sku: "CANON-R5"
    }
  ]
};

const result = await generateBudgetWithOrderData(budgetData, true, true);

if (result.success) {
  console.log('Presupuesto generado:', result.budgetUrl);
} else {
  console.error('Error:', result.message);
}
```

## 🔍 Funciones Disponibles

### `generateBudgetWithOrderData(orderData, uploadToR2, sendEmail)`
Genera un presupuesto PDF completo con los datos de la orden.

**Parámetros:**
- `orderData`: Datos de la orden/presupuesto
- `uploadToR2`: Boolean - Si subir a R2 storage (default: true)
- `sendEmail`: Boolean - Si enviar correo al cliente (default: true)

**Retorna:** `BudgetResult` con éxito/error y URL del PDF

### `generateBudgetFromOrderId(orderId, uploadToR2, sendEmail)`
Genera presupuesto desde una orden existente en la base de datos.

### `canGenerateBudget(orderId)`
Verifica si una orden es elegible para generar presupuesto.

### `processOrderForBudget(orderId, newStatus)`
Actualiza el estado de una orden y genera el presupuesto automáticamente.

## 🎨 Personalización del Template

El template PDF se encuentra en `src/pages/budget-pdf/[orderId].astro` y puede ser personalizado:

### Estilos CSS
- Colores corporativos
- Fuentes y tipografía
- Layout y espaciado
- Elementos responsive

### Contenido
- Información de la empresa
- Campos adicionales
- Cálculos personalizados
- Términos y condiciones

### Ejemplo de Personalización
```css
.header h1 {
  color: #your-brand-color;
  font-size: 2.5em;
}

.company-info {
  background-color: #your-background-color;
}
```

## 🔒 Seguridad

### Autenticación
- Verificación de sesión de usuario para acceso directo
- Validación de headers internos para requests de API
- Autorización basada en ownership de órdenes

### Headers de Seguridad
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Cache-Control: private, no-cache`

### Validación de Datos
- Validación de campos requeridos
- Sanitización de inputs
- Verificación de permisos de usuario

## 🐛 Troubleshooting

### Error: "Puppeteer not available"
```bash
# Instalar Puppeteer manualmente
npm install puppeteer

# En producción, instalar dependencias del sistema
apt-get install -y chromium-browser
```

### Error: "No user profile found"
- Verificar que el usuario tenga un perfil en `user_profiles`
- Verificar variables de entorno de Supabase
- Verificar autenticación del usuario

### Error: "Worker upload failed"
- Verificar URL del Cloudflare Worker
- Verificar conectividad de red
- El sistema usa fallback automático a base64

### Error: "Email sending failed"
- Verificar configuración del servicio de email
- Verificar URL del frontend email API
- El sistema continúa funcionando sin email

## 📊 Monitoreo y Logs

El sistema incluye logging detallado:

```typescript
// Logs de éxito
console.log('✅ Budget generated successfully:', result.budgetUrl);

// Logs de error
console.error('❌ Budget generation failed:', result.error);

// Logs de debug
console.log('🔧 Debug: Worker response:', result);
```

### Métricas Importantes
- Tiempo de generación de PDF
- Tasa de éxito de uploads a R2
- Tasa de envío de emails
- Errores de validación

## 🚀 Próximos Pasos

### Mejoras Sugeridas
1. **Cache de Templates**: Cache de HTML generado para mejor performance
2. **Queue System**: Sistema de colas para generación masiva
3. **Webhooks**: Notificaciones automáticas de estado
4. **Analytics**: Métricas detalladas de uso
5. **Multi-idioma**: Soporte para múltiples idiomas

### Integración con Frontend
El sistema está diseñado para ser compatible con el frontend existente:
- Misma estructura de datos
- Mismos endpoints de Cloudflare Worker
- Mismo servicio de email
- Misma base de datos Supabase

## 📞 Soporte

Para problemas o preguntas:
1. Revisar logs del servidor
2. Verificar variables de entorno
3. Comprobar conectividad con servicios externos
4. Revisar permisos de base de datos

El sistema está diseñado para ser robusto con múltiples fallbacks, pero siempre revisa los logs para diagnóstico completo.
