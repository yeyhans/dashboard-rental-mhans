"""
Pure validation helpers — no heavy dependencies (no mcp, no psycopg, no httpx).
Importable in tests without the full server stack installed.

Exported:
  SAFE_CLIENT_FIELDS     frozenset of editable client fields
  _filter_client_fields  allowlist filter returning {ok, fields, rejected}
  _validate_email        basic RFC-5322-ish email check
  _validate_rut          Chilean RUT módulo 11 validator
  ORDER_STATUS_VOCABULARY   active vocabulary ('legacy' | 'v12'), read from env
  DB_ORDER_STATUSES      order status values the CHECK constraint accepts
  VALID_TRANSITIONS      workflow transition map, restricted to those values
  DEFAULT_NEW_ORDER_STATUS  status a new Hermes order is inserted with
  PAYMENT_GATE_STATUS    stage gated by pago_completo (triggers processing PDF)
"""
from __future__ import annotations

import os
import re
from typing import Any, NamedTuple

# ---------------------------------------------------------------------------
# Client field allowlist
# ---------------------------------------------------------------------------

# Fields the agent may propose editing via draft_update_client.
# PROHIBITED by design: rut/email (tied to Supabase Auth or legal client data),
# auth_uid, url_* (documents/contracts managed by the client on the web),
# terminos_aceptados.
#
# IMPORTANT: This set MUST be an EXACT mirror of ALLOWED_UPDATE_FIELDS in
# dashboard/src/pages/api/external/update-user.ts. 'region' was removed because
# it is NOT a column in the user_profiles schema (database.ts) — the dashboard
# endpoint rejects it, so accepting it here would only produce a 400 round-trip.
SAFE_CLIENT_FIELDS: frozenset[str] = frozenset({
    "nombre",
    "apellido",
    "telefono",
    "direccion",
    "ciudad",
    "empresa_nombre",
    "empresa_rut",
    "instagram",
    "tipo_cliente",
})

_PROHIBITED_PREFIXES = ("url_",)
_PROHIBITED_EXACT: frozenset[str] = frozenset({
    "rut",
    "email",
    "auth_uid",
    "terminos_aceptados",
})


def _filter_client_fields(fields: dict[str, Any]) -> dict[str, Any]:
    """
    Filter a dict of client fields against SAFE_CLIENT_FIELDS.
    Returns {"ok": bool, "fields": safe_subset, "rejected": [prohibited_keys]}.
    Any key not in SAFE_CLIENT_FIELDS is rejected (reject-unknown by default).
    """
    safe: dict[str, Any] = {}
    rejected: list[str] = []
    for key, val in fields.items():
        if key in SAFE_CLIENT_FIELDS:
            safe[key] = val
        else:
            rejected.append(key)
    return {"ok": len(rejected) == 0, "fields": safe, "rejected": rejected}


# ---------------------------------------------------------------------------
# Order status vocabulary
# ---------------------------------------------------------------------------

# T-021 / T-024 deploy-window guard: the status vocabulary is selected ONCE
# at import from ORDER_STATUS_VOCABULARY. Two frozen tables, one switch point:
#
#   legacy (DEFAULT)  the seven values orders_status_check accepts TODAY.
#                     Byte-equivalent to the pre-T-021 behavior, so the
#                     container is safe to deploy BEFORE migration 0003.
#   v12               Portal Cliente v1.2 canonical vocabulary (ADR-001), the
#                     exact set the constraint accepts AFTER migration 0003.
#                     Mirror of dashboard/src/lib/orderStatus.ts (NEXT_STATUS
#                     + canTransition). Same pattern as the frontend flag
#                     PUBLIC_ORDER_STATUS_VOCABULARY (orderStatus.ts).
#
# Set ORDER_STATUS_VOCABULARY=v12 in the SAME release window as migration
# 0003, not before: with the legacy DB the v12 vocabulary produces drafts
# whose confirm dies on the CHECK constraint, and vice versa.


class _StatusVocabulary(NamedTuple):
    db_order_statuses: frozenset[str]
    active_order_statuses: tuple[str, ...]
    valid_transitions: dict[str, list[str]]
    default_new_order_status: str
    payment_gate_status: str


# The seven values orders_status_check accepts today. The documented workflow
# adds 'reviewing', 'preparing', 'delivering' and 'paid'; the database has
# never accepted any of them, so offering those transitions produced drafts
# whose confirm always died on the CHECK constraint (rehearsal 0002, F-4).
# The transitions collapse the documented linear progression onto the states
# that exist, and every state keeps its escape hatches.
_LEGACY_VOCABULARY = _StatusVocabulary(
    db_order_statuses=frozenset({
        "pending",
        "processing",
        "on-hold",
        "completed",
        "cancelled",
        "refunded",
        "failed",
    }),
    # Statuses that still hold equipment: they block availability.
    active_order_statuses=("pending", "on-hold", "processing"),
    valid_transitions={
        "pending":    ["on-hold", "cancelled", "failed"],
        "on-hold":    ["processing", "cancelled", "failed"],
        "processing": ["completed", "cancelled", "failed"],
        "completed":  ["refunded"],
        "cancelled":  [],
        "refunded":   [],
        "failed":     [],
    },
    default_new_order_status="on-hold",
    payment_gate_status="processing",
)

# The v1.2 machine is linear with two terminal exits (completed, cancelled):
# each stage advances only to the next one, any non-terminal stage may cancel,
# going backwards is never allowed, and terminals offer nothing. The old
# completed -> refunded escape does not carry over (refunds live in
# cancellation_reason semantics, not in a status). The six non-terminal
# stages hold (or will hold) equipment, so they block availability.
# 'confirmed' inherits the pago_completo gate and the processing-PDF trigger
# from 'processing' (mapping of migration 0003).
_V12_VOCABULARY = _StatusVocabulary(
    db_order_statuses=frozenset({
        "request",
        "evaluation",
        "confirmed",
        "preparation",
        "in-rental",
        "return",
        "completed",
        "cancelled",
    }),
    active_order_statuses=(
        "request",
        "evaluation",
        "confirmed",
        "preparation",
        "in-rental",
        "return",
    ),
    valid_transitions={
        "request":     ["evaluation", "cancelled"],
        "evaluation":  ["confirmed", "cancelled"],
        "confirmed":   ["preparation", "cancelled"],
        "preparation": ["in-rental", "cancelled"],
        "in-rental":   ["return", "cancelled"],
        "return":      ["completed", "cancelled"],
        "completed":   [],
        "cancelled":   [],
    },
    default_new_order_status="request",
    payment_gate_status="confirmed",
)

_VOCABULARIES: dict[str, _StatusVocabulary] = {
    "legacy": _LEGACY_VOCABULARY,
    "v12": _V12_VOCABULARY,
}

# Read once at startup; fail fast on a typo instead of running half-wrong.
ORDER_STATUS_VOCABULARY: str = (
    os.environ.get("ORDER_STATUS_VOCABULARY", "legacy").strip().lower() or "legacy"
)
if ORDER_STATUS_VOCABULARY not in _VOCABULARIES:
    raise ValueError(
        f"ORDER_STATUS_VOCABULARY={ORDER_STATUS_VOCABULARY!r} is not supported. "
        "Valid values: 'legacy' (default, pre-migration-0003 DB) or 'v12' "
        "(after migration 0003 has applied)."
    )

_ACTIVE_VOCABULARY = _VOCABULARIES[ORDER_STATUS_VOCABULARY]

DB_ORDER_STATUSES: frozenset[str] = _ACTIVE_VOCABULARY.db_order_statuses
ACTIVE_ORDER_STATUSES: tuple[str, ...] = _ACTIVE_VOCABULARY.active_order_statuses
VALID_TRANSITIONS: dict[str, list[str]] = _ACTIVE_VOCABULARY.valid_transitions

# Status a brand-new Hermes order is inserted with.
DEFAULT_NEW_ORDER_STATUS: str = _ACTIVE_VOCABULARY.default_new_order_status

# Stage that requires pago_completo (reserva) and triggers the processing PDF.
PAYMENT_GATE_STATUS: str = _ACTIVE_VOCABULARY.payment_gate_status


def is_valid_status(status: str) -> bool:
    """True if the database CHECK constraint would accept this status."""
    return status in DB_ORDER_STATUSES


def is_valid_transition(current: str, new: str) -> bool:
    """True if the workflow allows current → new AND the DB accepts new."""
    return new in VALID_TRANSITIONS.get(current, [])


# ---------------------------------------------------------------------------
# Email validation
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


def _validate_email(email: str) -> bool:
    """Basic email format validation (no network lookup)."""
    if not email or not isinstance(email, str):
        return False
    return bool(_EMAIL_RE.match(email.strip()))


# ---------------------------------------------------------------------------
# Chilean RUT validator (módulo 11)
# ---------------------------------------------------------------------------


def _validate_rut(rut: str) -> bool:
    """
    Validate Chilean RUT using the standard mod-11 algorithm.
    Accepts formats: '77.892.569-9', '77892569-9', '77892569K'.
    Multipliers cycle right-to-left: 2,3,4,5,6,7,2,3,4,5,6,7,...
    """
    rut = rut.upper().replace(".", "").replace("-", "").strip()
    if len(rut) < 2:
        return False
    body, dv = rut[:-1], rut[-1]
    if not body.isdigit():
        return False
    total = 0
    for i, digit in enumerate(reversed(body)):
        factor = (i % 6) + 2
        total += int(digit) * factor
    remainder = 11 - (total % 11)
    expected = {10: "K", 11: "0"}.get(remainder, str(remainder))
    return dv == expected
