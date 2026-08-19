"""
Pure validation helpers — no heavy dependencies (no mcp, no psycopg, no httpx).
Importable in tests without the full server stack installed.

Exported:
  SAFE_CLIENT_FIELDS     frozenset of editable client fields
  _filter_client_fields  allowlist filter returning {ok, fields, rejected}
  _validate_email        basic RFC-5322-ish email check
  _validate_rut          Chilean RUT módulo 11 validator
  DB_ORDER_STATUSES      order status values the CHECK constraint accepts
  VALID_TRANSITIONS      workflow transition map, restricted to those values
"""
from __future__ import annotations

import re
from typing import Any

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

# The seven values orders_status_check accepts TODAY.
#
# INTERIM ALIGNMENT (rehearsal 0002, F-4). The documented workflow adds
# 'reviewing', 'preparing', 'delivering' and 'paid'; the database has never
# accepted any of them, so offering those transitions produced drafts whose
# confirm always died on the CHECK constraint. Migration 0003 (Batch 5 / M4)
# moves orders.status to the v1.2 eight-value vocabulary; adopting it here is
# task T-021 and MUST ship in lockstep with that migration, not before.
DB_ORDER_STATUSES: frozenset[str] = frozenset({
    "pending",
    "processing",
    "on-hold",
    "completed",
    "cancelled",
    "refunded",
    "failed",
})

# Statuses that still hold equipment: they block availability for their dates.
ACTIVE_ORDER_STATUSES: tuple[str, ...] = ("pending", "on-hold", "processing")

# Workflow transitions, expressed only with committable values. The linear
# progression of the documented workflow collapses onto the states that exist,
# and every state keeps its escape hatches.
VALID_TRANSITIONS: dict[str, list[str]] = {
    "pending":    ["on-hold", "cancelled", "failed"],
    "on-hold":    ["processing", "cancelled", "failed"],
    "processing": ["completed", "cancelled", "failed"],
    "completed":  ["refunded"],
    "cancelled":  [],
    "refunded":   [],
    "failed":     [],
}


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
