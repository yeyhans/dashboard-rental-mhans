#!/usr/bin/env bash
# Lanza el servidor MCP de DOMINIO del rental (rental-mcp, Python/FastMCP).
# Lo invoca Hermes como subproceso stdio (config.yaml -> mcp_servers.rental).
# Secretos via entorno declarado en config (${VAR} interpolado por Hermes).
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL no definida — ver env.example}"
# DATABASE_URL_RW / DASHBOARD_API_* son opcionales: sin ellas, las tools de
# escritura/side-effects degradan con error claro (no crashean el server).
export PYTHONPATH="/opt/rental-mcp${PYTHONPATH:+:$PYTHONPATH}"
exec python -m rental_mcp
