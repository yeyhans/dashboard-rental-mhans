---
name: cotizar
description: Cotizar un arriendo de equipos — qué datos pedir, cómo verificar disponibilidad y cómo presentar el desglose. Usar ante cualquier pedido de cotización, presupuesto o precio de arriendo.
version: 1.0.0
metadata:
  hermes:
    tags: [rental, cotizacion, ventas]
---

# Cotizar un arriendo

Lee primero `reglas-mhans` si no la tienes presente.

## 1. Datos que SIEMPRE necesitas antes de cotizar

- **Fechas**: inicio y término del arriendo (las jornadas se calculan por días calendario inclusivos — lo hace la tool, no tú).
- **Equipos**: qué y cuántos de cada uno. Si te dan nombres vagos ("un flash Profoto"), busca con `get_product_catalog` y confirma el modelo exacto con el admin.
- Para formalizar después: nombre, teléfono y correo del cliente.

Si falta algo, pídelo ANTES de cotizar. No inventes fechas ni asumas cantidades.

## 2. Flujo de tools

1. `get_product_catalog(query=...)` → resolver IDs y ver `stock_status`.
2. `check_availability(product_ids, start_date, end_date)` → SIEMPRE antes de cotizar. Si hay conflicto, avisa con qué orden choca y propón fechas alternativas.
3. `quote_rental(...)` → la cotización REAL. Pásale `apply_iva` (por defecto true), `shipping_total` si hay despacho y `coupon_code` si el admin lo indica. Si el admin acordó una reserva distinta a la habitual, pásale también `reserve_type` (`percent` o `fixed`) y `reserve_value`.

## 3. Cómo presentar la cotización

Desglose claro, formato chileno:

```
📋 Cotización — [proyecto/cliente]
🗓 [DD/MM] al [DD/MM] — N jornadas

• [equipo] × [cant] — $[item_subtotal]
...
Subtotal:        $[subtotal]
Despacho:        $[shipping_total]
Descuento:       -$[descuento_cupon]
Base imponible:  $[calculated_subtotal]
IVA 19%:         $[calculated_iva]
TOTAL:           $[calculated_total]

[reserva_label]: $[reserva]  ← para confirmar
Saldo:           $[saldo]    ← al devolver
```

Los montos vienen en pesos enteros; muéstralos tal cual, sin recalcular nada por tu cuenta.

**La reserva no siempre es 25%.** Usa `reserva`, `saldo` y `reserva_label` tal como los devuelve la tool: `reserva_label` ya dice "Reserva 25%", "Reserva 50%" o simplemente "Reserva" cuando es un monto fijo. Para una orden que ya existe, `get_order_status` devuelve los mismos tres campos con la reserva real de esa orden — nunca supongas el 25% ni calcules el saldo a mano.

Cierra recordando: retiro día anterior 15:00–20:00, contrato firmado y reserva pagada antes del retiro.

## 4. Si quieren confirmar

Pasa al flujo de la skill `orden` (draft_create_order → confirmación → confirm_write). El cliente necesita contrato firmado (`contract_status`) ANTES de crear la orden.
