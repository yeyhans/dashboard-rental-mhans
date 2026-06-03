#!/usr/bin/env bash
set -uo pipefail
OUT=$( { printf "%s\n" "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"smoke\",\"version\":\"1\"}}}"; printf "%s\n" "{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}"; printf "%s\n" "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"quote_rental\",\"arguments\":{\"product_ids\":[5630],\"start_date\":\"2026-04-01\",\"end_date\":\"2026-04-03\"}}}"; sleep 10; } | timeout 50 /usr/local/bin/rental-mcp.sh 2>/tmp/call-smoke.err )
echo "$OUT" | python -c "
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try: m = json.loads(line)
    except Exception: continue
    if m.get(\"id\") == 2:
        r = m.get(\"result\", {})
        content = r.get(\"content\") or r.get(\"structuredContent\") or r
        print(json.dumps(content, ensure_ascii=False, indent=1)[:900])
"
