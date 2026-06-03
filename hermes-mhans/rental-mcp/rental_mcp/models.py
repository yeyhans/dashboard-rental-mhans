"""
Pydantic v2 models for MCP tool inputs and outputs.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Shared / primitive
# ---------------------------------------------------------------------------


class QuoteLine(BaseModel):
    product_id: int
    name: str = ""
    sku: str = ""
    precio_dia: float
    quantity: int = 1
    item_subtotal_raw: float
    item_subtotal_presented: int


class CouponInfo(BaseModel):
    code: str
    discount_type: str
    amount: float
    valid: bool
    reason: str = ""


# ---------------------------------------------------------------------------
# Tool outputs
# ---------------------------------------------------------------------------


class QuoteResult(BaseModel):
    num_jornadas: int
    lineas: list[QuoteLine]
    subtotal: float
    descuento_cupon: float
    coupon: CouponInfo | None = None
    shipping_total: float
    calculated_subtotal: float
    calculated_iva: float
    calculated_total: float
    reserva_25: float
    saldo_75: float
    # Presented (int, half-up)
    presented_total: int
    presented_iva: int
    presented_reserva: int
    presented_saldo: int
    moneda: str = "CLP"
    apply_iva: bool


class OverlapDetail(BaseModel):
    order_id: int
    order_proyecto: str = ""
    start_date: date
    end_date: date
    status: str
    overlap_days: int
    overlap_pct: int


class ProductAvailability(BaseModel):
    product_id: int
    disponible: bool
    overlap_pct: int
    conflictos: list[OverlapDetail]


class AvailabilityResult(BaseModel):
    por_producto: list[ProductAvailability]


class ProductItem(BaseModel):
    id: int
    name: str
    sku: str
    slug: str
    price: float
    stock_status: str
    categories_ids: list[int] = []


class OrderSummary(BaseModel):
    id: int
    status: str
    order_proyecto: str = ""
    billing_name: str = ""
    order_fecha_inicio: date | None = None
    order_fecha_termino: date | None = None
    num_jornadas: int | None = None
    calculated_total: float | None = None
    new_pdf_on_hold_url: str | None = None
    new_pdf_processing_url: str | None = None
    date_created: datetime | None = None
    date_modified: datetime | None = None


class ClientSummary(BaseModel):
    user_id: str
    nombre: str = ""
    apellido: str = ""
    tipo_cliente: str = ""
    has_contract: bool


class ClientDetail(ClientSummary):
    email: str | None = None
    telefono: str | None = None
    rut: str | None = None
    empresa_nombre: str | None = None
    empresa_rut: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    url_user_contrato: str | None = None
    terminos_aceptados: bool | None = None


class ContractStatus(BaseModel):
    user_id: str
    has_contract: bool
    faltantes: list[str]
    rut_valido: bool | None = None


class RevenueReport(BaseModel):
    date_from: date
    date_to: date
    group_by: str
    rows: list[dict[str, Any]]
    top_productos: list[dict[str, Any]]


class PickupList(BaseModel):
    target_date: date
    retiros_hoy: list[OrderSummary]
    devoluciones_hoy: list[OrderSummary]


# ---------------------------------------------------------------------------
# Draft / confirm
# ---------------------------------------------------------------------------


class DraftResult(BaseModel):
    plan_id: str
    preview: dict[str, Any]
    confirmation_token: str
    expires_at: datetime
    advertencias: list[str] = []


class ConfirmResult(BaseModel):
    applied: bool
    order_id: int | None = None
    status: str | None = None
    pdf_result: dict[str, Any] | None = None
    mensaje: str = ""
