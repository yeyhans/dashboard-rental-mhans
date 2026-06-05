"""
Entrypoint: python -m rental_mcp.notifier

Runs the order-notification service in an asyncio event loop.
Logs only to stderr (stdout is reserved for MCP protocol conventions).
"""
from __future__ import annotations

import asyncio
import logging
import sys

from rental_mcp.notifier.service import run_notifier

logging.basicConfig(stream=sys.stderr, level=logging.INFO)

if __name__ == "__main__":
    asyncio.run(run_notifier())
