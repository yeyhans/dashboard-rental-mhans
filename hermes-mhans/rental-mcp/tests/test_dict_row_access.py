"""
Tests that cursor results are read by column name, never by position.

REGRESSION GUARD (rehearsal 0002, F-5): both connection pools are built with
kwargs={"row_factory": dict_row} (db.py), so every fetchone() returns a dict.
server.py read the freshly inserted order id as `order_row[0]`, which raises
KeyError(0). FastMCP stringifies that to the bare message "0", so the whole
diagnostic the operator saw was:

    Error executing tool confirm_write: 0

The confirm_write path was the only positional read in the module — the
update_status path at :1540 and :1599 already read by key, which is why it
worked while order creation did not. F-5 sat one line past the F-3 fix and was
only reachable once F-2 and F-3 were both out of the way.

A behavioural test would need a live connection; these assert the property at
source level, the same shape as the column-set guards in test_order_insert.py.
"""
from __future__ import annotations

import re
from pathlib import Path

SERVER_SOURCE = (
    Path(__file__).resolve().parent.parent / "rental_mcp" / "server.py"
).read_text(encoding="utf-8")

# `row[0]`, `order_row[1]`, ... on any identifier ending in `row`/`_row`.
POSITIONAL_ROW_ACCESS = re.compile(r"\b\w*row\[\s*\d+\s*\]")


def _code_lines(source: str) -> list[tuple[int, str]]:
    """Source lines with comment-only lines dropped, so the guard does not trip
    on the explanatory comment left at the fix site."""
    lines = []
    for number, line in enumerate(source.splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        lines.append((number, line))
    return lines


class TestNoPositionalRowAccess:
    def test_server_never_indexes_a_row_by_position(self):
        offenders = [
            f"server.py:{number}: {line.strip()}"
            for number, line in _code_lines(SERVER_SOURCE)
            if POSITIONAL_ROW_ACCESS.search(line)
        ]
        assert offenders == [], (
            "dict_row cursors return dicts; positional access raises KeyError. "
            "Read by column name instead:\n" + "\n".join(offenders)
        )

    def test_the_confirm_write_insert_reads_the_id_by_name(self):
        assert 'order_row["id"]' in SERVER_SOURCE, (
            "the create_order INSERT must read its returned id by name; "
            "order_row[0] is the F-5 defect"
        )


class TestGuardCatchesTheOriginalDefect:
    """The guard is only worth having if it fails on the code it describes."""

    def test_regex_matches_the_pre_fix_line(self):
        assert POSITIONAL_ROW_ACCESS.search(
            "                    order_id = order_row[0] if order_row else None"
        )

    def test_regex_ignores_the_fixed_line(self):
        assert not POSITIONAL_ROW_ACCESS.search(
            '                    order_id = order_row["id"] if order_row else None'
        )
