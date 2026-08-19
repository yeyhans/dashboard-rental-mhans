-- =====================================================================================
--  Volume seed — brings staging's PERSONAL tables up to production row counts using
--  entirely synthetic identities.
--
--  Why volume matters. `staging_seed.sql` creates five hand-written customers, which is
--  enough to prove a policy accepts and rejects the right rows but not enough to prove
--  anything about the shapes production actually contains: 44 orders on one customer,
--  63-day rentals, 22-line carts, and the 18 profiles whose `tipo_cliente` is NULL.
--  Rehearsing 0001 against 29 orders and calling it verified repeats the mistake this
--  change has already made twice — a clean result on thin data proves only that the
--  statement parsed.
--
--  Why the identities are invented rather than copied. Production holds 148 real clients
--  with names, RUTs, phone numbers, addresses and signature URLs. Staging is a
--  lower-trust environment with a separate secret set, and Ley 21.719 takes effect
--  2026-12-01. Copying those rows would create a second place the data can leak from and
--  buy nothing: a migration is sensitive to row COUNT, NULL RATE and VALUE RANGE, all of
--  which are reproduced below from aggregate statistics that contain no personal data.
--
--  Distributions reproduced from production, 2026-08-19 (aggregates only):
--    user_profiles  148   natural 93 / empresa 37 / NULL 18
--                         contrato 107, firma 105, rut_anverso 104, terminos 113
--    orders         469   completed 410, cancelled 32, failed 21, on-hold 5, processing 1
--                         106 distinct customers, max 44 orders on one customer
--                         num_jornadas avg 1.4 max 63, line_items avg 3.4 max 22
--                         date_created 2025-03-15 .. 2026-08-19
--    order_communications 693   admin 682 / customer 11
--
--  Deterministic by construction: every value derives from the row index via md5(), so
--  two runs produce identical data and a re-run is a no-op rather than a duplicate.
--  No random() anywhere.
--
--  Usage (do NOT add --single-transaction; this file wraps itself):
--    docker exec -i supabase-stg-db psql -U supabase_admin -d postgres \
--      -v ON_ERROR_STOP=1 -f - < volume-seed.sql
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- GUARD — refuse to run against anything that looks like production.
-- Same rule as staging_seed.sql: a profile whose email is not on the sink domain means
-- non-seed customer data is present. This file INSERTs 469 orders; running it against
-- production would be unrecoverable without a restore.
-- -------------------------------------------------------------------------------------
DO $guard$
DECLARE
    real_profiles bigint;
BEGIN
    SELECT count(*) INTO real_profiles
    FROM public.user_profiles
    WHERE email IS NULL OR email NOT LIKE '%@sink.invalid';

    IF real_profiles > 0 THEN
        RAISE EXCEPTION
            'Abortado: % perfil(es) con email fuera de @sink.invalid. Esta base parece '
            'produccion o una copia de produccion, y este seed inserta 469 ordenes.',
            real_profiles
            USING HINT = 'Solo ejecutar contra staging con datos sinteticos.';
    END IF;
END
$guard$;

-- -------------------------------------------------------------------------------------
-- 1. auth.users — 141 bulk identities, which together with the 7 profiles staging_seed.sql
--    already created reach production's 148. None are loggable: `encrypted_password` is
--    NULL, so a password
--    grant fails closed. The eight token columns carry '' rather than NULL because
--    GoTrue scans them into non-pointer Go strings and a NULL makes every login on the
--    whole instance fail with an opaque 500 (see staging_seed.sql for the full note).
-- -------------------------------------------------------------------------------------
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
SELECT
    ('cccccccc-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'bulk-' || lpad(i::text, 3, '0') || '@sink.invalid',
    NULL,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('seed', 'volume'),
    '', '', '', '', '', '', '', ''
FROM generate_series(1, 141) AS i
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 2. user_profiles — shape the rows the auth insert already created.
--
--    This is an UPDATE, not an INSERT, and that is not a style choice. `auth.users` carries
--    an `on_auth_user_created` trigger (`handle_new_user`) that inserts a minimal
--    `user_profiles` row for every new auth user. An INSERT here therefore hits the
--    `auth_uid` unique constraint and reports `INSERT 0 0` — no error, no rows, and a seed
--    that looks like it ran. Observed on the first execution, 2026-08-19: 148 profiles
--    existed but 147 were `natural` and only 4 had a contract, none of the distributions
--    below applied. Same failure family as the rest of this change: a success line that
--    means nothing was written.
--
--    The NULL rates are the point of this block, not decoration. 41 of 148 production
--    profiles have no contract and 35 have not accepted terms; policies and the
--    `hasContract` gate in the order flow must be exercised against those rows, and a
--    seed where every profile is complete would pass a broken check.
--
--    `tipo_cliente` is NULL on 18 production rows even though the CHECK constraint only
--    admits 'natural' and 'empresa' — the constraint allows NULL. Reproduced deliberately.
--
--    Keyed on the `cccccccc-` auth_uid prefix, a namespace this file owns exclusively.
--    The first draft used `bbbbbbbb-`, which `staging_seed.sql` had already claimed for the
--    two admin accounts (`seed-admin@` and `seed-superadmin@`) — so the UPDATE rewrote both
--    admins into ordinary synthetic customers. Nothing failed; the damage only surfaced
--    when an RLS smoke picked one of them as a "customer" and it could read all 148
--    profiles, because it was still in `admin_users`. Hence the guard below: an id range is
--    not reserved just because this file assumed it was.
-- -------------------------------------------------------------------------------------
DO $admin_guard$
DECLARE
    clobbered bigint;
BEGIN
    SELECT count(*) INTO clobbered
    FROM public.user_profiles p
    JOIN public.admin_users a ON a.user_id = p.auth_uid
    WHERE p.auth_uid::text LIKE 'cccccccc-0000-4000-8000-%';

    IF clobbered > 0 THEN
        RAISE EXCEPTION
            'Abortado: % cuenta(s) admin caen en el rango cccccccc- de este seed. '
            'Sobrescribirlas convierte un admin en cliente sintetico sin ningun error visible.',
            clobbered
            USING HINT = 'Mover este seed a otro prefijo de uuid, o reasignar la cuenta admin.';
    END IF;
END
$admin_guard$;

WITH bulk AS (
    SELECT
        user_id,
        -- Trailing digits of the reserved uuid range are the generator index.
        substr(auth_uid::text, 25)::int AS i
    FROM public.user_profiles
    WHERE auth_uid::text LIKE 'cccccccc-0000-4000-8000-%'
)
UPDATE public.user_profiles p SET
    email        = 'bulk-' || lpad(b.i::text, 3, '0') || '@sink.invalid',
    nombre       = 'Cliente',
    apellido     = 'Sintetico ' || lpad(b.i::text, 3, '0'),
    usuario      = 'bulk' || lpad(b.i::text, 3, '0'),
    -- Structurally shaped like a Chilean RUT but from a reserved-looking range; the check
    -- digit is not computed, so nothing here can be mistaken for a real taxpayer id.
    rut          = '9' || lpad((10000000 + b.i)::text, 8, '0') || '-0',
    telefono     = '+5695550' || lpad(b.i::text, 4, '0'),
    direccion    = 'Calle Sintetica ' || b.i,
    ciudad       = 'Santiago',
    pais         = 'Chile',
    -- 90 natural / 36 empresa / 17 NULL over the 143 bulk rows; with the 5 pre-existing
    -- seed profiles this lands on production's 93 / 37 / 18 split.
    tipo_cliente = CASE
                       WHEN b.i <= 90  THEN 'natural'
                       WHEN b.i <= 126 THEN 'empresa'
                       ELSE NULL
                   END,
    empresa_nombre    = CASE WHEN b.i > 90 AND b.i <= 126 THEN 'Productora Sintetica ' || b.i END,
    empresa_rut       = CASE WHEN b.i > 90 AND b.i <= 126 THEN '7' || lpad((7000000 + b.i)::text, 8, '0') || '-0' END,
    empresa_ciudad    = CASE WHEN b.i > 90 AND b.i <= 126 THEN 'Santiago' END,
    empresa_direccion = CASE WHEN b.i > 90 AND b.i <= 126 THEN 'Av. Sintetica ' || b.i END,
    -- 104/148 carry rut_anverso in production, 105 firma, 107 contrato, 113 terminos.
    url_rut_anverso   = CASE WHEN b.i <= 103 THEN 'https://r2.invalid/staging/rut-anverso-' || b.i || '.jpg' END,
    url_rut_reverso   = CASE WHEN b.i <= 103 THEN 'https://r2.invalid/staging/rut-reverso-' || b.i || '.jpg' END,
    url_firma         = CASE WHEN b.i <= 104 THEN 'https://r2.invalid/staging/firma-' || b.i || '.png' END,
    url_user_contrato = CASE WHEN b.i <= 106 THEN 'https://r2.invalid/staging/contrato-' || b.i || '.pdf' END,
    terminos_aceptados = (b.i <= 112),
    created_at   = now() - ((520 - b.i) || ' days')::interval,
    updated_at   = now()
FROM bulk b
WHERE p.user_id = b.user_id;

-- -------------------------------------------------------------------------------------
-- 3. orders — 469 rows over 106 distinct customers.
--
--    Customer assignment is intentionally skewed, not round-robin: production has one
--    customer holding 44 orders, and an even spread would hide any per-customer policy
--    or index behaviour that only shows up on a heavy tail. `pick` below sends roughly
--    one order in ten to the same customer.
--
--    Status mix is positional so the counts are exact rather than approximate:
--    410 completed, 32 cancelled, 21 failed, 5 on-hold, 1 processing. Note these are the
--    five values production actually holds — `reviewing`, `preparing`, `delivering` and
--    `paid` appear in the workflow documentation but are rejected by the CHECK constraint.
-- -------------------------------------------------------------------------------------
WITH customers AS (
    SELECT user_id, row_number() OVER (ORDER BY user_id) - 1 AS n
    FROM public.user_profiles
    WHERE email LIKE '%@sink.invalid'
),
customer_count AS (SELECT count(*)::int AS c FROM customers),
gen AS (
    SELECT
        i,
        -- Deterministic pseudo-randomness: md5 of the index, read as an integer.
        ('x' || substr(md5('order-' || i), 1, 8))::bit(32)::bigint AS h
    FROM generate_series(1, 469) AS i
),
shaped AS (
    SELECT
        g.i,
        g.h,
        CASE
            WHEN g.h % 10 = 0 THEN 0                       -- heavy-tail customer
            ELSE (g.h % LEAST(106, cc.c))::int
        END AS pick,
        CASE
            WHEN g.i <= 410 THEN 'completed'
            WHEN g.i <= 442 THEN 'cancelled'
            WHEN g.i <= 463 THEN 'failed'
            WHEN g.i <= 468 THEN 'on-hold'
            ELSE 'processing'
        END AS status,
        -- avg 1.4, max 63: almost everything is a one-day rental, with a rare long shoot.
        CASE WHEN g.h % 97 = 0 THEN 63 WHEN g.h % 7 = 0 THEN 3 ELSE 1 END AS jornadas,
        -- avg 3.4 lines, max 22.
        CASE WHEN g.h % 89 = 0 THEN 22 ELSE 1 + (g.h % 6)::int END AS n_lines,
        ('2025-03-15'::date + ((g.h % 523))::int) AS start_date
    FROM gen g CROSS JOIN customer_count cc
)
INSERT INTO public.orders (
    order_key, status, currency, customer_id,
    billing_first_name, billing_last_name, billing_address_1, billing_city,
    billing_email, billing_phone, billing_company,
    order_proyecto, order_fecha_inicio, order_fecha_termino, num_jornadas, company_rut,
    line_items, calculated_subtotal, calculated_discount, calculated_iva, calculated_total,
    shipping_total, pago_reserva, date_created,
    fotos_garantia, orden_compra, numero_factura, new_pdf_on_hold_url
)
SELECT
    'stg-vol-' || lpad(s.i::text, 4, '0'),
    s.status,
    'CLP',
    c.user_id,
    'Cliente',
    'Sintetico ' || lpad(c.n::text, 3, '0'),
    'Calle Sintetica ' || s.i,
    'Santiago',
    'bulk-' || lpad(s.i::text, 3, '0') || '@sink.invalid',
    '+5695550' || lpad((s.i % 10000)::text, 4, '0'),
    NULL,
    'Produccion sintetica ' || s.i,
    s.start_date,
    s.start_date + (s.jornadas - 1),
    s.jornadas,
    '99000000-0',
    -- line_items mirrors the production jsonb shape and references REAL product ids, so a
    -- rehearsal that joins the catalogue through the jsonb resolves instead of finding nothing.
    (SELECT jsonb_agg(jsonb_build_object(
                'product_id', p.id,
                'name',       p.name,
                'quantity',   1 + (s.h % 3)::int,
                'price',      COALESCE(p.price, 10000),
                'dias',       s.jornadas))
     FROM (SELECT id, name, price FROM public.products
           ORDER BY id OFFSET (s.h % 140)::int LIMIT s.n_lines) p),
    (100000 * s.jornadas)::numeric,
    0::numeric,
    (100000 * s.jornadas * 0.19)::numeric,
    (100000 * s.jornadas * 1.19)::numeric,
    0::numeric,
    (s.h % 3 <> 0),
    (s.start_date - 7)::timestamptz,
    -- 344/469 carry warranty photos, 329 an orden_compra, 371 a factura, 425 a budget PDF.
    CASE WHEN s.i <= 344 THEN jsonb_build_array('https://r2.invalid/staging/garantia-' || s.i || '.webp') END,
    CASE WHEN s.i <= 329 THEN 'OC-SINT-' || lpad(s.i::text, 4, '0') END,
    CASE WHEN s.i <= 371 THEN 'F-' || lpad(s.i::text, 5, '0') END,
    CASE WHEN s.i <= 425 THEN 'https://r2.invalid/staging/presupuesto-' || s.i || '.pdf' END
FROM shaped s
JOIN customers c ON c.n = s.pick
ON CONFLICT (order_key) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 4. order_communications — 693 rows, 682 admin / 11 customer.
--    The lopsided split is production's: this table is mostly an internal admin log, and
--    a 50/50 seed would misrepresent what any read policy on it has to filter.
-- -------------------------------------------------------------------------------------
INSERT INTO public.order_communications (
    order_id, user_id, user_type, user_name, user_email, message, message_type, is_read, created_at
)
SELECT
    o.id,
    CASE WHEN g.i <= 11 THEN o.customer_id::text ELSE 'admin-sintetico' END,
    CASE WHEN g.i <= 11 THEN 'customer' ELSE 'admin' END,
    CASE WHEN g.i <= 11 THEN 'Cliente Sintetico' ELSE 'Admin Sintetico' END,
    CASE WHEN g.i <= 11 THEN 'bulk-comm@sink.invalid' ELSE 'admin@sink.invalid' END,
    'Mensaje sintetico ' || g.i || ' para la orden ' || o.id,
    'text',
    (g.i % 4 <> 0),
    o.date_created + interval '1 hour'
FROM generate_series(1, 693) AS g(i)
JOIN LATERAL (
    SELECT id, customer_id, date_created
    FROM public.orders
    WHERE order_key LIKE 'stg-vol-%'
    ORDER BY id
    OFFSET (g.i % GREATEST(1, (SELECT count(*) FROM public.orders WHERE order_key LIKE 'stg-vol-%')))
    LIMIT 1
) o ON true
WHERE NOT EXISTS (
    SELECT 1 FROM public.order_communications
    WHERE message = 'Mensaje sintetico ' || g.i || ' para la orden ' || o.id
);

COMMIT;

-- =====================================================================================
--  Post-seed assertion. Run separately; every line must report ok.
--
--  SELECT 'user_profiles', count(*), count(*) = 148 AS ok FROM public.user_profiles
--  UNION ALL SELECT 'orders', count(*), count(*) >= 469 FROM public.orders
--  UNION ALL SELECT 'order_communications', count(*), count(*) >= 693 FROM public.order_communications
--  UNION ALL SELECT 'non_sink_emails', count(*), count(*) = 0
--       FROM public.user_profiles WHERE email NOT LIKE '%@sink.invalid';
-- =====================================================================================
