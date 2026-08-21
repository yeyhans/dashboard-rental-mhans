"""
Tests for the orders INSERT payload built by draft_create_order/confirm_write.

REGRESSION GUARD (rehearsal 0002, F-3): the INSERT supplied only 8 of the 11
NOT NULL-without-default columns of `orders`, omitting billing_address_1,
billing_city and company_rut — and the profile lookup did not even SELECT the
data. create_order had therefore never succeeded in any environment; F-2 (the
DDL guard) was aborting the write before the INSERT was reached.

Postgres reports only the FIRST NOT NULL violation, so a test that merely
asserts "it no longer errors" would be satisfied by fixing one column. These
tests assert the FULL column set instead.
"""
from __future__ import annotations

import importlib
import re

import pytest

import rental_mcp.validators
from rental_mcp.domain import orders as orders_module
from rental_mcp.domain.orders import (
    ORDER_INSERT_COLUMNS,
    REQUIRED_ORDER_COLUMNS,
    build_order_insert_params,
    order_insert_sql,
)


@pytest.fixture
def load_orders(monkeypatch):
    """Reload validators + orders under a vocabulary; restore legacy default."""

    def _load(mode: str):
        monkeypatch.setenv("ORDER_STATUS_VOCABULARY", mode)
        importlib.reload(rental_mcp.validators)
        return importlib.reload(orders_module)

    yield _load
    monkeypatch.delenv("ORDER_STATUS_VOCABULARY", raising=False)
    importlib.reload(rental_mcp.validators)
    importlib.reload(orders_module)


# The eleven NOT NULL columns of `orders` that have no default, verified
# against production information_schema on 2026-08-19. Hardcoded here on
# purpose: this literal is the guard, so a change in the source module cannot
# silently satisfy the test.
NOT_NULL_NO_DEFAULT = {
    "billing_address_1",
    "billing_city",
    "billing_email",
    "billing_first_name",
    "billing_last_name",
    "billing_phone",
    "company_rut",
    "customer_id",
    "order_fecha_inicio",
    "order_fecha_termino",
    "order_proyecto",
}


def _profile(**overrides: object) -> dict:
    base = {
        "nombre": "Ana",
        "apellido": "García",
        "email": "ana@example.com",
        "telefono": "+56912345678",
        "direccion": "Purísima 25",
        "ciudad": "Recoleta",
        "rut": "77892569-9",
    }
    base.update(overrides)
    return base


def _quote() -> dict:
    return {
        "calculated_subtotal": 540000.0,
        "descuento_cupon": 54000.0,
        "calculated_iva": 92340.0,
        "calculated_total": 578340.0,
        "shipping_total": 0.0,
    }


def _params(**overrides: object) -> tuple:
    kwargs: dict = {
        "customer_id": 1,
        "order_proyecto": "Campaña Denim",
        "fecha_inicio": "2026-09-01",
        "fecha_termino": "2026-09-03",
        "num_jornadas": 3,
        "quote": _quote(),
        "line_items_json": "[]",
        "profile": _profile(),
    }
    kwargs.update(overrides)
    return build_order_insert_params(**kwargs)


class TestInsertColumnSet:
    def test_every_not_null_column_is_supplied(self):
        missing = NOT_NULL_NO_DEFAULT - set(ORDER_INSERT_COLUMNS)
        assert missing == set(), f"NOT NULL columns absent from the INSERT: {sorted(missing)}"

    def test_required_set_matches_the_database(self):
        # ANTI-DRIFT GUARD: the module's own declaration must equal the real
        # constraint set. If a migration adds a NOT NULL column, update both.
        assert REQUIRED_ORDER_COLUMNS == NOT_NULL_NO_DEFAULT

    def test_columns_are_unique(self):
        assert len(ORDER_INSERT_COLUMNS) == len(set(ORDER_INSERT_COLUMNS))

    def test_sql_lists_exactly_the_declared_columns(self):
        sql = order_insert_sql()
        columns_clause = re.search(r"INSERT INTO orders\s*\((.*?)\)", sql, re.S)
        assert columns_clause is not None
        columns = [c.strip() for c in columns_clause.group(1).split(",")]
        assert columns == list(ORDER_INSERT_COLUMNS)

    def test_placeholder_count_matches_param_count(self):
        sql = order_insert_sql()
        values_clause = re.search(r"VALUES\s*\((.*?)\)\s*RETURNING", sql, re.S)
        assert values_clause is not None
        placeholders = values_clause.group(1).count("%s")
        assert placeholders == len(ORDER_INSERT_COLUMNS) == len(_params())

    def test_line_items_is_cast_to_jsonb(self):
        assert "%s::jsonb" in order_insert_sql()


class TestInsertParams:
    def _value(self, column: str, **overrides: object) -> object:
        return _params(**overrides)[ORDER_INSERT_COLUMNS.index(column)]

    def test_billing_address_comes_from_profile_direccion(self):
        assert self._value("billing_address_1") == "Purísima 25"

    def test_billing_city_comes_from_profile_ciudad(self):
        assert self._value("billing_city") == "Recoleta"

    def test_company_rut_comes_from_profile_rut(self):
        # Convention mirrored from the two existing writers:
        # dashboard CreateOrderForm.tsx (`company_rut: selectedUser.rut || ''`)
        # and frontend OrderConfirmation.tsx (the "RUT de facturación" field,
        # prefilled from the profile rut). It is the billing RUT of whoever
        # rents, not necessarily a company RUT.
        assert self._value("company_rut") == "77892569-9"

    def test_missing_profile_data_becomes_empty_string_not_none(self):
        # NOT NULL columns: None would abort the INSERT. Both existing writers
        # fall back to '' rather than a sentinel.
        empty = _profile(direccion=None, ciudad=None, rut=None)
        for column in ("billing_address_1", "billing_city", "company_rut"):
            assert self._value(column, profile=empty) == ""

    def test_absent_profile_keys_become_empty_string(self):
        for column in ("billing_address_1", "billing_city", "company_rut"):
            assert self._value(column, profile={}) == ""

    def test_no_required_value_is_none(self):
        params = _params(profile={})
        for column in REQUIRED_ORDER_COLUMNS:
            assert params[ORDER_INSERT_COLUMNS.index(column)] is not None

    def test_billing_names_come_from_profile(self):
        assert self._value("billing_first_name") == "Ana"
        assert self._value("billing_last_name") == "García"
        assert self._value("billing_email") == "ana@example.com"
        assert self._value("billing_phone") == "+56912345678"

    def test_status_defaults_to_on_hold_in_legacy_mode(self, load_orders):
        # Pre-migration-0003 (R3-102): the live CHECK constraint refuses
        # 'request', so a new Hermes order must enter at `on-hold`.
        mod = load_orders("legacy")
        params = mod.build_order_insert_params(**self._kwargs())
        assert params[ORDER_INSERT_COLUMNS.index("status")] == "on-hold"

    def test_status_defaults_to_request_in_v12_mode(self, load_orders):
        # v1.2 (T-021): a new Hermes order enters the machine at `request`.
        mod = load_orders("v12")
        params = mod.build_order_insert_params(**self._kwargs())
        assert params[ORDER_INSERT_COLUMNS.index("status")] == "request"

    @staticmethod
    def _kwargs() -> dict:
        return {
            "customer_id": 1,
            "order_proyecto": "Campaña Denim",
            "fecha_inicio": "2026-09-01",
            "fecha_termino": "2026-09-03",
            "num_jornadas": 3,
            "quote": _quote(),
            "line_items_json": "[]",
            "profile": _profile(),
        }

    def test_new_orders_are_not_marked_paid(self):
        assert self._value("pago_completo") is False

    def test_financials_come_from_the_quote(self):
        assert self._value("calculated_subtotal") == 540000.0
        assert self._value("calculated_discount") == 54000.0
        assert self._value("calculated_iva") == 92340.0
        assert self._value("calculated_total") == 578340.0
        assert self._value("shipping_total") == 0.0

    def test_rejects_a_status_the_database_would_refuse(self):
        # 'reviewing' never existed in ANY vocabulary (phantom workflow).
        with pytest.raises(ValueError, match="reviewing"):
            _params(status="reviewing")

    def test_v12_mode_rejects_a_retired_status(self, load_orders):
        # Post-0003 the CHECK constraint no longer accepts the old vocabulary.
        mod = load_orders("v12")
        with pytest.raises(ValueError, match="on-hold"):
            mod.build_order_insert_params(**self._kwargs(), status="on-hold")

    def test_legacy_mode_rejects_a_v12_status(self, load_orders):
        # Pre-0003 the live CHECK constraint refuses the v1.2 vocabulary.
        mod = load_orders("legacy")
        with pytest.raises(ValueError, match="request"):
            mod.build_order_insert_params(**self._kwargs(), status="request")
