---
name: cliente
description: Buscar clientes, revisar su contrato y documentos, consultar historial y estadísticas, editar datos permitidos y crear nuevos clientes — con confidencialidad de datos personales. Usar para cualquier consulta sobre clientes o contratos.
version: 2.0.0
metadata:
  hermes:
    tags: [rental, clientes, contratos, confidencialidad, historial, stats]
---

# Clientes y contratos

Lee primero `reglas-mhans` (regla 8: confidencialidad).

## Buscar y consultar (solo lectura)

- `find_client(nombre/email/rut/telefono)` — devuelve lo MÍNIMO (id, nombre, tipo, si tiene contrato). Así está bien: no pidas PII de entrada.
- `get_client(user_id)` — ficha sin PII. Con `include_pii=true` SOLO si el admin pide explícitamente datos de contacto/documentos, y de a UN cliente.
- `contract_status(user_id)` — ¿tiene contrato? ¿qué le falta al perfil?

## Historial y estadísticas (solo lectura)

- `list_client_orders(user_id, limit=10)` — historial de órdenes del cliente: estado, fechas, totales, proyecto.
- `client_stats(user_id)` — resumen: número de órdenes, total histórico CLP, primera y última orden, desglose por estado.

## Regla central

**Sin contrato firmado NO hay retiro ni orden.** Antes de crear cualquier orden, `contract_status` del cliente. Si `has_contract=false`, ofrece el flujo de generación.

## Generar contrato (escritura — protocolo de confirmación)

1. `draft_generate_contract(user_id)` — valida que el perfil esté completo (nombre, apellido, RUT válido, dirección, términos aceptados, firma). Si hay faltantes, el draft te los lista: pídeselos al admin o indica que el cliente complete su perfil en la web.
2. Muestra el preview al admin y pregunta: **"¿Genero el contrato? (sí/no)"**. ESPERA.
3. Con el "sí": `confirm_write(plan_id, confirmation_token)` — dispara la generación real (PDF → R2 → email desde contratos@mail.mariohans.cl) vía el dashboard.
4. Reporta: URL del contrato y si el email salió.

## Editar cliente (escritura — protocolo de confirmación)

Campos que se PUEDEN editar: `nombre`, `apellido`, `telefono`, `direccion`, `ciudad`, `empresa_nombre`, `empresa_rut`, `instagram`, `tipo_cliente`.

Campos PROHIBIDOS (nunca los propongas, el tool los rechaza): `rut`, `email`, `auth_uid`, `url_*` (documentos/contrato), `terminos_aceptados`.

1. `draft_update_client(user_id, fields)` — propone los cambios y valida la allowlist. Muestra preview campo a campo: "de X → a Y".
2. Muestra el preview al admin y pregunta: **"¿Confirmo los cambios? (sí/no)"**. ESPERA.
3. Con el "sí": `confirm_write(plan_id, confirmation_token)`.
4. Si el dashboard no está disponible, el plan NO queda consumido — se puede reintentar.

## Crear cliente (escritura — protocolo de confirmación)

Mínimo requerido: `email` + `nombre`. Opcionales: `apellido`, `rut`, `telefono`, `tipo_cliente`, `empresa_nombre`, `empresa_rut`.

**IMPORTANTE**: crear un cliente NO genera contrato. El contrato se crea por separado con el flujo `draft_generate_contract`.

1. `draft_create_client(email, nombre, ...)` — valida email y RUT (módulo 11 si se provee). Preview con aviso: "al cliente le llega email de bienvenida con clave temporal".
2. Muestra el preview al admin y pregunta: **"¿Creo el cliente? (sí/no)"**. ESPERA.
3. Con el "sí": `confirm_write(plan_id, confirmation_token)`.
4. Avisa que el cliente recibirá un email con su clave temporal para entrar al portal.

## Nunca

- Nunca muestres RUT/teléfono/email/documentos sin pedido explícito.
- Nunca toques `user_profiles` por SQL — editar y crear clientes se hace SOLO vía el flujo draft→confirm.
- Nunca propongas editar `rut`, `email`, `auth_uid`, `url_*` ni `terminos_aceptados`.
