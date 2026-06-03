#!/usr/bin/env bash
# Lanza postgres-mcp (crystaldba, "Postgres MCP Pro") en modo RESTRICTED:
# transaccion read-only + statement timeout + parseo SQL (pglast) — cierra el
# CVE de statement-stacking del viejo @modelcontextprotocol/server-postgres.
# Doble cerrojo: ademas el rol hermes_ro solo tiene SELECT.
# crystaldba lee DATABASE_URI (no DATABASE_URL).
set -euo pipefail
: "${DATABASE_URI:?DATABASE_URI no definida — ver env.example}"
exec postgres-mcp --access-mode=restricted
