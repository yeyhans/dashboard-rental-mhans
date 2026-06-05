---
name: catalogo
description: Catálogo de equipos, métricas e ingresos del rental — qué tool usar para cada análisis y cuándo escalar a SQL ad-hoc. Usar para consultas de productos, demanda, ingresos o reportes.
version: 1.0.0
metadata:
  hermes:
    tags: [rental, catalogo, analytics, reportes]
---

# Catálogo y análisis del negocio

Lee primero `reglas-mhans` (regla 9: números solo de tools).

## Tools de dominio (preferir SIEMPRE — rápidas y tipadas)

- `get_product_catalog(query/sku/category_id/only_instock)` — buscar equipos, precios actuales, stock.
- `revenue_report(date_from, date_to)` — facturación por período: total, por estado, ticket promedio, top productos.
- `product_demand(date_from, date_to, limit)` — ranking de equipos más arrendados e ingresos.
- `low_stock_report()` — equipos fuera de stock o bajo pedido.

## SQL ad-hoc (`rentaldb`, solo lectura — escala aquí cuando el dominio no alcanza)

Para preguntas que las tools de dominio no cubren (cruces raros, cohortes, series temporales):
- `execute_sql` corre en transacción READ-ONLY con rol de solo SELECT — no puede escribir nada.
- Explora el esquema primero con `list_objects` / `get_object_details` si no estás seguro de columnas.
- Vistas útiles ya hechas: `order_summary`, `products_with_categories`, `order_communications`, `shipping_usage`.
- snake_case; fechas ISO en DB (muéstralas DD/MM/YYYY); montos CLP sin decimales.

## Presentación

- Reportes: encabezado con período, totales arriba, desglose abajo, formato chileno ($1.234.567).
- Si el admin pide "cómo vamos", un resumen ejecutivo: facturación del período, órdenes activas por estado, próximos retiros (`list_pickups_today`) y equipos conflictivos.
