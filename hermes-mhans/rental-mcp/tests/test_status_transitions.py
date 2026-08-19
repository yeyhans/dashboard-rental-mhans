"""
Tests for the order status vocabulary and transition map.

REGRESSION GUARD (rehearsal 0002, F-4): the transition map encoded the
DOCUMENTED workflow (reviewing / preparing / delivering / paid), none of which
the orders_status_check constraint accepts. update_order_status_draft happily
produced a draft and a confirmation token for on-hold → reviewing, and the
confirm then died with a check-constraint violation.

Interim alignment only: the v1.2 vocabulary ships with migration 0003
(Batch 5 / M4) under task T-021, gated on client decision O-8.
"""
from __future__ import annotations

import pytest

from rental_mcp.validators import (
    DB_ORDER_STATUSES,
    VALID_TRANSITIONS,
    is_valid_status,
    is_valid_transition,
)


# The exact CHECK constraint of orders.status today. Hardcoded on purpose:
# this literal is the guard against the source module drifting on its own.
CHECK_CONSTRAINT_VALUES = {
    "pending",
    "processing",
    "on-hold",
    "completed",
    "cancelled",
    "refunded",
    "failed",
}

# Values the documentation describes but the database rejects.
PHANTOM_STATUSES = {"reviewing", "preparing", "delivering", "paid"}


class TestStatusVocabulary:
    def test_matches_the_check_constraint_exactly(self):
        assert set(DB_ORDER_STATUSES) == CHECK_CONSTRAINT_VALUES

    def test_phantom_statuses_are_absent(self):
        assert set(DB_ORDER_STATUSES) & PHANTOM_STATUSES == set()

    @pytest.mark.parametrize("status", sorted(CHECK_CONSTRAINT_VALUES))
    def test_accepts_every_committable_value(self, status):
        assert is_valid_status(status) is True

    @pytest.mark.parametrize("status", sorted(PHANTOM_STATUSES))
    def test_rejects_values_the_database_would_refuse(self, status):
        # Must be caught BEFORE reaching the database, where it would surface
        # as a check-constraint violation on confirm.
        assert is_valid_status(status) is False

    def test_rejects_unknown_value(self):
        assert is_valid_status("nonexistent") is False
        assert is_valid_status("") is False


class TestTransitions:
    def test_every_source_state_is_a_real_status(self):
        assert set(VALID_TRANSITIONS) == CHECK_CONSTRAINT_VALUES

    def test_every_offered_transition_is_committable(self):
        # The defect in one line: a transition the tool offers must be a value
        # the CHECK constraint accepts, otherwise the draft can never commit.
        for current, targets in VALID_TRANSITIONS.items():
            for target in targets:
                assert target in DB_ORDER_STATUSES, (
                    f"{current} → {target} is offered but the database rejects {target!r}"
                )

    def test_no_phantom_transition_is_offered(self):
        offered = {t for targets in VALID_TRANSITIONS.values() for t in targets}
        assert offered & PHANTOM_STATUSES == set()

    def test_on_hold_can_reach_processing(self):
        # The rental's core path: reserva confirmed → processing.
        assert is_valid_transition("on-hold", "processing") is True

    def test_on_hold_cannot_reach_reviewing(self):
        assert is_valid_transition("on-hold", "reviewing") is False

    def test_terminal_states_offer_nothing(self):
        for terminal in ("cancelled", "refunded", "failed"):
            assert VALID_TRANSITIONS[terminal] == []

    def test_no_self_transition(self):
        for current, targets in VALID_TRANSITIONS.items():
            assert current not in targets

    def test_unknown_source_state_offers_nothing(self):
        assert is_valid_transition("reviewing", "processing") is False
