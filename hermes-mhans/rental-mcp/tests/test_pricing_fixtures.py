"""
Cross-language golden fixtures — Python must reproduce the TypeScript numbers exactly.

The fixture file is the shared contract between the dashboard module
(`src/lib/pricing.ts`), the customer frontend and this package. A vendored copy lives in
`tests/data/pricing-golden.json` so the Python package stays testable on its own (the Hermes
image ships only `hermes-mhans/`); `test_vendored_copy_matches_canonical` compares it byte for
byte against the canonical file whenever the full repository is checked out, so the copy cannot
drift silently.

Canonical path (relative to this repository root):
    src/lib/__fixtures__/pricing-golden.json
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from rental_mcp.domain.pricing import PricingError, compute_order_totals

VENDORED_FIXTURES = Path(__file__).parent / "data" / "pricing-golden.json"

# hermes-mhans/rental-mcp/tests -> hermes-mhans/rental-mcp -> hermes-mhans -> dashboard root
CANONICAL_FIXTURES = (
    Path(__file__).resolve().parents[3] / "src" / "lib" / "__fixtures__" / "pricing-golden.json"
)

_FIXTURES = json.loads(VENDORED_FIXTURES.read_text(encoding="utf-8"))
_CASES = _FIXTURES["cases"]
_ERROR_CASES = _FIXTURES["error_cases"]


def _totals(case_input: dict) -> dict:
    return compute_order_totals(
        line_items=case_input["line_items"],
        start_date=case_input.get("start_date"),
        end_date=case_input.get("end_date"),
        jornadas=case_input.get("jornadas"),
        shipping_total=case_input.get("shipping_total"),
        coupon=case_input.get("coupon"),
        discount=case_input.get("discount"),
        apply_iva=case_input.get("apply_iva", True),
        reserve_type=case_input.get("reserve_type"),
        reserve_value=case_input.get("reserve_value"),
    )


def test_vendored_copy_matches_canonical() -> None:
    """The vendored fixture must be identical to the dashboard's canonical file."""
    if not CANONICAL_FIXTURES.exists():
        pytest.skip(f"Canonical fixtures not present in this checkout: {CANONICAL_FIXTURES}")
    assert VENDORED_FIXTURES.read_bytes() == CANONICAL_FIXTURES.read_bytes()


@pytest.mark.parametrize("case", _CASES, ids=[c["name"] for c in _CASES])
def test_golden_case_matches_expected(case: dict) -> None:
    """Every amount is an integer and equals the value the TypeScript module produces."""
    expected = case["expected"]
    result = _totals(case["input"])

    for key, value in expected.items():
        actual = result[key]
        if key == "line_subtotals":
            assert actual == value, f"{case['name']}: {key}"
            assert all(isinstance(n, int) for n in actual)
        elif key == "reserve_label":
            assert actual == value, f"{case['name']}: {key}"
        else:
            assert actual == value, f"{case['name']}: {key}"
            assert isinstance(actual, int), f"{case['name']}: {key} must be int, got {type(actual)}"


@pytest.mark.parametrize("case", _ERROR_CASES, ids=[c["name"] for c in _ERROR_CASES])
def test_error_case_raises(case: dict) -> None:
    """Inputs the contract calls invalid must raise, never return a silent number."""
    with pytest.raises(PricingError):
        _totals(case["input"])


def test_totals_are_internally_consistent() -> None:
    """net/total/balance must add up on every case, not only match the expected block."""
    for case in _CASES:
        result = _totals(case["input"])
        assert result["net"] == (
            result["products_subtotal"] - result["discount"] + result["shipping_total"]
        )
        assert result["total"] == result["net"] + result["iva"]
        assert result["balance"] == result["total"] - result["reserve"]
        assert 0 <= result["reserve"] <= result["total"]
