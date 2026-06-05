# Hermes de mhans — asistente de negocio del rental

Asistente de IA para **Mario Hans Rental Fotográfico** en el VPS (instancia
aislada del Hermes de farmiemos). Gateway por **Telegram** (bot propio,
long-polling, sin puertos expuestos). Arquitectura **MCP de dominio + Skills**.

## Arquitectura v2

```
Telegram (admin) ←→ hermes-mhans (gateway, MiniMax-M3)
                        │  SOUL.md (identidad) + skills/ (playbooks)
                        ├─ MCP "rental"   → rental-mcp (Python/FastMCP propio)
                        │     21 tools: lectura tipada + gestión de clientes +
                        │     escritura draft→confirm (token single-use, TTL 15min)
                        │     → INSERT transaccional → dispara PDF/email dashboard
                        ├─ MCP "rentaldb" → postgres-mcp crystaldba RESTRICTED
                        │     SQL ad-hoc SOLO lectura (tools.include recortado)
                        └─ DB: Supabase self-hosted (red docker interna :5434)
                              roles: hermes_ro (SELECT) / hermes_rw (sin DELETE)
                                     hermes_notifier (SELECT+UPDATE notificaciones)

Flujo de notificación automática:
  INSERT en orders → trigger trg_hermes_notify_new_order
    → INSERT en hermes_notifications (dedup por order_id UNIQUE)
    → pg_notify('hermes_new_order') → hermes-mhans-notifier
    → sendMessage a todos los admins con /start al bot
```

**Por qué así** (workflow de investigación, 2026-06): MCP tipado para lo
determinista (el LLM no calcula plata) + skills para metodología (benchmark
Supabase: MCP+Skill 71% vs 46% baseline). El `approvals.mode` de Hermes NO
cubre MCP tools (verificado) → la aprobación vive en el diseño draft→confirm.

## Estructura

```
Dockerfile            imagen DERIVADA hermes-mhans:local (deps python + crystaldba)
docker-compose.yml    3 servicios: gateway + dashboard (127.0.0.1:9120) + notifier
config.yaml           plantilla → volumen (mcp_servers rental + rentaldb)
SOUL.md               identidad (SIN fórmulas — viven en rental-mcp)
GUIA.md               guía completa del agente (operación, troubleshooting, seguridad)
skills/rental/        cotizar, orden, cliente v2.0.0, catalogo, reglas-mhans
rental-mcp/           server MCP de dominio (pytest: 113 tests — golden pricing/availability + notifier + client tools)
  rental_mcp/
    server.py         21 tools MCP
    validators.py     SAFE_CLIENT_FIELDS, validación email/RUT módulo-11
    notifier/         servicio de notificación de órdenes nuevas (LISTEN/NOTIFY)
scripts/
  rental-mcp.sh           wrapper stdio del server de dominio
  rentaldb-mcp.sh         wrapper crystaldba --access-mode=restricted
  setup-db-role.sh        rol hermes_ro (lectura) + DATABASE_URL en .env
  setup-db-role-rw.sh     rol hermes_rw + tabla hermes_pending_writes + URL_RW
  setup-db-role-notifier.sh  rol hermes_notifier + DATABASE_URL_NOTIFIER al .env (NUEVO)
  setup-notifications.sh     tabla hermes_notifications + trigger + smoke test (NUEVO)
  setup-rls-hermes.sh        policy RLS SELECT para roles hermes en user_profiles (NUEVO)
  pg-mcp.sh               LEGACY (server deprecated) — ya no se usa
```

## Repo y deploy

Esta carpeta vive en el repo del **dashboard** (`yeyhans/dashboard-rental-mhans`)
para versionar el agente junto al negocio. Vercel la ignora (`.vercelignore`);
el deploy real es al VPS. CI: `.github/workflows/rental-mcp-tests.yml` corre
los golden tests en cada push que toque `hermes-mhans/rental-mcp/`.

### Deploy al VPS (desde esta carpeta)

```bash
bash scripts/deploy.sh            # sync rsync + restart gateway (código/skills)
bash scripts/deploy.sh --build    # + rebuild imagen derivada (Dockerfile/deps)
bash scripts/deploy.sh --reseed   # + resiembra config/SOUL desde plantillas
```

`deploy.sh` NUNCA toca el `.env` del VPS — los secretos viven solo allá.

### Primer despliegue (una vez — ya hecho en este VPS)

```bash
# 1. roles DB (idempotentes, generan/rotan passwords y escriben .env del VPS)
#    Orden obligatorio: ro → rw → notifier → notifications → rls
ssh hermes-vps 'bash -s' < scripts/setup-db-role.sh
ssh hermes-vps 'bash -s' < scripts/setup-db-role-rw.sh
ssh hermes-vps 'bash -s' < scripts/setup-db-role-notifier.sh
ssh hermes-vps 'bash -s' < scripts/setup-notifications.sh
ssh hermes-vps 'bash -s' < scripts/setup-rls-hermes.sh
# 2. completar .env del VPS: TELEGRAM_*, MINIMAX_API_KEY, DASHBOARD_API_URL, DASHBOARD_API_TOKEN
# 3. bash scripts/deploy.sh --build
docker compose -f /opt/agents/mhans/docker-compose.yml logs -f
# 4. tests dentro del contenedor (113 passed esperado)
docker compose -f /opt/agents/mhans/docker-compose.yml exec hermes-mhans-main \
  bash -c 'cd /opt/rental-mcp && python -m pytest -q'
```

Ver detalles completos de operación, variables de entorno y troubleshooting: `GUIA.md`.

Resembrar config/SOUL/skills desde plantillas: `docker compose stop` →
borrar el archivo del volumen (`docker run --rm -v hermes_mhans_data:/d alpine
rm -f /d/config.yaml /d/SOUL.md`) → `docker compose up -d`. (Con contenedores
PARADOS: Hermes reescribe SOUL.md al shutdown.)

## Escrituras — protocolo de aprobación

1. `draft_create_order` / `update_order_status_draft` / `draft_generate_contract` /
   `draft_create_client` / `draft_update_client`
   validan (contrato obligatorio, transición, disponibilidad, allowlist de campos)
   y persisten el plan + token en `hermes_pending_writes` (sobrevive recreates).
2. El agente muestra el preview por Telegram y espera un "sí" explícito.
3. `confirm_write(plan_id, token)` — re-valida, RE-calcula con funciones puras
   (persiste SUS números), INSERT transaccional, dispara PDF/email del
   dashboard (best-effort), marca el token consumido.
   Acciones HTTP (create_client/update_client): best-effort vía `/api/external/*`;
   `consumed_at` solo se marca si el POST fue exitoso (permite reintento si Vercel cae).

Cerrojo real = token single-use + TTL + rol sin DELETE. La pregunta del agente
es la capa humana. Cron: SOLO lectura (skills lo prohíben; el job no recibe
confirmación humana).

## Cron de retiros (opcional, post-deploy)

Mandar por Telegram: *"Creá un cron job diario a las 09:00 que llame
list_pickups_today y me mande el resumen de retiros y devoluciones del día.
Solo lectura."* (el tool cronjob del agente lo registra con su formato nativo).

## Dashboard web

`ssh hermes-mhans-dash` → http://localhost:9120 (bind solo loopback del VPS).

## Rotación de credenciales

```bash
ssh hermes-vps 'bash -s' < scripts/setup-db-role.sh      # hermes_ro
ssh hermes-vps 'bash -s' < scripts/setup-db-role-rw.sh   # hermes_rw
ssh hermes-vps 'cd /opt/hermes-mhans && docker compose up -d --force-recreate'
```
