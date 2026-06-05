#!/usr/bin/env bash
# Deploy de hermes-mhans al VPS (/opt/hermes-mhans) desde el repo del dashboard.
# Uso:  bash scripts/deploy.sh            -> sync + restart suave (gateway)
#       bash scripts/deploy.sh --build    -> sync + rebuild imagen + recreate
#       bash scripts/deploy.sh --reseed   -> ADEMAS resiembra config/SOUL desde
#                                            plantillas (pisa cambios runtime)
# Requiere: atajo SSH `hermes-vps` (~/.ssh/config) y rsync local.
# NUNCA toca el .env del VPS (los secretos viven SOLO alla).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# POST-F8: el CÓDIGO sigue en /opt/hermes-mhans/ (los binds del compose vivo
# apuntan ahí); el compose + .env viven en /opt/agents/mhans/.
DEST=hermes-vps:/opt/hermes-mhans/

echo "[deploy] sync $HERE -> $DEST"
if command -v rsync >/dev/null 2>&1; then
  rsync -az --delete \
    --exclude '.env' \
    --exclude '__pycache__/' \
    --exclude '.pytest_cache/' \
    --exclude '*.pyc' \
    "$HERE/" "$DEST"
else
  # Git Bash de Windows no trae rsync: tar over ssh (NO borra huérfanos en
  # destino — si renombrás/borrás archivos, limpialos a mano en el VPS).
  echo "[deploy] rsync no disponible -> tar over ssh"
  tar -C "$HERE" \
    --exclude='.env' \
    --exclude='__pycache__' \
    --exclude='.pytest_cache' \
    --exclude='*.pyc' \
    -czf - . | ssh hermes-vps 'tar -C /opt/hermes-mhans -xzf -'
fi

ssh hermes-vps "chmod +x /opt/hermes-mhans/scripts/*.sh /opt/hermes-mhans/entrypoint.sh"

if [[ "${1:-}" == "--reseed" || "${2:-}" == "--reseed" ]]; then
  echo "[deploy] reseed: parar -> borrar config/SOUL del volumen -> arrancar"
  ssh hermes-vps "cd /opt/agents/mhans && docker compose stop >/dev/null 2>&1 && docker run --rm -v hermes_mhans_data:/d alpine rm -f /d/config.yaml /d/SOUL.md"
fi

if [[ "${1:-}" == "--build" ]]; then
  echo "[deploy] rebuild imagen derivada + recreate"
  ssh hermes-vps "cd /opt/agents/mhans && docker compose build && docker compose up -d --force-recreate"
else
  echo "[deploy] restart gateway (codigo rental-mcp es bind mount: alcanza)"
  ssh hermes-vps "cd /opt/agents/mhans && docker compose up -d && docker restart hermes-mhans-main >/dev/null"
fi

echo "[deploy] estado:"
ssh hermes-vps "cd /opt/agents/mhans && docker compose ps --format '{{.Name}} {{.Status}}' && sleep 12 && docker logs --since 1m hermes-mhans-main 2>&1 | grep -icE 'mcp.*(fail|error)' | xargs -I{} echo 'errores MCP: {}'"
echo "[deploy] OK"
