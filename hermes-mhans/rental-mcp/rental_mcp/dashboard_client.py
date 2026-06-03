"""
HTTP client for Mario Hans dashboard side-effects (PDF generation, contracts).

Auth (verified against external/generate-budget-pdf.ts):
- /api/external/* endpoints accept header `X-API-Key: <DASHBOARD_API_TOKEN>`.
  A Supabase JWT Bearer would also work but expires in 1h — unusable for a
  static .env. We ALWAYS use X-API-Key.
- /api/order/generate-processing-pdf is NOT an external endpoint (requires admin
  session JWT). We attempt it with X-API-Key anyway; on 401/403 we return a
  soft error instructing the operator to generate the PDF from the dashboard.

Rules:
- Base URL from env DASHBOARD_API_URL; api key from env DASHBOARD_API_TOKEN.
- If DASHBOARD_API_TOKEN is empty → {ok: False, reason: 'DASHBOARD_API_TOKEN no configurado'}
  without touching the network (check happens after health-check guard).
- GET /api/health before any POST (if unreachable → {ok: False, reason: '...'}).
- NEVER raise exceptions to callers — always return dict with ok/reason.
- Timeout 30s. Logs to stderr only.
"""
from __future__ import annotations

import logging
import os
import sys
from typing import Any

import httpx

logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger(__name__)

_TIMEOUT = 30.0


def _client() -> httpx.AsyncClient:
    """Build an httpx async client with X-API-Key auth header."""
    base_url = os.environ.get("DASHBOARD_API_URL", "")
    token = os.environ.get("DASHBOARD_API_TOKEN", "")
    headers: dict[str, str] = {}
    if token:
        # X-API-Key matches FRONTEND_API_SECRET on the dashboard side
        headers["X-API-Key"] = token
    return httpx.AsyncClient(base_url=base_url, headers=headers, timeout=_TIMEOUT)


def _token_guard() -> dict[str, Any] | None:
    """Return an error dict if DASHBOARD_API_TOKEN is not set, else None."""
    if not os.environ.get("DASHBOARD_API_TOKEN", "").strip():
        return {"ok": False, "reason": "DASHBOARD_API_TOKEN no configurado"}
    return None


async def _health_check(client: httpx.AsyncClient) -> dict[str, Any] | None:
    """Return None if healthy, or error dict if not."""
    base_url = os.environ.get("DASHBOARD_API_URL", "")
    if not base_url:
        return {"ok": False, "reason": "DASHBOARD_API_URL no configurada"}
    try:
        resp = await client.get("/api/health")
        if resp.status_code >= 400:
            return {"ok": False, "reason": f"dashboard health {resp.status_code}"}
        return None
    except Exception as exc:
        return {"ok": False, "reason": f"dashboard inaccesible: {exc}"}


async def generate_budget_pdf(order_id: int) -> dict[str, Any]:
    """POST /api/external/generate-budget-pdf — X-API-Key auth. Best-effort, never raises."""
    async with _client() as client:
        err = await _health_check(client)
        if err:
            return err
        err = _token_guard()
        if err:
            return err
        try:
            resp = await client.post(
                "/api/external/generate-budget-pdf",
                json={"orderId": order_id},
            )
            body_text = resp.text[:500]
            return {"ok": resp.status_code < 400, "status": resp.status_code, "body": body_text}
        except Exception as exc:
            logger.error("generate_budget_pdf error: %s", exc, exc_info=True)
            return {"ok": False, "reason": str(exc)}


async def generate_processing_pdf(order_id: int) -> dict[str, Any]:
    """
    POST /api/order/generate-processing-pdf — attempts X-API-Key auth.
    This endpoint normally requires an admin session JWT; if we get 401/403
    we return a soft error telling the operator to use the dashboard directly.
    Best-effort, never raises.
    """
    async with _client() as client:
        err = await _health_check(client)
        if err:
            return err
        err = _token_guard()
        if err:
            return err
        try:
            resp = await client.post(
                "/api/order/generate-processing-pdf",
                json={"orderId": order_id},
            )
            if resp.status_code in (401, 403):
                return {
                    "ok": False,
                    "status": resp.status_code,
                    "reason": "endpoint requiere sesión admin — generar PDF processing desde el dashboard",
                }
            body_text = resp.text[:500]
            return {"ok": resp.status_code < 400, "status": resp.status_code, "body": body_text}
        except Exception as exc:
            logger.error("generate_processing_pdf error: %s", exc, exc_info=True)
            return {"ok": False, "reason": str(exc)}


async def generate_contract_pdf(user_id: str) -> dict[str, Any]:
    """POST /api/external/generate-contract-pdf — X-API-Key auth. Best-effort, never raises."""
    async with _client() as client:
        err = await _health_check(client)
        if err:
            return err
        err = _token_guard()
        if err:
            return err
        try:
            resp = await client.post(
                "/api/external/generate-contract-pdf",
                json={"userId": user_id},
            )
            body_text = resp.text[:500]
            return {"ok": resp.status_code < 400, "status": resp.status_code, "body": body_text}
        except Exception as exc:
            logger.error("generate_contract_pdf error: %s", exc, exc_info=True)
            return {"ok": False, "reason": str(exc)}
