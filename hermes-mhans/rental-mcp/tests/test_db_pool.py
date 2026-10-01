"""
Tests for the hermes_rw pool bootstrap in rental_mcp.db.

REGRESSION GUARD (rehearsal 0002, F-2): _get_rw_pool() used to call
ensure_pending_writes_table() on first use, which issued
CREATE TABLE IF NOT EXISTS hermes_pending_writes. hermes_rw has no CREATE on
schema public, and CREATE TABLE IF NOT EXISTS checks that privilege BEFORE the
existence short-circuit — so the DDL failed with "permission denied for schema
public" even though the table was already there, and every write tool
(draft_create_order, confirm_write, order create/update) died before doing any
work. The table, the role and its grants belong to
dashboard/supabase/migrations/0000_baseline.sql (ADR-D5); db.py must only
assert, never create.

These tests are intentionally sync + asyncio.run(): the CI job
(.github/workflows/rental-mcp-tests.yml) does not install pytest-asyncio.
"""
from __future__ import annotations

import asyncio
import inspect
from contextlib import asynccontextmanager

import psycopg
import pytest

from rental_mcp import db


DDL_KEYWORDS = ("CREATE ", "ALTER ", "DROP ", "TRUNCATE ", "GRANT ", "REVOKE ")


def _is_ddl(sql: str) -> bool:
    return sql.strip().upper().startswith(DDL_KEYWORDS)


class FakeCursor:
    """Minimal async cursor over FakeConnection.run()."""

    def __init__(self, conn: "FakeConnection") -> None:
        self._conn = conn
        self._row: dict | None = None

    async def execute(self, sql: str, params: tuple | None = None) -> "FakeCursor":
        self._row = self._conn.run(sql, params)
        return self

    async def fetchone(self) -> dict | None:
        return self._row

    async def __aenter__(self) -> "FakeCursor":
        return self

    async def __aexit__(self, *exc: object) -> bool:
        return False


class FakeConnection:
    """Connection whose role has no CREATE on schema public."""

    def __init__(self, pool: "FakePool") -> None:
        self._pool = pool

    def run(self, sql: str, params: tuple | None = None) -> dict | None:
        self._pool.statements.append(sql)
        if _is_ddl(sql):
            raise psycopg.errors.InsufficientPrivilege(
                "permission denied for schema public"
            )
        if "TO_REGCLASS" in sql.upper():
            return {"table_exists": self._pool.table_exists}
        return None

    async def execute(self, sql: str, params: tuple | None = None) -> FakeCursor:
        cur = FakeCursor(self)
        await cur.execute(sql, params)
        return cur

    async def commit(self) -> None:
        return None

    def cursor(self, *args: object, **kwargs: object) -> FakeCursor:
        return FakeCursor(self)


class FakePool:
    def __init__(self, table_exists: bool = True) -> None:
        self.table_exists = table_exists
        self.statements: list[str] = []
        self.opened = False
        self.closed = False

    async def open(self) -> None:
        self.opened = True

    async def close(self) -> None:
        self.closed = True

    @asynccontextmanager
    async def connection(self):
        yield FakeConnection(self)


@pytest.fixture
def install_fake_pool(monkeypatch):
    """Swap AsyncConnectionPool for FakePool and reset the module singleton."""

    def _install(table_exists: bool = True) -> list[FakePool]:
        created: list[FakePool] = []

        def factory(**kwargs: object) -> FakePool:
            pool = FakePool(table_exists=table_exists)
            created.append(pool)
            return pool

        monkeypatch.setattr(db, "AsyncConnectionPool", factory)
        monkeypatch.setattr(db, "_rw_pool", None)
        monkeypatch.setenv(
            "DATABASE_URL_RW", "postgresql://hermes_rw@localhost:5434/postgres"
        )
        return created

    yield _install
    db._rw_pool = None


class TestRwPoolBootstrap:
    def test_bootstrap_issues_no_ddl(self, install_fake_pool):
        created = install_fake_pool(table_exists=True)

        pool = asyncio.run(db._get_rw_pool())

        assert pool is created[0]
        assert pool.opened
        ddl = [s for s in pool.statements if _is_ddl(s)]
        assert ddl == [], f"db.py must not issue DDL as hermes_rw, got: {ddl}"

    def test_bootstrap_asserts_the_table_exists(self, install_fake_pool):
        created = install_fake_pool(table_exists=True)

        asyncio.run(db._get_rw_pool())

        assert any(
            "to_regclass" in s.lower() for s in created[0].statements
        ), "the bootstrap must verify hermes_pending_writes exists"

    def test_pool_is_reused_and_asserted_once(self, install_fake_pool):
        created = install_fake_pool(table_exists=True)

        first = asyncio.run(db._get_rw_pool())
        second = asyncio.run(db._get_rw_pool())

        assert first is second
        assert len(created) == 1

    def test_missing_table_raises_actionable_error(self, install_fake_pool):
        install_fake_pool(table_exists=False)

        with pytest.raises(RuntimeError) as excinfo:
            asyncio.run(db._get_rw_pool())

        message = str(excinfo.value)
        assert "hermes_pending_writes" in message
        assert "0000_baseline.sql" in message

    def test_missing_table_does_not_cache_a_broken_pool(self, install_fake_pool):
        created = install_fake_pool(table_exists=False)

        with pytest.raises(RuntimeError):
            asyncio.run(db._get_rw_pool())

        assert db._rw_pool is None
        assert created[0].closed, "the failed pool must be closed, not leaked"

    def test_missing_env_var_raises(self, monkeypatch):
        monkeypatch.setattr(db, "_rw_pool", None)
        monkeypatch.delenv("DATABASE_URL_RW", raising=False)

        with pytest.raises(RuntimeError, match="DATABASE_URL_RW"):
            asyncio.run(db._get_rw_pool())


class TestNoRuntimeDdl:
    def test_module_source_contains_no_ddl(self):
        # ANTI-DRIFT GUARD: hermes_rw is granted DML only (0000_baseline.sql).
        # Any DDL reintroduced here fails at runtime for the whole write path.
        source = inspect.getsource(db).upper()
        for statement in ("CREATE TABLE", "CREATE INDEX", "ALTER TABLE", "DROP TABLE"):
            assert statement not in source, f"{statement} must not be issued at runtime"

    def test_no_ensure_table_helper(self):
        assert not hasattr(db, "ensure_pending_writes_table")
        assert not hasattr(db, "HERMES_PENDING_WRITES_DDL")
