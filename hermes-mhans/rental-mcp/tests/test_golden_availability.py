"""
Golden tests for domain.availability — date overlap logic.
Replicates check-conflicts.ts calculateDateOverlap exactly.
"""
import pytest
from datetime import date

from rental_mcp.domain.availability import calculate_overlap, late_fee


class TestCalculateOverlap:
    def test_adjacent_overlap_one_day(self):
        """(01->03) vs (03->05): 1 day overlap, total=3, pct=33."""
        overlap_days, total_days, pct = calculate_overlap(
            start1=date(2026, 4, 1), end1=date(2026, 4, 3),
            start2=date(2026, 4, 3), end2=date(2026, 4, 5),
        )
        assert overlap_days == 1
        assert total_days == 3
        assert pct == 33

    def test_no_overlap(self):
        """(01->03) vs (04->06): 0 overlap."""
        overlap_days, total_days, pct = calculate_overlap(
            start1=date(2026, 4, 1), end1=date(2026, 4, 3),
            start2=date(2026, 4, 4), end2=date(2026, 4, 6),
        )
        assert overlap_days == 0
        assert total_days == 3
        assert pct == 0

    def test_identical_dates_full_overlap(self):
        """Same range = 100% overlap."""
        overlap_days, total_days, pct = calculate_overlap(
            start1=date(2026, 4, 1), end1=date(2026, 4, 3),
            start2=date(2026, 4, 1), end2=date(2026, 4, 3),
        )
        assert overlap_days == 3
        assert total_days == 3
        assert pct == 100

    def test_partial_overlap(self):
        """(01->04) vs (03->06): overlap 03->04 = 2 days, total=4, pct=50."""
        overlap_days, total_days, pct = calculate_overlap(
            start1=date(2026, 4, 1), end1=date(2026, 4, 4),
            start2=date(2026, 4, 3), end2=date(2026, 4, 6),
        )
        assert overlap_days == 2
        assert total_days == 4
        assert pct == 50

    def test_contained_range(self):
        """(01->05) contains (02->04): overlap=3, total=5, pct=60."""
        overlap_days, total_days, pct = calculate_overlap(
            start1=date(2026, 4, 1), end1=date(2026, 4, 5),
            start2=date(2026, 4, 2), end2=date(2026, 4, 4),
        )
        assert overlap_days == 3
        assert total_days == 5
        assert pct == 60

    def test_single_day_each_same(self):
        """Both single-day, same date: 1 overlap, 1 total, 100%."""
        overlap_days, total_days, pct = calculate_overlap(
            start1=date(2026, 4, 1), end1=date(2026, 4, 1),
            start2=date(2026, 4, 1), end2=date(2026, 4, 1),
        )
        assert overlap_days == 1
        assert total_days == 1
        assert pct == 100

    def test_single_day_different(self):
        """Both single-day, different dates: 0 overlap."""
        overlap_days, total_days, pct = calculate_overlap(
            start1=date(2026, 4, 1), end1=date(2026, 4, 1),
            start2=date(2026, 4, 2), end2=date(2026, 4, 2),
        )
        assert overlap_days == 0
        assert total_days == 1
        assert pct == 0

    def test_pct_rounding_half_up(self):
        """Verify pct uses int(x + 0.5) rounding (half-up), matching TS Math.round."""
        # (01->03) vs (03->05): 1/3 = 33.33... -> TS Math.round = 33
        overlap_days, total_days, pct = calculate_overlap(
            start1=date(2026, 4, 1), end1=date(2026, 4, 3),
            start2=date(2026, 4, 3), end2=date(2026, 4, 5),
        )
        assert pct == 33  # not 34 (banker's round would also give 33 here)

    def test_two_thirds_pct(self):
        """(01->03) vs (02->04): overlap 02->03=2 days, total=3, pct=67."""
        overlap_days, total_days, pct = calculate_overlap(
            start1=date(2026, 4, 1), end1=date(2026, 4, 3),
            start2=date(2026, 4, 2), end2=date(2026, 4, 4),
        )
        assert overlap_days == 2
        assert total_days == 3
        assert pct == 67


class TestLateFeeFromAvailability:
    """late_fee is also importable from availability for convenience."""

    def test_late_fee_basic(self):
        assert late_fee(daily_cost=15000, days_late=5) == 75000

    def test_late_fee_zero(self):
        assert late_fee(daily_cost=15000, days_late=0) == 0
