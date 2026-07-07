"""
Notifier service — listens for new orders via PostgreSQL LISTEN/NOTIFY and
sends Telegram messages to allowed users.

Design decisions:
- Dedicated AsyncConnection with autocommit=True (LISTEN requires a persistent
  session that is NOT in a transaction). Cannot use the shared pool from db.py.
- pg_notify payload is used ONLY as a wakeup signal; the actual drain always
  queries notified_at IS NULL by created_at (at-least-once, dedup by UNIQUE order_id).
- PII in the message: only nombre, apellido, telefono. No RUT/email/URLs.
- Plain text messages (no parse_mode) to avoid format injection via client names.
- Retry cap: 5 attempts (hard failures only). After that the row stays visible
  in hermes_notifications.
- 429 (Telegram rate limit): respects Retry-After header and does NOT consume a
  retry attempt — a transient rate-limit must not permanently discard a
  notification. The row stays pending and is retried next cycle.
- 403 (bot not started): hard failure, consumes an attempt, logged clearly.
- Reconnect backoff: 1s → 30s exponential.
- All logs to stderr only.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from datetime import date, datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

# httpx and psycopg are available inside the Docker container but may not be
# present in a minimal dev Python. Guard BOTH imports so pure-logic functions
# (format_order_message, filter_pending_rows, decide_attempt_outcome) stay
# importable and unit-testable without the network/DB drivers installed.
try:
    import httpx
    _HTTPX_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover
    httpx = None  # type: ignore[assignment]
    _HTTPX_AVAILABLE = False

try:
    import psycopg
    from psycopg.rows import dict_row as _dict_row
    _PSYCOPG_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover
    psycopg = None  # type: ignore[assignment]
    _dict_row = None  # type: ignore[assignment]
    _PSYCOPG_AVAILABLE = False

logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger(__name__)

SANTIAGO = ZoneInfo("America/Santiago")
UTC = timezone.utc
# httpx loguea a INFO la URL completa de cada request — que en la Bot API
# incluye el TOKEN del bot. Silenciarlo: solo warnings/errores de httpx.
logging.getLogger("httpx").setLevel(logging.WARNING)

CHANNEL = "hermes_new_order"
MAX_ATTEMPTS = 5
RECONNECT_BASE = 1.0
RECONNECT_MAX = 30.0
# Failsafe: aunque un NOTIFY se pierda, drenamos la cola cada POLL_INTERVAL_S.
POLL_INTERVAL_S = 60.0
TELEGRAM_API = "https://api.telegram.org"


# ---------------------------------------------------------------------------
# Pure helpers (tested in test_notifier.py — no DB/network dependencies)
# ---------------------------------------------------------------------------


def _fmt_clp(amount: Any) -> str:
    """Format an integer CLP amount in Chilean locale (dots as thousands separators)."""
    if amount is None:
        return "—"
    try:
        # Postgres `numeric` arrives as decimal.Decimal (Decimal + float raises
        # TypeError) — coerce to float first so Decimal/str/int/float all work.
        val = int(float(amount) + 0.5)  # half-up
    except (TypeError, ValueError):
        return "—"
    # Manual es-CL formatting: groups of 3 with dot separator
    s = str(val)
    groups = []
    while len(s) > 3:
        groups.append(s[-3:])
        s = s[:-3]
    groups.append(s)
    return "$" + ".".join(reversed(groups))


def _fmt_date(d: Any) -> str:
    """Format a date or datetime as DD/MM/YYYY in America/Santiago."""
    if d is None:
        return "—"
    if isinstance(d, datetime):
        d = d.astimezone(SANTIAGO).date()
    if isinstance(d, date):
        return d.strftime("%d/%m/%Y")
    return str(d)


MAX_ITEMS_IN_MESSAGE = 10


def _parse_line_items(raw: Any) -> list[dict[str, Any]]:
    """
    Normalize orders.line_items (jsonb) into a list of dicts.
    psycopg returns jsonb as Python objects, but be defensive: accept a JSON
    string (older drivers / manual rows) and return [] on anything invalid.
    """
    if raw is None:
        return []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (ValueError, TypeError):
            return []
    if not isinstance(raw, list):
        return []
    return [it for it in raw if isinstance(it, dict)]


def _coerce_amount(value: Any) -> Any:
    """Coerce a price that may come as str/float/int to a number (None if invalid)."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def format_order_message(row: dict[str, Any]) -> str:
    """
    Build a plain-text Telegram message for a new order notification.
    Pure function — no side effects, no DB, no network.
    PII included: nombre, apellido, telefono only.
    Detail: equipos (line_items, máx MAX_ITEMS_IN_MESSAGE), jornadas y
    desglose subtotal/IVA/total.
    """
    order_id = row.get("order_id", "?")
    nombre = row.get("nombre") or ""
    apellido = row.get("apellido") or ""
    cliente = f"{nombre} {apellido}".strip() or "—"
    telefono = row.get("telefono") or "—"
    proyecto = row.get("order_proyecto") or "—"
    inicio = _fmt_date(row.get("order_fecha_inicio"))
    termino = _fmt_date(row.get("order_fecha_termino"))
    total = _fmt_clp(row.get("calculated_total"))
    status = row.get("status") or "—"

    fechas = f"Fechas: {inicio} al {termino}"
    num_jornadas = row.get("num_jornadas")
    if num_jornadas:
        unidad = "jornada" if num_jornadas == 1 else "jornadas"
        fechas += f" ({num_jornadas} {unidad})"

    lines = [
        "Nueva orden recibida",
        f"Orden: #{order_id}",
        f"Cliente: {cliente}",
        f"Telefono: {telefono}",
        f"Proyecto: {proyecto}",
        fechas,
    ]

    items = _parse_line_items(row.get("line_items"))
    if items:
        lines.append("Equipos:")
        for it in items[:MAX_ITEMS_IN_MESSAGE]:
            name = it.get("name") or "(sin nombre)"
            qty = it.get("quantity") or 1
            price = _coerce_amount(it.get("price"))
            if price is not None:
                lines.append(f"• {name} ×{qty} — {_fmt_clp(price)}/día")
            else:
                lines.append(f"• {name} ×{qty}")
        extra = len(items) - MAX_ITEMS_IN_MESSAGE
        if extra > 0:
            unidad = "equipo más" if extra == 1 else "equipos más"
            lines.append(f"… y {extra} {unidad}")

    subtotal = row.get("calculated_subtotal")
    if subtotal is not None:
        lines.append(f"Subtotal: {_fmt_clp(subtotal)}")
    iva = row.get("calculated_iva")
    if iva is not None:
        lines.append(f"IVA: {_fmt_clp(iva)}")

    lines.append(f"Total: {total} CLP")
    lines.append(f"Estado: {status}")
    return "\n".join(lines)


def decide_attempt_outcome(send_results: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Decide what to do with a notification row after attempting all recipients.

    Pure function — no side effects, no DB, no network.

    Input: one result dict per recipient, each shaped like the return of
    _send_telegram: {"ok": bool, "rate_limited": bool, "reason": str}.

    Rules:
    - If EVERY recipient succeeded → ack=True (mark notified).
    - If at least one failed but EVERY failure was a 429 rate-limit → transient:
      do NOT increment attempts and do NOT record last_error. The row stays
      pending and is retried next cycle (after Retry-After was honored).
    - If any failure was a HARD error (403, other 4xx/5xx, network) → increment
      attempts and record last_error. Permanent-ish failures eventually hit the
      MAX_ATTEMPTS cap.

    Returns:
        {
          "ack": bool,            # all sends succeeded
          "increment": bool,      # bump attempts + set last_error
          "last_error": str|None, # error text to persist (only when increment)
        }
    """
    if not send_results:
        # No recipients configured — nothing sent, leave row pending without churn.
        return {"ack": False, "increment": False, "last_error": None}

    failures = [r for r in send_results if not r.get("ok")]
    if not failures:
        return {"ack": True, "increment": False, "last_error": None}

    all_rate_limited = all(r.get("rate_limited") for r in failures)
    if all_rate_limited:
        # Transient rate-limit only — do not consume an attempt.
        return {"ack": False, "increment": False, "last_error": None}

    # At least one hard failure — count it against the retry cap.
    hard = [r for r in failures if not r.get("rate_limited")]
    reason = (hard[0].get("reason") if hard else failures[0].get("reason")) or "fallo de envío"
    return {"ack": False, "increment": True, "last_error": str(reason)}


def filter_pending_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Pure filter + dedup for pending notification rows.
    - Excludes rows with notified_at set (already sent).
    - Excludes rows with attempts >= MAX_ATTEMPTS (capped, no more retries).
    - Deduplicates by order_id, keeping the earliest created_at.
    - Returns result sorted by created_at ascending.
    Pure function — no side effects.
    """
    # Filter
    eligible = [
        r for r in rows
        if r.get("notified_at") is None
        and (r.get("attempts") or 0) < MAX_ATTEMPTS
    ]
    # Sort by created_at ascending before dedup
    eligible.sort(key=lambda r: r.get("created_at") or datetime.min.replace(tzinfo=UTC))
    # Dedup by order_id — first seen wins (earliest created_at)
    seen: set[int] = set()
    result = []
    for r in eligible:
        oid = r.get("order_id")
        if oid not in seen:
            seen.add(oid)
            result.append(r)
    return result


# ---------------------------------------------------------------------------
# DB helpers (require live DB — not unit-tested)
# ---------------------------------------------------------------------------


async def _drain_pending(conn: Any) -> list[dict[str, Any]]:
    """
    Fetch all unnotified rows from hermes_notifications JOIN orders+user_profiles.
    Returns raw dicts; caller applies filter_pending_rows before processing.
    conn must be a psycopg.AsyncConnection with autocommit=True.
    """
    sql = """
        SELECT
            n.id          AS notif_id,
            n.order_id,
            n.notified_at,
            n.attempts,
            n.created_at,
            up.nombre,
            up.apellido,
            up.telefono,
            o.order_proyecto,
            o.order_fecha_inicio,
            o.order_fecha_termino,
            o.num_jornadas,
            o.line_items,
            o.calculated_subtotal,
            o.calculated_iva,
            o.calculated_total,
            o.status
        FROM hermes_notifications n
        JOIN orders o ON o.id = n.order_id
        LEFT JOIN user_profiles up ON up.user_id::text = o.customer_id::text
        WHERE n.notified_at IS NULL
        ORDER BY n.created_at ASC
    """
    async with conn.cursor(row_factory=_dict_row) as cur:
        await cur.execute(sql)
        return await cur.fetchall()


async def _ack_row(conn: Any, notif_id: int) -> None:
    """Mark a notification as sent."""
    async with conn.cursor() as cur:
        await cur.execute(
            "UPDATE hermes_notifications SET notified_at = now() WHERE id = %s",
            (notif_id,),
        )


async def _increment_attempts(conn: Any, notif_id: int, error: str) -> None:
    """Increment attempt counter and record last error."""
    async with conn.cursor() as cur:
        await cur.execute(
            """
            UPDATE hermes_notifications
               SET attempts = attempts + 1, last_error = %s
             WHERE id = %s
            """,
            (error[:500], notif_id),
        )


# ---------------------------------------------------------------------------
# Telegram sender
# ---------------------------------------------------------------------------


async def _send_telegram(
    client: httpx.AsyncClient,
    bot_token: str,
    chat_id: str,
    text: str,
) -> dict[str, Any]:
    """
    POST sendMessage to Telegram Bot API.
    Returns {"ok": True, "rate_limited": False} on success,
    {"ok": False, "rate_limited": bool, "reason": ...} on failure.
    Handles 429 Retry-After (transient, rate_limited=True) and 403 (hard).

    The caller uses `rate_limited` to decide whether a failed row should consume
    a retry attempt: a 429 must NOT consume one (see decide_attempt_outcome).
    """
    url = f"{TELEGRAM_API}/bot{bot_token}/sendMessage"
    try:
        resp = await client.post(url, json={"chat_id": chat_id, "text": text})
    except Exception as exc:
        # Network/transport error is a hard failure — let it count against the cap.
        return {"ok": False, "rate_limited": False, "reason": str(exc)}

    if resp.status_code == 429:
        retry_after = int(resp.headers.get("Retry-After", "5"))
        logger.warning(
            "Telegram 429 rate-limit para chat_id=%s — Retry-After=%ss",
            chat_id, retry_after,
        )
        await asyncio.sleep(retry_after)
        return {
            "ok": False,
            "rate_limited": True,
            "reason": "429 rate-limited, reintento en próximo ciclo",
        }

    if resp.status_code == 403:
        logger.error(
            "Telegram 403 para chat_id=%s — el admin no ha iniciado el bot "
            "(/start al bot en Telegram)", chat_id,
        )
        return {"ok": False, "rate_limited": False, "reason": "403 el admin no ha iniciado el bot"}

    if resp.status_code >= 400:
        return {
            "ok": False,
            "rate_limited": False,
            "reason": f"HTTP {resp.status_code}: {resp.text[:200]}",
        }

    return {"ok": True, "rate_limited": False}


# ---------------------------------------------------------------------------
# Main notification loop
# ---------------------------------------------------------------------------


async def _process_pending(
    conn: psycopg.AsyncConnection,
    http_client: httpx.AsyncClient,
    bot_token: str,
    allowed_users: list[str],
) -> None:
    """Drain and process all pending notifications."""
    raw_rows = await _drain_pending(conn)
    pending = filter_pending_rows(raw_rows)

    if not pending:
        return

    logger.info("Procesando %d notificaciones pendientes", len(pending))

    for row in pending:
        notif_id = row["notif_id"]
        text = format_order_message(row)
        send_results: list[dict[str, Any]] = []

        for chat_id in allowed_users:
            result = await _send_telegram(http_client, bot_token, chat_id, text)
            send_results.append(result)
            if not result["ok"]:
                logger.warning(
                    "Fallo envío order_id=%s chat_id=%s: %s",
                    row["order_id"], chat_id, result.get("reason"),
                )

        outcome = decide_attempt_outcome(send_results)

        if outcome["ack"]:
            await _ack_row(conn, notif_id)
            logger.info("Notificacion enviada order_id=%s", row["order_id"])
        elif outcome["increment"]:
            await _increment_attempts(conn, notif_id, outcome["last_error"] or "fallo de envío")
        else:
            # Transient (all failures were 429) — leave the row pending without
            # consuming an attempt; it will be retried next cycle.
            logger.info(
                "Notificacion order_id=%s diferida por rate-limit (429) — "
                "no se consume intento, reintento próximo ciclo",
                row["order_id"],
            )


async def run_notifier() -> None:
    """
    Main entry point. Opens a dedicated autocommit psycopg3 connection,
    LISTENs on hermes_new_order, and processes notifications in a loop.
    Reconnects with exponential backoff (1s → 30s) on any connection error.
    """
    db_url = os.environ.get("DATABASE_URL_NOTIFIER", "")
    if not db_url:
        logger.error("DATABASE_URL_NOTIFIER no configurada — notifier no puede arrancar")
        return

    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        logger.error("TELEGRAM_BOT_TOKEN no configurada")
        return

    allowed_raw = os.environ.get("TELEGRAM_ALLOWED_USERS", "")
    allowed_users = [u.strip() for u in allowed_raw.split(",") if u.strip()]
    if not allowed_users:
        logger.error("TELEGRAM_ALLOWED_USERS vacía — no hay destinatarios")
        return

    backoff = RECONNECT_BASE

    if not _PSYCOPG_AVAILABLE:
        logger.error("psycopg no disponible — instalar psycopg[binary]>=3.1")
        return

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        while True:
            try:
                logger.info("Conectando a DB (notifier) ...")
                # autocommit=True is required for LISTEN to work outside a transaction
                conn = await psycopg.AsyncConnection.connect(
                    db_url,
                    autocommit=True,
                    row_factory=_dict_row,
                )
                async with conn:
                    await conn.execute(f"LISTEN {CHANNEL}")
                    logger.info("LISTEN %s activo — catch-up inicial", CHANNEL)

                    # Catch-up: process any rows that arrived while we were down
                    await _process_pending(conn, http_client, bot_token, allowed_users)

                    backoff = RECONNECT_BASE  # reset on successful connect

                    # Wait for pg_notify wakeups.
                    # GOTCHA (psycopg 3.x, verificado en vivo): el generator
                    # notifies() LOCKEA la conexión mientras itera — ejecutar
                    # queries sobre la misma conexión DENTRO del cuerpo del
                    # async for deadlockea el servicio (la query espera un lock
                    # que el generator nunca suelta). Por eso: stop_after=1 +
                    # timeout cierran el generator (sueltan el lock) ANTES de
                    # drenar. El timeout además actúa de failsafe: drenamos la
                    # cola cada POLL_INTERVAL_S aunque un NOTIFY se pierda.
                    while True:
                        async for _notify in conn.notifies(
                            timeout=POLL_INTERVAL_S, stop_after=1
                        ):
                            logger.debug("NOTIFY recibido — drenando cola")
                        await _process_pending(conn, http_client, bot_token, allowed_users)

            except Exception as exc:
                logger.error(
                    "Error en notifier (reconectando en %.0fs): %s", backoff, exc
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, RECONNECT_MAX)
