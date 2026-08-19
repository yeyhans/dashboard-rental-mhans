#!/usr/bin/env bash
# Migration-chain lint (T-016, ADR-D8 "Ordering constraint"; rule 2 added for Finding 1 of
# openspec rehearsals/0004.md).
#
# RULE 1 — ordering. No migration that creates a table may carry a sequence number lower than
# 0002_hermes_least_privilege.sql. A `CREATE TABLE` landing before 0002 inherits the
# `ALTER DEFAULT PRIVILEGES ... GRANT SELECT ... TO hermes_ro` entry captured in
# 0000_baseline.sql, which makes the new table agent-readable at creation time with no reviewed
# grant line anywhere. Revoking afterwards is data-exposure remediation, not prevention — and
# under Ley 21.719 the difference is not academic.
#
# RULE 2 — anon REVOKE. Any migration containing `CREATE TABLE ... public.` must also contain a
# `REVOKE` naming `anon`. Same mechanism as rule 1, different grantee and far worse blast radius:
# `pg_default_acl` on `public` grants anon and authenticated the FULL table privilege set
# (`arwdDxt` — including INSERT, DELETE and TRUNCATE) on every future table, from both grantors.
# `0004_serialised_assets.sql` handles this correctly per-table; nothing forced it to, and a new
# table with no REVOKE is indistinguishable in review from one that never needed it.
#
# Rule 2 is BELT-AND-BRACES, not the primary control. The real fix is
# `0005_revoke_public_default_privileges.sql`, which removes the default privilege wholesale so a
# new table is deny-by-default at creation. This lint stays because it is nearly free, it keeps
# working if 0005 is ever rolled back (its `.down.sql` restores the defect deliberately), and it
# makes the intent legible in the diff. A migration that genuinely wants a public-readable table
# still satisfies the rule — it revokes first, then grants back the narrow privilege it means.
#
# Rule 2 is grep-level on purpose, matching rule 1's cost profile: it proves a REVOKE naming anon
# is PRESENT in the file, not that it covers the right table. A migration creating two tables and
# revoking on only one passes. That residual gap is accepted and is precisely what 0005 closes at
# the source.
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
# FIXTURE SELF-TEST (manual, T-016 acceptance — results recorded here rather than run in CI, since
# the fixtures must not live in migrations/). One fixture per rule; re-confirmed 2026-08-19.
#
#   $ ./lint-chain.sh ../lint-fixtures/misordered
#   [lint-chain] FINDING: 0001_create_assets_fixture.sql creates a table in public. but contains
#                no REVOKE naming anon
#   [lint-chain] FINDING: 0001_create_assets_fixture.sql (seq 0001) contains CREATE TABLE but
#                sequence 0001 < 0002 (hermes least-privilege revocation)
#   [lint-chain] 2 finding(s) — chain invariants violated
#   exit 1
#
# That fixture now trips BOTH rules (it was written for rule 1 and happens to omit the REVOKE too),
# which is why rule 2 has its own fixture at sequence 0006 — high enough that rule 1 cannot fire,
# so the single finding is unambiguously rule 2:
#
#   $ ./lint-chain.sh ../lint-fixtures/no-anon-revoke
#   [lint-chain] FINDING: 0006_create_table_without_revoke_fixture.sql creates a table in public.
#                but contains no REVOKE naming anon
#   [lint-chain] 1 finding(s) — chain invariants violated
#   exit 1
#
# That fixture also guards the comment-stripping behaviour: it documents the missing REVOKE lines
# in a trailing comment, and an earlier draft of rule 2 passed it for exactly that reason.
#
# Running against this directory returns 0 findings over 13 sequenced files — including
# 0004_serialised_assets.sql, which satisfies rule 2 via its real REVOKE at line 94.
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

  # Strip `--` line comments before matching ANYTHING. Without this the lint reads prose: these
  # migrations carry long explanatory headers that quote the very SQL they discuss, so a file whose
  # only mention of `REVOKE ... anon` is a comment describing what a future author should write
  # would pass rule 2, and a commented-out `CREATE TABLE` would falsely trip rule 1. Caught by the
  # no-anon-revoke fixture, which documents the missing lines in a trailing comment and must still
  # be flagged.
  # Known limit, accepted at this cost tier: only line comments are stripped, not `/* */` blocks,
  # and a string literal containing `--` loses its tail. Neither appears in this chain.
  stripped=$(sed 's/--.*//' "$path")

  # -w so CREATE TABLESPACE and similar do not match; -i because dump output casing varies.
  creates_table=0
  if printf '%s' "$stripped" | grep -qiwE 'CREATE[[:space:]]+(UNLOGGED[[:space:]]+)?TABLE'; then
    creates_table=1
  fi

  # ---- rule 2: a table created in `public` must be accompanied by a REVOKE naming anon ----
  # Narrower pattern than rule 1's: only `public.`-qualified tables carry the schema's default
  # ACL. An unqualified `CREATE TABLE foo` resolves via search_path and is almost always a temp or
  # fixture table, so flagging it would train people to ignore this lint.
  if [ "$creates_table" -eq 1 ] &&
     printf '%s' "$stripped" | grep -qiE 'CREATE[[:space:]]+(UNLOGGED[[:space:]]+)?TABLE([[:space:]]+IF[[:space:]]+NOT[[:space:]]+EXISTS)?[[:space:]]+public\.' &&
     ! printf '%s' "$stripped" | grep -qiE 'REVOKE.*\banon\b'; then
    echo "[lint-chain] FINDING: $file creates a table in public. but contains no REVOKE naming anon"
    echo "             pg_default_acl grants anon the full table privilege set (arwdDxt, incl."
    echo "             TRUNCATE) on every new table — see 0004_serialised_assets.sql:93-94"
    findings=$((findings + 1))
  fi

  # ---- rule 1: a table may not be created before the hermes least-privilege revocation ----
  # 10# forces base-10: bare 0002 would otherwise be read as octal by $(( )).
  seq_num=$((10#$seq_raw))
  [ "$seq_num" -lt "$LEAST_PRIVILEGE_SEQ" ] || continue

  if [ "$creates_table" -eq 1 ]; then
    echo "[lint-chain] FINDING: $file (seq $seq_raw) contains CREATE TABLE but sequence $seq_raw"
    echo "             < $(printf '%04d' "$LEAST_PRIVILEGE_SEQ") (hermes least-privilege revocation)"
    findings=$((findings + 1))
  fi
done

if [ "$findings" -gt 0 ]; then
  echo "[lint-chain] $findings finding(s) — chain invariants violated"
  exit 1
fi

echo "[lint-chain] 0 findings — $checked sequenced migration(s) checked in $TARGET_DIR"
