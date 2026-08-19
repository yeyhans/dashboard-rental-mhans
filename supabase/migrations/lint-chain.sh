#!/usr/bin/env bash
# Migration-chain ordering lint (T-016, ADR-D8 "Ordering constraint").
#
# Enforces ONE rule: no migration that creates a table may carry a sequence number lower than
# 0002_hermes_least_privilege.sql. A `CREATE TABLE` landing before 0002 inherits the
# `ALTER DEFAULT PRIVILEGES ... GRANT SELECT ... TO hermes_ro` entry captured in
# 0000_baseline.sql, which makes the new table agent-readable at creation time with no reviewed
# grant line anywhere. Revoking afterwards is data-exposure remediation, not prevention — and
# under Ley 21.719 the difference is not academic.
#
# No dependencies beyond coreutils/grep. Query-only: touches no database, writes no files.
#
# Usage:
#   ./lint-chain.sh              # lint this directory (the real migration chain)
#   ./lint-chain.sh <dir>        # lint another directory (used for the fixture self-test)
# Exit 0 = no findings. Exit 1 = ordering violation. Exit 2 = usage/environment error.
#
# EXCLUSIONS, and why each is safe:
#   * 0000_baseline.sql — legitimately creates all 14 relations; it IS the pre-0002 state the
#     revoke is written against (ADR-D5 captures the default privilege as-is so 0002 reads as a
#     reviewable diff). Its `.down.sql` only drops.
#   * `_`-prefixed files (e.g. _snapshot_0001_pre_revoke.sql) — deliberately un-numbered so they
#     do not read as appliable (R2-001); not part of the chain.
#   * `_raw/` and any other subdirectory — scratch dumps, gitignored.
#   * Files with no leading digits — not sequenced migrations.
#
# KNOWN CAVEAT (accepted, documented rather than silently handled): the four legacy
# date-prefixed migrations (20260203_*, 20260331_*, 20260406_*, 20260416_*) predate the numbered
# chain but sort numerically ABOVE it (20260203 > 2), so this lint would not flag a `CREATE TABLE`
# in them. Verified 2026-08-18 that none of the four contains `CREATE TABLE` (all are function/
# policy changes), and they are historical — superseded by 0000_baseline.sql and never re-applied.
# If a new date-prefixed migration is ever added, this caveat becomes a real gap; the chain
# convention going forward is 4-digit sequence numbers only.
#
# FIXTURE SELF-TEST (manual, T-016 acceptance — result recorded here rather than run in CI, since
# the fixture must not live in migrations/):
#   $ ./lint-chain.sh ../lint-fixtures/misordered
#   [lint-chain] FINDING: 0001_create_assets_fixture.sql (seq 0001) contains CREATE TABLE but
#                sequence 0001 < 0002 (hermes least-privilege revocation)
#   [lint-chain] 1 finding(s) — chain ordering violated
#   exit 1
# Confirmed 2026-08-18. Running it against this directory returns 0 findings.
set -euo pipefail

# Sequence number of 0002_hermes_least_privilege.sql. A CREATE TABLE at or above this is fine;
# below it is the violation.
readonly LEAST_PRIVILEGE_SEQ=2
readonly BASELINE_FILE=0000_baseline.sql

TARGET_DIR=${1:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"}

if [ ! -d "$TARGET_DIR" ]; then
  echo "[lint-chain] ERROR: not a directory: $TARGET_DIR" >&2
  exit 2
fi

findings=0
checked=0

# Non-recursive on purpose: subdirectories (_raw/) are scratch, never part of the chain.
for path in "$TARGET_DIR"/*.sql; do
  [ -e "$path" ] || continue
  file=$(basename "$path")

  case "$file" in
    "$BASELINE_FILE"|_*) continue ;;
  esac

  # Leading digit run = sequence number. No leading digits -> not a sequenced migration.
  seq_raw=${file%%[!0-9]*}
  [ -n "$seq_raw" ] || continue

  checked=$((checked + 1))

  # 10# forces base-10: bare 0002 would otherwise be read as octal by $(( )).
  seq_num=$((10#$seq_raw))
  [ "$seq_num" -lt "$LEAST_PRIVILEGE_SEQ" ] || continue

  # -w so CREATE TABLESPACE and similar do not match; -i because dump output casing varies.
  if grep -qiwE 'CREATE[[:space:]]+(UNLOGGED[[:space:]]+)?TABLE' "$path"; then
    echo "[lint-chain] FINDING: $file (seq $seq_raw) contains CREATE TABLE but sequence $seq_raw"
    echo "             < $(printf '%04d' "$LEAST_PRIVILEGE_SEQ") (hermes least-privilege revocation)"
    findings=$((findings + 1))
  fi
done

if [ "$findings" -gt 0 ]; then
  echo "[lint-chain] $findings finding(s) — chain ordering violated"
  exit 1
fi

echo "[lint-chain] 0 findings — $checked sequenced migration(s) checked in $TARGET_DIR"
