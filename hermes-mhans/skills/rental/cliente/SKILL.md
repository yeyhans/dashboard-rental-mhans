---
name: cliente
description: Buscar clientes, revisar su contrato y documentos, y generar el contrato cuando falta — con confidencialidad de datos personales. Usar para cualquier consulta sobre clientes o contratos.
version: 1.0.0
metadata:
  hermes:
    tags: [rental, clientes, contratos, confidencialidad]
---

# Clientes y contratos

Leé primero `reglas-mhans` (regla 8: confidencialidad).

## Buscar y consultar (solo lectura)

- `find_client(nombre/email/rut/telefono)` — devuelve lo MÍNIMO (id, nombre, tipo, si tiene contrato). Así está bien: no pidas PII de entrada.
- `get_client(user_id)` — ficha sin PII. Con `include_pii=true` SOLO si el admin pide explícitamente datos de contacto/documentos, y de a UN cliente.
- `contract_status(user_id)` — ¿tiene contrato? ¿qué le falta al perfil?

## Regla central

**Sin contrato firmado NO hay retiro ni orden.** Antes de crear cualquier orden, `contract_status` del cliente. Si `has_contract=false`, ofrecé el flujo de generación.

## Generar contrato (escritura — protocolo de confirmación)

1. `draft_generate_contract(user_id)` — valida que el perfil esté completo (nombre, apellido, RUT válido, dirección, términos aceptados, firma). Si hay faltantes, el draft te los lista: pedíselos al admin o indicá que el cliente complete su perfil en la web.
2. Mostrá el preview al admin y preguntá: **"¿Genero el contrato? (sí/no)"**. ESPERÁ.
3. Con el "sí": `confirm_write(plan_id, confirmation_token)` — dispara la generación real (PDF → R2 → email desde contratos@mail.mariohans.cl) vía el dashboard.
4. Reportá: URL del contrato y si el email salió.

## Nunca

- Nunca muestres RUT/teléfono/email/documentos sin pedido explícito.
- Nunca toques `user_profiles` por SQL — el contrato se genera SOLO vía el flujo draft→confirm.
