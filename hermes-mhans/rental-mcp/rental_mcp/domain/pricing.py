"""
Order pricing — the single money formula, mirrored from the dashboard.

The canonical implementation is `src/lib/pricing.ts` (dashboard). This module must reproduce it
digit for digit: both are held to `src/lib/__fixtures__/pricing-golden.json`, vendored here as
`tests/data/pricing-golden.json`. Change a rule here only together with that file.

Rules (CLP integers, half-up rounding):
 1. line_subtotal = round(unit daily price * quantity * jornadas)
 2. jornadas = inclusive calendar days between date-only 'YYYY-MM-DD' values, computed as pure
    dates so no time zone or DST transition can change the count
 3. products_subtotal = sum of line subtotals
 4. discount applies to products only, clamped to [0, products_subtotal]
 5. net (stored as `calculated_subtotal`) = products_subtotal - discount + shipping (shipping
    IS part of the taxable base)
 6. iva = round(net * 19%) when IVA applies; total = net + iva
 7. reserve comes from the order (`orders.reserve_type` / `orders.reserve_value`), defaulting to
    25%; it is rounded and clamped to [0, total]. balance = total - reserve

Rounding: Python's built-in round() is banker's rounding and must NOT be used — it turns 22312.5
into 22312 while JavaScript's Math.round gives 22313. Every rounding here goes through
`round_half_up`, which uses Decimal ROUND_HALF_UP.

NO stdout writes — this is a pure computation module.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

IVA_RATE: float = 0.19

# `orders.reserve_type` / `orders.reserve_value` carry the share actually agreed per order
# (dashboard migration 0008). These are only the fallback for orders (and quotes) that do not
# say otherwise — the business default in `.claude/rules/01-business-context.md`.
DEFAULT_RESERVE_TYPE: str = "percent"
DEFAULT_RESERVE_VALUE: float = 25.0

_DATE_LENGTH = 10


class PricingError(ValueError):
    """Invalid pricing input. Subclasses ValueError so existing callers keep working."""


def round_half_up(value: float | int | Decimal) -> int:
    """Half-up rounding matching JS Math.round for the amounts this module handles."""
    try:
        quantized = Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    except InvalidOperation as exc:  # pragma: no cover - guarded by _to_number upstream
        raise PricingError(f"Valor no redondeable: {value!r}") from exc
    return int(quantized)


# Kept private: callers outside this module must use round_half_up.
_half_up = round_half_up


def _to_number(value: Any) -> float:
    """Coerce a DB/JSON value to float. PostgREST serialises numeric as a string."""
    if value is None or value == "":
        return float("nan")
    if isinstance(value, bool):
        return float("nan")
    try:
        return float(value)
    except (TypeError, ValueError):
        return float("nan")


def _is_finite(value: float) -> bool:
    return value == value and value not in (float("inf"), float("-inf"))


def _non_negative(value: Any, field: str) -> float:
    parsed = _to_number(value)
    if not _is_finite(parsed) or parsed < 0:
        raise PricingError(f"Valor inválido para {field}")
    return parsed


def _optional_non_negative(value: Any, field: str) -> float:
    if value is None or value == "":
        return 0.0
    return _non_negative(value, field)


def _as_date(value: Any, field: str) -> date:
    """Accept a `date` or a 'YYYY-MM-DD' string; anything else is an error."""
    if isinstance(value, date):
        return value
    if isinstance(value, str) and len(value) >= _DATE_LENGTH:
        head = value[:_DATE_LENGTH]
        try:
            return date.fromisoformat(head)
        except ValueError as exc:
            raise PricingError(f"Fecha inválida en {field}") from exc
    raise PricingError(f"Fecha inválida en {field}")


def num_jornadas(start_date: Any, end_date: Any) -> int:
    """
    Inclusive calendar days between two dates.

    Pure date arithmetic: no timestamps, so a DST transition cannot add or drop a jornada.
    """
    start = _as_date(start_date, "fecha de inicio")
    end = _as_date(end_date, "fecha de término")
    if start > end:
        raise PricingError(
            f"start_date ({start}) must be <= end_date ({end})"
        )
    return (end - start).days + 1


def item_subtotal(precio_dia: Any, quantity: Any, jornadas: int) -> int:
    """Line subtotal in whole CLP: round(precio_dia * quantity * jornadas)."""
    price = _non_negative(precio_dia, "precio")
    qty = _non_negative(quantity, "cantidad")
    return round_half_up(price * qty * jornadas)


def _clamp_discount(discount: float, products_subtotal: int) -> int:
    return min(products_subtotal, max(0, round_half_up(discount)))


def compute_discount(coupon: dict[str, Any] | None, products_subtotal: int) -> int:
    """
    Discount over the products subtotal only, clamped to [0, products_subtotal].

    Shipping is never discounted.
    """
    if not coupon:
        return 0

    amount = _to_number(coupon.get("amount"))
    if not _is_finite(amount):
        return 0

    discount_type = coupon.get("discount_type")

    if discount_type == "percent":
        discount = float(round_half_up(products_subtotal * amount / 100.0))
        maximum = _to_number(coupon.get("maximum_amount"))
        if _is_finite(maximum) and maximum > 0:
            discount = min(discount, maximum)
    elif discount_type == "fixed_cart":
        discount = amount
    elif discount_type == "fixed_product":
        # TODO(business): WooCommerce applies fixed_product per unit of each eligible product.
        # The dashboard has always applied it as a flat amount (see src/lib/pricing.ts); kept
        # identical here until the business defines the semantics. Never silently 0.
        discount = amount
    else:
        discount = 0.0

    return _clamp_discount(discount, products_subtotal)


def reserve_amount(
    total: int,
    reserve_type: str | None = None,
    reserve_value: Any = None,
) -> int:
    """
    What confirms the order — derived from the order's own reserve, not a hardcoded 25%.

    `reserve_type` 'fixed' means `reserve_value` is a CLP amount; anything else (including an
    unrecognised value or None) is a percentage, which is the historical behaviour. The result is
    clamped to [0, total] because a fixed reserve can exceed a total that moved after it was
    agreed.
    """
    if not _is_finite(float(total)) or total <= 0:
        return 0

    configured = _to_number(reserve_value)
    value = DEFAULT_RESERVE_VALUE if not _is_finite(configured) else configured

    raw = value if reserve_type == "fixed" else total * (value / 100.0)
    return min(total, max(0, round_half_up(raw)))


def reserve_label(reserve_type: str | None = None, reserve_value: Any = None) -> str:
    """'Reserva 25%' for a percentage, 'Reserva' for a fixed amount."""
    if reserve_type == "fixed":
        return "Reserva"
    parsed = _to_number(reserve_value)
    value = DEFAULT_RESERVE_VALUE if not _is_finite(parsed) else parsed
    shown = int(value) if float(value).is_integer() else value
    return f"Reserva {str(shown).replace('.', ',')}%"


def _resolve_jornadas(
    start_date: Any, end_date: Any, jornadas: Any
) -> int:
    if start_date and end_date:
        return num_jornadas(start_date, end_date)
    parsed = _to_number(jornadas)
    if not _is_finite(parsed) or parsed < 1 or not float(parsed).is_integer():
        raise PricingError("Número de jornadas inválido")
    return int(parsed)


def compute_order_totals(
    *,
    line_items: list[dict[str, Any]],
    start_date: Any = None,
    end_date: Any = None,
    jornadas: Any = None,
    shipping_total: Any = None,
    coupon: dict[str, Any] | None = None,
    discount: Any = None,
    apply_iva: bool = True,
    reserve_type: str | None = None,
    reserve_value: Any = None,
) -> dict[str, Any]:
    """
    The whole money formula, in CLP integers. Mirror of `computeOrderTotals` in pricing.ts.

    `line_items` entries carry `price` and `quantity` (the dashboard/PostgREST shape); the legacy
    Hermes key `precio_dia` is accepted as an alias for `price`.
    """
    resolved_jornadas = _resolve_jornadas(start_date, end_date, jornadas)

    line_subtotals: list[int] = []
    for index, item in enumerate(line_items, start=1):
        price = item.get("price", item.get("precio_dia"))
        line_subtotals.append(
            item_subtotal(
                _non_negative(price, f"precio del ítem {index}"),
                _non_negative(item.get("quantity"), f"cantidad del ítem {index}"),
                resolved_jornadas,
            )
        )

    products_subtotal = sum(line_subtotals)
    shipping = round_half_up(_optional_non_negative(shipping_total, "envío"))

    if coupon:
        applied_discount = compute_discount(coupon, products_subtotal)
    else:
        manual = _to_number(discount)
        applied_discount = _clamp_discount(manual, products_subtotal) if _is_finite(manual) else 0

    net = products_subtotal - applied_discount + shipping
    # Integer arithmetic keeps x.5 exact, exactly as pricing.ts does it.
    iva = (net * 19 + 50) // 100 if apply_iva else 0
    total = net + iva
    reserve = reserve_amount(total, reserve_type, reserve_value)

    return {
        "jornadas": resolved_jornadas,
        "line_subtotals": line_subtotals,
        "products_subtotal": products_subtotal,
        "discount": applied_discount,
        "shipping_total": shipping,
        "net": net,
        "iva": iva,
        "total": total,
        "reserve": reserve,
        "balance": total - reserve,
        "reserve_label": reserve_label(reserve_type, reserve_value),
    }


def calculate_quote(
    lines: list[dict[str, Any]],
    jornadas: int,
    shipping_total: float,
    coupon_type: str | None,
    coupon_amount: float,
    apply_iva: bool,
    coupon_maximum_amount: float | None = None,
    discount: float | None = None,
    reserve_type: str | None = None,
    reserve_value: Any = None,
) -> dict[str, Any]:
    """
    Hermes-facing quote: the canonical totals, under the Spanish keys the MCP tools return.

    Every amount is an integer CLP value; the `presented_*` keys are kept as aliases because the
    tool payloads and the Telegram formatting already read them.
    """
    coupon = (
        {
            "discount_type": coupon_type,
            "amount": coupon_amount,
            "maximum_amount": coupon_maximum_amount,
        }
        if coupon_type
        else None
    )

    totals = compute_order_totals(
        line_items=lines,
        jornadas=jornadas,
        shipping_total=shipping_total,
        coupon=coupon,
        discount=discount,
        apply_iva=apply_iva,
        reserve_type=reserve_type,
        reserve_value=reserve_value,
    )

    return {
        "num_jornadas": totals["jornadas"],
        "line_subtotals": totals["line_subtotals"],
        "subtotal": totals["products_subtotal"],
        "shipping_total": totals["shipping_total"],
        "descuento_cupon": totals["discount"],
        "calculated_subtotal": totals["net"],
        "calculated_iva": totals["iva"],
        "calculated_total": totals["total"],
        "reserva": totals["reserve"],
        "saldo": totals["balance"],
        "reserva_label": totals["reserve_label"],
        "reserve_type": reserve_type or DEFAULT_RESERVE_TYPE,
        "reserve_value": (
            DEFAULT_RESERVE_VALUE
            if not _is_finite(_to_number(reserve_value))
            else _to_number(reserve_value)
        ),
        "apply_iva": apply_iva,
        "moneda": "CLP",
        # Presented aliases — same integers, kept for the existing tool payloads.
        "presented_subtotal": totals["products_subtotal"],
        "presented_descuento": totals["discount"],
        "presented_subtotal_base": totals["net"],
        "presented_iva": totals["iva"],
        "presented_total": totals["total"],
        "presented_reserva": totals["reserve"],
        "presented_saldo": totals["balance"],
    }


def late_fee(daily_cost: float, days_late: int) -> float:
    """Simple late fee: dias_atraso * costo_diario."""
    return float(daily_cost) * days_late
