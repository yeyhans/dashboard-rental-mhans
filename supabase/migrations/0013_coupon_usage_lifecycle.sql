--
-- 0013_coupon_usage_lifecycle.sql — record a coupon's use when an order takes it, release it when
-- the order is cancelled.
--
-- SDD artifacts (design.md, specs/*, audits/, rehearsals/) live at the mhans workspace root:
-- ../../../openspec/changes/consolidado-web-2027/ (OUTSIDE this repo — not visible from a clone
-- of `dashboard/` alone; see R2-003).
--
-- WHY. `coupons.usage_limit` and `coupons.usage_limit_per_user` were decorative. The only caller
-- of `apply_coupon` is `POST /api/coupons/apply/[code]`, which nothing in the order flow invokes,
-- so a coupon attached to a real order never produced a `coupon_usage` row and never incremented
-- `usage_count`. `CouponService.couponEligibility` then read those two untouched counters and
-- concluded, correctly given its inputs, that the coupon had never been used — so a single-use
-- coupon could be spent forever.
--
-- WHY NOT REUSE `apply_coupon`. It inserts the usage row and increments the counter, but it never
-- looks at either limit, and it takes no lock. Two orders created in the same instant would both
-- be admitted. It is left in place untouched: `/api/coupons/apply/[code]` still calls it, and
-- changing a function under a live caller inside this migration is a second change in disguise.
--
-- WHAT.
--
--   `record_coupon_usage_for_order(p_order_id, p_coupon_code, p_user_id, p_discount_amount)`
--       Takes `SELECT ... FOR UPDATE` on the coupon row FIRST. Everything after it — reading the
--       two limits, releasing what this order had recorded before, inserting, incrementing — runs
--       with every other recording of the SAME coupon queued behind it, so the count that decides
--       cannot be stale by the time the insert lands. That lock is the entire reason this is a
--       database function and not four statements in the service.
--       Idempotent: called twice for the same (order, coupon, user) it reports success without a
--       second row, so a retry after a timeout cannot double-count.
--
--   `release_coupon_usage_for_order(p_order_id)`
--       Deletes the order's usage rows and decrements each affected coupon by exactly the number
--       of rows removed, floored at zero. Idempotent by construction: a second call deletes
--       nothing, decrements nothing and returns 0. An order that never had a coupon is the same
--       no-op.
--
-- ORDER OF EVENTS. The service records AFTER the order row exists and never lets a failure here
-- undo it: an order is revenue, a missing `coupon_usage` row is a reconciliation chore. The
-- failure is logged with the order id and the code so it can be replayed by hand.
--
-- LOCK ORDERING. `record_...` calls `release_...` while already holding the new coupon's row lock,
-- so an admin swapping A→B at the same instant as another admin swaps B→A on a different order
-- can deadlock. Postgres detects it and aborts one side; the service logs the refusal and the
-- order survives. Not worth a global ordering for two hand-driven edits.
--
-- PRIVILEGES. Both are SECURITY DEFINER with a pinned `search_path` (they run as the owner,
-- `supabase_admin`, and must not resolve `coupons` through a caller-supplied schema). EXECUTE is
-- revoked from PUBLIC and from `anon`/`authenticated` and granted to `service_role` alone — the
-- dashboard reaches them through `supabaseAdmin`. `hermes_ro` gains NOTHING: it is a read-only
-- role and these functions write. Per the 0004–0012 convention: do not add a privilege statement
-- here without an ADR-D8 allowlist change and a matching update to
-- `hermes-mhans/scripts/assert-least-privilege.sh`.
--
-- Idempotent: `CREATE OR REPLACE FUNCTION`; REVOKE/GRANT are no-ops when already applied.
--

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

-- =========================================================================
-- ROLE GUARD (prod-parity audit, 2026-08-19). Runs FIRST, inside the transaction. See 0002/0004/
-- 0006–0012 for the full rationale: production's `public` objects are owned by `supabase_admin`,
-- and `postgres` there is neither superuser nor a member of that role. Run as `postgres`, REVOKE
-- reports success and revokes nothing; this guard turns that into an error.
--
-- Apply with:  psql -U supabase_admin -v ON_ERROR_STOP=1 -f <this file>
-- =========================================================================
DO $role_guard$
BEGIN
  IF NOT pg_has_role(current_user, 'supabase_admin', 'USAGE') THEN
    RAISE EXCEPTION
      'Esta migracion debe ejecutarse como supabase_admin (rol actual: %). Los objetos de public '
      'pertenecen a supabase_admin: como postgres, REVOKE informa exito y no revoca nada.',
      current_user
      USING HINT = 'psql -U supabase_admin -v ON_ERROR_STOP=1 -f <archivo>';
  END IF;
END
$role_guard$;

-- =========================================================================
-- RELEASE. Defined first because `record_...` calls it. plpgsql resolves the call at execution
-- time, so the order is for the reader, not for the parser.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.release_coupon_usage_for_order(p_order_id integer)
RETURNS TABLE(released integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $release$
DECLARE
    v_released integer := 0;
BEGIN
    IF p_order_id IS NULL THEN
        RETURN QUERY SELECT 0;
        RETURN;
    END IF;

    -- One statement: the delete, the per-coupon tally and the decrement cannot drift apart, and a
    -- concurrent release of the same order removes the rows exactly once between them.
    WITH removed AS (
        DELETE FROM public.coupon_usage
         WHERE order_id = p_order_id
        RETURNING coupon_id
    ), per_coupon AS (
        SELECT coupon_id, count(*)::integer AS uses
          FROM removed
         GROUP BY coupon_id
    ), bumped AS (
        UPDATE public.coupons c
           SET usage_count = GREATEST( COALESCE(c.usage_count, 0) - pc.uses, 0 ),
               date_modified = NOW()
          FROM per_coupon pc
         WHERE c.id = pc.coupon_id
        RETURNING pc.uses AS uses
    )
    SELECT COALESCE(sum(uses), 0)::integer INTO v_released FROM bumped;

    RETURN QUERY SELECT v_released;
END;
$release$;

COMMENT ON FUNCTION public.release_coupon_usage_for_order(integer) IS
    'Libera el uso de cupon registrado para una orden (cancelacion o edicion que quita el cupon): '
    'borra sus filas de coupon_usage y descuenta usage_count, nunca bajo cero. Idempotente: una '
    'segunda llamada devuelve 0.';

-- =========================================================================
-- RECORD. The lock is the point. See the header.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.record_coupon_usage_for_order(
    p_order_id integer,
    p_coupon_code character varying,
    p_user_id integer,
    p_discount_amount numeric
)
RETURNS TABLE(success boolean, message text, usage_id integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $record$
DECLARE
    v_coupon      public.coupons%ROWTYPE;
    v_existing_id integer;
    v_total_uses  integer;
    v_user_uses   integer;
    v_new_id      integer;
BEGIN
    IF p_order_id IS NULL OR p_coupon_code IS NULL OR p_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Datos insuficientes para registrar el uso del cupon'::TEXT, NULL::INTEGER;
        RETURN;
    END IF;

    -- Serialises every recording of THIS coupon. Without it two orders created in the same
    -- instant both read usage_count = 0 and a one-use coupon is spent twice.
    SELECT * INTO v_coupon FROM public.coupons WHERE code = p_coupon_code FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Cupon no encontrado'::TEXT, NULL::INTEGER;
        RETURN;
    END IF;

    IF v_coupon.status <> 'publish' THEN
        RETURN QUERY SELECT FALSE, 'Cupon no disponible'::TEXT, NULL::INTEGER;
        RETURN;
    END IF;

    -- Already recorded for this exact (order, coupon, user): a retry, not a second use.
    SELECT id INTO v_existing_id
      FROM public.coupon_usage
     WHERE order_id = p_order_id AND coupon_id = v_coupon.id AND user_id = p_user_id;

    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'El uso del cupon ya estaba registrado'::TEXT, v_existing_id;
        RETURN;
    END IF;

    -- The order carried a different coupon (or a different customer) before this edit. Dropping
    -- it here, inside the same transaction, is what makes a swap leave exactly one row.
    PERFORM public.release_coupon_usage_for_order(p_order_id);

    IF v_coupon.usage_limit IS NOT NULL THEN
        SELECT count(*)::integer INTO v_total_uses
          FROM public.coupon_usage WHERE coupon_id = v_coupon.id;

        IF v_total_uses >= v_coupon.usage_limit THEN
            RETURN QUERY SELECT FALSE, 'Este cupon ha alcanzado su limite de uso'::TEXT, NULL::INTEGER;
            RETURN;
        END IF;
    END IF;

    IF v_coupon.usage_limit_per_user IS NOT NULL THEN
        SELECT count(*)::integer INTO v_user_uses
          FROM public.coupon_usage WHERE coupon_id = v_coupon.id AND user_id = p_user_id;

        IF v_user_uses >= v_coupon.usage_limit_per_user THEN
            RETURN QUERY SELECT FALSE, 'Ya has utilizado este cupon anteriormente'::TEXT, NULL::INTEGER;
            RETURN;
        END IF;
    END IF;

    INSERT INTO public.coupon_usage (coupon_id, user_id, order_id, discount_amount)
    VALUES (v_coupon.id, p_user_id, p_order_id, COALESCE(p_discount_amount, 0))
    RETURNING id INTO v_new_id;

    UPDATE public.coupons
       SET usage_count = COALESCE(usage_count, 0) + 1,
           date_modified = NOW()
     WHERE id = v_coupon.id;

    RETURN QUERY SELECT TRUE, 'Uso del cupon registrado'::TEXT, v_new_id;

EXCEPTION WHEN unique_violation THEN
    -- The UNIQUE (coupon_id, user_id, order_id) fired anyway: a concurrent recording of the same
    -- order won the race. Reported, not raised — the order must survive either way.
    RETURN QUERY SELECT FALSE, 'Este cupon ya fue usado en esta orden'::TEXT, NULL::INTEGER;
END;
$record$;

COMMENT ON FUNCTION public.record_coupon_usage_for_order(integer, character varying, integer, numeric) IS
    'Registra el uso de un cupon por una orden bajo bloqueo de la fila del cupon: valida '
    'usage_limit y usage_limit_per_user, libera lo que la orden tuviera registrado antes, inserta '
    'en coupon_usage e incrementa usage_count. Idempotente para la misma (orden, cupon, usuario).';

-- =========================================================================
-- PRIVILEGES. service_role executes; nobody else.
-- =========================================================================
REVOKE ALL ON FUNCTION public.release_coupon_usage_for_order(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_coupon_usage_for_order(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_coupon_usage_for_order(integer) TO service_role;

REVOKE ALL ON FUNCTION public.record_coupon_usage_for_order(integer, character varying, integer, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_coupon_usage_for_order(integer, character varying, integer, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_coupon_usage_for_order(integer, character varying, integer, numeric) TO service_role;

COMMIT;

-- =========================================================================
-- Post-apply assertions.
--
--   -- A one-use coupon admits exactly one order:
--   SELECT * FROM public.record_coupon_usage_for_order(9001, 'UNICO', 42, 1000);  -- success
--   SELECT * FROM public.record_coupon_usage_for_order(9002, 'UNICO', 43, 1000);  -- limite de uso
--
--   -- Releasing is idempotent:
--   SELECT * FROM public.release_coupon_usage_for_order(9001);  -- released = 1
--   SELECT * FROM public.release_coupon_usage_for_order(9001);  -- released = 0
--
-- Privilege posture (must match the ADR-D8 allowlist):
--
--   SELECT has_function_privilege('anon',
--            'public.record_coupon_usage_for_order(integer,character varying,integer,numeric)',
--            'EXECUTE') AS anon_exec,        -- false
--          has_function_privilege('hermes_ro',
--            'public.release_coupon_usage_for_order(integer)', 'EXECUTE') AS ro_exec, -- false
--          has_function_privilege('service_role',
--            'public.release_coupon_usage_for_order(integer)', 'EXECUTE') AS sr_exec; -- true
--
-- PostgREST caches the schema; reload it so the RPCs are reachable through the API:
--
--   NOTIFY pgrst, 'reload schema';
-- =========================================================================
