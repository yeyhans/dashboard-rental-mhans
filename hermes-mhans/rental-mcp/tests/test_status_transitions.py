"""
Tests for the order status vocabulary and transition map.

T-021 (lockstep with migration 0003, ADR-D9) plus the T-024 deploy-window
guard: the vocabulary is selected ONCE at import by the env var
ORDER_STATUS_VOCABULARY:

    legacy (DEFAULT)  the seven values orders_status_check accepts TODAY,
                      byte-equivalent to the pre-T-021 behavior. Safe if the
                      container ships before migration 0003 applies.
    v12               Portal Cliente v1.2 canonical eight-value vocabulary
                      (ADR-001), the exact set the constraint accepts after
                      migration 0003. Mirrors dashboard/src/lib/orderStatus.ts.

Both tables are pinned here with hardcoded literals on purpose: the literals
are the guard against the source module drifting.
"""
from __future__ import annotations

import importlib

import pytest

import rental_mcp.domain.orders
import rental_mcp.validators


# ---------------------------------------------------------------------------
# Pinned expectations — v1.2 (post-migration-0003 CHECK constraint)
# ---------------------------------------------------------------------------

V12_CHECK_CONSTRAINT_VALUES = {
    "request",
    "evaluation",
    "confirmed",
    "preparation",
    "in-rental",
    "return",
    "completed",
    "cancelled",
}

# The full 8-row transition matrix, pinned row by row.
V12_TRANSITIONS = {
    "request":     ["evaluation", "cancelled"],
    "evaluation":  ["confirmed", "cancelled"],
    "confirmed":   ["preparation", "cancelled"],
    "preparation": ["in-rental", "cancelled"],
    "in-rental":   ["return", "cancelled"],
    "return":      ["completed", "cancelled"],
    "completed":   [],
    "cancelled":   [],
}

V12_ACTIVE = (
    "request",
    "evaluation",
    "confirmed",
    "preparation",
    "in-rental",
    "return",
)

TERMINAL_STATUSES = {"completed", "cancelled"}

# The linear happy path, in order.
LINEAR_PATH = [
    "request",
    "evaluation",
    "confirmed",
    "preparation",
    "in-rental",
    "return",
    "completed",
]

# ---------------------------------------------------------------------------
# Pinned expectations — legacy (the CHECK constraint of production TODAY)
# ---------------------------------------------------------------------------

LEGACY_CHECK_CONSTRAINT_VALUES = {
    "pending",
    "processing",
    "on-hold",
    "completed",
    "cancelled",
    "refunded",
    "failed",
}

# The full 7-row transition matrix exactly as it was before T-021.
LEGACY_TRANSITIONS = {
    "pending":    ["on-hold", "cancelled", "failed"],
    "on-hold":    ["processing", "cancelled", "failed"],
    "processing": ["completed", "cancelled", "failed"],
    "completed":  ["refunded"],
    "cancelled":  [],
    "refunded":   [],
    "failed":     [],
}

LEGACY_ACTIVE = ("pending", "on-hold", "processing")

# Retired vocabularies under v12: pre-migration production values plus the
# phantom documented workflow. None may be accepted in v12 mode.
RETIRED_STATUSES = {
    "pending",
    "processing",
    "on-hold",
    "refunded",
    "failed",
    "reviewing",
    "preparing",
    "delivering",
    "paid",
}


# ---------------------------------------------------------------------------
# Module (re)loading helpers — the switch is read once at import
# ---------------------------------------------------------------------------


def _reload_with(monkeypatch, mode: str | None):
    """Reload validators (and its dependant orders) under the given env."""
    if mode is None:
        monkeypatch.delenv("ORDER_STATUS_VOCABULARY", raising=False)
    else:
        monkeypatch.setenv("ORDER_STATUS_VOCABULARY", mode)
    validators = importlib.reload(rental_mcp.validators)
    importlib.reload(rental_mcp.domain.orders)
    return validators


@pytest.fixture(autouse=True)
def _restore_default_vocabulary(monkeypatch):
    """Leave the modules back in their default (legacy) shape after each test."""
    yield
    _reload_with(monkeypatch, None)


@pytest.fixture
def v12(monkeypatch):
    return _reload_with(monkeypatch, "v12")


@pytest.fixture
def legacy(monkeypatch):
    return _reload_with(monkeypatch, "legacy")


# ---------------------------------------------------------------------------
# The switch itself
# ---------------------------------------------------------------------------


class TestVocabularySwitch:
    def test_default_is_legacy(self, monkeypatch):
        # Deploying the container BEFORE migration 0003 must be safe: with no
        # env var the module keeps today's production behavior (R3-101/R3-102).
        validators = _reload_with(monkeypatch, None)
        assert validators.ORDER_STATUS_VOCABULARY == "legacy"
        assert validators.VALID_TRANSITIONS == LEGACY_TRANSITIONS

    def test_unknown_value_fails_fast_at_import(self, monkeypatch):
        monkeypatch.setenv("ORDER_STATUS_VOCABULARY", "v13")
        with pytest.raises(ValueError, match="ORDER_STATUS_VOCABULARY"):
            importlib.reload(rental_mcp.validators)

    def test_value_is_case_insensitive(self, monkeypatch):
        validators = _reload_with(monkeypatch, "V12")
        assert validators.ORDER_STATUS_VOCABULARY == "v12"


# ---------------------------------------------------------------------------
# Legacy mode — byte-equivalent to the pre-T-021 tables
# ---------------------------------------------------------------------------


class TestLegacyVocabulary:
    def test_matches_todays_check_constraint_exactly(self, legacy):
        assert set(legacy.DB_ORDER_STATUSES) == LEGACY_CHECK_CONSTRAINT_VALUES

    def test_full_transition_matrix_pin(self, legacy):
        # Row-by-row equality with the pre-diff table (recovered from git).
        assert legacy.VALID_TRANSITIONS == LEGACY_TRANSITIONS

    def test_active_statuses_pin(self, legacy):
        assert legacy.ACTIVE_ORDER_STATUSES == LEGACY_ACTIVE

    def test_rejects_v12_only_values(self, legacy):
        for status in sorted(V12_CHECK_CONSTRAINT_VALUES - LEGACY_CHECK_CONSTRAINT_VALUES):
            assert legacy.is_valid_status(status) is False

    def test_existing_orders_can_still_move(self, legacy):
        # R3-101 regression: pre-migration rows carry the old vocabulary and
        # must keep their transitions.
        assert legacy.is_valid_transition("on-hold", "processing") is True
        assert legacy.is_valid_transition("processing", "completed") is True
        assert legacy.is_valid_transition("completed", "refunded") is True

    def test_default_new_order_status_is_on_hold(self, legacy):
        # R3-102 regression: today's CHECK constraint refuses 'request'.
        assert legacy.DEFAULT_NEW_ORDER_STATUS == "on-hold"

    def test_payment_gate_stage_is_processing(self, legacy):
        assert legacy.PAYMENT_GATE_STATUS == "processing"


# ---------------------------------------------------------------------------
# v12 mode — vocabulary
# ---------------------------------------------------------------------------


class TestV12StatusVocabulary:
    def test_matches_the_check_constraint_exactly(self, v12):
        assert set(v12.DB_ORDER_STATUSES) == V12_CHECK_CONSTRAINT_VALUES

    @pytest.mark.parametrize("status", sorted(V12_CHECK_CONSTRAINT_VALUES))
    def test_accepts_every_committable_value(self, v12, status):
        assert v12.is_valid_status(status) is True

    @pytest.mark.parametrize("status", sorted(RETIRED_STATUSES))
    def test_rejects_every_retired_value(self, v12, status):
        # Lockstep requirement: post-0003 the CHECK constraint refuses these,
        # so a draft carrying one could never commit.
        assert v12.is_valid_status(status) is False

    def test_rejects_unknown_value(self, v12):
        assert v12.is_valid_status("nonexistent") is False
        assert v12.is_valid_status("") is False

    def test_default_new_order_status_is_request(self, v12):
        assert v12.DEFAULT_NEW_ORDER_STATUS == "request"

    def test_payment_gate_stage_is_confirmed(self, v12):
        assert v12.PAYMENT_GATE_STATUS == "confirmed"


class TestV12ActiveStatuses:
    def test_active_statuses_are_the_six_non_terminal_stages(self, v12):
        assert set(v12.ACTIVE_ORDER_STATUSES) == V12_CHECK_CONSTRAINT_VALUES - TERMINAL_STATUSES
        assert v12.ACTIVE_ORDER_STATUSES == V12_ACTIVE

    def test_active_statuses_contain_no_retired_value(self, v12):
        assert set(v12.ACTIVE_ORDER_STATUSES) & RETIRED_STATUSES == set()


# ---------------------------------------------------------------------------
# v12 mode — transitions
# ---------------------------------------------------------------------------


class TestV12Transitions:
    def test_full_transition_matrix_pin(self, v12):
        # The 8-row matrix, pinned row by row.
        assert v12.VALID_TRANSITIONS == V12_TRANSITIONS

    def test_every_source_state_is_a_real_status(self, v12):
        assert set(v12.VALID_TRANSITIONS) == V12_CHECK_CONSTRAINT_VALUES

    def test_every_offered_transition_is_committable(self, v12):
        for current, targets in v12.VALID_TRANSITIONS.items():
            for target in targets:
                assert target in v12.DB_ORDER_STATUSES, (
                    f"{current} -> {target} is offered but the database rejects {target!r}"
                )

    def test_no_retired_transition_is_offered(self, v12):
        offered = {t for targets in v12.VALID_TRANSITIONS.values() for t in targets}
        assert offered & RETIRED_STATUSES == set()

    @pytest.mark.parametrize(
        "current,expected_next",
        list(zip(LINEAR_PATH[:-1], LINEAR_PATH[1:])),
    )
    def test_linear_progression(self, v12, current, expected_next):
        assert v12.is_valid_transition(current, expected_next) is True

    @pytest.mark.parametrize("current", LINEAR_PATH[:-1])
    def test_every_non_terminal_stage_can_cancel(self, v12, current):
        assert v12.is_valid_transition(current, "cancelled") is True

    @pytest.mark.parametrize("current", sorted(V12_CHECK_CONSTRAINT_VALUES))
    def test_no_stage_may_be_skipped(self, v12, current):
        # Only the immediate next stage (plus cancelled) is offered.
        allowed = set(v12.VALID_TRANSITIONS[current])
        if current in TERMINAL_STATUSES:
            assert allowed == set()
        else:
            idx = LINEAR_PATH.index(current)
            assert allowed == {LINEAR_PATH[idx + 1], "cancelled"}

    def test_going_backwards_is_never_allowed(self, v12):
        for later_idx, current in enumerate(LINEAR_PATH):
            for earlier in LINEAR_PATH[:later_idx]:
                assert v12.is_valid_transition(current, earlier) is False, (
                    f"{current} -> {earlier} goes backwards"
                )

    def test_terminal_states_offer_nothing(self, v12):
        for terminal in sorted(TERMINAL_STATUSES):
            assert v12.VALID_TRANSITIONS[terminal] == []

    def test_completed_cannot_be_cancelled(self, v12):
        # Two terminals (ADR-001): leaving `completed` is not allowed, the
        # old completed -> refunded escape does not carry over.
        assert v12.is_valid_transition("completed", "cancelled") is False

    def test_no_self_transition(self, v12):
        for current, targets in v12.VALID_TRANSITIONS.items():
            assert current not in targets

    def test_retired_source_state_offers_nothing(self, v12):
        assert v12.is_valid_transition("on-hold", "confirmed") is False
        assert v12.is_valid_transition("processing", "completed") is False
