# Imagen DERIVADA para el Hermes de mhans.
# FROM la imagen compartida (hermes-agent:local) + dependencias propias:
#   - postgres-mcp (crystaldba "Postgres MCP Pro") -> reemplaza al server
#     @modelcontextprotocol/server-postgres DEPRECATED (CVE statement-stacking).
#     Se ejecuta con --access-mode=restricted (transaccion read-only + pglast).
#   - deps del rental-mcp (server MCP de dominio propio): mcp (FastMCP oficial),
#     psycopg3, pydantic, httpx, pytest (para correr los golden tests dentro).
# Derivar AISLA a farmiemos: rebuildear esto NO toca hermes-agent:local.
FROM hermes-agent:local

# Ya somos user hermes (heredado). pip --user -> ~/.local (mismo prefix que hermes-agent).
RUN pip install --no-cache-dir --user \
        "mcp>=1.2" \
        "psycopg[binary]>=3.1" \
        "pydantic>=2" \
        "httpx>=0.27" \
        "pytest>=8" \
        "postgres-mcp"

# El codigo de rental-mcp se monta por bind mount en /opt/rental-mcp (compose),
# NO se hornea: iterar sin rebuild. PYTHONPATH lo fija el wrapper rental-mcp.sh.
