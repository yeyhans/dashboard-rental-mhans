# Guía de Detección de Conflictos de Productos

## Descripción General

El sistema de detección de conflictos de productos permite identificar automáticamente cuando los equipos de alquiler están siendo utilizados en múltiples órdenes durante las mismas fechas, evitando así la doble reserva de equipos.

## Características Principales

### 1. Detección Automática
- **Verificación en Tiempo Real**: Al abrir los detalles de una orden, el sistema verifica automáticamente si hay conflictos
- **Análisis de Fechas**: Compara las fechas de inicio y término de las órdenes para detectar solapamientos
- **Filtrado Inteligente**: Solo considera órdenes activas (processing, completed, on-hold)

### 2. Interfaz Visual Profesional

#### Badge de Alerta
- **Color Rojo**: Indica conflictos detectados
- **Texto Descriptivo**: "Ocupado en X orden(es)"
- **Ícono de Alerta**: Triángulo de advertencia para mayor visibilidad
- **Interactivo**: Clic para expandir detalles

#### Resumen de Conflictos
Cuando hay conflictos, se muestra un panel de alerta en la parte superior con:
- Número total de conflictos
- Rango de fechas afectadas
- Lista de órdenes en conflicto

#### Detalles Expandibles
Al hacer clic en el badge, se muestran:
- **ID de Orden**: Número de la orden en conflicto
- **Estado**: Badge con el estado actual de la orden
- **Cliente**: Nombre del cliente
- **Proyecto**: Nombre del proyecto
- **Fechas**: Rango de fechas del conflicto
- **Productos**: Lista específica de productos en conflicto con cantidades

### 3. Información Técnica

#### Endpoint API
```
POST /api/orders/check-conflicts
```

**Parámetros:**
```json
{
  "currentOrderId": 123,
  "productIds": [1, 2, 3],
  "startDate": "2024-01-15",
  "endDate": "2024-01-20"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "orderId": 456,
      "orderProject": "Proyecto ABC",
      "startDate": "2024-01-18",
      "endDate": "2024-01-22",
      "status": "processing",
      "customerName": "Juan Pérez",
      "customerEmail": "juan@example.com",
      "conflictingProducts": [
        {
          "productId": 1,
          "productName": "Excavadora CAT",
          "quantity": 2
        }
      ]
    }
  ]
}
```

#### Lógica de Detección de Solapamiento
```javascript
const hasDateOverlap = (
  (currentStart <= orderEnd && currentEnd >= orderStart) ||
  (orderStart <= currentEnd && orderEnd >= currentStart)
);
```

## Casos de Uso

### 1. Prevención de Doble Reserva
- **Problema**: Dos clientes reservan el mismo equipo para fechas solapadas
- **Solución**: El sistema alerta inmediatamente sobre el conflicto
- **Beneficio**: Evita problemas operacionales y de servicio al cliente

### 2. Planificación de Inventario
- **Problema**: Dificultad para saber qué equipos están disponibles
- **Solución**: Visualización clara de conflictos y disponibilidad
- **Beneficio**: Mejor planificación y gestión de recursos

### 3. Resolución de Conflictos
- **Problema**: Necesidad de identificar rápidamente órdenes conflictivas
- **Solución**: Información detallada de todas las órdenes en conflicto
- **Beneficio**: Resolución rápida y eficiente de problemas

## Estados del Sistema

### Cargando
- Badge: "Verificando disponibilidad..."
- Color: Outline (gris)
- Comportamiento: Se muestra mientras se cargan los datos

### Sin Conflictos
- No se muestra badge de conflicto
- Comportamiento normal del componente

### Con Conflictos
- Badge rojo con número de conflictos
- Panel de alerta en la parte superior
- Detalles expandibles por producto

## Integración con Otros Componentes

### ProcessOrder
- **Ubicación**: Sección de productos, en los badges de cada item
- **Activación**: Automática al cargar la orden
- **Dependencias**: OrderService, apiClient

### OrderService
- **Método**: `checkProductConflicts()`
- **Base de Datos**: Consulta tabla `orders` con joins necesarios
- **Performance**: Optimizado para consultas rápidas

## Consideraciones de Performance

### Optimizaciones Implementadas
1. **Consultas Eficientes**: Solo busca órdenes activas con fechas válidas
2. **Filtrado Temprano**: Excluye la orden actual de la búsqueda
3. **Carga Asíncrona**: No bloquea la carga principal del componente
4. **Cache de Resultados**: Los resultados se mantienen hasta que cambian los datos

### Recomendaciones
- **Índices de Base de Datos**: Asegurar índices en `order_fecha_inicio`, `order_fecha_termino`, `status`
- **Paginación**: Para órdenes con muchos productos, considerar paginación
- **Debounce**: Si se implementa búsqueda en tiempo real, usar debounce

## Mantenimiento y Extensiones

### Posibles Mejoras Futuras
1. **Notificaciones Push**: Alertas en tiempo real cuando se crean conflictos
2. **Resolución Automática**: Sugerencias para resolver conflictos
3. **Reportes**: Dashboard de conflictos frecuentes
4. **Integración con Calendario**: Vista de calendario con conflictos visuales

### Monitoreo
- **Logs**: Todos los conflictos se registran en console para debugging
- **Métricas**: Considerar agregar métricas de conflictos detectados
- **Alertas**: Sistema de alertas para conflictos críticos

## Troubleshooting

### Problemas Comunes

#### No se muestran conflictos cuando deberían existir
- **Verificar**: Fechas de las órdenes están correctamente formateadas
- **Revisar**: Estados de las órdenes (solo activas se consideran)
- **Comprobar**: Productos tienen IDs válidos

#### Performance lenta
- **Optimizar**: Consultas de base de datos
- **Revisar**: Índices en tablas relacionadas
- **Considerar**: Implementar cache

#### Errores de API
- **Verificar**: Endpoint `/api/orders/check-conflicts` está disponible
- **Revisar**: Parámetros enviados son correctos
- **Comprobar**: Autenticación y permisos

## Conclusión

El sistema de detección de conflictos de productos proporciona una herramienta robusta y profesional para la gestión de inventario de equipos de alquiler, mejorando significativamente la experiencia del usuario y la eficiencia operacional.
