"""
Entry point: python -m rental_mcp

Runs the FastMCP server over stdio.
NOTHING must be printed to stdout before mcp.run() — it would corrupt the protocol.
All logging goes to stderr (configured in server.py).
"""
import sys

# Guard: if somehow stdout was used before this point, abort loudly to stderr
# (this is just a safety reminder; real protection is in logging config)
import logging
logging.basicConfig(stream=sys.stderr, level=logging.INFO)

from rental_mcp.server import mcp

if __name__ == "__main__":
    mcp.run()
