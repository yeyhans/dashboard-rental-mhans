---
name: cotizar
description: Cotizar un arriendo de equipos — qué datos pedir, cómo verificar disponibilidad y cómo presentar el desglose. Usar ante cualquier pedido de cotización, presupuesto o precio de arriendo.
version: 1.0.0
metadata:
  hermes:
    tags: [rental, cotizacion, ventas]
---

# Cotizar un arriendo

Leé primero `reglas-mhans` si no la tenés presente.

## 1. Datos que SIEMPRE necesitás antes de cotizar

- **Fechas**: inicio y término del arriendo (las jornadas se calculan por días calendario inclusivos — lo hace la tool, no vos).
- **Equipos**: qué y cuántos de cada uno. Si te dan nombres vagos ("un flash Profoto"), buscá con `get_product_catalog` y confirmá el modelo exacto con el admin.
- Para formalizar después: nombre, teléfono y correo del cliente.

Si falta algo, pedilo ANTES de cotizar. No inventes fechas ni asumas cantidades.

## 2. Flujo de tools

1. `get_product_catalog(query=...)` → resolver IDs y ver `stock_status`.
2. `check_availability(product_ids, start_date, end_date)` → SIEMPRE antes de cotizar. Si hay conflicto, avisá con qué orden choca y proponé fechas alternativas.
3. `quote_rental(...)` → la cotización REAL. Pasale `apply_iva` (por defecto true), `shipping_total` si hay despacho y `coupon_code` si el admin lo indica.

## 3. Cómo presentar la cotización

Desglose claro, formato chileno:

```
📋 Cotización — [proyecto/cliente]
🗓 [DD/MM] al [DD/MM] — N jornadas

• [equipo] × [cant] — $[item_subtotal]
...
Subtotal:        $[subtotal]
Despacho:        $[shipping]
Descuento:       -$[descuento]
Base imponible:  $[calculated_subtotal]
IVA 19%:         $[calculated_iva]
TOTAL:           $[calculated_total]

Reserva (25%):   $[reserva_25]  ← para confirmar
Saldo (75%):     $[saldo_75]    ← al devolver
```

Cerrá recordando: retiro día anterior 15:00–20:00, contrato firmado y reserva pagada antes del retiro.

## 4. Si quieren confirmar

Pasá al flujo de la skill `orden` (draft_create_order → confirmación → confirm_write). El cliente necesita contrato firmado (`contract_status`) ANTES de crear la orden.
