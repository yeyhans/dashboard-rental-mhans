"""
Golden tests for domain.pricing — MUST pass before any other code is touched.
These tests define the single source of truth for rental pricing calculations.
"""
import pytest
from datetime import date

from rental_mcp.domain.pricing import (
    num_jornadas,
    item_subtotal,
    calculate_quote,
    late_fee,
    IVA_RATE,
    RESERVE_RATE,
)


class TestNumJornadas:
    def test_three_days_inclusive(self):
        """2026-04-01 to 2026-04-03 = 3 jornadas (golden case)."""
        assert num_jornadas(date(2026, 4, 1), date(2026, 4, 3)) == 3

    def test_same_day_is_one(self):
        """Same start and end date = 1 jornada."""
        assert num_jornadas(date(2026, 4, 1), date(2026, 4, 1)) == 1

    def test_start_after_end_raises(self):
        """start_date > end_date must raise ValueError (clear error, not silent abs)."""
        with pytest.raises(ValueError, match="start_date"):
            num_jornadas(date(2026, 4, 3), date(2026, 4, 1))

    def test_two_days(self):
        assert num_jornadas(date(2026, 1, 1), date(2026, 1, 2)) == 2


class TestItemSubtotal:
    def test_basic(self):
        """precio_dia=10000, qty=2, 3 jornadas = 60000."""
        assert item_subtotal(precio_dia=10000, quantity=2, jornadas=3) == 60000.0

    def test_single(self):
        assert item_subtotal(precio_dia=25000, quantity=1, jornadas=3) == 75000.0


class TestCalculateQuote:
    """Golden case from spec: two product lines, coupon, shipping, IVA."""

    def _base_lines(self):
        return [
            {"precio_dia": 10000, "quantity": 2},
            {"precio_dia": 25000, "quantity": 1},
        ]

    def test_subtotal(self):
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type=None,
            coupon_amount=0,
            apply_iva=True,
        )
        assert result["subtotal"] == 135000

    def test_shipping(self):
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type=None,
            coupon_amount=0,
            apply_iva=True,
        )
        assert result["shipping_total"] == 5000

    def test_coupon_percent(self):
        """10% coupon sobre subtotal = 13500 de descuento."""
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type="percent",
            coupon_amount=10,
            apply_iva=True,
        )
        assert result["descuento_cupon"] == 13500.0

    def test_calculated_subtotal_with_coupon_and_shipping(self):
        """135000 + 5000 - 13500 = 126500."""
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type="percent",
            coupon_amount=10,
            apply_iva=True,
        )
        assert result["calculated_subtotal"] == 126500.0

    def test_iva_applied(self):
        """IVA = 126500 * 0.19 = 24035.0."""
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type="percent",
            coupon_amount=10,
            apply_iva=True,
        )
        assert result["calculated_iva"] == pytest.approx(24035.0)

    def test_total_with_iva(self):
        """126500 + 24035 = 150535.0."""
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type="percent",
            coupon_amount=10,
            apply_iva=True,
        )
        assert result["calculated_total"] == pytest.approx(150535.0)

    def test_reserva_25(self):
        """150535 * 0.25 = 37633.75."""
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type="percent",
            coupon_amount=10,
            apply_iva=True,
        )
        assert result["reserva_25"] == pytest.approx(37633.75)

    def test_saldo_75(self):
        """150535 - 37633.75 = 112901.25."""
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type="percent",
            coupon_amount=10,
            apply_iva=True,
        )
        assert result["saldo_75"] == pytest.approx(112901.25)

    def test_no_iva(self):
        """Without IVA: total = calculated_subtotal, iva = 0."""
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type="percent",
            coupon_amount=10,
            apply_iva=False,
        )
        assert result["calculated_iva"] == 0.0
        assert result["calculated_total"] == pytest.approx(126500.0)

    def test_coupon_fixed_cart(self):
        """Fixed coupon of 20000 — subtracted directly from subtotal+shipping."""
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type="fixed_cart",
            coupon_amount=20000,
            apply_iva=False,
        )
        # 135000 + 5000 - 20000 = 120000
        assert result["calculated_subtotal"] == pytest.approx(120000.0)
        assert result["descuento_cupon"] == pytest.approx(20000.0)

    def test_no_coupon(self):
        """No coupon: descuento = 0, calculated_subtotal = subtotal + shipping."""
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=0,
            coupon_type=None,
            coupon_amount=0,
            apply_iva=False,
        )
        assert result["descuento_cupon"] == 0.0
        assert result["calculated_subtotal"] == pytest.approx(135000.0)

    def test_presented_amounts_are_int(self):
        """presented_* keys must be int (half-up rounding for display)."""
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type="percent",
            coupon_amount=10,
            apply_iva=True,
        )
        # Internal floats exist for fidelity; presented_ keys are int
        assert isinstance(result["presented_total"], int)
        assert isinstance(result["presented_reserva"], int)
        assert isinstance(result["presented_saldo"], int)

    def test_presented_total_half_up(self):
        """presented_total = int(150535.0 + 0.5) = 150535."""
        result = calculate_quote(
            lines=self._base_lines(),
            jornadas=3,
            shipping_total=5000,
            coupon_type="percent",
            coupon_amount=10,
            apply_iva=True,
        )
        assert result["presented_total"] == 150535


class TestLateFee:
    def test_basic_late_fee(self):
        """dias_atraso * costo_diario."""
        assert late_fee(daily_cost=10000, days_late=3) == 30000

    def test_zero_days(self):
        assert late_fee(daily_cost=10000, days_late=0) == 0

    def test_fractional_daily_cost(self):
        """Result should be a number (float OK here)."""
        result = late_fee(daily_cost=10000.5, days_late=2)
        assert result == pytest.approx(20001.0)
