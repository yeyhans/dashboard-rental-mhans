"""
Pure pricing functions — single source of truth for rental quotation.
Replicates calculations.ts + CreateOrderForm.tsx logic exactly.

Rules:
- Internal values stay as float for fidelity with the TS dashboard.
- presented_* keys use half-up int rounding: int(x + 0.5)
- NO stdout writes — this is a pure computation module.
"""
from __future__ import annotations

from datetime import date
from typing import Any

IVA_RATE: float = 0.19
RESERVE_RATE: float = 0.25


def _half_up(x: float) -> int:
    """Half-up rounding matching TS Math.round (not Python's banker's round)."""
    return int(x + 0.5)


def num_jornadas(start_date: date, end_date: date) -> int:
    """
    Count inclusive calendar days between start_date and end_date.

    Replicates CreateOrderForm.tsx calculateDays:
        ceil(|end - start| / 86400000) + 1  (TS, with setHours(0,0,0,0))
    Python equivalent: (end_date - start_date).days + 1

    Raises ValueError if start_date > end_date (unlike TS which uses abs()).
    """
    if start_date > end_date:
        raise ValueError(
            f"start_date ({start_date}) must be <= end_date ({end_date})"
        )
    return (end_date - start_date).days + 1


def item_subtotal(precio_dia: float, quantity: int, jornadas: int) -> float:
    """Compute line subtotal: precio_dia * quantity * jornadas."""
    return float(precio_dia) * quantity * jornadas


def calculate_quote(
    lines: list[dict[str, Any]],
    jornadas: int,
    shipping_total: float,
    coupon_type: str | None,
    coupon_amount: float,
    apply_iva: bool,
) -> dict[str, Any]:
    """
    Full rental quote calculation.

    Args:
        lines: list of {"precio_dia": float, "quantity": int}
        jornadas: number of rental days (from num_jornadas)
        shipping_total: shipping cost in CLP
        coupon_type: 'percent' | 'fixed_cart' | None
        coupon_amount: discount value (% or fixed CLP)
        apply_iva: whether to add 19% IVA

    Returns dict with both raw floats (for dashboard fidelity) and
    presented_* int values (half-up, for display).

    Formula (exact replica of calculations.ts):
        item_subtotal = precio_dia * qty * jornadas
        subtotal = sum(item_subtotals)
        descuento_cupon:
            percent   → subtotal * (amount / 100)
            fixed_cart→ amount
            None      → 0
        calculated_subtotal = subtotal + shipping_total - descuento_cupon
        calculated_iva      = calculated_subtotal * 0.19  if apply_iva else 0
        calculated_total    = calculated_subtotal + calculated_iva
        reserva_25          = calculated_total * 0.25
        saldo_75            = calculated_total - reserva_25
    """
    # Line totals
    line_totals: list[float] = [
        item_subtotal(line["precio_dia"], line["quantity"], jornadas)
        for line in lines
    ]
    subtotal: float = sum(line_totals)

    # Coupon
    if coupon_type == "percent":
        descuento_cupon: float = subtotal * (coupon_amount / 100.0)
    elif coupon_type == "fixed_cart":
        descuento_cupon = float(coupon_amount)
    else:
        descuento_cupon = 0.0

    shipping_total = float(shipping_total)
    calculated_subtotal: float = subtotal + shipping_total - descuento_cupon
    calculated_iva: float = calculated_subtotal * IVA_RATE if apply_iva else 0.0
    calculated_total: float = calculated_subtotal + calculated_iva
    reserva_25: float = calculated_total * RESERVE_RATE
    saldo_75: float = calculated_total - reserva_25

    return {
        # Raw floats — for dashboard fidelity
        "num_jornadas": jornadas,
        "subtotal": subtotal,
        "shipping_total": shipping_total,
        "descuento_cupon": descuento_cupon,
        "calculated_subtotal": calculated_subtotal,
        "calculated_iva": calculated_iva,
        "calculated_total": calculated_total,
        "reserva_25": reserva_25,
        "saldo_75": saldo_75,
        "apply_iva": apply_iva,
        "moneda": "CLP",
        # Presented ints — half-up rounding for display only
        "presented_subtotal": _half_up(subtotal),
        "presented_descuento": _half_up(descuento_cupon),
        "presented_subtotal_base": _half_up(calculated_subtotal),
        "presented_iva": _half_up(calculated_iva),
        "presented_total": _half_up(calculated_total),
        "presented_reserva": _half_up(reserva_25),
        "presented_saldo": _half_up(saldo_75),
    }


def late_fee(daily_cost: float, days_late: int) -> float:
    """Simple late fee: dias_atraso * costo_diario."""
    return float(daily_cost) * days_late
