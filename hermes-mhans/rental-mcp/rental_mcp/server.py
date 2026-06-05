"""
FastMCP server — Mario Hans Rental Fotográfico.

Rules:
- NOTHING writes to stdout except MCP protocol. All logs → stderr.
- Descriptions are in Chilean Spanish (the agent's language).
- SQL ALWAYS parametrized (%s). No f-strings with user input in SQL.
- Pools are lazy (created on first use via db.py).
- Write tools use draft→confirm pattern via hermes_pending_writes.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import secrets
import sys
from datetime import date, datetime, timedelta, timezone
from typing import Any

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel

from rental_mcp import db
from rental_mcp import dashboard_client
from rental_mcp.validators import (
    SAFE_CLIENT_FIELDS,
    _filter_client_fields,
    _validate_email,          # used directly in draft_create_client
    _validate_rut as _validate_rut_impl,
)
from rental_mcp.domain import pricing as domain_pricing
from rental_mcp.domain import availability as domain_avail
from rental_mcp.models import (
    AvailabilityResult,
    ClientDetail,
    ClientSummary,
    ConfirmResult,
    ContractStatus,
    DraftResult,
    OrderSummary,
    PickupList,
    ProductAvailability,
    ProductItem,
    QuoteLine,
    QuoteResult,
    RevenueReport,
)

# All logs to stderr — stdout is reserved for MCP protocol
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger(__name__)

# Firma del SDK oficial (mcp.server.fastmcp): name + instructions.
# OJO: kwargs como version=/description= NO existen y crashean el server al
# spawn (TypeError) — Hermes solo muestra "initial connection failed".
mcp = FastMCP(
    name="rental-mcp",
    instructions="Servidor MCP de dominio para Mario Hans Rental Fotográfico — arriendo de equipos fotográficos, Chile. Lectura tipada + escrituras draft→confirm.",
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

UTC = timezone.utc


def _now() -> datetime:
    return datetime.now(UTC)


def _half_up(x: float) -> int:
    return int(x + 0.5)


def _coerce_price(val: Any) -> float:
    """Products.price may arrive as string or numeric from Supabase."""
    if val is None:
        return 0.0
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


# Chilean RUT validator (módulo 11) — delegates to validators module.
# Kept here so existing call-sites inside server.py don't need to change.
def _validate_rut(rut: str) -> bool:
    """Validate Chilean RUT (e.g. '12345678-9' or '12345678K')."""
    return _validate_rut_impl(rut)


# Workflow transition map
_VALID_TRANSITIONS: dict[str, list[str]] = {
    "on-hold":     ["reviewing", "failed"],
    "reviewing":   ["processing", "failed"],
    "processing":  ["preparing", "failed"],
    "preparing":   ["delivering", "failed"],
    "delivering":  ["completed", "failed"],
    "completed":   ["paid", "failed"],
    "paid":        ["failed"],
    "failed":      [],
}


def _is_valid_transition(current: str, new: str) -> bool:
    return new in _VALID_TRANSITIONS.get(current, [])


async def _fetch_coupon(code: str) -> dict[str, Any] | None:
    """Fetch and validate a coupon by code."""
    row = await db.fetch_one(
        "SELECT * FROM coupons WHERE code = %s LIMIT 1",
        (code,),
    )
    return row


async def _quote_internal(
    product_ids: list[int],
    start_date: date,
    end_date: date,
    quantities: dict[int, int] | None,
    coupon_code: str | None,
    shipping_total: float,
    apply_iva: bool,
) -> dict[str, Any]:
    """Shared logic for quoting (used by tool and draft_create_order)."""
    jornadas = domain_pricing.num_jornadas(start_date, end_date)
    qtys = quantities or {}

    # Fetch product prices
    placeholders = ",".join(["%s"] * len(product_ids))
    rows = await db.fetch_all(
        f"SELECT id, name, sku, price FROM products WHERE id IN ({placeholders})",
        tuple(product_ids),
    )
    by_id = {r["id"]: r for r in rows}

    lines_domain: list[dict[str, Any]] = []
    lines_out: list[QuoteLine] = []

    for pid in product_ids:
        product = by_id.get(pid)
        if not product:
            raise ValueError(f"Producto {pid} no encontrado")
        price = _coerce_price(product["price"])
        qty = qtys.get(pid, 1)
        subtotal_raw = domain_pricing.item_subtotal(price, qty, jornadas)
        lines_domain.append({"precio_dia": price, "quantity": qty})
        lines_out.append(
            QuoteLine(
                product_id=pid,
                # `or ""`: la DB trae NULL explícito (no ausencia) — .get(default)
                # no cubre None y pydantic rechaza. Cazado contra producción.
                name=product.get("name") or "",
                sku=product.get("sku") or "",
                precio_dia=price,
                quantity=qty,
                item_subtotal_raw=subtotal_raw,
                item_subtotal_presented=_half_up(subtotal_raw),
            )
        )

    # Coupon resolution
    coupon_type: str | None = None
    coupon_amount: float = 0.0
    coupon_info: dict[str, Any] | None = None

    if coupon_code:
        coupon_row = await _fetch_coupon(coupon_code)
        if not coupon_row:
            coupon_info = {"code": coupon_code, "valid": False, "reason": "Cupón no encontrado"}
        else:
            now = _now()
            expires = coupon_row.get("date_expires")
            if expires and expires < now:
                coupon_info = {"code": coupon_code, "valid": False, "reason": "Cupón vencido"}
            elif coupon_row.get("usage_limit") and coupon_row.get("usage_count", 0) >= coupon_row["usage_limit"]:
                coupon_info = {"code": coupon_code, "valid": False, "reason": "Cupón agotado"}
            else:
                coupon_type = coupon_row["discount_type"]
                coupon_amount = float(coupon_row["amount"])
                coupon_info = {
                    "code": coupon_code,
                    "valid": True,
                    "discount_type": coupon_type,
                    "amount": coupon_amount,
                }

    calc = domain_pricing.calculate_quote(
        lines=lines_domain,
        jornadas=jornadas,
        shipping_total=shipping_total,
        coupon_type=coupon_type,
        coupon_amount=coupon_amount,
        apply_iva=apply_iva,
    )

    return {
        "num_jornadas": jornadas,
        "lineas": [ln.model_dump() for ln in lines_out],
        "subtotal": calc["subtotal"],
        "descuento_cupon": calc["descuento_cupon"],
        "coupon": coupon_info,
        "shipping_total": calc["shipping_total"],
        "calculated_subtotal": calc["calculated_subtotal"],
        "calculated_iva": calc["calculated_iva"],
        "calculated_total": calc["calculated_total"],
        "reserva_25": calc["reserva_25"],
        "saldo_75": calc["saldo_75"],
        "presented_total": calc["presented_total"],
        "presented_iva": calc["presented_iva"],
        "presented_reserva": calc["presented_reserva"],
        "presented_saldo": calc["presented_saldo"],
        "moneda": "CLP",
        "apply_iva": apply_iva,
    }


# ---------------------------------------------------------------------------
# TOOL 1 — quote_rental (read-only)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def quote_rental(
    product_ids: list[int],
    start_date: date,
    end_date: date,
    quantities: dict[int, int] | None = None,
    coupon_code: str | None = None,
    shipping_total: float = 0,
    apply_iva: bool = True,
) -> dict[str, Any]:
    """
    Cotiza un arriendo fotográfico para los productos indicados.
    Calcula jornadas, subtotales, IVA, reserva 25% y saldo 75%.
    Valida cupón (existencia, vigencia, límite de uso).
    """
    try:
        return await _quote_internal(
            product_ids, start_date, end_date, quantities, coupon_code, shipping_total, apply_iva
        )
    except ValueError as e:
        return {"error": str(e)}
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 2 — check_availability (read-only)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def check_availability(
    product_ids: list[int],
    start_date: date,
    end_date: date,
    exclude_order_id: int | None = None,
) -> dict[str, Any]:
    """
    Verifica disponibilidad de productos para un rango de fechas.
    Detecta solapamientos con órdenes activas (on-hold → delivering).
    """
    try:
        active_statuses = ("on-hold", "reviewing", "processing", "preparing", "delivering")
        placeholders_p = ",".join(["%s"] * len(product_ids))
        placeholders_s = ",".join(["%s"] * len(active_statuses))

        # NOTA: en ESTA DB no existe la tabla order_items — las lineas viven en
        # orders.line_items (jsonb array, product_id como STRING). Verificado.
        sql = f"""
            SELECT
                (li->>'product_id')::int AS product_id,
                o.id AS order_id,
                o.order_proyecto,
                o.order_fecha_inicio,
                o.order_fecha_termino,
                o.status
            FROM orders o,
                 jsonb_array_elements(coalesce(o.line_items, '[]'::jsonb)) li
            WHERE li->>'product_id' ~ '^[0-9]+$'
              AND (li->>'product_id')::int IN ({placeholders_p})
              AND o.status IN ({placeholders_s})
              AND o.order_fecha_inicio IS NOT NULL
              AND o.order_fecha_termino IS NOT NULL
              AND o.order_fecha_inicio <= %s
              AND o.order_fecha_termino >= %s
        """
        params: tuple = tuple(product_ids) + active_statuses + (end_date, start_date)

        if exclude_order_id is not None:
            sql += " AND o.id != %s"
            params = params + (exclude_order_id,)

        rows = await db.fetch_all(sql, params)

        # Group conflicts by product
        by_product: dict[int, list[dict]] = {pid: [] for pid in product_ids}
        for row in rows:
            by_product.setdefault(row["product_id"], []).append(row)

        result: list[dict[str, Any]] = []
        for pid in product_ids:
            conflicts_raw = by_product.get(pid, [])
            conflicts_out = []
            max_pct = 0
            for c in conflicts_raw:
                s1 = c["order_fecha_inicio"]
                e1 = c["order_fecha_termino"]
                if isinstance(s1, datetime):
                    s1 = s1.date()
                if isinstance(e1, datetime):
                    e1 = e1.date()
                overlap_days, _, pct = domain_avail.calculate_overlap(
                    start_date, end_date, s1, e1
                )
                if pct > max_pct:
                    max_pct = pct
                conflicts_out.append({
                    "order_id": c["order_id"],
                    "order_proyecto": c.get("order_proyecto", ""),
                    "start_date": s1.isoformat() if hasattr(s1, "isoformat") else str(s1),
                    "end_date": e1.isoformat() if hasattr(e1, "isoformat") else str(e1),
                    "status": c["status"],
                    "overlap_days": overlap_days,
                    "overlap_pct": pct,
                })
            result.append({
                "product_id": pid,
                "disponible": len(conflicts_out) == 0,
                "overlap_pct": max_pct,
                "conflictos": conflicts_out,
            })

        return {"por_producto": result}
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 3 — get_product_catalog (read-only)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def get_product_catalog(
    query: str | None = None,
    sku: str | None = None,
    category_id: int | None = None,
    only_instock: bool = False,
    limit: int = 20,
) -> dict[str, Any]:
    """
    Busca productos del catálogo fotográfico.
    Filtra por nombre (ILIKE), SKU, categoría y estado de stock.
    """
    try:
        conditions = []
        params: list[Any] = []

        if query:
            conditions.append("p.name ILIKE %s")
            params.append(f"%{query}%")
        if sku:
            conditions.append("p.sku ILIKE %s")
            params.append(f"%{sku}%")
        if only_instock:
            conditions.append("p.stock_status = 'instock'")
        if category_id:
            conditions.append("p.categories_ids @> %s::jsonb")
            params.append(json.dumps([category_id]))

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(limit)

        rows = await db.fetch_all(
            f"SELECT id, name, sku, slug, price, stock_status, categories_ids FROM products {where} LIMIT %s",
            tuple(params),
        )

        products = [
            {
                "id": r["id"],
                "name": r["name"],
                "sku": r.get("sku", ""),
                "slug": r.get("slug", ""),
                "price": _coerce_price(r.get("price")),
                "stock_status": r.get("stock_status", ""),
            }
            for r in rows
        ]
        return {"productos": products, "total": len(products)}
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 4 — get_order_status (read-only)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def get_order_status(order_id: int) -> dict[str, Any]:
    """
    Obtiene el estado actual de una orden: cliente, fechas, estado workflow, links de PDF.
    """
    try:
        row = await db.fetch_one(
            """
            SELECT
                o.id, o.status, o.order_proyecto,
                o.order_fecha_inicio, o.order_fecha_termino, o.num_jornadas,
                o.calculated_total, o.new_pdf_on_hold_url, o.new_pdf_processing_url,
                o.date_created, o.date_modified,
                o.billing_first_name, o.billing_last_name
            FROM orders o WHERE o.id = %s
            """,
            (order_id,),
        )
        if not row:
            return {"error": f"Orden {order_id} no encontrada"}
        return {
            "id": row["id"],
            "status": row["status"],
            "order_proyecto": row.get("order_proyecto", ""),
            "billing_name": f"{row.get('billing_first_name', '')} {row.get('billing_last_name', '')}".strip(),
            "order_fecha_inicio": row["order_fecha_inicio"].isoformat() if row.get("order_fecha_inicio") else None,
            "order_fecha_termino": row["order_fecha_termino"].isoformat() if row.get("order_fecha_termino") else None,
            "num_jornadas": row.get("num_jornadas"),
            "calculated_total": row.get("calculated_total"),
            "pdf_on_hold": row.get("new_pdf_on_hold_url"),
            "pdf_processing": row.get("new_pdf_processing_url"),
            "date_created": row["date_created"].isoformat() if row.get("date_created") else None,
            "date_modified": row["date_modified"].isoformat() if row.get("date_modified") else None,
        }
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 5 — list_orders (read-only)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def list_orders(
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """
    Lista órdenes con filtros opcionales por estado y rango de fechas de creación.
    """
    try:
        conditions = []
        params: list[Any] = []

        if status:
            conditions.append("status = %s")
            params.append(status)
        if date_from:
            conditions.append("date_created >= %s")
            params.append(date_from)
        if date_to:
            conditions.append("date_created <= %s")
            params.append(date_to)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(limit)

        rows = await db.fetch_all(
            f"""
            SELECT id, status, order_proyecto, billing_first_name, billing_last_name,
                   order_fecha_inicio, order_fecha_termino, calculated_total, date_created
            FROM orders {where}
            ORDER BY date_created DESC
            LIMIT %s
            """,
            tuple(params),
        )

        orders = [
            {
                "id": r["id"],
                "status": r["status"],
                "proyecto": r.get("order_proyecto", ""),
                "cliente": f"{r.get('billing_first_name', '')} {r.get('billing_last_name', '')}".strip(),
                "fecha_inicio": r["order_fecha_inicio"].isoformat() if r.get("order_fecha_inicio") else None,
                "fecha_termino": r["order_fecha_termino"].isoformat() if r.get("order_fecha_termino") else None,
                "total": r.get("calculated_total"),
                "date_created": r["date_created"].isoformat() if r.get("date_created") else None,
            }
            for r in rows
        ]
        return {"ordenes": orders, "total": len(orders)}
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 5b — list_client_orders (read-only, B1)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def list_client_orders(user_id: str, limit: int = 10) -> dict[str, Any]:
    """
    Lista el historial de órdenes de un cliente específico (por user_id/customer_id).
    Devuelve hasta `limit` órdenes, ordenadas por fecha de creación descendente.
    """
    try:
        rows = await db.fetch_all(
            """
            SELECT id, status, order_proyecto, order_fecha_inicio, order_fecha_termino,
                   calculated_total, date_created, num_jornadas
            FROM orders
            WHERE customer_id::text = %s
            ORDER BY date_created DESC
            LIMIT %s
            """,
            (str(user_id), limit),
        )
        orders = [
            {
                "id": r["id"],
                "status": r["status"],
                "proyecto": r.get("order_proyecto", ""),
                "fecha_inicio": r["order_fecha_inicio"].isoformat() if r.get("order_fecha_inicio") else None,
                "fecha_termino": r["order_fecha_termino"].isoformat() if r.get("order_fecha_termino") else None,
                "num_jornadas": r.get("num_jornadas"),
                "total": r.get("calculated_total"),
                "date_created": r["date_created"].isoformat() if r.get("date_created") else None,
            }
            for r in rows
        ]
        return {"user_id": user_id, "ordenes": orders, "total": len(orders)}
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 5c — client_stats (read-only, B1)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def client_stats(user_id: str) -> dict[str, Any]:
    """
    Estadísticas históricas de un cliente: número de órdenes, total acumulado CLP,
    última orden, y desglose por estado.
    """
    try:
        row = await db.fetch_one(
            """
            SELECT
                COUNT(*)                        AS num_ordenes,
                SUM(calculated_total)           AS total_historico,
                MAX(date_created)               AS ultima_orden,
                MIN(date_created)               AS primera_orden
            FROM orders
            WHERE customer_id::text = %s
            """,
            (str(user_id),),
        )
        por_estado_rows = await db.fetch_all(
            """
            SELECT status, COUNT(*) AS cantidad, SUM(calculated_total) AS total
            FROM orders
            WHERE customer_id::text = %s
            GROUP BY status
            ORDER BY cantidad DESC
            """,
            (str(user_id),),
        )
        return {
            "user_id": user_id,
            "num_ordenes": int(row["num_ordenes"] or 0),
            "total_historico_clp": int(row["total_historico"] or 0) if row.get("total_historico") else 0,
            "ultima_orden": row["ultima_orden"].isoformat() if row.get("ultima_orden") else None,
            "primera_orden": row["primera_orden"].isoformat() if row.get("primera_orden") else None,
            "por_estado": [
                {
                    "status": r["status"],
                    "cantidad": int(r["cantidad"]),
                    "total_clp": int(r["total"] or 0) if r.get("total") else 0,
                }
                for r in por_estado_rows
            ],
        }
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 6 — list_pickups_today (read-only)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def list_pickups_today(target_date: date | None = None) -> dict[str, Any]:
    """
    Lista retiros y devoluciones del día.
    Retiros: órdenes con order_fecha_inicio = target_date (se retiran hoy).
    Devoluciones: order_fecha_termino = ayer (plazo devolución hasta 13h del día siguiente,
    que es hoy).
    """
    try:
        today = target_date or _now().date()
        yesterday = today - timedelta(days=1)
        active = ("on-hold", "reviewing", "processing", "preparing", "delivering")
        placeholders = ",".join(["%s"] * len(active))

        base_sql = f"""
            SELECT id, status, order_proyecto, billing_first_name, billing_last_name,
                   order_fecha_inicio, order_fecha_termino, num_jornadas, calculated_total
            FROM orders
            WHERE status IN ({placeholders})
        """

        retiros_rows = await db.fetch_all(
            base_sql + " AND order_fecha_inicio = %s",
            active + (today,),
        )
        devoluciones_rows = await db.fetch_all(
            base_sql + " AND order_fecha_termino = %s",
            active + (yesterday,),
        )

        def fmt(rows: list) -> list[dict]:
            return [
                {
                    "id": r["id"],
                    "status": r["status"],
                    "proyecto": r.get("order_proyecto", ""),
                    "cliente": f"{r.get('billing_first_name', '')} {r.get('billing_last_name', '')}".strip(),
                    "fecha_inicio": r["order_fecha_inicio"].isoformat() if r.get("order_fecha_inicio") else None,
                    "fecha_termino": r["order_fecha_termino"].isoformat() if r.get("order_fecha_termino") else None,
                    "num_jornadas": r.get("num_jornadas"),
                }
                for r in rows
            ]

        return {
            "fecha": today.isoformat(),
            "retiros_hoy": fmt(retiros_rows),
            "devoluciones_hoy": fmt(devoluciones_rows),
        }
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 7 — find_client (read-only, no PII)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def find_client(
    nombre: str | None = None,
    email: str | None = None,
    rut: str | None = None,
    telefono: str | None = None,
    limit: int = 10,
) -> dict[str, Any]:
    """
    Busca clientes por nombre, email, RUT o teléfono.
    Devuelve SOLO user_id, nombre, apellido, tipo_cliente, has_contract.
    Sin PII sensible.
    """
    try:
        conditions = []
        params: list[Any] = []

        if nombre:
            conditions.append("(nombre ILIKE %s OR apellido ILIKE %s)")
            params.extend([f"%{nombre}%", f"%{nombre}%"])
        if email:
            conditions.append("email ILIKE %s")
            params.append(f"%{email}%")
        if rut:
            conditions.append("rut ILIKE %s")
            params.append(f"%{rut}%")
        if telefono:
            conditions.append("telefono ILIKE %s")
            params.append(f"%{telefono}%")

        if not conditions:
            return {"error": "Se requiere al menos un criterio de búsqueda"}

        where = " AND ".join(conditions)
        params.append(limit)

        rows = await db.fetch_all(
            f"""
            SELECT user_id, nombre, apellido, tipo_cliente,
                   (url_user_contrato IS NOT NULL) AS has_contract
            FROM user_profiles
            WHERE {where}
            LIMIT %s
            """,
            tuple(params),
        )

        return {
            "clientes": [
                {
                    "user_id": r["user_id"],
                    "nombre": r.get("nombre", ""),
                    "apellido": r.get("apellido", ""),
                    "tipo_cliente": r.get("tipo_cliente", ""),
                    "has_contract": bool(r.get("has_contract")),
                }
                for r in rows
            ],
            "total": len(rows),
        }
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 8 — get_client (read-only)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def get_client(user_id: str, include_pii: bool = False) -> dict[str, Any]:
    """
    Obtiene el perfil de un cliente.
    PII (rut, email, teléfono, docs) SOLO si include_pii=True.
    """
    try:
        row = await db.fetch_one(
            "SELECT * FROM user_profiles WHERE user_id = %s",
            (user_id,),
        )
        if not row:
            return {"error": f"Cliente {user_id} no encontrado"}

        base = {
            "user_id": row["user_id"],
            "nombre": row.get("nombre", ""),
            "apellido": row.get("apellido", ""),
            "tipo_cliente": row.get("tipo_cliente", ""),
            "empresa_nombre": row.get("empresa_nombre"),
            "has_contract": row.get("url_user_contrato") is not None,
            "terminos_aceptados": row.get("terminos_aceptados"),
        }
        if include_pii:
            base.update(
                {
                    "email": row.get("email"),
                    "telefono": row.get("telefono"),
                    "rut": row.get("rut"),
                    "empresa_rut": row.get("empresa_rut"),
                    "direccion": row.get("direccion"),
                    "ciudad": row.get("ciudad"),
                    "url_user_contrato": row.get("url_user_contrato"),
                    "url_firma": row.get("url_firma"),
                    "url_rut_anverso": row.get("url_rut_anverso"),
                    "url_rut_reverso": row.get("url_rut_reverso"),
                }
            )
        return base
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 9 — contract_status (read-only)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def contract_status(user_id: str) -> dict[str, Any]:
    """
    Verifica el estado de contrato de un cliente.
    Devuelve campos faltantes para completar el perfil.
    """
    try:
        row = await db.fetch_one(
            """
            SELECT user_id, nombre, apellido, rut, direccion,
                   url_firma, terminos_aceptados, url_user_contrato
            FROM user_profiles WHERE user_id = %s
            """,
            (user_id,),
        )
        if not row:
            return {"error": f"Cliente {user_id} no encontrado"}

        required = {
            "nombre": row.get("nombre"),
            "apellido": row.get("apellido"),
            "rut": row.get("rut"),
            "direccion": row.get("direccion"),
            "url_firma": row.get("url_firma"),
            "terminos_aceptados": row.get("terminos_aceptados"),
        }
        faltantes = [k for k, v in required.items() if not v]
        has_contract = row.get("url_user_contrato") is not None

        rut_val = row.get("rut")
        rut_valido = _validate_rut(rut_val) if rut_val else None

        return {
            "user_id": user_id,
            "has_contract": has_contract,
            "faltantes": faltantes,
            "rut_valido": rut_valido,
        }
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 10 — revenue_report (read-only)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def revenue_report(
    date_from: date,
    date_to: date,
    group_by: str = "status",
) -> dict[str, Any]:
    """
    Informe de ingresos por estado (u otro agrupador).
    Incluye top 5 productos por ingreso en el período.
    """
    try:
        rows = await db.fetch_all(
            f"""
            SELECT status,
                   COUNT(*) AS num_ordenes,
                   SUM(calculated_total) AS total_ingresos,
                   AVG(calculated_total) AS promedio
            FROM orders
            WHERE date_created BETWEEN %s AND %s
            GROUP BY {group_by}
            ORDER BY total_ingresos DESC NULLS LAST
            """,
            (date_from, date_to),
        )

        # Sin tabla order_items: expandir orders.line_items (jsonb).
        # Ingreso por linea = price (diario) x quantity x num_jornadas de la orden.
        top_products = await db.fetch_all(
            """
            SELECT (li->>'product_id')::int AS product_id, p.name,
                   COUNT(*) AS veces_arrendado,
                   SUM((li->>'price')::numeric * coalesce((li->>'quantity')::numeric, 1)
                       * coalesce(o.num_jornadas, 1)) AS ingresos
            FROM orders o,
                 jsonb_array_elements(coalesce(o.line_items, '[]'::jsonb)) li
            LEFT JOIN products p ON p.id = (li->>'product_id')::int
            WHERE li->>'product_id' ~ '^[0-9]+$'
              AND o.date_created BETWEEN %s AND %s
            GROUP BY 1, p.name
            ORDER BY ingresos DESC NULLS LAST
            LIMIT 5
            """,
            (date_from, date_to),
        )

        return {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "group_by": group_by,
            "rows": [dict(r) for r in rows],
            "top_productos": [dict(r) for r in top_products],
        }
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 11 — product_demand (read-only)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def product_demand(
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 10,
) -> dict[str, Any]:
    """
    Ranking de productos por demanda: veces arrendado e ingresos generados.
    """
    try:
        conditions = []
        params: list[Any] = []
        if date_from:
            conditions.append("o.date_created >= %s")
            params.append(date_from)
        if date_to:
            conditions.append("o.date_created <= %s")
            params.append(date_to)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(limit)

        # Sin tabla order_items: expandir orders.line_items (jsonb).
        guard = "li->>'product_id' ~ '^[0-9]+$'"
        where_full = f"WHERE {guard} AND {' AND '.join(conditions)}" if conditions else f"WHERE {guard}"
        rows = await db.fetch_all(
            f"""
            SELECT (li->>'product_id')::int AS product_id, p.name, p.sku,
                   COUNT(*) AS veces_arrendado,
                   SUM((li->>'price')::numeric * coalesce((li->>'quantity')::numeric, 1)
                       * coalesce(o.num_jornadas, 1)) AS ingresos
            FROM orders o,
                 jsonb_array_elements(coalesce(o.line_items, '[]'::jsonb)) li
            LEFT JOIN products p ON p.id = (li->>'product_id')::int
            {where_full}
            GROUP BY 1, p.name, p.sku
            ORDER BY veces_arrendado DESC NULLS LAST
            LIMIT %s
            """,
            tuple(params),
        )
        return {"ranking": [dict(r) for r in rows]}
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 12 — low_stock_report (read-only)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"readOnlyHint": True})
async def low_stock_report() -> dict[str, Any]:
    """
    Productos con stock_status distinto de 'instock'.
    """
    try:
        rows = await db.fetch_all(
            "SELECT id, name, sku, stock_status FROM products WHERE stock_status != 'instock' ORDER BY name",
        )
        return {"productos_sin_stock": [dict(r) for r in rows], "total": len(rows)}
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 13 — draft_create_order (write, destructive)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"destructiveHint": True})
async def draft_create_order(
    customer_id: str,
    product_ids: list[int],
    quantities: dict[int, int],
    start_date: date,
    end_date: date,
    order_proyecto: str,
    coupon_code: str | None = None,
    shipping_total: float = 0,
    apply_iva: bool = True,
) -> dict[str, Any]:
    """
    Prepara un borrador de orden de arriendo (requiere confirmación).
    Valida: cliente existe, tiene contrato firmado, fechas válidas,
    disponibilidad (conflictos = advertencia), y cotiza.
    Devuelve plan_id + preview + confirmation_token (válido 15 minutos).
    """
    try:
        advertencias: list[str] = []

        # Validate customer exists and has contract
        client_row = await db.fetch_one(
            "SELECT user_id, nombre, apellido, url_user_contrato FROM user_profiles WHERE user_id = %s",
            (customer_id,),
        )
        if not client_row:
            return {"error": f"Cliente {customer_id} no encontrado"}
        if not client_row.get("url_user_contrato"):
            return {"error": "El cliente no tiene contrato firmado. Sin contrato no se puede crear una orden."}

        # Validate dates
        if start_date > end_date:
            return {"error": f"start_date ({start_date}) debe ser <= end_date ({end_date})"}

        # Availability check (soft warning, not hard block)
        avail = await check_availability(product_ids, start_date, end_date)
        if "error" not in avail:
            for pa in avail.get("por_producto", []):
                if not pa["disponible"]:
                    advertencias.append(
                        f"Producto {pa['product_id']} tiene {len(pa['conflictos'])} conflicto(s) "
                        f"(overlap máx {pa['overlap_pct']}%). Verificar antes de confirmar."
                    )

        # Quote
        quote = await _quote_internal(
            product_ids, start_date, end_date, quantities, coupon_code, shipping_total, apply_iva
        )
        if "error" in quote:
            return quote

        plan_json = {
            "customer_id": customer_id,
            "product_ids": product_ids,
            "quantities": quantities,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "order_proyecto": order_proyecto,
            "quote": quote,
            "apply_iva": apply_iva,
        }

        token = secrets.token_urlsafe(32)
        expires_at = _now() + timedelta(minutes=15)
        allowed_users = os.environ.get("TELEGRAM_ALLOWED_USERS", "")
        bound_user = allowed_users.split(",")[0].strip() if allowed_users else None

        # Insert pending write
        result = await db.fetch_one(
            """
            INSERT INTO hermes_pending_writes
                (action, plan_json, confirmation_token, bound_user, expires_at)
            VALUES (%s, %s::jsonb, %s, %s, %s)
            RETURNING id, expires_at
            """,
            ("create_order", json.dumps(plan_json), token, bound_user, expires_at),
            pool="rw",
        )

        if not result:
            return {"error": "No se pudo crear el borrador"}

        return {
            "plan_id": str(result["id"]),
            "preview": {
                "cliente": f"{client_row.get('nombre', '')} {client_row.get('apellido', '')}".strip(),
                "proyecto": order_proyecto,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "num_jornadas": quote["num_jornadas"],
                "total_presentado": quote["presented_total"],
                "reserva_presentada": quote["presented_reserva"],
                "saldo_presentado": quote["presented_saldo"],
                "iva_presentado": quote["presented_iva"],
                "moneda": "CLP",
            },
            "confirmation_token": token,
            "expires_at": expires_at.isoformat(),
            "advertencias": advertencias,
        }
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 14 — update_order_status_draft (write, destructive)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"destructiveHint": True})
async def update_order_status_draft(order_id: int, new_status: str) -> dict[str, Any]:
    """
    Prepara un cambio de estado de orden (requiere confirmación).
    Valida la transición de workflow. Si new_status='processing', advierte
    que se requiere confirmar pago de reserva antes de proceder.
    """
    try:
        order = await db.fetch_one(
            "SELECT id, status, pago_completo FROM orders WHERE id = %s",
            (order_id,),
        )
        if not order:
            return {"error": f"Orden {order_id} no encontrada"}

        current = order["status"]
        if not _is_valid_transition(current, new_status):
            valid = _VALID_TRANSITIONS.get(current, [])
            return {
                "error": f"Transición inválida: '{current}' → '{new_status}'. "
                         f"Transiciones válidas desde '{current}': {valid}"
            }

        advertencias: list[str] = []
        if new_status == "processing" and not order.get("pago_completo"):
            advertencias.append(
                "ATENCIÓN: La orden no tiene pago_completo=true. "
                "El estado 'processing' SOLO debe activarse si el pago de reserva está confirmado. "
                "Confirmar esta acción es responsabilidad del operador."
            )

        plan_json = {
            "order_id": order_id,
            "current_status": current,
            "new_status": new_status,
        }
        token = secrets.token_urlsafe(32)
        expires_at = _now() + timedelta(minutes=15)

        result = await db.fetch_one(
            """
            INSERT INTO hermes_pending_writes (action, plan_json, confirmation_token, expires_at)
            VALUES (%s, %s::jsonb, %s, %s)
            RETURNING id, expires_at
            """,
            ("update_status", json.dumps(plan_json), token, expires_at),
            pool="rw",
        )

        if not result:
            return {"error": "No se pudo crear el borrador de cambio de estado"}

        return {
            "plan_id": str(result["id"]),
            "preview": {
                "order_id": order_id,
                "de": current,
                "a": new_status,
            },
            "confirmation_token": token,
            "expires_at": expires_at.isoformat(),
            "advertencias": advertencias,
        }
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 15 — draft_generate_contract (write, destructive)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"destructiveHint": True})
async def draft_generate_contract(user_id: str) -> dict[str, Any]:
    """
    Prepara la generación de contrato para un cliente (requiere confirmación).
    Valida: perfil completo, RUT módulo 11, términos aceptados.
    """
    try:
        row = await db.fetch_one(
            """
            SELECT user_id, nombre, apellido, rut, direccion, url_firma, terminos_aceptados
            FROM user_profiles WHERE user_id = %s
            """,
            (user_id,),
        )
        if not row:
            return {"error": f"Cliente {user_id} no encontrado"}

        faltantes = []
        required = {
            "nombre": row.get("nombre"),
            "apellido": row.get("apellido"),
            "rut": row.get("rut"),
            "direccion": row.get("direccion"),
            "url_firma": row.get("url_firma"),
            "terminos_aceptados": row.get("terminos_aceptados"),
        }
        for k, v in required.items():
            if not v:
                faltantes.append(k)

        rut_valido = True
        if row.get("rut"):
            rut_valido = _validate_rut(row["rut"])
            if not rut_valido:
                faltantes.append("rut_invalido")

        if faltantes:
            return {
                "error": f"Perfil incompleto. Campos faltantes o inválidos: {faltantes}",
                "faltantes": faltantes,
            }

        plan_json = {"user_id": user_id}
        token = secrets.token_urlsafe(32)
        expires_at = _now() + timedelta(minutes=15)

        result = await db.fetch_one(
            """
            INSERT INTO hermes_pending_writes (action, plan_json, confirmation_token, expires_at)
            VALUES (%s, %s::jsonb, %s, %s)
            RETURNING id, expires_at
            """,
            ("generate_contract", json.dumps(plan_json), token, expires_at),
            pool="rw",
        )

        if not result:
            return {"error": "No se pudo crear el borrador"}

        return {
            "plan_id": str(result["id"]),
            "preview": {
                "user_id": user_id,
                "nombre": f"{row.get('nombre', '')} {row.get('apellido', '')}".strip(),
                "rut": row.get("rut"),
                "accion": "Generar contrato vía dashboard",
            },
            "confirmation_token": token,
            "expires_at": expires_at.isoformat(),
            "advertencias": [],
        }
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 15b — draft_update_client (write, destructive — B3)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"destructiveHint": True})
async def draft_update_client(user_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    """
    Prepara la edición de un cliente (requiere confirmación).
    Solo acepta campos del conjunto SEGURO: nombre, apellido, telefono, direccion,
    ciudad, empresa_nombre, empresa_rut, instagram, tipo_cliente.
    RECHAZA explícitamente: rut, email, auth_uid, url_*, terminos_aceptados.
    Muestra preview campo a campo (de X → a Y) antes de confirmar.
    Si empresa_rut viene, valida módulo 11.
    """
    try:
        # Defense-in-depth: filter allowlist before anything else
        filter_result = _filter_client_fields(fields)
        if not filter_result["ok"]:
            return {
                "error": (
                    f"Campos no permitidos: {filter_result['rejected']}. "
                    "Campos editables: nombre, apellido, telefono, direccion, ciudad, "
                    "empresa_nombre, empresa_rut, instagram, tipo_cliente. "
                    "Prohibidos: rut, email, auth_uid, url_*, terminos_aceptados."
                ),
                "rechazados": filter_result["rejected"],
            }

        safe_fields = filter_result["fields"]
        if not safe_fields:
            return {"error": "No se enviaron campos para editar"}

        # Validate empresa_rut if provided
        if "empresa_rut" in safe_fields and safe_fields["empresa_rut"]:
            if not _validate_rut(str(safe_fields["empresa_rut"])):
                return {"error": f"RUT empresa inválido: {safe_fields['empresa_rut']!r} (módulo 11 no pasa)"}

        # Fetch current values for preview
        row = await db.fetch_one(
            "SELECT * FROM user_profiles WHERE user_id = %s",
            (user_id,),
        )
        if not row:
            return {"error": f"Cliente {user_id!r} no encontrado"}

        preview_changes: list[dict[str, Any]] = []
        for key, new_val in safe_fields.items():
            old_val = row.get(key)
            preview_changes.append({"campo": key, "de": old_val, "a": new_val})

        plan_json = {"user_id": user_id, "fields": safe_fields}
        token = secrets.token_urlsafe(32)
        expires_at = _now() + timedelta(minutes=15)

        result = await db.fetch_one(
            """
            INSERT INTO hermes_pending_writes (action, plan_json, confirmation_token, expires_at)
            VALUES (%s, %s::jsonb, %s, %s)
            RETURNING id, expires_at
            """,
            ("update_client", json.dumps(plan_json), token, expires_at),
            pool="rw",
        )
        if not result:
            return {"error": "No se pudo crear el borrador"}

        return {
            "plan_id": str(result["id"]),
            "preview": {
                "user_id": user_id,
                "cliente": f"{row.get('nombre', '')} {row.get('apellido', '')}".strip(),
                "cambios": preview_changes,
            },
            "confirmation_token": token,
            "expires_at": expires_at.isoformat(),
            "advertencias": [],
        }
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 15c — draft_create_client (write, destructive — B3)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"destructiveHint": True})
async def draft_create_client(
    email: str,
    nombre: str,
    apellido: str | None = None,
    rut: str | None = None,
    telefono: str | None = None,
    tipo_cliente: str | None = None,
    empresa_nombre: str | None = None,
    empresa_rut: str | None = None,
) -> dict[str, Any]:
    """
    Prepara la creación de un nuevo cliente (requiere confirmación).
    Mínimo requerido: email + nombre.
    Valida formato de email y, si se proveen, RUT personal y RUT empresa (módulo 11).
    El preview avisa que al cliente le llega un email de bienvenida con clave temporal.
    IMPORTANTE: crear un cliente NO genera contrato — el contrato se genera por separado.
    """
    try:
        # Validate required fields
        if not email or not email.strip():
            return {"error": "El campo 'email' es obligatorio"}
        if not nombre or not nombre.strip():
            return {"error": "El campo 'nombre' es obligatorio"}

        if not _validate_email(email.strip()):
            return {"error": f"Email inválido: {email!r}"}

        if rut and not _validate_rut(rut):
            return {"error": f"RUT inválido: {rut!r} (módulo 11 no pasa)"}

        if empresa_rut and not _validate_rut(empresa_rut):
            return {"error": f"RUT empresa inválido: {empresa_rut!r} (módulo 11 no pasa)"}

        payload: dict[str, Any] = {
            "email": email.strip(),
            "nombre": nombre.strip(),
        }
        if apellido:
            payload["apellido"] = apellido.strip()
        if rut:
            payload["rut"] = rut
        if telefono:
            payload["telefono"] = telefono
        if tipo_cliente:
            payload["tipo_cliente"] = tipo_cliente
        if empresa_nombre:
            payload["empresa_nombre"] = empresa_nombre
        if empresa_rut:
            payload["empresa_rut"] = empresa_rut

        plan_json = {"payload": payload}
        token = secrets.token_urlsafe(32)
        expires_at = _now() + timedelta(minutes=15)

        result = await db.fetch_one(
            """
            INSERT INTO hermes_pending_writes (action, plan_json, confirmation_token, expires_at)
            VALUES (%s, %s::jsonb, %s, %s)
            RETURNING id, expires_at
            """,
            ("create_client", json.dumps(plan_json), token, expires_at),
            pool="rw",
        )
        if not result:
            return {"error": "No se pudo crear el borrador"}

        return {
            "plan_id": str(result["id"]),
            "preview": {
                "accion": "Crear cliente",
                "email": email.strip(),
                "nombre": nombre.strip(),
                "apellido": apellido or "—",
                "datos_adicionales": {k: v for k, v in payload.items() if k not in ("email", "nombre", "apellido")},
            },
            "confirmation_token": token,
            "expires_at": expires_at.isoformat(),
            "advertencias": [
                "Al confirmar, el cliente recibirá un email de bienvenida con su clave temporal.",
                "Crear un cliente NO genera contrato — el contrato se genera por separado con draft_generate_contract.",
            ],
        }
    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 16 — confirm_write (write, destructive)
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"destructiveHint": True})
async def confirm_write(plan_id: str, confirmation_token: str) -> dict[str, Any]:
    """
    Confirma y ejecuta un plan pendiente.
    Acciones: create_order / update_status / generate_contract / create_client / update_client.
    ÚNICA tool que escribe al negocio. Valida token, expiración, y re-valida reglas de negocio.

    Desduplicación según el tipo de acción:
    - Acciones DB (create_order, update_status): el consumed_at se marca DENTRO de la
      misma transacción que ejecuta la acción, con un CAS
      (UPDATE ... WHERE consumed_at IS NULL RETURNING id). Esto SÍ bloquea dos
      confirmaciones simultáneas: solo una gana el CAS y la otra es rechazada.
    - Acciones HTTP (generate_contract, create_client, update_client): el consumed_at
      se marca DESPUÉS de que el POST al dashboard devuelve ok (para permitir reintento
      si Vercel está caído). Por eso el CAS NO garantiza exclusión entre dos confirms
      concurrentes para estas acciones — la desduplicación real la provee la
      idempotencia server-side del dashboard (409 por email duplicado en create_client;
      update idempotente en update_client; generación de contrato re-ejecutable). Si
      Vercel está caído, consumed_at queda NULL y el plan puede reintentarse.
    """
    try:
        # Fetch plan
        row = await db.fetch_one(
            """
            SELECT id, action, plan_json, confirmation_token, consumed_at, expires_at
            FROM hermes_pending_writes
            WHERE id = %s::uuid
            """,
            (plan_id,),
            pool="rw",
        )

        if not row:
            return {"error": "Plan no encontrado"}
        if row["consumed_at"]:
            return {"error": "Este plan ya fue ejecutado o cancelado"}
        if row["expires_at"] < _now():
            return {"error": "Plan expirado (más de 15 minutos)"}
        if not hmac.compare_digest(row["confirmation_token"], confirmation_token):
            return {"error": "Token de confirmación inválido"}

        action = row["action"]
        plan = row["plan_json"] if isinstance(row["plan_json"], dict) else json.loads(row["plan_json"])

        # --- create_order ---
        if action == "create_order":
            customer_id = plan["customer_id"]
            product_ids = plan["product_ids"]
            quantities = plan["quantities"]
            start_date = date.fromisoformat(plan["start_date"])
            end_date = date.fromisoformat(plan["end_date"])
            order_proyecto = plan["order_proyecto"]
            apply_iva = plan.get("apply_iva", True)
            original_quote = plan["quote"]

            # Re-validate contract
            client_row = await db.fetch_one(
                "SELECT url_user_contrato FROM user_profiles WHERE user_id = %s",
                (customer_id,),
                pool="rw",
            )
            if not client_row or not client_row.get("url_user_contrato"):
                return {"error": "Contrato no disponible al confirmar. Acción cancelada."}

            # Re-validate availability
            avail = await check_availability(product_ids, start_date, end_date)
            conflicts = [pa for pa in avail.get("por_producto", []) if not pa["disponible"]]
            if conflicts:
                conflict_ids = [c["product_id"] for c in conflicts]
                return {
                    "error": f"Conflicto de disponibilidad al confirmar para productos: {conflict_ids}. "
                             "Acción cancelada. Re-verificar fechas."
                }

            # Re-calculate (source of truth on confirm)
            new_quote = await _quote_internal(
                product_ids, start_date, end_date, quantities,
                original_quote.get("coupon", {}).get("code") if original_quote.get("coupon") else None,
                original_quote.get("shipping_total", 0),
                apply_iva,
            )
            if "error" in new_quote:
                return new_quote

            # Drift check: abort if difference > 1 CLP
            diff = abs(new_quote["calculated_total"] - original_quote["calculated_total"])
            if diff > 1:
                return {
                    "error": (
                        f"Los montos recalculados difieren del plan en {diff:.2f} CLP "
                        f"(plan: {original_quote['calculated_total']}, recalculado: {new_quote['calculated_total']}). "
                        "Precio puede haber cambiado. Re-cotizar antes de confirmar."
                    )
                }

            q = new_quote
            jornadas = q["num_jornadas"]

            # Billing data: columnas NOT NULL sin default en orders (verificado
            # contra information_schema) — obligatorio poblarlas desde el perfil.
            billing_row = await db.fetch_one(
                "SELECT nombre, apellido, email, telefono FROM user_profiles WHERE user_id = %s",
                (customer_id,),
                pool="rw",
            ) or {}

            # line_items con el shape EXACTO de produccion (verificado contra
            # datos reales): product_id como STRING, price = precio diario.
            # No existe tabla order_items en esta DB — el jsonb es la fuente.
            placeholders = ",".join(["%s"] * len(product_ids))
            prod_rows = await db.fetch_all(
                f"SELECT id, sku, images FROM products WHERE id IN ({placeholders})",
                tuple(product_ids),
                pool="rw",
            )
            prod_by_id: dict[int, dict] = {r["id"]: r for r in prod_rows}

            def _first_image(pid: int) -> str:
                images = (prod_by_id.get(pid) or {}).get("images")
                if isinstance(images, str):
                    try:
                        images = json.loads(images)
                    except (TypeError, ValueError):
                        images = None
                if isinstance(images, list) and images and isinstance(images[0], dict):
                    return str(images[0].get("src", "") or "")
                return ""

            line_items_prod = [
                {
                    "sku": str((prod_by_id.get(ln["product_id"]) or {}).get("sku") or ""),
                    "name": ln.get("name", ""),
                    "image": _first_image(ln["product_id"]),
                    "price": _half_up(ln["precio_dia"]),
                    "quantity": ln["quantity"],
                    "product_id": str(ln["product_id"]),
                }
                for ln in q["lineas"]
            ]
            line_items_json = json.dumps(line_items_prod)

            # Execute in a single transaction — CAS marks consumed atomically with the INSERT.
            # If two confirms race, only one transaction wins the consumed_at CAS; the other
            # sees consumed_at != NULL on the next fetch and is rejected above.
            async with db.rw_conn() as conn:
                async with conn.cursor() as cur:
                    # CAS: mark consumed only if not yet consumed (race protection)
                    await cur.execute(
                        """
                        UPDATE hermes_pending_writes
                           SET consumed_at = %s
                         WHERE id = %s::uuid AND consumed_at IS NULL
                        RETURNING id
                        """,
                        (_now(), plan_id),
                    )
                    cas_row = await cur.fetchone()
                    if not cas_row:
                        await conn.rollback()
                        return {"error": "Este plan ya fue ejecutado por otro proceso (race condition evitada)"}

                    # Insert order. Sin columna apply_iva (NO existe en esta DB:
                    # el branch apply_iva ya quedo reflejado en calculated_iva).
                    await cur.execute(
                        """
                        INSERT INTO orders (
                            status, customer_id, order_proyecto,
                            order_fecha_inicio, order_fecha_termino, num_jornadas,
                            calculated_subtotal, calculated_discount, calculated_iva, calculated_total,
                            shipping_total, pago_completo, line_items,
                            billing_first_name, billing_last_name, billing_email, billing_phone
                        ) VALUES (
                            'on-hold', %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, false, %s::jsonb,
                            %s, %s, %s, %s
                        ) RETURNING id
                        """,
                        (
                            customer_id, order_proyecto,
                            start_date, end_date, jornadas,
                            q["calculated_subtotal"], q["descuento_cupon"],
                            q["calculated_iva"], q["calculated_total"],
                            q["shipping_total"],
                            line_items_json,
                            str(billing_row.get("nombre") or ""),
                            str(billing_row.get("apellido") or ""),
                            str(billing_row.get("email") or ""),
                            str(billing_row.get("telefono") or ""),
                        ),
                    )
                    order_row = await cur.fetchone()
                    order_id = order_row[0] if order_row else None

                    if not order_id:
                        await conn.rollback()
                        return {"error": "No se pudo insertar la orden"}

                    await conn.commit()

            # Best-effort PDF generation
            pdf_result = await dashboard_client.generate_budget_pdf(order_id)
            nota = ""
            if not pdf_result.get("ok"):
                nota = "PDF pendiente, generar desde dashboard"

            return {
                "applied": True,
                "order_id": order_id,
                "status": "on-hold",
                "pdf_result": pdf_result,
                "mensaje": nota or "Orden creada exitosamente",
            }

        # --- update_status ---
        elif action == "update_status":
            oid = plan["order_id"]
            new_status = plan["new_status"]
            current = plan["current_status"]

            # CAS + status update in one transaction (DB action — mark consumed atomically)
            async with db.rw_conn() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        UPDATE hermes_pending_writes
                           SET consumed_at = %s
                         WHERE id = %s::uuid AND consumed_at IS NULL
                        RETURNING id
                        """,
                        (_now(), plan_id),
                    )
                    cas_row = await cur.fetchone()
                    if not cas_row:
                        await conn.rollback()
                        return {"error": "Este plan ya fue ejecutado por otro proceso (race condition evitada)"}

                    await cur.execute(
                        "UPDATE orders SET status = %s, date_modified = %s WHERE id = %s",
                        (new_status, _now(), oid),
                    )
                    await conn.commit()

            pdf_result = None
            if new_status == "processing":
                pdf_result = await dashboard_client.generate_processing_pdf(oid)

            return {
                "applied": True,
                "order_id": oid,
                "status": new_status,
                "pdf_result": pdf_result,
                "mensaje": f"Estado actualizado: {current} → {new_status}",
            }

        # --- generate_contract ---
        # HTTP action: mark consumed AFTER the dashboard call succeeds so that
        # if Vercel is down the plan can be retried without a manual DB fix.
        elif action == "generate_contract":
            uid = plan["user_id"]

            pdf_result = await dashboard_client.generate_contract_pdf(uid)
            if pdf_result.get("ok"):
                await db.execute(
                    """
                    UPDATE hermes_pending_writes
                       SET consumed_at = %s
                     WHERE id = %s::uuid AND consumed_at IS NULL
                    """,
                    (_now(), plan_id),
                    pool="rw",
                )
            return {
                "applied": pdf_result.get("ok", False),
                "user_id": uid,
                "pdf_result": pdf_result,
                "mensaje": (
                    "Solicitud de contrato enviada al dashboard"
                    if pdf_result.get("ok")
                    else "Dashboard no disponible — reintentar confirm_write cuando Vercel esté activo"
                ),
            }

        # --- create_client ---
        # HTTP action: mark consumed ONLY on dashboard ok (allows retry if Vercel down).
        elif action == "create_client":
            payload = plan["payload"]

            # Re-validate allowlist (defense in depth: payload was built by draft_create_client
            # but verify again here in case plan_json was tampered)
            email = payload.get("email", "")
            if not _validate_email(email):
                return {"error": f"Email inválido al confirmar: {email!r}"}
            rut = payload.get("rut")
            if rut and not _validate_rut(str(rut)):
                return {"error": f"RUT inválido al confirmar: {rut!r}"}
            empresa_rut = payload.get("empresa_rut")
            if empresa_rut and not _validate_rut(str(empresa_rut)):
                return {"error": f"RUT empresa inválido al confirmar: {empresa_rut!r}"}

            api_result = await dashboard_client.create_user(payload)
            if api_result.get("ok"):
                await db.execute(
                    """
                    UPDATE hermes_pending_writes
                       SET consumed_at = %s
                     WHERE id = %s::uuid AND consumed_at IS NULL
                    """,
                    (_now(), plan_id),
                    pool="rw",
                )
                return {
                    "applied": True,
                    "api_result": api_result,
                    "mensaje": (
                        f"Cliente {email} creado. "
                        "Le llegará email de bienvenida con clave temporal."
                    ),
                }
            else:
                # Do NOT mark consumed — allow retry
                return {
                    "applied": False,
                    "api_result": api_result,
                    "mensaje": (
                        "Error al crear cliente en el dashboard — reintentar confirm_write "
                        "cuando Vercel esté activo. Plan NO consumido."
                    ),
                }

        # --- update_client ---
        # HTTP action: same strategy as create_client.
        elif action == "update_client":
            uid = plan["user_id"]
            fields = plan["fields"]

            # Re-validate allowlist (defense in depth)
            filter_result = _filter_client_fields(fields)
            if not filter_result["ok"]:
                return {
                    "error": f"Campos no permitidos al confirmar: {filter_result['rejected']}",
                    "rechazados": filter_result["rejected"],
                }

            api_result = await dashboard_client.update_user(uid, filter_result["fields"])
            if api_result.get("ok"):
                await db.execute(
                    """
                    UPDATE hermes_pending_writes
                       SET consumed_at = %s
                     WHERE id = %s::uuid AND consumed_at IS NULL
                    """,
                    (_now(), plan_id),
                    pool="rw",
                )
                return {
                    "applied": True,
                    "user_id": uid,
                    "api_result": api_result,
                    "mensaje": f"Cliente {uid} actualizado exitosamente",
                }
            else:
                # Do NOT mark consumed — allow retry
                return {
                    "applied": False,
                    "user_id": uid,
                    "api_result": api_result,
                    "mensaje": (
                        "Error al actualizar cliente en el dashboard — reintentar confirm_write "
                        "cuando Vercel esté activo. Plan NO consumido."
                    ),
                }

        else:
            return {"error": f"Acción desconocida en plan: {action}"}

    except RuntimeError as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# TOOL 17 — cancel_write
# ---------------------------------------------------------------------------

@mcp.tool(annotations={"destructiveHint": True})
async def cancel_write(plan_id: str) -> dict[str, Any]:
    """Cancela un plan pendiente sin ejecutarlo."""
    try:
        await db.execute(
            """
            UPDATE hermes_pending_writes
            SET consumed_at = %s, note = 'cancelado por operador'
            WHERE id = %s::uuid AND consumed_at IS NULL
            """,
            (_now(), plan_id),
            pool="rw",
        )
        return {"cancelled": True, "plan_id": plan_id}
    except RuntimeError as e:
        return {"error": str(e)}
