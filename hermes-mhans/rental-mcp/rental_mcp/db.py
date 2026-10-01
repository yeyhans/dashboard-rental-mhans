"""
Database access layer — psycopg3 connection pools.

Rules:
- Pools are lazy (created on first use, NOT at import time).
- Server starts even if DB is down; tools report errors per-call.
- SQL ALWAYS parametrized with %s (psycopg3 style). NEVER f-strings with input.
- Logs go to stderr only.
- NEVER issues DDL. Schema objects belong to
  dashboard/supabase/migrations/0000_baseline.sql (ADR-D5); this layer only asserts.
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

PENDING_WRITES_TABLE = "public.hermes_pending_writes"


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
        pool = AsyncConnectionPool(
            conninfo=url,
            min_size=1,
            max_size=3,
            kwargs={"row_factory": dict_row},
            open=False,
        )
        await pool.open()
        try:
            await assert_pending_writes_table(pool)
        except BaseException:
            # Do not cache a pool whose preconditions failed: the next call must
            # re-check instead of handing out a silently unusable pool.
            await pool.close()
            raise
        _rw_pool = pool
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


async def assert_pending_writes_table(pool: AsyncConnectionPool | None = None) -> None:
    """Assert that hermes_pending_writes exists. Never issues DDL.

    hermes_rw has no CREATE on schema public and must not have it (ADR-D8,
    least privilege). An IF NOT EXISTS guard would not help: PostgreSQL checks
    the schema privilege before the existence short-circuit, so any DDL here
    aborts the whole write path even when the table is already in place.
    """
    pool = pool or await _get_rw_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                "SELECT to_regclass(%s) IS NOT NULL AS table_exists",
                (PENDING_WRITES_TABLE,),
            )
            row = await cur.fetchone()

    if not (row and row.get("table_exists")):
        raise RuntimeError(
            f"{PENDING_WRITES_TABLE} no existe — el patrón confirm-before-write no puede "
            "operar. La tabla la crea dashboard/supabase/migrations/0000_baseline.sql: "
            "aplicar la cadena de migraciones antes de habilitar las escrituras de Hermes."
        )
    logger.info("hermes_pending_writes verificada")


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
