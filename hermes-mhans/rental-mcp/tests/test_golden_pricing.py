"""
Golden tests for domain.pricing — the single source of truth for rental money.

The cross-language contract lives in tests/test_pricing_fixtures.py (shared JSON fixtures with
the dashboard). This file covers the Hermes-facing surface: jornadas, line subtotals and the
`calculate_quote` payload, including the per-order reserve (25%, 50% and a fixed amount).
"""
import pytest
from datetime import date

from rental_mcp.domain.pricing import (
    DEFAULT_RESERVE_VALUE,
    IVA_RATE,
    PricingError,
    calculate_quote,
    item_subtotal,
    late_fee,
    num_jornadas,
    reserve_amount,
    reserve_label,
    round_half_up,
)


class TestNumJornadas:
    def test_three_days_inclusive(self):
        """2026-04-01 to 2026-04-03 = 3 jornadas (golden case)."""
        assert num_jornadas(date(2026, 4, 1), date(2026, 4, 3)) == 3

    def test_same_day_is_one(self):
        """Same start and end date = 1 jornada."""
        assert num_jornadas(date(2026, 4, 1), date(2026, 4, 1)) == 1

    def test_start_after_end_raises(self):
        """start_date > end_date must raise (clear error, not a silent abs)."""
        with pytest.raises(ValueError, match="start_date"):
            num_jornadas(date(2026, 4, 3), date(2026, 4, 1))

    def test_two_days(self):
        assert num_jornadas(date(2026, 1, 1), date(2026, 1, 2)) == 2

    def test_iso_strings_are_accepted(self):
        """Dates arrive as 'YYYY-MM-DD' from JSON payloads as well as as date objects."""
        assert num_jornadas("2027-04-02", "2027-04-05") == 4

    def test_malformed_date_raises(self):
        with pytest.raises(PricingError):
            num_jornadas("05/03/2027", "2027-03-06")


class TestRoundHalfUp:
    def test_half_goes_up_not_to_even(self):
        """Python's built-in round() would give 22312 and 2 here — banker's rounding."""
        assert round_half_up(22312.5) == 22313
        assert round_half_up(2.5) == 3


class TestItemSubtotal:
    def test_basic(self):
        """precio_dia=10000, qty=2, 3 jornadas = 60000."""
        assert item_subtotal(precio_dia=10000, quantity=2, jornadas=3) == 60000

    def test_single(self):
        assert item_subtotal(precio_dia=25000, quantity=1, jornadas=3) == 75000

    def test_rounds_half_up_to_int(self):
        assert item_subtotal(precio_dia="1000.5", quantity=1, jornadas=1) == 1001

    def test_negative_price_raises(self):
        with pytest.raises(PricingError):
            item_subtotal(precio_dia=-1, quantity=1, jornadas=1)


class TestCalculateQuote:
    """Two product lines, coupon, shipping, IVA — all amounts are CLP integers."""

    def _base_lines(self):
        return [
            {"precio_dia": 10000, "quantity": 2},
            {"precio_dia": 25000, "quantity": 1},
        ]

    def _quote(self, **overrides):
        args = dict(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type="percent",
            coupon_amount=10,
            apply_iva=True,
        )
        args.update(overrides)
        return calculate_quote(**args)

    def test_subtotal(self):
        assert self._quote(coupon_type=None, coupon_amount=0)["subtotal"] == 135000

    def test_shipping(self):
        assert self._quote(coupon_type=None, coupon_amount=0)["shipping_total"] == 5000

    def test_coupon_percent(self):
        """10% of the products subtotal (135000), never of the shipping."""
        assert self._quote()["descuento_cupon"] == 13500

    def test_coupon_percent_capped_by_maximum_amount(self):
        """maximum_amount caps the percentage; without the cap it would be 13500."""
        assert self._quote(coupon_maximum_amount=5000)["descuento_cupon"] == 5000

    def test_coupon_fixed_product_is_a_flat_amount_not_zero(self):
        """fixed_product is applied flat, pending the business decision — never silently 0."""
        result = self._quote(coupon_type="fixed_product", coupon_amount=20000)
        assert result["descuento_cupon"] == 20000

    def test_coupon_clamped_to_products_subtotal(self):
        """A coupon larger than the products subtotal cannot eat the shipping."""
        result = self._quote(coupon_type="fixed_cart", coupon_amount=999999)
        assert result["descuento_cupon"] == 135000
        assert result["calculated_subtotal"] == 5000

    def test_calculated_subtotal_with_coupon_and_shipping(self):
        """135000 - 13500 + 5000 = 126500 (shipping is taxed)."""
        assert self._quote()["calculated_subtotal"] == 126500

    def test_iva_applied(self):
        """IVA = round(126500 * 0.19) = 24035."""
        assert self._quote()["calculated_iva"] == 24035

    def test_total_with_iva(self):
        assert self._quote()["calculated_total"] == 150535

    def test_reserve_default_is_25_percent(self):
        """No reserve given: the business default, round(150535 * 0.25) = 37634."""
        result = self._quote()
        assert result["reserva"] == 37634
        assert result["saldo"] == 150535 - 37634
        assert result["reserva_label"] == "Reserva 25%"

    def test_reserve_percent_50(self):
        """A per-order 50% reserve, not the hardcoded 25%."""
        result = self._quote(reserve_type="percent", reserve_value=50)
        assert result["reserva"] == 75268  # round(150535 * 0.5) = 75267.5 -> 75268
        assert result["saldo"] == 150535 - 75268
        assert result["reserva_label"] == "Reserva 50%"

    def test_reserve_fixed_amount(self):
        """A fixed reserve is a CLP amount, not a share."""
        result = self._quote(reserve_type="fixed", reserve_value=100000)
        assert result["reserva"] == 100000
        assert result["saldo"] == 50535
        assert result["reserva_label"] == "Reserva"

    def test_reserve_fixed_clamped_to_total(self):
        result = self._quote(reserve_type="fixed", reserve_value=999999)
        assert result["reserva"] == 150535
        assert result["saldo"] == 0

    def test_no_iva(self):
        """Without IVA: total = net, iva = 0."""
        result = self._quote(apply_iva=False)
        assert result["calculated_iva"] == 0
        assert result["calculated_total"] == 126500

    def test_coupon_fixed_cart(self):
        """Fixed coupon of 20000 over the products subtotal."""
        result = self._quote(coupon_type="fixed_cart", coupon_amount=20000, apply_iva=False)
        assert result["descuento_cupon"] == 20000
        assert result["calculated_subtotal"] == 120000

    def test_no_coupon(self):
        result = self._quote(coupon_type=None, coupon_amount=0, shipping_total=0, apply_iva=False)
        assert result["descuento_cupon"] == 0
        assert result["calculated_subtotal"] == 135000

    def test_manual_discount_without_coupon(self):
        result = self._quote(
            coupon_type=None, coupon_amount=0, shipping_total=0, discount=5000, apply_iva=False
        )
        assert result["descuento_cupon"] == 5000
        assert result["calculated_subtotal"] == 130000

    def test_all_amounts_are_int(self):
        """No floats reach the DB or the customer — CLP has no decimals."""
        result = self._quote()
        for key in (
            "subtotal",
            "descuento_cupon",
            "shipping_total",
            "calculated_subtotal",
            "calculated_iva",
            "calculated_total",
            "reserva",
            "saldo",
            "presented_total",
            "presented_reserva",
            "presented_saldo",
        ):
            assert isinstance(result[key], int), key

    def test_presented_aliases_match_the_canonical_values(self):
        result = self._quote()
        assert result["presented_total"] == result["calculated_total"]
        assert result["presented_reserva"] == result["reserva"]
        assert result["presented_saldo"] == result["saldo"]


class TestReserveAmount:
    def test_defaults_to_25_percent_when_the_order_says_nothing(self):
        assert DEFAULT_RESERVE_VALUE == 25
        assert reserve_amount(100000) == 25000

    def test_percent_from_the_order(self):
        assert reserve_amount(100000, "percent", 50) == 50000

    def test_numeric_string_from_postgrest(self):
        """A numeric(12,2) arrives as '50.00'; treating it as text is how a NaN reaches a quote."""
        assert reserve_amount(100000, "percent", "50.00") == 50000

    def test_fixed_amount(self):
        assert reserve_amount(100000, "fixed", 30000) == 30000

    def test_clamped_to_total(self):
        assert reserve_amount(100000, "fixed", 999999) == 100000

    def test_zero_total(self):
        assert reserve_amount(0, "fixed", 30000) == 0

    def test_unrecognised_type_is_treated_as_percent(self):
        assert reserve_amount(100000, "weird", 10) == 10000


class TestReserveLabel:
    def test_percent(self):
        assert reserve_label("percent", 25) == "Reserva 25%"
        assert reserve_label("percent", 50) == "Reserva 50%"

    def test_fixed(self):
        assert reserve_label("fixed", 100000) == "Reserva"

    def test_default(self):
        assert reserve_label(None, None) == "Reserva 25%"


class TestIvaRate:
    def test_is_chilean_19_percent(self):
        assert IVA_RATE == 0.19


class TestLateFee:
    def test_basic_late_fee(self):
        """dias_atraso * costo_diario."""
        assert late_fee(daily_cost=10000, days_late=3) == 30000

    def test_zero_days(self):
        assert late_fee(daily_cost=10000, days_late=0) == 0

    def test_fractional_daily_cost(self):
        result = late_fee(daily_cost=10000.5, days_late=2)
        assert result == pytest.approx(20001.0)
