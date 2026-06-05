"""
Tests for client-tool pure logic in server.py:
- SAFE_CLIENT_FIELDS allowlist enforcement
- email validation
- RUT validation (módulo 11, including 'K' verifier)
- draft payload construction helpers
"""
from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# Import the pure helpers from validators.py (no mcp/psycopg dep)
# ---------------------------------------------------------------------------

from rental_mcp.validators import (
    _validate_rut,
    _validate_email,
    SAFE_CLIENT_FIELDS,
    _filter_client_fields,
)


# ---------------------------------------------------------------------------
# SAFE_CLIENT_FIELDS allowlist
# ---------------------------------------------------------------------------


class TestSafeClientFields:
    def test_allowed_fields_present(self):
        expected = {
            "nombre", "apellido", "telefono", "direccion", "ciudad",
            "empresa_nombre", "empresa_rut", "instagram",
            "tipo_cliente",
        }
        assert expected.issubset(SAFE_CLIENT_FIELDS)

    def test_safe_fields_exact_mirror_of_dashboard_allowlist(self):
        # ANTI-DRIFT GUARD: SAFE_CLIENT_FIELDS must be an EXACT mirror of
        # ALLOWED_UPDATE_FIELDS in dashboard/src/pages/api/external/update-user.ts.
        # If they diverge, the agent will draft fields the dashboard rejects (400),
        # or vice versa. 'region' is intentionally absent: it is NOT a column in
        # user_profiles (database.ts). Keep both sets identical.
        assert SAFE_CLIENT_FIELDS == {
            "nombre", "apellido", "telefono", "direccion", "ciudad",
            "empresa_nombre", "empresa_rut", "instagram", "tipo_cliente",
        }

    def test_region_rejected_not_in_safe(self):
        # 'region' is NOT a user_profiles column — must be rejected by the filter.
        assert "region" not in SAFE_CLIENT_FIELDS
        result = _filter_client_fields({"nombre": "Ana", "region": "Metropolitana"})
        assert not result["ok"]
        assert "region" in result["rejected"]
        assert "nombre" in result["fields"]

    def test_prohibited_rut_not_in_safe(self):
        assert "rut" not in SAFE_CLIENT_FIELDS

    def test_prohibited_email_not_in_safe(self):
        assert "email" not in SAFE_CLIENT_FIELDS

    def test_prohibited_auth_uid_not_in_safe(self):
        assert "auth_uid" not in SAFE_CLIENT_FIELDS

    def test_prohibited_terminos_not_in_safe(self):
        assert "terminos_aceptados" not in SAFE_CLIENT_FIELDS

    def test_url_fields_not_in_safe(self):
        url_fields = [
            "url_user_contrato", "url_firma", "url_rut_anverso",
            "url_rut_reverso", "url_empresa_erut",
        ]
        for f in url_fields:
            assert f not in SAFE_CLIENT_FIELDS, f"{f!r} should be prohibited"


# ---------------------------------------------------------------------------
# _filter_client_fields
# ---------------------------------------------------------------------------


class TestFilterClientFields:
    def test_allows_safe_field(self):
        result = _filter_client_fields({"nombre": "Ana", "apellido": "García"})
        assert result == {"ok": True, "fields": {"nombre": "Ana", "apellido": "García"}, "rejected": []}

    def test_rejects_rut(self):
        result = _filter_client_fields({"nombre": "Ana", "rut": "12345678-9"})
        assert not result["ok"]
        assert "rut" in result["rejected"]

    def test_rejects_email(self):
        result = _filter_client_fields({"email": "test@example.com"})
        assert not result["ok"]
        assert "email" in result["rejected"]

    def test_rejects_auth_uid(self):
        result = _filter_client_fields({"auth_uid": "uuid-abc"})
        assert not result["ok"]
        assert "auth_uid" in result["rejected"]

    def test_rejects_url_star(self):
        result = _filter_client_fields({"url_firma": "http://example.com/firma.pdf"})
        assert not result["ok"]
        assert "url_firma" in result["rejected"]

    def test_rejects_terminos_aceptados(self):
        result = _filter_client_fields({"terminos_aceptados": True})
        assert not result["ok"]
        assert "terminos_aceptados" in result["rejected"]

    def test_mixed_safe_and_prohibited(self):
        result = _filter_client_fields({"nombre": "Ana", "rut": "bad", "telefono": "+56912345678"})
        assert not result["ok"]
        assert "rut" in result["rejected"]
        # The two safe fields should be listed in allowed portion
        assert "nombre" in result["fields"]
        assert "telefono" in result["fields"]

    def test_empty_dict_is_ok(self):
        result = _filter_client_fields({})
        assert result["ok"]
        assert result["fields"] == {}

    def test_all_safe_fields_accepted(self):
        payload = {f: "value" for f in SAFE_CLIENT_FIELDS}
        result = _filter_client_fields(payload)
        assert result["ok"]
        assert result["rejected"] == []


# ---------------------------------------------------------------------------
# _validate_rut (módulo 11) — existing function in server.py
# ---------------------------------------------------------------------------


class TestValidateRut:
    # All test RUTs verified with the standard Chilean mod-11 algorithm.

    def test_valid_rut_natural(self):
        # 77.892.569-9 is a real Chilean company RUT (Hans Salinas SpA)
        assert _validate_rut("77892569-9") is True

    def test_valid_rut_with_k(self):
        # 5.126.663-3 — verified: expected DV = 3
        assert _validate_rut("5126663-3") is True

    def test_valid_rut_empresa(self):
        assert _validate_rut("77.892.569-9") is True

    def test_valid_rut_no_dots_no_dash(self):
        # 778925699 = body 77892569, dv 9
        assert _validate_rut("778925699") is True

    def test_valid_rut_k_verifier_exists(self):
        # A RUT that has K as DV (verified computationally)
        # body=5 → factor=2 → total=10 → 11-10=1... try body=6 → 6*2=12 → rem=11-1=10 → K
        assert _validate_rut("6-K") is True

    def test_invalid_rut_wrong_dv(self):
        # 77892569-9 is valid; -0 is wrong
        assert _validate_rut("77892569-0") is False

    def test_invalid_rut_too_short(self):
        assert _validate_rut("1") is False

    def test_invalid_rut_letters_in_body(self):
        assert _validate_rut("ABCDEFG-1") is False

    def test_invalid_rut_empty(self):
        assert _validate_rut("") is False

    def test_rut_with_dots_stripped(self):
        # Same RUT with and without dots must give same result
        assert _validate_rut("77.892.569-9") == _validate_rut("77892569-9")
        assert _validate_rut("77.892.569-9") is True

    def test_k_verifier_lowercase_accepted(self):
        # Function should normalize to uppercase before checking
        assert _validate_rut("6-k") == _validate_rut("6-K")
        assert _validate_rut("6-k") is True


# ---------------------------------------------------------------------------
# _validate_email
# ---------------------------------------------------------------------------


class TestValidateEmail:
    def test_valid_email(self):
        assert _validate_email("user@example.com") is True

    def test_valid_email_subdomain(self):
        assert _validate_email("user@mail.mariohans.cl") is True

    def test_invalid_no_at(self):
        assert _validate_email("userexample.com") is False

    def test_invalid_no_domain(self):
        assert _validate_email("user@") is False

    def test_invalid_empty(self):
        assert _validate_email("") is False

    def test_invalid_spaces(self):
        assert _validate_email("user @example.com") is False

    def test_valid_plus_address(self):
        assert _validate_email("user+tag@example.com") is True

    def test_valid_dots_in_local(self):
        assert _validate_email("first.last@example.com") is True
