"""
Tests that a stored plan survives the JSONB round trip with usable key types.

REGRESSION GUARD (rehearsal 0002, F-6): `draft_create_order` declares
`quantities: dict[int, int]`, so pydantic coerces the incoming JSON object's
string keys to ints and the DRAFT quotes correctly. The dict is then persisted
to `hermes_pending_writes.plan_json` as JSONB, where keys can only be strings.
`confirm_write` read it back raw and passed it to `_quote_internal`, which
looks up `qtys.get(pid, 1)` with an int `pid` — so every lookup missed and
every line silently fell back to quantity 1.

The compare-and-swap guard caught the resulting mismatch and refused the
confirmation, which is the guard doing its job: without it the order would have
been written at the under-counted total against a plan the customer approved at
the correct one. So the user-visible symptom was "Los montos recalculados
difieren del plan", not a wrong charge.

Only multi-unit orders were affected — with every quantity at 1 the fallback
coincides with the real value, which is why this survived F-2, F-3 and F-5:
every earlier probe in the rehearsal used quantity 1 throughout.
"""
from __future__ import annotations

import json

import pytest


def _jsonb_round_trip(plan: dict) -> dict:
    """What psycopg gives back after a dict is stored in a JSONB column."""
    return json.loads(json.dumps(plan))


def _coerce_quantities(raw: dict) -> dict[int, int]:
    """The coercion applied in confirm_write (server.py, create_order branch)."""
    return {int(pid): qty for pid, qty in raw.items()}


class TestJsonbLosesIntegerKeys:
    """The premise. If this ever stops holding, the coercion can go."""

    def test_keys_come_back_as_strings(self):
        stored = _jsonb_round_trip({"quantities": {1: 1, 3: 2}})
        assert list(stored["quantities"].keys()) == ["1", "3"]

    def test_int_lookup_misses_on_the_raw_dict(self):
        raw = _jsonb_round_trip({"quantities": {1: 1, 3: 2}})["quantities"]
        # This is the defect: the miss is silent and yields the default.
        assert raw.get(3, 1) == 1


class TestCoercionRestoresTheDraftQuantities:
    def test_lookup_by_int_product_id_works_after_coercion(self):
        raw = _jsonb_round_trip({"quantities": {1: 1, 3: 2}})["quantities"]
        qtys = _coerce_quantities(raw)
        assert qtys.get(1, 1) == 1
        assert qtys.get(3, 1) == 2

    def test_quantities_survive_the_round_trip_unchanged(self):
        original = {1: 1, 3: 2, 7: 5}
        raw = _jsonb_round_trip({"quantities": original})["quantities"]
        assert _coerce_quantities(raw) == original

    @pytest.mark.parametrize("quantities", [{}, {1: 1}, {2: 3, 4: 1, 9: 12}])
    def test_coercion_is_total(self, quantities):
        raw = _jsonb_round_trip({"quantities": quantities})["quantities"]
        assert _coerce_quantities(raw) == quantities


class TestTheArithmeticTheGuardCaught:
    """Reproduces the rehearsal's numbers so the failure mode stays legible."""

    PRICES = {1: 155_000, 3: 90_000}
    JORNADAS = 2

    def _subtotal(self, qtys: dict) -> int:
        return sum(
            self.PRICES[pid] * qtys.get(pid, 1) * self.JORNADAS
            for pid in self.PRICES
        )

    def test_string_keys_undercount_the_subtotal(self):
        raw = _jsonb_round_trip({"quantities": {1: 1, 3: 2}})["quantities"]
        assert self._subtotal(raw) == 490_000

    def test_coerced_keys_reproduce_the_draft_subtotal(self):
        raw = _jsonb_round_trip({"quantities": {1: 1, 3: 2}})["quantities"]
        assert self._subtotal(_coerce_quantities(raw)) == 670_000

    def test_single_unit_orders_are_unaffected(self):
        """Why the defect hid for so long."""
        raw = _jsonb_round_trip({"quantities": {1: 1, 3: 1}})["quantities"]
        assert self._subtotal(raw) == self._subtotal(_coerce_quantities(raw))


class TestConfirmWriteAppliesTheCoercion:
    def test_source_coerces_plan_quantities(self):
        from pathlib import Path

        source = (
            Path(__file__).resolve().parent.parent / "rental_mcp" / "server.py"
        ).read_text(encoding="utf-8")
        assert 'int(pid): qty for pid, qty in plan["quantities"]' in source, (
            "confirm_write must re-key plan['quantities'] to ints; reading it raw "
            "from JSONB is the F-6 defect"
        )
