# Hermes mhans — Guía Completa del Agente

> Versión: post-F8 (2026-06-05). Producción activa en VPS.
>
> **Identidad**: el agente se presenta ante el admin como **"Marito"** y habla
> español chileno (tuteo — el voseo rioplatense está explícitamente prohibido
> en su SOUL.md). "Hermes" / `hermes-mhans` es el nombre de la infraestructura
> (imagen, contenedores, roles DB), no de la persona del bot.

---

## Qué es y qué hace

Hermes mhans es el asistente de IA de Mario Hans Rental Fotográfico. Opera exclusivamente por Telegram con un bot privado. Solo pueden usarlo los administradores en la lista de acceso permitido (allowlist).

El agente tiene tres grandes bloques de funcionalidad:

### 1. Consultas de negocio (solo lectura)

El operador puede preguntar en lenguaje natural y el agente consulta la base de datos vía MCP tipado:

- "Cotizame un Profoto B10 + trípode para 3 jornadas del 10 al 12 de junio"
- "Qué retiros hay para mañana?"
- "Está disponible la cámara Canon R5 para la próxima semana?"
- "Mostrame el historial de órdenes de la cliente Ana Torres"
- "Cuántas órdenes completó Juan Pérez en total y cuánto gastó?"
- "Buscame todos los clientes de tipo empresa de Antofagasta"

### 2. Acciones con aprobación humana (draft → confirm)

Las escrituras en base de datos SIEMPRE pasan por confirmación explícita del operador:

- "Creá una orden para el cliente user_id 42, proyecto Campaña Adidas, del 5 al 7 de julio, cámara Canon R5 y Profoto B1X"
- "Cambiá el estado de la orden 1234 a processing"
- "Generá el contrato para Ana Torres"
- "Actualizá el teléfono del cliente user_id 55 a +56912345678"
- "Creá un cliente nuevo: maria@empresa.cl, nombre María Fuentes, empresa"

Flujo: el agente muestra un preview con los datos del cambio y espera un "sí" o confirmación explícita. Solo entonces ejecuta `confirm_write`.

### 3. Notificaciones automáticas de órdenes nuevas

Cada vez que se inserta una orden nueva en la base de datos (desde el frontend del cliente, desde el dashboard, o desde el propio agente vía confirm_write), el servicio notifier envía automáticamente un mensaje de Telegram a todos los administradores con el detalle completo de la orden. El agente LLM no interviene en esto — es un servicio independiente.

---

## Arquitectura

```
Telegram (admin)
      │
      ▼
hermes-mhans (gateway — MiniMax-M3, long-polling)
  SOUL.md + skills/rental/
      │
      ├─── MCP "rental" ──────────► rental-mcp (Python/FastMCP)
      │         21 tools tipados        │
      │         (lectura + escritura    ├─ validators.py
      │          draft→confirm)         └─ notifier/
      │
      ├─── MCP "rentaldb" ─────────► postgres-mcp crystaldba
      │         SQL ad-hoc                (RESTRICTED, solo SELECT)
      │         (solo lectura)
      │
      └─── DB: Supabase self-hosted (red docker interna :5434)
                roles: hermes_ro (SELECT)
                        hermes_rw (sin DELETE)
                        hermes_notifier (SELECT orders+user_profiles,
                                         SELECT+UPDATE hermes_notifications)

─────────────────────────────────────────────────────────────────

Flujo de notificación de orden nueva:

INSERT en orders (cualquier origen)
      │
      ▼
trigger AFTER INSERT: trg_hermes_notify_new_order
      │  (SECURITY DEFINER, fallo nunca aborta la orden)
      ▼
hermes_notify_new_order()
      ├─ INSERT en public.hermes_notifications (order_id UNIQUE → dedup)
      └─ pg_notify('hermes_new_order', id)  ← wakeup al notifier
                  │
                  ▼
      hermes-mhans-notifier (3er servicio compose)
        conexión psycopg dedicada, autocommit
        LISTEN + catch-up al reconectar
        loop: conn.notifies(timeout=60, stop_after=1)
                  │
                  ▼
        Mensaje Telegram (texto plano, sin parse_mode)
        a todos los admins con /start al bot
```

---

## Los 21 tools del MCP "rental"

Lectura (14):

| Tool | Propósito | Tipo |
|------|-----------|------|
| `quote_rental` | Calcula cotización con fórmulas testeadas (precio/día × cantidad × jornadas, IVA, descuentos) | Lectura |
| `check_availability` | Verifica disponibilidad de equipos en un rango de fechas | Lectura |
| `get_product_catalog` | Busca/lista el catálogo de equipos (por query, SKU, categoría, disponibilidad) | Lectura |
| `get_order_status` | Obtiene estado completo de una orden por ID (cliente, fechas, workflow, links PDF) | Lectura |
| `list_orders` | Lista órdenes con filtros opcionales (estado, rango de fechas) | Lectura |
| `list_client_orders` | Historial de órdenes de un cliente específico (user_id, limit) | Lectura |
| `client_stats` | Estadísticas históricas de un cliente: nº órdenes, total acumulado CLP, última orden | Lectura |
| `list_pickups_today` | Lista retiros y devoluciones del día | Lectura |
| `find_client` | Busca clientes por nombre, email, RUT, teléfono o empresa | Lectura |
| `get_client` | Obtiene el perfil de un cliente por user_id (PII opcional) | Lectura |
| `contract_status` | Verifica el estado de contrato de un cliente | Lectura |
| `revenue_report` | Reporte de ingresos en un rango de fechas | Lectura |
| `product_demand` | Demanda de productos (ranking de equipos más solicitados por período) | Lectura |
| `low_stock_report` | Productos con `stock_status` distinto de `instock` | Lectura |

Escritura draft→confirm (7):

| Tool | Propósito | Tipo |
|------|-----------|------|
| `draft_create_order` | Genera plan de nueva orden con validaciones (disponibilidad, contrato) | Escritura draft→confirm |
| `update_order_status_draft` | Genera plan de cambio de estado con validaciones de transición | Escritura draft→confirm |
| `draft_generate_contract` | Genera plan para crear contrato PDF de usuario | Escritura draft→confirm |
| `draft_update_client` | Genera plan de edición de cliente (9 campos editables, preview campo por campo) | Escritura draft→confirm |
| `draft_create_client` | Genera plan de creación de cliente (Supabase Auth + perfil + email de bienvenida) | Escritura draft→confirm |
| `confirm_write` | Ejecuta el plan aprobado por el operador (token single-use, TTL 15min) | Ejecución |
| `cancel_write` | Cancela un plan pendiente sin ejecutarlo | Ejecución (cancela) |

### Campos editables en `draft_update_client`

Solo estos 9 campos están en la allowlist `SAFE_CLIENT_FIELDS` de `validators.py`:
`nombre`, `apellido`, `telefono`, `direccion`, `ciudad`, `empresa_nombre`, `empresa_rut`, `instagram`, `tipo_cliente`.

Campos PROHIBIDOS de editar vía agente: `rut`, `email`, `auth_uid`, cualquier `url_*`, `terminos_aceptados`.

### Acciones de `confirm_write`

- `create_order` — INSERT transaccional en orders + order_items
- `update_order_status` — UPDATE de estado + acciones automáticas (PDF/email del dashboard)
- `generate_contract` — genera PDF de contrato vía dashboard
- `create_client` — POST a `/api/external/create-user` del dashboard (idempotente por email, 409 si ya existe)
- `update_client` — POST a `/api/external/update-user` del dashboard (idempotente, campos allowlisteados)

Las acciones HTTP (`create_client`, `update_client`) son best-effort: marcan `consumed_at` en la tabla `hermes_pending_writes` SOLO si el POST fue exitoso. Si Vercel cae, el token sigue disponible para reintento. Las acciones DB usan CAS atómico (`UPDATE ... WHERE consumed_at IS NULL RETURNING`) para prevenir doble ejecución.

---

## El Notifier en Detalle

### Garantías

- **At-least-once**: la notificación se envía al menos una vez. Si el proceso cae y reinicia, hace catch-up leyendo filas `WHERE notified_at IS NULL` en `hermes_notifications`.
- **Dedup en base de datos**: `hermes_notifications.order_id` es `UNIQUE` con `ON CONFLICT DO NOTHING` — si el trigger dispara dos veces (edge case), se inserta una sola fila.
- **Fallo transparente para la orden**: el trigger usa `BEGIN...EXCEPTION WHEN OTHERS THEN RETURN NEW`. Un error en la notificación JAMÁS aborta la inserción de la orden.
- **Reintentos con cap**: máximo 5 intentos por notificación. Los errores 429 (rate limit de Telegram) NO consumen intento — respetan el header `Retry-After`. Un error 403 (admin sin `/start` al bot) registra el fallo pero no reintenta indefinidamente.

### Formato del mensaje (ejemplo real)

```
Nueva orden recibida
Orden: #1847
Cliente: Ana Torres
Telefono: +56912345678
Proyecto: Campaña Puma Primavera
Fechas: 10/06/2026 al 12/06/2026 (3 jornadas)
Equipos:
• Canon EOS R5 ×1 — $45.000/día
• Profoto B10 Plus ×2 — $38.000/día
• Trípode Manfrotto 055 ×1 — $12.000/día
Subtotal: $303.000
IVA: $57.570
Total: $360.570 CLP
Estado: on-hold
```

Reglas del mensaje:
- Texto plano sin `parse_mode` — previene inyección de formato Markdown
- PII mínima: SIN rut, email, dirección ni URLs de documentos
- Máximo 10 líneas de equipos; si hay más: "… y N equipos más"
- Precios en formato CLP: `$1.234.567`

### Gotcha crítico — psycopg 3.x

El generator `conn.notifies()` lockea la conexión. Hacer queries dentro del `async for` produce deadlock. El loop usa `stop_after=1` + `timeout=60` para cerrar el generator antes de procesar y liberar la conexión. El `timeout=60s` es el failsafe anti-pérdida: si llega un NOTIFY pero el generator ya expiró, el catch-up al reconectar recupera la fila pendiente.

---

## Operación

### Layout del VPS (post-F8)

```
/opt/hermes-mhans/          ← código fuente (bind :ro al contenedor)
  rental-mcp/               ← server MCP de dominio (Python/FastMCP)
    rental_mcp/
      server.py             ← 21 tools
      validators.py         ← SAFE_CLIENT_FIELDS, _validate_email, _validate_rut
      notifier/             ← servicio notifier (módulo independiente)
  skills/                   ← playbooks del agente
  scripts/                  ← scripts de setup y deploy
  Dockerfile

/opt/agents/mhans/          ← compose + variables de entorno
  docker-compose.yml        ← define los 3 servicios
  .env                      ← secretos (NUNCA commitear)
```

> Nota: el `docker-compose.yml` de este repo es el layout standalone original (containers `hermes-mhans` / `hermes-mhans-dashboard`). El compose VIVO en producción es `/opt/agents/mhans/docker-compose.yml` (post-F8, control plane), con containers `hermes-mhans-main`, `hermes-mhans-main-dashboard` y `hermes-mhans-notifier` — y está versionado en `hermes-control-plane/deploy/agents-vps/mhans/`. Los comandos de esta guía usan los nombres de producción.

### Los 3 servicios de docker-compose

| Servicio / Contenedor | mem_limit | Propósito |
|-----------------------|-----------|-----------|
| `hermes-mhans-main` | 600m | Gateway Telegram (el agente LLM) |
| `hermes-mhans-main-dashboard` | 256m | Dashboard web en loopback 127.0.0.1:9120 |
| `hermes-mhans-notifier` | 128m | Notifier de órdenes nuevas (stateless) |

Los 3 usan la misma imagen `hermes-mhans:local`; en el compose de producción el nombre de servicio y de contenedor coinciden.

El notifier usa `entrypoint: ["tini","--"]` para saltear el `entrypoint.sh` base (que siembra `HERMES_HOME` y no aplica al notifier), y `command: python -m rental_mcp.notifier`.

### Variables de entorno (`.env` en `/opt/agents/mhans/`)

| Variable | Descripción | Notas |
|----------|-------------|-------|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram | Obligatoria |
| `TELEGRAM_ALLOWED_USERS` | Lista de user_ids permitidos (allowlist) | Obligatoria |
| `MINIMAX_API_KEY` | API key del modelo MiniMax-M3 | Obligatoria |
| `DATABASE_URL` | Conexión a Supabase (rol hermes_ro) | Para MCP rentaldb y lectura general |
| `DATABASE_URL_RW` | Conexión a Supabase (rol hermes_rw) | Para confirm_write de órdenes/contratos |
| `DATABASE_URL_NOTIFIER` | Conexión directa al postmaster :5434 (rol hermes_notifier) | LISTEN/NOTIFY — requiere postmaster directo, NO pooler; lo escribe `setup-db-role-notifier.sh` |
| `DASHBOARD_API_URL` | URL base del dashboard (`https://dashboard.mariohans.cl`) | Estuvo AUSENTE — causa raíz de "dashboard caído" |
| `DASHBOARD_API_TOKEN` | Secreto estático 32 chars == `FRONTEND_API_SECRET` de Vercel | NO es JWT — el comentario viejo era erróneo |
| `HERMES_HOME` | Directorio de datos del agente (volumen persistente) | Sembrado por entrypoint.sh |
| `LOG_LEVEL` | Nivel de logging (INFO por defecto) | Opcional |

> GOTCHA: `env_file` se lee al CREAR el contenedor. Cambiar el `.env` requiere `docker compose up -d` (recreate). Un `docker compose restart` NO toma los cambios nuevos.

### Scripts y su orden de ejecución (primer despliegue)

```bash
# Orden recomendado (cada uno es idempotente):
# 1. Roles DB de lectura y escritura (ya existían)
ssh hermes-vps 'bash -s' < scripts/setup-db-role.sh        # hermes_ro
ssh hermes-vps 'bash -s' < scripts/setup-db-role-rw.sh     # hermes_rw

# 2. Rol y tabla del notifier (NUEVO)
ssh hermes-vps 'bash -s' < scripts/setup-db-role-notifier.sh  # hermes_notifier + DATABASE_URL_NOTIFIER al .env

# 3. Tabla, función y trigger de notificaciones (NUEVO)
ssh hermes-vps 'bash -s' < scripts/setup-notifications.sh     # tabla hermes_notifications + trigger + smoke test

# 4. Policy RLS para roles hermes en user_profiles (NUEVO)
ssh hermes-vps 'bash -s' < scripts/setup-rls-hermes.sh        # requiere que los 3 roles existan

# 5. Completar .env a mano: TELEGRAM_*, MINIMAX_API_KEY, DASHBOARD_API_URL, DASHBOARD_API_TOKEN
# 6. Deploy
bash scripts/deploy.sh --build
docker compose -f /opt/agents/mhans/docker-compose.yml logs -f
```

El script `setup-notifications.sh` incluye un smoke test que clona la última orden real en una transacción con `ROLLBACK` para verificar que el trigger y la función funcionan sin datos permanentes.

### Cómo deployar cambios

| Tipo de cambio | Acción |
|---------------|--------|
| Código `rental-mcp/` (server.py, validators.py, notifier/) | `bash scripts/deploy.sh` — el bind `:ro` hace que el restart del servicio tome el código nuevo sin rebuild |
| `Dockerfile` o dependencias Python | `bash scripts/deploy.sh --build` |
| Variables en `.env` | Editar `.env` en VPS + `docker compose -f /opt/agents/mhans/docker-compose.yml up -d` (recreate, no restart) |
| `SOUL.md` o `config.yaml` | `bash scripts/deploy.sh --reseed` |
| Skills del agente | Ver sección siguiente |

### Cómo actualizar skills sin pisar las runtime

Las skills se siembran una sola vez al crear el contenedor. El volumen persistente puede tener skills creadas en runtime (ej: "cobranza" creada por el agente directamente). Para actualizar una skill existente sin destruir las runtime:

```bash
# Copiar la skill actualizada al volumen (no pisar el directorio completo)
docker exec hermes-mhans-main cp -r \
  /opt/hermes/skills.default/rental/<nombre-skill>/. \
  /data/.hermes/skills/rental/<nombre-skill>/

# Verificar que la skill fue copiada
docker exec hermes-mhans-main ls /data/.hermes/skills/rental/
```

NO hacer `cp -r /opt/hermes/skills.default/rental/ /data/.hermes/skills/rental/` porque pisa todo el directorio y elimina skills runtime.

---

## Troubleshooting

| Síntoma | Causa probable | Diagnóstico | Fix |
|---------|---------------|-------------|-----|
| El agente devuelve "0 filas" o "cliente no encontrado" cuando el dato existe | RLS en `user_profiles` bloquea el rol sin policy | `SELECT relrowsecurity FROM pg_class WHERE relname='user_profiles';` → `true`. Comparar counts con `hermes_ro` vs `service_role` | Correr `scripts/setup-rls-hermes.sh` (crea la policy de SELECT para los 3 roles hermes) |
| `confirm_write` con `create_client` o `update_client` devuelve "dashboard caído o mal configurado" | `DASHBOARD_API_URL` o `DASHBOARD_API_TOKEN` vacíos en el entorno del contenedor | `docker exec hermes-mhans-main env \| grep DASHBOARD` | Editar `.env` con los valores correctos + `docker compose up -d` (recreate, NO restart) |
| Notifier conectado (log "LISTEN ok") pero no procesa órdenes nuevas | Deadlock por queries dentro de `conn.notifies()` (versión vieja del loop) ó NOTIFY no llega porque se conecta al pooler en vez del postmaster | Ver logs del notifier; verificar que `DATABASE_URL_NOTIFIER` apunta a puerto 5434 (postmaster), no 5432 (pooler) | Actualizar código con `deploy.sh`; verificar URL |
| Admins no reciben notificación, log muestra 403 | El admin no hizo `/start` al bot de Telegram | Log: `sendMessage returned 403` | El admin debe abrir el bot en Telegram y enviar `/start` |
| Mensaje de notificación llega con "Cliente: —" | RLS bloquea el JOIN del notifier en `user_profiles` | `docker exec hermes-mhans-notifier env \| grep DATABASE_URL_NOTIFIER`; verificar policy RLS | Correr `scripts/setup-rls-hermes.sh` con el rol `hermes_notifier` incluido |

---

## Seguridad

### Roles de base de datos (mínimo privilegio)

| Rol | Permisos |
|-----|----------|
| `hermes_ro` | SELECT en tablas de negocio (lectura tipada via MCP rentaldb) |
| `hermes_rw` | SELECT + INSERT + UPDATE en tablas de negocio, SIN DELETE. Dueño de `hermes_pending_writes` |
| `hermes_notifier` | SELECT en `orders` + `user_profiles`. SELECT + UPDATE en `hermes_notifications`. Sin INSERT ni DELETE en tablas de negocio |

### RLS en `user_profiles`

La tabla tiene RLS habilitado. Los roles hermes tienen `GRANT` de SELECT pero sin policy RLS = 0 filas SIN error (el gotcha silencioso de Postgres). La policy de lectura se crea con `setup-rls-hermes.sh`:

```sql
CREATE POLICY "Hermes agents can read user_profiles"
  ON public.user_profiles FOR SELECT
  TO hermes_ro, hermes_rw, hermes_notifier
  USING (true);
```

Las tablas `orders` y `products` NO tienen RLS habilitado.

### Doble cerrojo en escrituras

1. **Allowlist de campos**: `SAFE_CLIENT_FIELDS` en `validators.py` filtra los campos ANTES de generar el draft. Un campo fuera del set retorna error 400 con la lista permitida.
2. **Allowlist server-side en el dashboard**: los endpoints `/api/external/create-user` y `/api/external/update-user` validan los mismos 9 campos de forma independiente. El dashboard no confía en que el agente ya filtró.
3. **Token single-use + TTL**: `confirm_write` usa CAS atómico (`UPDATE ... WHERE consumed_at IS NULL RETURNING`) para que el mismo plan no se ejecute dos veces.
4. **Rate limit en dashboard**: los endpoints externos tienen rate limit de 5 req/min por IP.

### PII en notificaciones

El mensaje del notifier incluye solo: nombre+apellido, teléfono, proyecto, fechas, equipos con precios, totales, estado. NO incluye: RUT, email, dirección, URLs de documentos, fotos de garantía.

### Validación de RUT

`validators.py` implementa el algoritmo módulo-11 con el ciclo de factores `(i % 6) + 2`. El algoritmo original en `server.py` estaba incorrecto — fue corregido y centralizado en `validators.py`.

---

## Verificación

### Tests automatizados

```bash
# Dentro del contenedor (o en CI)
cd /opt/rental-mcp && python -m pytest -q

# Total esperado: 113 passed
# Breakdown:
#   Golden pricing tests:      22
#   Golden availability tests: 11
#   Notifier tests:            44
#   Client tools tests:        36
```

CI: `.github/workflows/rental-mcp-tests.yml` corre en cada push que toque `hermes-mhans/rental-mcp/`.

### Smoke test de notificaciones (sin datos permanentes)

El script `setup-notifications.sh` corre automáticamente un smoke test que:
1. Clona la última orden real en una transacción
2. Verifica que el trigger inserta en `hermes_notifications`
3. Hace ROLLBACK — ningún dato persiste

Para verificar manualmente que el notifier procesa:

```bash
# Ver logs del notifier en tiempo real
docker compose -f /opt/agents/mhans/docker-compose.yml logs -f hermes-mhans-notifier

# Verificar filas pendientes de notificación
docker exec hermes-mhans-notifier psql "$DATABASE_URL_NOTIFIER" \
  -c "SELECT id, order_id, attempts, notified_at, last_error FROM hermes_notifications ORDER BY created_at DESC LIMIT 10;"
```

### E2E con orden clonada

Para verificar el flujo completo (trigger → outbox → notifier → Telegram):

```bash
# Insertar una orden de prueba (clonar la última real)
docker exec hermes-mhans-notifier psql "$DATABASE_URL_NOTIFIER" -c "
INSERT INTO orders (SELECT * FROM orders ORDER BY id DESC LIMIT 1)
  ON CONFLICT DO NOTHING
  RETURNING id;
"
# El trigger debe dispararse y el notifier enviar el mensaje en ~1-5s
```
