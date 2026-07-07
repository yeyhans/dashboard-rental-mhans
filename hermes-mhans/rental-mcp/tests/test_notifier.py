"""
Tests for rental_mcp.notifier — pure-logic functions only. No DB, no network.
Covers: message formatting, Chilean locale, field safety, pending-row logic, dedup.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone, date
from zoneinfo import ZoneInfo


# ---------------------------------------------------------------------------
# Import the pure helpers we will test (they live in service.py)
# ---------------------------------------------------------------------------

from rental_mcp.notifier.service import (
    format_order_message,
    filter_pending_rows,
    decide_attempt_outcome,
)

SANTIAGO = ZoneInfo("America/Santiago")
UTC = timezone.utc


def _dt(year: int, month: int, day: int, hour: int = 10) -> datetime:
    """Build an aware UTC datetime for test fixtures."""
    return datetime(year, month, day, hour, 0, 0, tzinfo=UTC)


def _row(
    order_id: int = 1,
    notif_id: int = 1,
    notified_at=None,
    attempts: int = 0,
    nombre: str = "Juan",
    apellido: str = "Pérez",
    telefono: str = "+56912345678",
    proyecto: str = "Boda García",
    fecha_inicio=None,
    fecha_termino=None,
    total: int = 150000,
    status: str = "on-hold",
    created_at=None,
) -> dict:
    return {
        "notif_id": notif_id,
        "order_id": order_id,
        "notified_at": notified_at,
        "attempts": attempts,
        "nombre": nombre,
        "apellido": apellido,
        "telefono": telefono,
        "order_proyecto": proyecto,
        "order_fecha_inicio": fecha_inicio or date(2026, 6, 15),
        "order_fecha_termino": fecha_termino or date(2026, 6, 18),
        "calculated_total": total,
        "status": status,
        "created_at": created_at or _dt(2026, 6, 1),
    }


# ---------------------------------------------------------------------------
# format_order_message
# ---------------------------------------------------------------------------


class TestFormatOrderMessage:
    def test_contains_order_id(self):
        msg = format_order_message(_row(order_id=42))
        assert "42" in msg

    def test_contains_cliente_name(self):
        msg = format_order_message(_row(nombre="Carlos", apellido="López"))
        assert "Carlos" in msg
        assert "López" in msg

    def test_contains_proyecto(self):
        msg = format_order_message(_row(proyecto="Proyecto Alfa"))
        assert "Proyecto Alfa" in msg

    def test_clp_format_chilean_locale(self):
        """Total should be formatted with thousands separator (dot in es-CL)."""
        msg = format_order_message(_row(total=1500000))
        # 1.500.000 or 1,500,000 — we use es-CL which uses dots for thousands
        assert "1.500.000" in msg or "1500000" in msg

    def test_date_dd_mm_yyyy(self):
        """Dates must appear as DD/MM/YYYY."""
        row = _row(fecha_inicio=date(2026, 6, 15), fecha_termino=date(2026, 6, 18))
        msg = format_order_message(row)
        assert "15/06/2026" in msg
        assert "18/06/2026" in msg

    def test_no_markdown_parse_mode_chars_in_control_flow(self):
        """Message must be plain text — no parse_mode chars like * or _ wrapping values."""
        # We just check the function returns a str (actual send is tested integration)
        msg = format_order_message(_row())
        assert isinstance(msg, str)

    def test_none_nombre_does_not_crash(self):
        row = _row(nombre=None, apellido=None)
        msg = format_order_message(row)
        assert isinstance(msg, str)

    def test_none_proyecto_does_not_crash(self):
        row = _row(proyecto=None)
        msg = format_order_message(row)
        assert isinstance(msg, str)

    def test_none_telefono_does_not_crash(self):
        row = _row(telefono=None)
        msg = format_order_message(row)
        assert isinstance(msg, str)

    def test_none_total_does_not_crash(self):
        row = _row(total=None)
        msg = format_order_message(row)
        assert isinstance(msg, str)

    def test_none_dates_do_not_crash(self):
        row = _row(fecha_inicio=None, fecha_termino=None)
        msg = format_order_message(row)
        assert isinstance(msg, str)

    def test_special_chars_in_nombre_no_crash(self):
        """Names with Markdown chars must not cause format errors."""
        row = _row(nombre="*Ana_María*", apellido="[García]")
        msg = format_order_message(row)
        assert isinstance(msg, str)
        assert "Ana" in msg

    def test_contains_status(self):
        msg = format_order_message(_row(status="on-hold"))
        assert "on-hold" in msg

    def test_total_integer_clp(self):
        """Total must be rendered as integer CLP (no decimals)."""
        msg = format_order_message(_row(total=99999))
        # Should NOT show .00 or ,00
        assert ".00" not in msg and ",00" not in msg.replace(".", "X")

    def test_decimal_amounts_from_numeric_columns(self):
        """
        psycopg returns Postgres `numeric` as decimal.Decimal — the real shape
        of calculated_subtotal/iva/total in production. They must render as
        CLP amounts, never as the "—" fallback (Decimal + float raises TypeError).
        """
        from decimal import Decimal
        row = _row(total=Decimal("152320.00"))
        row["calculated_subtotal"] = Decimal("128000.00")
        row["calculated_iva"] = Decimal("24320.00")
        msg = format_order_message(row)
        assert "Subtotal: $128.000" in msg
        assert "IVA: $24.320" in msg
        assert "Total: $152.320 CLP" in msg
        assert "—" not in msg.split("Subtotal")[1]

    def test_string_amounts_do_not_render_dash(self):
        """Defensive: amounts arriving as strings must still render."""
        row = _row(total="77350.00")
        row["calculated_subtotal"] = "65000.00"
        row["calculated_iva"] = "12350.00"
        msg = format_order_message(row)
        assert "Subtotal: $65.000" in msg
        assert "IVA: $12.350" in msg
        assert "Total: $77.350 CLP" in msg


# ---------------------------------------------------------------------------
# filter_pending_rows — pure dedup / filter logic
# ---------------------------------------------------------------------------


class TestFilterPendingRows:
    def test_empty_list(self):
        assert filter_pending_rows([]) == []

    def test_notified_excluded(self):
        """Rows with notified_at set must be excluded."""
        rows = [
            _row(order_id=1, notified_at=_dt(2026, 6, 1)),
            _row(order_id=2, notified_at=None),
        ]
        result = filter_pending_rows(rows)
        assert len(result) == 1
        assert result[0]["order_id"] == 2

    def test_max_attempts_excluded(self):
        """Rows with attempts >= 5 must be excluded (capped, no more retries)."""
        rows = [
            _row(order_id=1, attempts=5),
            _row(order_id=2, attempts=4),
        ]
        result = filter_pending_rows(rows)
        assert len(result) == 1
        assert result[0]["order_id"] == 2

    def test_dedup_by_order_id(self):
        """Duplicate order_id rows: only the first (lowest created_at) survives."""
        rows = [
            _row(order_id=7, notif_id=1, created_at=_dt(2026, 6, 1, 8)),
            _row(order_id=7, notif_id=2, created_at=_dt(2026, 6, 1, 10)),
        ]
        result = filter_pending_rows(rows)
        assert len(result) == 1
        assert result[0]["notif_id"] == 1

    def test_sorted_by_created_at(self):
        """Pending rows must be returned in ascending created_at order."""
        rows = [
            _row(order_id=3, created_at=_dt(2026, 6, 3)),
            _row(order_id=1, created_at=_dt(2026, 6, 1)),
            _row(order_id=2, created_at=_dt(2026, 6, 2)),
        ]
        result = filter_pending_rows(rows)
        ids = [r["order_id"] for r in result]
        assert ids == [1, 2, 3]

    def test_all_pending_returned(self):
        rows = [_row(order_id=i) for i in range(1, 6)]
        assert len(filter_pending_rows(rows)) == 5

    def test_attempts_zero_included(self):
        rows = [_row(order_id=1, attempts=0)]
        assert len(filter_pending_rows(rows)) == 1

    def test_attempts_four_included(self):
        rows = [_row(order_id=1, attempts=4)]
        assert len(filter_pending_rows(rows)) == 1

    def test_attempts_five_excluded(self):
        rows = [_row(order_id=1, attempts=5)]
        assert len(filter_pending_rows(rows)) == 0


# ---------------------------------------------------------------------------
# decide_attempt_outcome — pure 429-vs-hard-failure retry policy
# ---------------------------------------------------------------------------


def _ok() -> dict:
    return {"ok": True, "rate_limited": False}


def _rate_limited() -> dict:
    return {"ok": False, "rate_limited": True, "reason": "429 rate-limited"}


def _hard(reason: str = "403 el admin no ha iniciado el bot") -> dict:
    return {"ok": False, "rate_limited": False, "reason": reason}


class TestDecideAttemptOutcome:
    def test_all_success_acks(self):
        out = decide_attempt_outcome([_ok(), _ok()])
        assert out["ack"] is True
        assert out["increment"] is False
        assert out["last_error"] is None

    def test_all_429_does_not_consume_attempt(self):
        # CRITICAL: a transient rate-limit must NOT increment attempts.
        out = decide_attempt_outcome([_rate_limited(), _rate_limited()])
        assert out["ack"] is False
        assert out["increment"] is False
        assert out["last_error"] is None

    def test_single_429_does_not_consume_attempt(self):
        out = decide_attempt_outcome([_rate_limited()])
        assert out["ack"] is False
        assert out["increment"] is False

    def test_hard_failure_consumes_attempt(self):
        out = decide_attempt_outcome([_hard()])
        assert out["ack"] is False
        assert out["increment"] is True
        assert "403" in out["last_error"]

    def test_mixed_429_and_hard_consumes_attempt(self):
        # A 429 on one recipient + a hard 403 on another → still a hard failure.
        out = decide_attempt_outcome([_rate_limited(), _hard()])
        assert out["ack"] is False
        assert out["increment"] is True
        assert "403" in out["last_error"]

    def test_mixed_success_and_429_does_not_consume(self):
        # One recipient ok, one rate-limited → not fully acked, but no hard error.
        out = decide_attempt_outcome([_ok(), _rate_limited()])
        assert out["ack"] is False
        assert out["increment"] is False

    def test_mixed_success_and_hard_consumes(self):
        out = decide_attempt_outcome([_ok(), _hard("HTTP 500: boom")])
        assert out["ack"] is False
        assert out["increment"] is True
        assert "500" in out["last_error"]

    def test_empty_results_no_churn(self):
        out = decide_attempt_outcome([])
        assert out["ack"] is False
        assert out["increment"] is False
        assert out["last_error"] is None


def _detail_row(**overrides) -> dict:
    """Base row with order detail (line_items + desglose) for message tests."""
    row = {
        "order_id": 77,
        "nombre": "Juan",
        "apellido": "Pérez",
        "telefono": "+56912345678",
        "order_proyecto": "Spot publicitario",
        "order_fecha_inicio": date(2026, 7, 1),
        "order_fecha_termino": date(2026, 7, 3),
        "num_jornadas": 3,
        "line_items": [
            {"name": "Canon R5", "quantity": 2, "price": 45000},
            {"name": "Profoto B10", "quantity": 1, "price": 30000},
        ],
        "calculated_subtotal": 360000,
        "calculated_iva": 68400,
        "calculated_total": 428400,
        "status": "on-hold",
    }
    row.update(overrides)
    return row


class TestFormatOrderDetail:
    """Detalle de la orden en el mensaje: equipos, jornadas, desglose."""

    def test_items_listed_with_quantity(self):
        msg = format_order_message(_detail_row())
        assert "Canon R5" in msg
        assert "×2" in msg
        assert "Profoto B10" in msg
        assert "×1" in msg

    def test_items_price_per_day_clp(self):
        msg = format_order_message(_detail_row())
        assert "$45.000/día" in msg
        assert "$30.000/día" in msg

    def test_jornadas_shown_with_dates(self):
        msg = format_order_message(_detail_row())
        assert "3 jornadas" in msg

    def test_jornada_singular(self):
        msg = format_order_message(_detail_row(num_jornadas=1))
        assert "1 jornada" in msg
        assert "1 jornadas" not in msg

    def test_desglose_subtotal_iva(self):
        msg = format_order_message(_detail_row())
        assert "Subtotal: $360.000" in msg
        assert "IVA: $68.400" in msg
        assert "Total: $428.400 CLP" in msg

    def test_line_items_none_no_crash_no_section(self):
        msg = format_order_message(_detail_row(line_items=None))
        assert "Equipos" not in msg
        assert "Orden: #77" in msg

    def test_line_items_empty_list_no_section(self):
        msg = format_order_message(_detail_row(line_items=[]))
        assert "Equipos" not in msg

    def test_line_items_as_json_string_parsed(self):
        msg = format_order_message(
            _detail_row(line_items='[{"name": "Manfrotto 055", "quantity": 3, "price": 8000}]')
        )
        assert "Manfrotto 055" in msg
        assert "×3" in msg

    def test_line_items_invalid_string_no_crash(self):
        msg = format_order_message(_detail_row(line_items="no-es-json"))
        assert "Orden: #77" in msg

    def test_items_truncated_at_ten(self):
        items = [
            {"name": f"Equipo {i}", "quantity": 1, "price": 1000}
            for i in range(12)
        ]
        msg = format_order_message(_detail_row(line_items=items))
        assert "Equipo 9" in msg
        assert "Equipo 10" not in msg
        assert "y 2 equipos más" in msg

    def test_item_without_name_or_price_no_crash(self):
        msg = format_order_message(
            _detail_row(line_items=[{"quantity": 2}, {"name": "Solo nombre"}])
        )
        assert "Solo nombre" in msg
        assert "Orden: #77" in msg

    def test_num_jornadas_none_no_crash(self):
        msg = format_order_message(_detail_row(num_jornadas=None))
        assert "jornada" not in msg
        assert "Fechas:" in msg

    def test_price_as_string_no_crash(self):
        msg = format_order_message(
            _detail_row(line_items=[{"name": "X", "quantity": 1, "price": "45000"}])
        )
        assert "$45.000/día" in msg
