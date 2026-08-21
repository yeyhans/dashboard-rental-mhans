---
name: orden
description: Crear órdenes y gestionar su estado/seguimiento — flujo draft→confirmación→commit, workflow de estados, retiros y devoluciones del día. Usar para crear, consultar o avanzar órdenes de arriendo.
version: 1.0.0
metadata:
  hermes:
    tags: [rental, ordenes, workflow]
---

# Órdenes: creación y seguimiento

Lee primero `reglas-mhans`.

## Consultar (libre, solo lectura)

- `get_order_status(order_id)` — estado, fechas, totales, PDFs, cliente.
- `list_orders(status=..., date_from=..., date_to=...)` — listados.
- `list_pickups_today()` — retiros y devoluciones del día (retiro = órdenes que inician MAÑANA; devolución = órdenes que terminaron AYER).

## Crear una orden (escritura — SIEMPRE con confirmación)

Protocolo obligatorio en DOS pasos. JAMÁS te saltes el paso de confirmación humana:

1. **Draft**: `draft_create_order(...)`. Antes verifica:
   - Cliente identificado (`find_client` / `get_client`) y **con contrato** (`contract_status`). Sin contrato → primero el flujo de la skill `cliente`.
   - Disponibilidad ok (el draft la re-chequea y te devuelve advertencias).
2. **Muestra el preview COMPLETO al admin por Telegram**: cliente, equipos, fechas, jornadas, desglose de montos, advertencias. Pregunta explícitamente: **"¿Confirmo la creación? (sí/no)"** y ESPERA la respuesta.
3. Solo con un "sí" claro del admin: `confirm_write(plan_id, confirmation_token)`. Si dice no o pide cambios: `cancel_write(plan_id)` y rearma.
4. Reporta el resultado: número de orden, estado inicial (`on-hold` con vocabulario legacy; `request` cuando rige v1.2 — la tool te lo devuelve) y si el presupuesto PDF/email se disparó o quedó pendiente.

El token expira a los 15 minutos — si expiró, genera un draft nuevo (no lo "reintentes").

## Avanzar estado (escritura — mismo protocolo)

1. `update_order_status_draft(order_id, new_status)` — valida la transición del workflow.
2. Preview al admin + pregunta explícita + esperar "sí".
3. `confirm_write(...)`.

Guard crítico: a la etapa gateada por pago (`processing` con vocabulario legacy; `confirmed` cuando rige v1.2) SOLO si la reserva está pagada. Si el draft advierte pago no verificado, díselo al admin y que él confirme bajo su responsabilidad.

## Nunca

- Nunca llames `confirm_write` sin haber mostrado el preview Y recibido un "sí" en ESTE chat.
- Nunca crees órdenes para clientes sin contrato.
- Nunca modifiques órdenes por SQL (`rentaldb` es solo para consultas).
