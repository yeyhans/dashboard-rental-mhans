#!/usr/bin/env bash
#
# Copies the REFERENCE data (catalogue and commercial config) from the production database into
# the staging database, so migration rehearsals run against real values and real row counts
# instead of a thin synthetic sample.
#
# WHAT IT COPIES, AND WHY ONLY THIS
# ---------------------------------
# Four tables, all business reference data with no personal information in them:
#
#   categories        (24 rows)   catalogue taxonomy
#   products          (165 rows)  the rental catalogue
#   shipping_methods  (4 rows)    dispatch options
#   coupons           (7 rows)    discount codes
#
# It deliberately does NOT copy: user_profiles, orders, order_communications, coupon_usage,
# shipping_usage, admin_users, hermes_*, or anything in `auth`. Those hold names, RUTs, emails,
# phone numbers, addresses and signatures of real clients. Ley 21.719 takes effect 2026-12-01 and
# staging is a lower-trust environment with a different secret set; copying client data into it
# would create a second place that data can leak from, for no rehearsal benefit — a migration
# cares about row COUNT and column SHAPE, which the synthetic seed already provides at production
# volume (see supabase/seeds/staging_seed.sql).
#
# `created_by` on `coupons` and `shipping_methods` is a FK into `auth.users`. Production's auth
# users do not exist in staging and must not be copied there, so the column is nulled in transit —
# it is an audit breadcrumb, not business data. Both FKs are ON DELETE SET NULL, so NULL is a value
# the schema already treats as valid.
#
# SAFETY
# ------
# Production is opened READ ONLY: every production statement runs inside
# `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, so a typo cannot write. Nothing is dumped to
# disk; rows stream prod -> staging through a pipe.
#
# USAGE (on the VPS)
#   bash import-reference-data.sh            # copy
#   DRY_RUN=1 bash import-reference-data.sh  # report what would change, touch nothing
#
set -euo pipefail

PROD_CONTAINER=${PROD_CONTAINER:-supabase-9cd8-db}
PROD_USER=${PROD_USER:-supabase_admin}
PROD_PORT=${PROD_PORT:-5434}

STG_CONTAINER=${STG_CONTAINER:-supabase-stg-db}
STG_USER=${STG_USER:-supabase_admin}
STG_PORT=${STG_PORT:-5432}

DRY_RUN=${DRY_RUN:-0}

# Load order matters: `products.categories_ids` is jsonb (no FK), but `categories.parent` is a
# self-FK and `serialised_assets.product_id` points at `products`. FK triggers are suspended for
# the load rather than sorting rows topologically — see the session_replication_role note below.
TABLES=(categories products shipping_methods coupons)

# Columns nulled in transit because they reference auth.users, which is never copied.
declare -A NULL_COLUMNS=(
  [coupons]=created_by
  [shipping_methods]=created_by
)

prod_sql() {
  docker exec -i "$PROD_CONTAINER" psql -U "$PROD_USER" -p "$PROD_PORT" -d postgres \
    -v ON_ERROR_STOP=1 -qtA "$@"
}

stg_sql() {
  docker exec -i "$STG_CONTAINER" psql -U "$STG_USER" -p "$STG_PORT" -d postgres \
    -v ON_ERROR_STOP=1 -qtA "$@"
}

require_container() {
  docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null | grep -qx true ||
    { echo "[import] FATAL: container $1 is not running" >&2; exit 1; }
}

require_container "$PROD_CONTAINER"
require_container "$STG_CONTAINER"

# Refuse to run if the two ends resolve to the same container. The whole point of this script is
# that one side is production; a copy-paste that pointed both at prod would TRUNCATE it.
if [ "$PROD_CONTAINER" = "$STG_CONTAINER" ]; then
  echo "[import] FATAL: PROD_CONTAINER and STG_CONTAINER are the same ($PROD_CONTAINER)." >&2
  echo "         This script TRUNCATEs the staging side. Refusing to run." >&2
  exit 1
fi

echo "[import] source (READ ONLY): $PROD_CONTAINER:$PROD_PORT"
echo "[import] target            : $STG_CONTAINER:$STG_PORT"
[ "$DRY_RUN" = "1" ] && echo "[import] DRY RUN — no changes will be made"
echo

for table in "${TABLES[@]}"; do
  # Column list is read from the TARGET, not the source: if staging is ahead of production (it
  # carries serialised_assets and will carry future migrations), copying prod's list would build a
  # COPY naming a column staging may not have in the same position. Intersecting on the target and
  # verifying against the source below makes a shape drift an error, not a silent misalignment.
  stg_cols=$(stg_sql -c "select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
                         from information_schema.columns
                         where table_schema='public' and table_name='$table';")
  prod_cols=$(prod_sql -c "select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
                           from information_schema.columns
                           where table_schema='public' and table_name='$table';")

  if [ -z "$stg_cols" ] || [ -z "$prod_cols" ]; then
    echo "[import] FATAL: table $table missing on one side" >&2
    exit 1
  fi
  if [ "$stg_cols" != "$prod_cols" ]; then
    echo "[import] FATAL: column shape differs for $table — refusing to copy" >&2
    echo "         prod: $prod_cols" >&2
    echo "         stg : $stg_cols" >&2
    exit 1
  fi

  # Build the SELECT list, replacing any auth-referencing column with a typed NULL.
  select_list=$stg_cols
  null_col=${NULL_COLUMNS[$table]:-}
  if [ -n "$null_col" ]; then
    select_list=$(printf '%s' "$stg_cols" | sed -E "s/(^|, )$null_col(,|$)/\1NULL::uuid AS $null_col\2/")
  fi

  src_count=$(prod_sql -c "begin isolation level repeatable read read only;
                           select count(*) from public.$table;")
  dst_count=$(stg_sql -c "select count(*) from public.$table;")
  echo "[import] $table: prod=$src_count  staging=$dst_count${null_col:+  (nulling $null_col)}"

  if [ "$DRY_RUN" = "1" ]; then
    continue
  fi

  # session_replication_role=replica suspends FK/user triggers for THIS session only. It is used
  # rather than a topological sort because `categories.parent` is a self-FK: any row order can
  # violate it mid-load, and the constraint is not DEFERRABLE so SET CONSTRAINTS cannot help.
  # Integrity is re-verified after the load by VALIDATE-equivalent counts below.
  #
  # TRUNCATE ... CASCADE also clears the dependent synthetic tables (serialised_assets on products,
  # coupon_usage on coupons, shipping_usage on shipping_methods). That is intended: they hold
  # generated rows keyed to the old ids, and leaving them would point at products that no longer
  # exist. Re-seed them afterwards with supabase/seeds/staging_seed.sql if a rehearsal needs them.
  docker exec -i "$PROD_CONTAINER" psql -U "$PROD_USER" -p "$PROD_PORT" -d postgres -v ON_ERROR_STOP=1 -qtA \
    -c "begin isolation level repeatable read read only;
        copy (select $select_list from public.$table) to stdout with (format csv)" |
  docker exec -i "$STG_CONTAINER" psql -U "$STG_USER" -p "$STG_PORT" -d postgres -v ON_ERROR_STOP=1 -q \
    -c "set session_replication_role = replica;
        truncate table public.$table cascade;
        copy public.$table ($stg_cols) from stdin with (format csv);"

  loaded=$(stg_sql -c "select count(*) from public.$table;")
  if [ "$loaded" != "$src_count" ]; then
    echo "[import] FATAL: $table loaded $loaded rows, expected $src_count" >&2
    exit 1
  fi
  echo "[import] $table: loaded $loaded rows"
done

if [ "$DRY_RUN" = "1" ]; then
  echo
  echo "[import] dry run complete — nothing changed"
  exit 0
fi

# COPY does not advance the identity sequences, so the next INSERT would collide with a copied id.
# Every table here uses an integer PK backed by a sequence; pg_get_serial_sequence returns NULL for
# any that does not, and the coalesce keeps that from erroring.
echo
echo "[import] resyncing identity sequences"
for table in "${TABLES[@]}"; do
  stg_sql -c "select setval(s.seq, coalesce((select max(id) from public.$table), 1))
              from (select pg_get_serial_sequence('public.$table','id') as seq) s
              where s.seq is not null;" >/dev/null
done

# Integrity re-check: session_replication_role bypassed the FK triggers during the load, so the
# constraints were never evaluated. These queries evaluate them by hand. A non-zero count means the
# copy produced rows the schema would have rejected.
echo "[import] verifying foreign keys the load bypassed"
orphan_parents=$(stg_sql -c "select count(*) from public.categories c
                             where c.parent is not null
                               and not exists (select 1 from public.categories p where p.id = c.parent);")
if [ "$orphan_parents" != "0" ]; then
  echo "[import] FATAL: $orphan_parents categories reference a missing parent" >&2
  exit 1
fi
echo "[import] categories.parent: 0 orphans"

echo
echo "[import] done. Personal data was NOT copied — user_profiles, orders, order_communications,"
echo "         admin_users, coupon_usage, shipping_usage and auth.* remain synthetic."
