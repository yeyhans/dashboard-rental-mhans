"""
Database access layer — psycopg3 connection pools.

Rules:
- Pools are lazy (created on first use, NOT at import time).
- Server starts even if DB is down; tools report errors per-call.
- SQL ALWAYS parametrized with %s (psycopg3 style). NEVER f-strings with input.
- Logs go to stderr only.
- Includes ensure_pending_writes_table() for the hermes_pending_writes DDL.
"""
from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

# All logs to stderr — stdout is reserved for MCP protocol
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger(__name__)

# Module-level pool singletons (lazy)
_ro_pool: AsyncConnectionPool | None = None
_rw_pool: AsyncConnectionPool | None = None

HERMES_PENDING_WRITES_DDL = """
CREATE TABLE IF NOT EXISTS hermes_pending_writes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  plan_json jsonb NOT NULL,
  confirmation_token text NOT NULL,
  bound_user text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  note text
);
"""


async def _get_ro_pool() -> AsyncConnectionPool:
    global _ro_pool
    if _ro_pool is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError("DATABASE_URL no configurada")
        logger.info("Creando pool RO hacia base de datos")
        _ro_pool = AsyncConnectionPool(
            conninfo=url,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row},
            open=False,
        )
        await _ro_pool.open()
    return _ro_pool


async def _get_rw_pool() -> AsyncConnectionPool:
    global _rw_pool
    if _rw_pool is None:
        url = os.environ.get("DATABASE_URL_RW")
        if not url:
            raise RuntimeError("DATABASE_URL_RW no configurada — escrituras no habilitadas")
        logger.info("Creando pool RW hacia base de datos")
        _rw_pool = AsyncConnectionPool(
            conninfo=url,
            min_size=1,
            max_size=3,
            kwargs={"row_factory": dict_row},
            open=False,
        )
        await _rw_pool.open()
        await ensure_pending_writes_table()
    return _rw_pool


@asynccontextmanager
async def ro_conn() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """Async context manager for a read-only connection."""
    pool = await _get_ro_pool()
    async with pool.connection() as conn:
        yield conn


@asynccontextmanager
async def rw_conn() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """Async context manager for a read-write connection."""
    pool = await _get_rw_pool()
    async with pool.connection() as conn:
        yield conn


async def ensure_pending_writes_table() -> None:
    """CREATE TABLE IF NOT EXISTS hermes_pending_writes."""
    pool = await _get_rw_pool()
    async with pool.connection() as conn:
        await conn.execute(HERMES_PENDING_WRITES_DDL)
        await conn.commit()
    logger.info("hermes_pending_writes table ensured")


async def fetch_one(
    sql: str, params: tuple | None = None, pool: str = "ro"
) -> dict[str, Any] | None:
    """Execute a query and return the first row as a dict, or None."""
    ctx = ro_conn() if pool == "ro" else rw_conn()
    async with ctx as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(sql, params)
            return await cur.fetchone()


async def fetch_all(
    sql: str, params: tuple | None = None, pool: str = "ro"
) -> list[dict[str, Any]]:
    """Execute a query and return all rows as a list of dicts."""
    ctx = ro_conn() if pool == "ro" else rw_conn()
    async with ctx as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(sql, params)
            return await cur.fetchall()


async def execute(
    sql: str, params: tuple | None = None, pool: str = "rw"
) -> int:
    """Execute a non-SELECT statement. Returns rowcount."""
    ctx = ro_conn() if pool == "ro" else rw_conn()
    async with ctx as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)
            await conn.commit()
            return cur.rowcount
