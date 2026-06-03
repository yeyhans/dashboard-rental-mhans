#!/usr/bin/env bash
# Smoke: handshake stdio contra rental-mcp y listar tools.
set -uo pipefail
OUT=$( { printf "%s\n" "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"smoke\",\"version\":\"1\"}}}"; printf "%s\n" "{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}"; printf "%s\n" "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}"; sleep 8; } | timeout 40 /usr/local/bin/rental-mcp.sh 2>/tmp/rental-smoke.err )
echo "$OUT" | python -c "
import sys, json
ok = False
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try: m = json.loads(line)
    except Exception: continue
    if m.get(\"id\") == 2 and \"result\" in m:
        names = sorted(t[\"name\"] for t in m[\"result\"][\"tools\"])
        print(f\"TOOLS({len(names)}): \" + \", \".join(names)); ok = True
if not ok: print(\"SIN tools/list — ver stderr\")
"
tail -3 /tmp/rental-smoke.err
