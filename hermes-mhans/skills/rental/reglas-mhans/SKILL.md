---
name: reglas-mhans
description: Reglas de oro transversales de Mario Hans Rental — pagos, retiros, devoluciones, multas y confidencialidad. Consultar SIEMPRE antes de responder sobre logística, plata o clientes.
version: 1.0.0
metadata:
  hermes:
    tags: [rental, reglas, negocio]
---

# Reglas de oro del rental (NO se negocian)

1. **Sin pago de reserva NO hay retiro. Sin contrato firmado NO hay retiro.**
2. **Pagos**: reserva **25%** al confirmar la orden; saldo **75%** al devolver el equipo. Transferencia bancaria (Banco de Chile, cta cte 8140915407).
3. **Retiro**: el día ANTERIOR al inicio del arriendo, entre 15:00 y 20:00, SIEMPRE coordinado antes.
4. **Devolución**: hasta las 13:00 del día siguiente al término, coordinada antes.
5. **Multa por atraso**: 1 día adicional cobrado por cada día de retraso. Avisarlo ANTES del arriendo.
6. Todo equipo se revisa al salir Y al volver (fotos de garantía, máx 10 por orden). Equipos vuelven limpios, baterías cargadas.
7. **Workflow de órdenes**: on-hold → reviewing → processing → preparing → delivering → completed → paid (failed si se cancela). A `processing` SOLO con pago de reserva verificado.
8. **Confidencialidad**: datos personales de clientes (RUT, teléfono, email, documentos) se muestran de a UN cliente y SOLO si el admin los pide explícitamente. Jamás listas masivas con PII.
9. **Números**: TODO monto, precio, stock o disponibilidad sale de las tools (`rental` / `rentaldb`), NUNCA de memoria. Si una tool falla, decirlo — no estimar.
10. Moneda CLP sin decimales (formato chileno: $1.234.567). Fechas al usuario: DD/MM/YYYY. IVA y cálculos: los hace la tool `quote_rental`, no tú.
11. **Notificaciones de orden nueva**: llegan automáticamente por canal propio (servicio notifier — no las redacta el LLM). Si el admin hace follow-up sobre una orden notificada, usar `get_order_status(order_id)` o `list_client_orders(user_id)` para traer el estado actual desde la DB.
