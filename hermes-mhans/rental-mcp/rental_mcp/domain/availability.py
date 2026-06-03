"""
Pure availability / date-overlap functions.
Replicates check-conflicts.ts calculateDateOverlap exactly.

Rules:
- Days are inclusive on both ends.
- Percentage uses half-up rounding (int(x + 0.5)) to match TS Math.round.
- NO side effects, NO DB access.
"""
from __future__ import annotations

from datetime import date


def calculate_overlap(
    start1: date,
    end1: date,
    start2: date,
    end2: date,
) -> tuple[int, int, int]:
    """
    Calculate date overlap between two inclusive date ranges.

    Replicates calculateDateOverlap from check-conflicts.ts:
        overlap_start = max(start1, start2)
        overlap_end   = min(end1, end2)
        if overlap_start <= overlap_end:
            overlap_days = (overlap_end - overlap_start).days + 1
            total_days   = (end1 - start1).days + 1
            overlap_pct  = int(overlap_days / total_days * 100 + 0.5)
        else:
            overlap_days = 0, overlap_pct = 0

    Returns:
        (overlap_days, total_days, overlap_pct)
        where overlap_pct is 0-100 (half-up rounded integer).
    """
    overlap_start = max(start1, start2)
    overlap_end = min(end1, end2)
    total_days = (end1 - start1).days + 1

    if overlap_start <= overlap_end:
        overlap_days = (overlap_end - overlap_start).days + 1
        overlap_pct = int(overlap_days / total_days * 100 + 0.5)
        return overlap_days, total_days, overlap_pct
    else:
        return 0, total_days, 0


def has_conflict(
    start1: date,
    end1: date,
    start2: date,
    end2: date,
) -> bool:
    """Return True if the two inclusive date ranges overlap at all."""
    overlap_days, _, _ = calculate_overlap(start1, end1, start2, end2)
    return overlap_days > 0


def late_fee(daily_cost: float, days_late: int) -> float:
    """Convenience re-export: dias_atraso * costo_diario."""
    return float(daily_cost) * days_late
