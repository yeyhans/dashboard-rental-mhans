# 📊 Sistema de Analytics Avanzados - Rental Mario Hans

## 🎯 Descripción General

Sistema completo de analytics avanzados que proporciona estadísticas detalladas sobre usuarios, productos, cupones, shipping y KPIs del negocio de rental de equipos.

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   analytics.astro   │────│AdvancedAnalytics │────│   Supabase      │
│   (Página Principal) │    │    Service       │    │   Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ React Components│    │   API Endpoint   │    │ Database Tables │
│ (Visualización) │    │ /api/analytics/  │    │ - user_profiles │
└─────────────────┘    │    advanced      │    │ - orders        │
                       └──────────────────┘    │ - products      │
                                               └─────────────────┘
```

## 📁 Estructura de Archivos

```
backend/src/
├── services/
│   └── advancedAnalyticsService.ts     # Servicio principal de analytics
├── pages/
│   ├── analytics.astro                 # Página principal de analytics
│   └── api/analytics/
│       └── advanced.ts                 # API endpoint para datos
└── components/analytics/
    ├── UserAnalyticsCard.tsx           # Componente de estadísticas de usuarios
    ├── ProductAnalyticsCard.tsx        # Componente de estadísticas de productos
    ├── CouponAnalyticsCard.tsx         # Componente de estadísticas de cupones
    ├── ShippingAnalyticsCard.tsx       # Componente de estadísticas de shipping
    └── KPIAnalyticsCard.tsx           # Componente de KPIs principales
```

## 📊 Módulos de Analytics

### 1. **Análisis de Usuarios** 👥
- **Total de usuarios** registrados en el sistema
- **Usuarios activos** (con órdenes en el período)
- **Segmentación por tipo** (persona vs empresa)
- **Distribución geográfica** por ciudades
- **Usuarios con contratos** firmados
- **Tasa de conversión** (usuarios que realizan órdenes)
- **Crecimiento mensual** de usuarios
- **Top 10 regiones** con más usuarios

### 2. **Análisis de Productos** 📦
- **Inventario total** y productos activos
- **Estado del stock** (en stock, sin stock, stock bajo)
- **Top 10 productos más rentados** por cantidad
- **Performance por categorías** con revenue
- **Revenue por producto** individual
- **Análisis de categorías** con métricas de rendimiento

### 3. **Análisis de Cupones** 🎫
- **Total de cupones utilizados** en el período
- **Monto total de descuentos** aplicados
- **Descuento promedio** por orden
- **Top 10 cupones más usados** por frecuencia
- **Impacto en órdenes** (con vs sin descuento)
- **Tendencias mensuales** de uso de cupones
- **Análisis de efectividad** de promociones

### 4. **Análisis de Shipping** 🚚
- **Revenue total de envíos** generado
- **Costo promedio** de envío por orden
- **Distribución pickup vs shipping** con porcentajes
- **Métodos de envío** más utilizados
- **Top 10 regiones de entrega** por volumen
- **Tendencias mensuales** de costos de envío
- **Métricas de eficiencia** operacional

### 5. **KPIs Principales** 📈
- **Customer Lifetime Value (CLV)** promedio
- **Average Order Value (AOV)** del período
- **Customer Retention Rate** y Churn Rate
- **Funnel de conversión** completo
- **Monthly Recurring Revenue (MRR)**
- **Customer Acquisition Cost (CAC)**
- **Análisis de rentabilidad** (LTV/CAC ratio)

## 🔧 Configuración e Instalación

### Prerrequisitos
- Node.js 18+
- Supabase configurado con service role key
- Base de datos con tablas: `user_profiles`, `orders`, `products`

### Variables de Entorno
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Instalación
```bash
# Navegar al directorio backend
cd backend

# Instalar dependencias (si no están instaladas)
npm install

# Ejecutar en desarrollo
npm run dev
```

## 🚀 Uso del Sistema

### Acceso a Analytics
1. **Dashboard Principal**: Ir a `/dashboard`
2. **Botón "Analytics Avanzados"**: Click para acceder
3. **URL Directa**: Navegar a `/analytics`

### Navegación por Pestañas
- **Usuarios**: Estadísticas de registro, actividad y conversión
- **Productos**: Análisis de inventario, rentas y categorías
- **Cupones**: Uso de descuentos y efectividad promocional
- **Shipping**: Costos, métodos y distribución geográfica
- **KPIs**: Métricas clave de rendimiento del negocio

### Período de Análisis
- **Por defecto**: Últimos 30 días
- **Personalizable**: Via parámetros URL `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

## 📊 Estructura de Datos

### UserAnalytics Interface
```typescript
interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  usersByType: { persona: number; empresa: number };
  usersByRegion: Array<{ ciudad: string; count: number }>;
  usersWithContracts: number;
  conversionRate: number;
  newUsersThisMonth: number;
  userGrowthRate: number;
}
```

### ProductAnalytics Interface
```typescript
interface ProductAnalytics {
  totalProducts: number;
  activeProducts: number;
  mostRentedProducts: Array<{
    id: number; name: string; sku: string;
    totalRentals: number; revenue: number; image?: string;
  }>;
  categoriesPerformance: Array<{
    category: string; productCount: number;
    totalRevenue: number; avgPrice: number;
  }>;
  stockStatus: { inStock: number; outOfStock: number; lowStock: number };
  revenueByProduct: Array<{ productId: number; name: string; revenue: number }>;
}
```

## 🔍 Consultas de Base de Datos

### Tablas Utilizadas
- **`user_profiles`**: Datos de usuarios y perfiles
- **`orders`**: Órdenes con line_items, shipping_lines, coupon_lines
- **`products`**: Catálogo de productos con categorías y stock

### Campos Clave
- **Usuarios**: `tipo_cliente`, `ciudad`, `terminos_aceptados`, `created_at`
- **Órdenes**: `status`, `calculated_total`, `calculated_discount`, `shipping_total`
- **Productos**: `stock_status`, `categories_name`, `price`

## 🎨 Componentes UI

### Características de Diseño
- **Responsive**: Adaptable a móvil, tablet y desktop
- **Tema oscuro/claro**: Soporte completo
- **Iconografía**: Lucide React icons consistentes
- **Colores**: Sistema de colores semánticos
- **Animaciones**: Transiciones suaves entre pestañas

### Componentes Reutilizables
- **Cards**: Estructura consistente con header/content
- **Badges**: Indicadores de estado y categorías
- **Progress bars**: Visualización de porcentajes
- **Grids**: Layouts responsivos para métricas

## 🔒 Seguridad y Permisos

### Autenticación
- **Requerida**: Session de Supabase válida
- **Verificación**: Admin role en tabla `admin_users`
- **Redirección**: A login si no autenticado

### Autorización
- **Solo admins**: Acceso a analytics avanzados
- **Service role**: Para consultas de base de datos
- **Rate limiting**: Implementado en API endpoints

## 📈 Métricas de Rendimiento

### Optimizaciones Implementadas
- **Consultas paralelas**: Promise.all para múltiples queries
- **Índices de BD**: En campos de filtrado frecuente
- **Caching**: Resultados cacheados por período
- **Lazy loading**: Componentes cargados bajo demanda

### Tiempos de Respuesta Esperados
- **Carga inicial**: < 3 segundos
- **Cambio de pestaña**: < 500ms
- **Actualización de datos**: < 2 segundos

## 🐛 Troubleshooting

### Errores Comunes

#### "No se pueden cargar los analytics"
```bash
# Verificar variables de entorno
echo $SUPABASE_SERVICE_ROLE_KEY

# Verificar conexión a Supabase
npm run test:db
```

#### "Datos vacíos en componentes"
- Verificar que existan datos en las tablas
- Confirmar rango de fechas válido
- Revisar logs del servidor para errores SQL

#### "Componentes React no se renderizan"
- Verificar que client:load esté presente
- Confirmar que los datos se pasan correctamente
- Revisar consola del navegador para errores JS

### Logs de Debug
```typescript
// Habilitar logs detallados
console.log('🔍 Advanced Analytics API called with:', { startDate, endDate });
console.log('✅ Advanced analytics loaded successfully');
```

## 🚀 Roadmap Futuro

### Funcionalidades Planificadas
- [ ] **Filtros avanzados** por fecha personalizada
- [ ] **Exportación** de datos a Excel/PDF
- [ ] **Alertas automáticas** para métricas críticas
- [ ] **Comparación temporal** (mes vs mes anterior)
- [ ] **Gráficos interactivos** con Chart.js
- [ ] **Dashboard personalizable** por usuario
- [ ] **API pública** para integraciones externas

### Mejoras Técnicas
- [ ] **Real-time updates** con WebSockets
- [ ] **Caching avanzado** con Redis
- [ ] **Optimización de queries** con materialized views
- [ ] **Testing automatizado** con Jest
- [ ] **Documentación API** con Swagger

## 📞 Soporte

### Contacto Técnico
- **Desarrollador**: Sistema implementado por Cascade AI
- **Documentación**: Este README y comentarios en código
- **Issues**: Reportar en el repositorio del proyecto

### Recursos Adicionales
- **Supabase Docs**: https://supabase.com/docs
- **Astro Docs**: https://docs.astro.build
- **React Docs**: https://react.dev

---

## 🎉 ¡Sistema Implementado Exitosamente!

El sistema de analytics avanzados está completamente funcional y listo para proporcionar insights valiosos sobre el negocio de Rental Mario Hans. 

**Acceso**: `/analytics` desde el dashboard principal

**Características principales**:
✅ 5 módulos de analytics completos
✅ Interfaz responsive y moderna  
✅ Datos en tiempo real desde Supabase
✅ Componentes React reutilizables
✅ Seguridad y autenticación integrada
