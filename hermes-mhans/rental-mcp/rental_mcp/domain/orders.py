"""
Pure builders for the `orders` INSERT issued by confirm_write.

Rules:
- No psycopg, no mcp: importable in tests without the server stack.
- The SQL is derived from ORDER_INSERT_COLUMNS so the column list and the
  placeholder list cannot drift apart. Every identifier here is a module
  constant; no caller input is ever interpolated.
"""
from __future__ import annotations

from typing import Any

from ..validators import is_valid_status

# The eleven NOT NULL columns of `orders` that have no default. Omitting any
# of them aborts the INSERT, and Postgres reports only the first violation —
# which is how billing_address_1, billing_city and company_rut stayed missing
# (rehearsal 0002, F-3). Keep in sync with 0000_baseline.sql.
REQUIRED_ORDER_COLUMNS: frozenset[str] = frozenset({
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
})

# Column order of the INSERT. build_order_insert_params() returns values in
# exactly this order.
# No apply_iva column in this DB: the apply_iva branch is already folded into
# calculated_iva by the quote.
ORDER_INSERT_COLUMNS: tuple[str, ...] = (
    "status",
    "customer_id",
    "order_proyecto",
    "order_fecha_inicio",
    "order_fecha_termino",
    "num_jornadas",
    "calculated_subtotal",
    "calculated_discount",
    "calculated_iva",
    "calculated_total",
    "shipping_total",
    "pago_completo",
    "line_items",
    "billing_first_name",
    "billing_last_name",
    "billing_email",
    "billing_phone",
    "billing_address_1",
    "billing_city",
    "company_rut",
)

_CASTS: dict[str, str] = {"line_items": "%s::jsonb"}


def order_insert_sql() -> str:
    """Build the parametrized INSERT for a new order."""
    columns = ", ".join(ORDER_INSERT_COLUMNS)
    placeholders = ", ".join(_CASTS.get(col, "%s") for col in ORDER_INSERT_COLUMNS)
    return f"INSERT INTO orders ({columns}) VALUES ({placeholders}) RETURNING id"


def _text(profile: dict[str, Any], key: str) -> str:
    """Profile field as text. NOT NULL columns take '' when data is absent."""
    return str(profile.get(key) or "")


def build_order_insert_params(
    *,
    customer_id: int,
    order_proyecto: str,
    fecha_inicio: Any,
    fecha_termino: Any,
    num_jornadas: int,
    quote: dict[str, Any],
    line_items_json: str,
    profile: dict[str, Any],
    status: str = "on-hold",
) -> tuple[Any, ...]:
    """
    Build the INSERT values from a quote and a user_profiles row.

    Billing mapping mirrors the two existing writers so a Hermes order is
    indistinguishable from one created elsewhere:
      billing_address_1 <- direccion, billing_city <- ciudad  (frontend
      OrderConfirmation.tsx prefills its billing form from those fields)
      company_rut <- rut  (dashboard CreateOrderForm.tsx: `selectedUser.rut || ''`;
      the frontend labels the same field "RUT de facturación"). Despite the
      column name it holds the billing RUT of whoever rents — the personal RUT
      for a natural person — and '' when the profile has none. No sentinel.
    """
    if not is_valid_status(status):
        raise ValueError(
            f"Estado '{status}' no permitido por la base de datos. "
            "El INSERT sería rechazado por orders_status_check."
        )

    values: dict[str, Any] = {
        "status": status,
        "customer_id": customer_id,
        "order_proyecto": order_proyecto,
        "order_fecha_inicio": fecha_inicio,
        "order_fecha_termino": fecha_termino,
        "num_jornadas": num_jornadas,
        "calculated_subtotal": quote["calculated_subtotal"],
        "calculated_discount": quote["descuento_cupon"],
        "calculated_iva": quote["calculated_iva"],
        "calculated_total": quote["calculated_total"],
        "shipping_total": quote["shipping_total"],
        "pago_completo": False,
        "line_items": line_items_json,
        "billing_first_name": _text(profile, "nombre"),
        "billing_last_name": _text(profile, "apellido"),
        "billing_email": _text(profile, "email"),
        "billing_phone": _text(profile, "telefono"),
        "billing_address_1": _text(profile, "direccion"),
        "billing_city": _text(profile, "ciudad"),
        "company_rut": _text(profile, "rut"),
    }
    return tuple(values[col] for col in ORDER_INSERT_COLUMNS)
