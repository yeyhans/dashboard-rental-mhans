#!/usr/bin/env bash
# Bootstrap del contenedor Hermes de mhans.
# Siembra config base + identidad (SOUL.md) + skills la PRIMERA vez, sin pisar
# cambios posteriores del usuario o del propio agente (persisten en el volumen).
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-/data/.hermes}"
mkdir -p "$HERMES_HOME"

if [ ! -f "$HERMES_HOME/config.yaml" ] && [ -f /opt/hermes/config.yaml.default ]; then
    cp /opt/hermes/config.yaml.default "$HERMES_HOME/config.yaml"
    echo "[entrypoint] config.yaml base instalado en $HERMES_HOME"
fi

# Identidad del agente: SOUL.md es el slot #1 del system prompt de Hermes.
if [ ! -f "$HERMES_HOME/SOUL.md" ] && [ -f /opt/hermes/SOUL.md.default ]; then
    cp /opt/hermes/SOUL.md.default "$HERMES_HOME/SOUL.md"
    echo "[entrypoint] SOUL.md (identidad mhans) instalado en $HERMES_HOME"
fi

# Skills del rental: seed-once POR SKILL (namespace rental/*). No pisa skills
# que el agente cree con skill_manage ni ediciones posteriores en el volumen.
if [ -d /opt/hermes/skills.default/rental ]; then
    mkdir -p "$HERMES_HOME/skills/rental"
    for src in /opt/hermes/skills.default/rental/*/; do
        name="$(basename "$src")"
        dst="$HERMES_HOME/skills/rental/$name"
        if [ ! -d "$dst" ]; then
            cp -r "$src" "$dst"
            echo "[entrypoint] skill rental/$name sembrada"
        fi
    done
fi

echo "[entrypoint] Hermes Agent: $(hermes --version 2>/dev/null || echo 'version desconocida')"
echo "[entrypoint] Arrancando: $*"

# Entrega el control al proceso principal (gateway). tini queda como PID 1.
exec "$@"
