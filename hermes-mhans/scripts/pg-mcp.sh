#!/usr/bin/env bash
# Lanza el servidor MCP de Postgres (SOLO LECTURA) contra la DB del rental.
# Lo invoca Hermes como subproceso stdio (config.yaml -> mcp_servers.rentaldb).
# El connection string viene del entorno (.env del compose), NUNCA de este archivo.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL no definida — ver env.example}"
exec npx -y @modelcontextprotocol/server-postgres "$DATABASE_URL"
