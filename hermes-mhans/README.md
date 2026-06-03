# Hermes de mhans — asistente de negocio del rental

Asistente de IA para **Mario Hans Rental Fotográfico** en el VPS (instancia
aislada del Hermes de farmiemos). Gateway por **Telegram** (bot propio,
long-polling, sin puertos expuestos). Arquitectura **MCP de dominio + Skills**.

## Arquitectura v2

```
Telegram (admin) ←→ hermes-mhans (gateway, MiniMax-M3)
                        │  SOUL.md (identidad) + skills/ (playbooks)
                        ├─ MCP "rental"   → rental-mcp (Python/FastMCP propio)
                        │     lectura tipada: quote_rental (fórmulas testeadas),
                        │     check_availability, órdenes, clientes, reportes
                        │     escritura: draft_* → confirm_write (token en DB,
                        │     single-use, TTL 15min) → INSERT transaccional →
                        │     dispara PDF/email del dashboard
                        ├─ MCP "rentaldb" → postgres-mcp crystaldba RESTRICTED
                        │     SQL ad-hoc SOLO lectura (tools.include recortado)
                        └─ DB: Supabase self-hosted (red docker interna :5434)
                              roles: hermes_ro (SELECT) / hermes_rw (sin DELETE)
```

**Por qué así** (workflow de investigación, 2026-06): MCP tipado para lo
determinista (el LLM no calcula plata) + skills para metodología (benchmark
Supabase: MCP+Skill 71% vs 46% baseline). El `approvals.mode` de Hermes NO
cubre MCP tools (verificado) → la aprobación vive en el diseño draft→confirm.

## Estructura

```
Dockerfile            imagen DERIVADA hermes-mhans:local (deps python + crystaldba)
docker-compose.yml    gateway + dashboard (127.0.0.1:9120, túnel SSH)
config.yaml           plantilla → volumen (mcp_servers rental + rentaldb)
SOUL.md               identidad (SIN fórmulas — viven en rental-mcp)
skills/rental/        cotizar, orden, cliente, catalogo, reglas-mhans
rental-mcp/           server MCP de dominio (pytest: tests/ golden)
scripts/
  rental-mcp.sh       wrapper stdio del server de dominio
  rentaldb-mcp.sh     wrapper crystaldba --access-mode=restricted
  setup-db-role.sh    rol hermes_ro (lectura) + DATABASE_URL en .env
  setup-db-role-rw.sh rol hermes_rw + tabla hermes_pending_writes + URL_RW
  pg-mcp.sh           LEGACY (server deprecated) — ya no se usa
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
ssh hermes-vps 'bash -s' < scripts/setup-db-role.sh
ssh hermes-vps 'bash -s' < scripts/setup-db-role-rw.sh
# 2. completar .env del VPS: TELEGRAM_*, MINIMAX_API_KEY, DASHBOARD_API_*
# 3. bash scripts/deploy.sh --build
docker compose logs -f hermes-mhans
# 4. golden tests dentro del contenedor
docker compose exec hermes-mhans bash -c 'cd /opt/rental-mcp && python -m pytest -q'
```

Resembrar config/SOUL/skills desde plantillas: `docker compose stop` →
borrar el archivo del volumen (`docker run --rm -v hermes_mhans_data:/d alpine
rm -f /d/config.yaml /d/SOUL.md`) → `docker compose up -d`. (Con contenedores
PARADOS: Hermes reescribe SOUL.md al shutdown.)

## Escrituras — protocolo de aprobación

1. `draft_create_order` / `update_order_status_draft` / `draft_generate_contract`
   validan (contrato obligatorio, transición, disponibilidad) y persisten el
   plan + token en `hermes_pending_writes` (sobrevive recreates).
2. El agente muestra el preview por Telegram y espera un "sí" explícito.
3. `confirm_write(plan_id, token)` — re-valida, RE-calcula con funciones puras
   (persiste SUS números), INSERT transaccional, dispara PDF/email del
   dashboard (best-effort), marca el token consumido.

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
