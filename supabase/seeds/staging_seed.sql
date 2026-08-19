-- =====================================================================================
--  staging_seed.sql — SYNTHETIC representative data for the STAGING database ONLY
-- =====================================================================================
--
--  ############################  DO NOT RUN AGAINST PRODUCTION  ######################
--
--  This file is NOT part of the migration chain. It has no numeric prefix, it lives in
--  `supabase/seeds/` (not `supabase/migrations/`), and `lint-chain.sh` never sees it —
--  that script globs `*.sql` in its own directory only. Nothing should ever apply this
--  file as a migration.
--
--  It writes rows. Running it against production would inject fake customers, fake
--  orders and fake coupons into live business data. A runtime guard below aborts the
--  transaction if it detects a database holding real data, but the guard is a safety
--  net, not permission to be careless.
--
--  PRIVACY: every value here is fabricated. No production row was copied. Production
--  was read read-only to learn the SHAPE of the data (status distribution, line_items
--  key set, num_jornadas and total ranges, table cardinalities) and nothing else.
--  Emails are all on the unroutable `sink.invalid` domain. RUTs are syntactically valid
--  Chilean RUTs (correct modulo-11 check digit) over deliberately fake number ranges.
--  This matters beyond tidiness: Ley 21.719 takes effect 2026-12-01 and staging carries
--  weaker isolation and separate secrets than production.
--
--  WHY THIS EXISTS: every rehearsal before this seed ran against a schema-only staging
--  database. A read that returns 0 rows because the caller lacks privilege and a read
--  that returns 0 rows because a policy's USING clause is wrong are indistinguishable
--  when the table is empty. Those green-looking rehearsals proved PERMISSION, never ROW
--  VISIBILITY. The data below is shaped specifically around the discriminations the
--  policies make:
--    * multiple customers, so "A must not see B's order" is a real assertion
--    * an order owned by a profile with no loggable session (orphan-ish case)
--    * order_communications threads on two different customers' orders
--    * coupons in BOTH `publish` and `draft` (0001's surviving policy filters to
--      publish only — this is how the Hermes "Cupón no encontrado" defect manifests)
--    * shipping_methods with enabled true AND false
--
--  IDEMPOTENT: safe to re-run. Every insert is keyed on a natural unique column
--  (auth.users.id, user_profiles.auth_uid, orders.order_key, products.slug,
--  categories.slug, coupons.code) or guarded by NOT EXISTS where no unique key exists
--  (shipping_methods, order_communications).
--
--  Usage — do NOT add `--single-transaction`; this file wraps itself in BEGIN/COMMIT and
--  the extra flag only produces a "there is already a transaction in progress" warning:
--    docker exec -i supabase-stg-db psql -U supabase_admin -d postgres \
--      -v ON_ERROR_STOP=1 -f - < staging_seed.sql
--
--  Seeded login password for the four loggable customers: StagingSeed!2026
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- GUARD: refuse to run on a database that looks like production.
-- Any profile whose email is not on the sink domain means real (or at least non-seed)
-- customer data is present. That is the signature of production, and of any staging
-- database that was refreshed by copying production — which this project forbids.
-- -------------------------------------------------------------------------------------
DO $guard$
DECLARE
    real_profiles bigint;
    real_logins   bigint;
BEGIN
    SELECT count(*) INTO real_profiles
    FROM public.user_profiles
    WHERE email IS NULL OR email NOT LIKE '%@sink.invalid';

    IF real_profiles > 0 THEN
        RAISE EXCEPTION
            'staging_seed.sql REFUSED: % user_profiles row(s) carry non-sink emails. '
            'This database holds real customer data — it is production or a production '
            'copy. This seed writes fabricated rows and must never touch it.', real_profiles;
    END IF;

    -- The profile check alone is not enough once admins are seeded: staff accounts exist
    -- in auth.users with no user_profiles row, so a production database whose customers
    -- had somehow been cleared would still slip past the check above while holding real
    -- admin identities.
    SELECT count(*) INTO real_logins
    FROM auth.users
    WHERE email IS NULL OR email NOT LIKE '%@sink.invalid';

    IF real_logins > 0 THEN
        RAISE EXCEPTION
            'staging_seed.sql REFUSED: % auth.users row(s) carry non-sink emails. '
            'This database holds real login identities — it is production or a production '
            'copy.', real_logins;
    END IF;

    RAISE NOTICE 'guard OK: no non-sink profiles or logins present, database looks like staging';
END
$guard$;

-- -------------------------------------------------------------------------------------
-- 1. AUTH USERS
--    Five identities. A–D get a bcrypt password so a real session JWT can be minted
--    through GoTrue's password grant. E deliberately gets NO password: it exists so an
--    order can be owned by a profile that no session can ever authenticate as — the
--    "orphan-ish" case that makes a policy's ownership join falsifiable.
--    Inserting here fires `on_auth_user_created`; the profile UPSERT in step 2 then
--    fills in the synthetic detail the trigger cannot know.
-- -------------------------------------------------------------------------------------
--    GOTCHA — the token columns MUST be '' and not NULL. GoTrue scans
--    confirmation_token / recovery_token / email_change* / phone_change* /
--    reauthentication_token into non-pointer Go strings, so a NULL makes every
--    password grant fail with HTTP 500 `Database error querying schema` — an error that
--    says nothing about the real cause. Rows GoTrue creates itself carry '' in all of
--    them; rows inserted by hand must match that or they are unusable for login.
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
SELECT
    v.id::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    v.email,
    CASE WHEN v.loggable
         THEN extensions.crypt('StagingSeed!2026', extensions.gen_salt('bf'))
         ELSE NULL
    END,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', v.nombre, 'apellido', v.apellido),
    '', '', '', '', '', '', '', ''
FROM (VALUES
    ('aaaaaaaa-0000-4000-8000-000000000001', 'seed-a@sink.invalid', 'Alba',   'Riquelme', true),
    ('aaaaaaaa-0000-4000-8000-000000000002', 'seed-b@sink.invalid', 'Bruno',  'Tapia',    true),
    ('aaaaaaaa-0000-4000-8000-000000000003', 'seed-c@sink.invalid', 'Carola', 'Nunez',    true),
    ('aaaaaaaa-0000-4000-8000-000000000004', 'seed-d@sink.invalid', 'Damian', 'Ossa',     true),
    ('aaaaaaaa-0000-4000-8000-000000000005', 'seed-e@sink.invalid', 'Elena',  'Pizarro',  false)
) AS v(id, email, nombre, apellido, loggable)
ON CONFLICT (id) DO UPDATE SET
    -- Self-heal: repair NULL token columns on rows a previous run inserted, without
    -- rotating the password hash (which would change on every re-run and break nothing
    -- visibly, but would make the seed non-deterministic).
    confirmation_token         = COALESCE(auth.users.confirmation_token, ''),
    recovery_token             = COALESCE(auth.users.recovery_token, ''),
    email_change               = COALESCE(auth.users.email_change, ''),
    email_change_token_new     = COALESCE(auth.users.email_change_token_new, ''),
    email_change_token_current = COALESCE(auth.users.email_change_token_current, ''),
    phone_change               = COALESCE(auth.users.phone_change, ''),
    phone_change_token         = COALESCE(auth.users.phone_change_token, ''),
    reauthentication_token     = COALESCE(auth.users.reauthentication_token, ''),
    encrypted_password         = COALESCE(auth.users.encrypted_password, EXCLUDED.encrypted_password);

-- -------------------------------------------------------------------------------------
-- 2. USER PROFILES
--    Fabricated RUTs, all with a correct modulo-11 check digit. Mix of natural persons
--    and one empresa (production runs ~25% empresa). D has no signed contract, so the
--    "no contract, no order" business rule has a negative fixture too.
-- -------------------------------------------------------------------------------------
INSERT INTO public.user_profiles (
    auth_uid, email, nombre, apellido, usuario, rut, telefono,
    direccion, ciudad, pais, tipo_cliente,
    empresa_nombre, empresa_rut, empresa_ciudad, empresa_direccion,
    terminos_aceptados, url_user_contrato, url_firma
)
SELECT
    v.auth_uid::uuid, v.email, v.nombre, v.apellido, v.usuario, v.rut, v.telefono,
    v.direccion, v.ciudad, 'Chile', v.tipo_cliente,
    v.empresa_nombre, v.empresa_rut, v.empresa_ciudad, v.empresa_direccion,
    true, v.contrato, v.firma
FROM (VALUES
    ('aaaaaaaa-0000-4000-8000-000000000001', 'seed-a@sink.invalid', 'Alba', 'Riquelme', 'seed-alba',
     '11.111.111-K', '+56900000101', 'Av. Ficticia 100', 'Santiago', 'natural',
     NULL, NULL, NULL, NULL,
     'https://staging.invalid/contracts/seed-a.pdf', 'https://staging.invalid/sig/seed-a.png'),
    ('aaaaaaaa-0000-4000-8000-000000000002', 'seed-b@sink.invalid', 'Bruno', 'Tapia', 'seed-bruno',
     '22.222.222-9', '+56900000102', 'Pasaje Inventado 250', 'Valparaiso', 'natural',
     NULL, NULL, NULL, NULL,
     'https://staging.invalid/contracts/seed-b.pdf', 'https://staging.invalid/sig/seed-b.png'),
    ('aaaaaaaa-0000-4000-8000-000000000003', 'seed-c@sink.invalid', 'Carola', 'Nunez', 'seed-carola',
     '15.333.444-1', '+56900000103', 'Camino Falso 1300', 'Santiago', 'empresa',
     'Productora Sintetica SpA', '77.123.456-6', 'Santiago', 'Camino Falso 1300',
     'https://staging.invalid/contracts/seed-c.pdf', 'https://staging.invalid/sig/seed-c.png'),
    ('aaaaaaaa-0000-4000-8000-000000000004', 'seed-d@sink.invalid', 'Damian', 'Ossa', 'seed-damian',
     '9.876.543-5', '+56900000104', 'Calle Imaginaria 42', 'Concepcion', 'natural',
     NULL, NULL, NULL, NULL,
     NULL, NULL),
    ('aaaaaaaa-0000-4000-8000-000000000005', 'seed-e@sink.invalid', 'Elena', 'Pizarro', 'seed-elena',
     '18.222.333-8', '+56900000105', 'Ruta Nula 7', 'La Serena', 'natural',
     NULL, NULL, NULL, NULL,
     'https://staging.invalid/contracts/seed-e.pdf', NULL)
) AS v(auth_uid, email, nombre, apellido, usuario, rut, telefono,
       direccion, ciudad, tipo_cliente,
       empresa_nombre, empresa_rut, empresa_ciudad, empresa_direccion, contrato, firma)
ON CONFLICT (auth_uid) DO UPDATE SET
    email             = EXCLUDED.email,
    nombre            = EXCLUDED.nombre,
    apellido          = EXCLUDED.apellido,
    usuario           = EXCLUDED.usuario,
    rut               = EXCLUDED.rut,
    telefono          = EXCLUDED.telefono,
    direccion         = EXCLUDED.direccion,
    ciudad            = EXCLUDED.ciudad,
    pais              = EXCLUDED.pais,
    tipo_cliente      = EXCLUDED.tipo_cliente,
    empresa_nombre    = EXCLUDED.empresa_nombre,
    empresa_rut       = EXCLUDED.empresa_rut,
    empresa_ciudad    = EXCLUDED.empresa_ciudad,
    empresa_direccion = EXCLUDED.empresa_direccion,
    terminos_aceptados= EXCLUDED.terminos_aceptados,
    url_user_contrato = EXCLUDED.url_user_contrato,
    url_firma         = EXCLUDED.url_firma;

-- -------------------------------------------------------------------------------------
-- 3. CATEGORIES — six top-level, fabricated names in the rental's real domain vocabulary.
-- -------------------------------------------------------------------------------------
INSERT INTO public.categories (name, slug, description)
VALUES
    ('Camaras Staging',      'stg-camaras',      'Synthetic category — staging only'),
    ('Iluminacion Staging',  'stg-iluminacion',  'Synthetic category — staging only'),
    ('Opticas Staging',      'stg-opticas',      'Synthetic category — staging only'),
    ('Soportes Staging',     'stg-soportes',     'Synthetic category — staging only'),
    ('Audio Staging',        'stg-audio',        'Synthetic category — staging only'),
    ('Accesorios Staging',   'stg-accesorios',   'Synthetic category — staging only')
ON CONFLICT (slug) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 4. PRODUCTS — 30 fabricated items. Names are invented; the real catalogue is NOT
--    copied. Status mix includes a few non-published rows so "published only" filters
--    are falsifiable.
-- -------------------------------------------------------------------------------------
INSERT INTO public.products (name, slug, type, status, sku, price, regular_price,
                             stock_status, description, short_description, categories_name)
SELECT v.name, v.slug, 'simple', v.status, v.sku, v.price, v.price,
       v.stock, 'Synthetic staging product. Not a real catalogue item.',
       'Synthetic staging product.', v.cat
FROM (VALUES
    ('STG Cuerpo Mirrorless A1',   'stg-cuerpo-mirrorless-a1',   'publish', 'STG-C01',  95000, 'instock',      'Camaras Staging'),
    ('STG Cuerpo Mirrorless A2',   'stg-cuerpo-mirrorless-a2',   'publish', 'STG-C02',  85000, 'instock',      'Camaras Staging'),
    ('STG Cuerpo Reflex B1',       'stg-cuerpo-reflex-b1',       'publish', 'STG-C03',  60000, 'instock',      'Camaras Staging'),
    ('STG Cuerpo Cine C1',         'stg-cuerpo-cine-c1',         'publish', 'STG-C04', 180000, 'instock',      'Camaras Staging'),
    ('STG Cuerpo Compacta D1',     'stg-cuerpo-compacta-d1',     'draft',   'STG-C05',  35000, 'outofstock',   'Camaras Staging'),
    ('STG Flash Estudio 500W',     'stg-flash-estudio-500w',     'publish', 'STG-L01',  45000, 'instock',      'Iluminacion Staging'),
    ('STG Flash Estudio 1000W',    'stg-flash-estudio-1000w',    'publish', 'STG-L02',  55000, 'instock',      'Iluminacion Staging'),
    ('STG Panel LED Bicolor',      'stg-panel-led-bicolor',      'publish', 'STG-L03',  28000, 'instock',      'Iluminacion Staging'),
    ('STG Panel LED RGB',          'stg-panel-led-rgb',          'publish', 'STG-L04',  32000, 'instock',      'Iluminacion Staging'),
    ('STG Softbox Octa 120',       'stg-softbox-octa-120',       'publish', 'STG-L05',  18000, 'instock',      'Iluminacion Staging'),
    ('STG Softbox Strip 30x140',   'stg-softbox-strip-30x140',   'publish', 'STG-L06',  16000, 'instock',      'Iluminacion Staging'),
    ('STG Beauty Dish 70',         'stg-beauty-dish-70',         'publish', 'STG-L07',  20000, 'instock',      'Iluminacion Staging'),
    ('STG Generador Portatil',     'stg-generador-portatil',     'publish', 'STG-L08',  70000, 'onbackorder',  'Iluminacion Staging'),
    ('STG Optica 24mm f1.4',       'stg-optica-24mm-f14',        'publish', 'STG-O01',  38000, 'instock',      'Opticas Staging'),
    ('STG Optica 35mm f1.4',       'stg-optica-35mm-f14',        'publish', 'STG-O02',  38000, 'instock',      'Opticas Staging'),
    ('STG Optica 50mm f1.2',       'stg-optica-50mm-f12',        'publish', 'STG-O03',  42000, 'instock',      'Opticas Staging'),
    ('STG Optica 85mm f1.4',       'stg-optica-85mm-f14',        'publish', 'STG-O04',  40000, 'instock',      'Opticas Staging'),
    ('STG Zoom 24-70 f2.8',        'stg-zoom-24-70-f28',         'publish', 'STG-O05',  45000, 'instock',      'Opticas Staging'),
    ('STG Zoom 70-200 f2.8',       'stg-zoom-70-200-f28',        'publish', 'STG-O06',  48000, 'instock',      'Opticas Staging'),
    ('STG Macro 100mm',            'stg-macro-100mm',            'draft',   'STG-O07',  30000, 'outofstock',   'Opticas Staging'),
    ('STG Tripode Carbono',        'stg-tripode-carbono',        'publish', 'STG-S01',  15000, 'instock',      'Soportes Staging'),
    ('STG Tripode Video Fluido',   'stg-tripode-video-fluido',   'publish', 'STG-S02',  22000, 'instock',      'Soportes Staging'),
    ('STG C-Stand Pesado',         'stg-c-stand-pesado',         'publish', 'STG-S03',   8000, 'instock',      'Soportes Staging'),
    ('STG Brazo Magico 50cm',      'stg-brazo-magico-50cm',      'publish', 'STG-S04',   6000, 'instock',      'Soportes Staging'),
    ('STG Slider 100cm',           'stg-slider-100cm',           'publish', 'STG-S05',  25000, 'instock',      'Soportes Staging'),
    ('STG Grabadora Campo 4ch',    'stg-grabadora-campo-4ch',    'publish', 'STG-A01',  30000, 'instock',      'Audio Staging'),
    ('STG Microfono Shotgun',      'stg-microfono-shotgun',      'publish', 'STG-A02',  20000, 'instock',      'Audio Staging'),
    ('STG Lavalier Inalambrico',   'stg-lavalier-inalambrico',   'publish', 'STG-A03',  24000, 'instock',      'Audio Staging'),
    ('STG Maleta Rigida 60L',      'stg-maleta-rigida-60l',      'publish', 'STG-X01',   9000, 'instock',      'Accesorios Staging'),
    ('STG Bateria Extra',          'stg-bateria-extra',          'publish', 'STG-X02',   5000, 'instock',      'Accesorios Staging')
) AS v(name, slug, status, sku, price, stock, cat)
ON CONFLICT (slug) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 5. ORDERS — 24 orders across the five customers.
--    Status mix mirrors production's SHAPE (completed dominant ~88%, then cancelled,
--    failed, on-hold, processing) without copying a single production value:
--      completed 18 | cancelled 2 | failed 2 | on-hold 1 | processing 1
--    Order `stg-ord-orphan-01` belongs to seed-e, whose auth user has no password, so
--    no session can ever be minted for its owner.
--    line_items mirrors production's key set: product_id, name, sku, quantity, price,
--    subtotal, total. num_jornadas stays in production's observed 1-7 band.
-- -------------------------------------------------------------------------------------
INSERT INTO public.orders (
    order_key, status, customer_id,
    billing_first_name, billing_last_name, billing_company,
    billing_address_1, billing_city, billing_email, billing_phone,
    order_proyecto, order_fecha_inicio, order_fecha_termino, num_jornadas, company_rut,
    line_items, calculated_subtotal, calculated_discount, calculated_iva, calculated_total,
    currency, pago_reserva, date_created
)
SELECT
    v.order_key, v.status, p.user_id,
    p.nombre, p.apellido, p.empresa_nombre,
    p.direccion, p.ciudad, p.email, p.telefono,
    v.proyecto,
    (CURRENT_DATE + v.start_offset)::date,
    (CURRENT_DATE + v.start_offset + v.jornadas - 1)::date,
    v.jornadas,
    COALESCE(p.empresa_rut, p.rut),
    jsonb_build_array(jsonb_build_object(
        'product_id', pr.id, 'name', pr.name, 'sku', pr.sku,
        'quantity', v.qty, 'price', pr.price,
        'subtotal', pr.price * v.qty * v.jornadas,
        'total',    pr.price * v.qty * v.jornadas)),
    (pr.price * v.qty * v.jornadas),
    0,
    round((pr.price * v.qty * v.jornadas) * 0.19),
    (pr.price * v.qty * v.jornadas) + round((pr.price * v.qty * v.jornadas) * 0.19),
    'CLP', v.reserva, now() + (v.start_offset || ' days')::interval
FROM (VALUES
    ('stg-ord-a-01', 'completed',  'seed-a@sink.invalid', 'Editorial otonio',        -40, 2, 1, true),
    ('stg-ord-a-02', 'completed',  'seed-a@sink.invalid', 'Retratos estudio',        -33, 1, 2, true),
    ('stg-ord-a-03', 'completed',  'seed-a@sink.invalid', 'Campania calzado',        -26, 3, 1, true),
    ('stg-ord-a-04', 'completed',  'seed-a@sink.invalid', 'Lookbook primavera',      -19, 2, 2, true),
    ('stg-ord-a-05', 'cancelled',  'seed-a@sink.invalid', 'Shooting suspendido',     -12, 1, 1, false),
    ('stg-ord-a-06', 'on-hold',    'seed-a@sink.invalid', 'Cotizacion pendiente',      5, 2, 1, false),
    ('stg-ord-b-01', 'completed',  'seed-b@sink.invalid', 'Documental costa',        -45, 5, 1, true),
    ('stg-ord-b-02', 'completed',  'seed-b@sink.invalid', 'Entrevistas corporativas',-38, 2, 2, true),
    ('stg-ord-b-03', 'completed',  'seed-b@sink.invalid', 'Videoclip banda',         -30, 3, 1, true),
    ('stg-ord-b-04', 'completed',  'seed-b@sink.invalid', 'Registro evento',         -22, 1, 3, true),
    ('stg-ord-b-05', 'failed',     'seed-b@sink.invalid', 'Pago no confirmado',      -15, 2, 1, false),
    ('stg-ord-b-06', 'processing', 'seed-b@sink.invalid', 'Produccion en curso',       2, 3, 2, true),
    ('stg-ord-c-01', 'completed',  'seed-c@sink.invalid', 'Catalogo temporada',      -50, 7, 2, true),
    ('stg-ord-c-02', 'completed',  'seed-c@sink.invalid', 'Spot publicitario',       -42, 4, 3, true),
    ('stg-ord-c-03', 'completed',  'seed-c@sink.invalid', 'Fotografia producto',     -35, 2, 4, true),
    ('stg-ord-c-04', 'completed',  'seed-c@sink.invalid', 'Making of',               -28, 1, 1, true),
    ('stg-ord-c-05', 'completed',  'seed-c@sink.invalid', 'Contenido redes',         -20, 2, 2, true),
    ('stg-ord-c-06', 'cancelled',  'seed-c@sink.invalid', 'Cliente reagenda',        -10, 3, 1, false),
    ('stg-ord-d-01', 'completed',  'seed-d@sink.invalid', 'Matrimonio playa',        -44, 2, 1, true),
    ('stg-ord-d-02', 'completed',  'seed-d@sink.invalid', 'Sesion familiar',         -31, 1, 1, true),
    ('stg-ord-d-03', 'completed',  'seed-d@sink.invalid', 'Graduacion',              -18, 1, 2, true),
    ('stg-ord-d-04', 'failed',     'seed-d@sink.invalid', 'Sin contrato firmado',     -8, 2, 1, false),
    ('stg-ord-e-01', 'completed',  'seed-e@sink.invalid', 'Archivo patrimonial',     -55, 4, 1, true),
    ('stg-ord-orphan-01', 'completed', 'seed-e@sink.invalid', 'Orden sin sesion posible', -60, 3, 2, true)
) AS v(order_key, status, owner_email, proyecto, start_offset, jornadas, qty, reserva)
JOIN public.user_profiles p ON p.email = v.owner_email
CROSS JOIN LATERAL (
    -- deterministic product pick, so re-runs produce identical totals
    SELECT id, name, sku, price FROM public.products
    WHERE slug LIKE 'stg-%' AND status = 'publish'
    ORDER BY md5(v.order_key || slug) LIMIT 1
) pr
ON CONFLICT (order_key) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 6. ORDER COMMUNICATIONS — threads on TWO different customers' orders (A and B), so a
--    rehearsal can assert both halves: the owner sees their thread, a non-owner sees
--    nothing. A one-customer fixture would make the second half vacuous.
-- -------------------------------------------------------------------------------------
INSERT INTO public.order_communications (order_id, user_id, user_type, user_name, user_email,
                                         message, message_type, is_read)
SELECT o.id, v.user_id, v.user_type, v.user_name, v.user_email, v.message, 'text', v.is_read
FROM (VALUES
    ('stg-ord-a-01', 'seed-a', 'customer', 'Alba Riquelme', 'seed-a@sink.invalid',
     'Hola, consulta por el horario de retiro del equipo.', false),
    ('stg-ord-a-01', 'stg-admin', 'admin', 'Staging Admin', 'admin@sink.invalid',
     'Hola Alba, el retiro es el dia anterior entre 15:00 y 20:00.', true),
    ('stg-ord-a-01', 'seed-a', 'customer', 'Alba Riquelme', 'seed-a@sink.invalid',
     'Perfecto, paso a las 17:00. Gracias.', false),
    ('stg-ord-a-03', 'seed-a', 'customer', 'Alba Riquelme', 'seed-a@sink.invalid',
     'Necesito una bateria extra para esta produccion.', false),
    ('stg-ord-b-01', 'seed-b', 'customer', 'Bruno Tapia', 'seed-b@sink.invalid',
     'Se puede extender un dia mas el arriendo?', false),
    ('stg-ord-b-01', 'stg-admin', 'admin', 'Staging Admin', 'admin@sink.invalid',
     'Si, se cobra la jornada adicional. Confirmame y lo dejo agendado.', true),
    ('stg-ord-b-03', 'seed-b', 'customer', 'Bruno Tapia', 'seed-b@sink.invalid',
     'Adjunto la orden de compra de la productora.', false)
) AS v(order_key, user_id, user_type, user_name, user_email, message, is_read)
JOIN public.orders o ON o.order_key = v.order_key
WHERE NOT EXISTS (
    SELECT 1 FROM public.order_communications oc
    WHERE oc.order_id = o.id AND oc.message = v.message
);

-- -------------------------------------------------------------------------------------
-- 7. COUPONS — the `publish` vs `draft` split is load-bearing, not decoration.
--    0001's surviving read policy filters to status='publish'. A draft coupon that the
--    admin can see but Hermes cannot is exactly the shape of the "Cupón no encontrado"
--    defect, and it cannot be reproduced without a draft row present.
--    `trash` is included because the CHECK constraint allows it and nothing else tests it.
-- -------------------------------------------------------------------------------------
INSERT INTO public.coupons (code, amount, discount_type, description, status,
                            usage_count, usage_limit, minimum_amount, individual_use)
VALUES
    ('STGPUBLISH10', 10,    'percent',       'Synthetic published coupon — 10%',        'publish', 0, 100, 20000, false),
    ('STGPUBLISH5K', 5000,  'fixed_cart',    'Synthetic published coupon — 5.000 CLP',  'publish', 0,  50, 30000, false),
    ('STGDRAFT20',   20,    'percent',       'Synthetic DRAFT coupon — must be invisible to publish-only readers', 'draft', 0, 10, 0, false),
    ('STGDRAFTFIX',  15000, 'fixed_cart',    'Synthetic DRAFT coupon — fixed cart',     'draft',   0,  10, 50000, true),
    ('STGTRASHED',   50,    'percent',       'Synthetic trashed coupon',                'trash',   0,   1,     0, true),
    ('STGPRODUCT3K', 3000,  'fixed_product', 'Synthetic published coupon — per product','publish', 0,  25,     0, false)
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 8. SHIPPING METHODS — enabled true AND false, so an "enabled only" filter is testable.
--    No unique constraint on `name`, hence the NOT EXISTS guard.
-- -------------------------------------------------------------------------------------
INSERT INTO public.shipping_methods (name, description, cost, shipping_type, enabled,
                                     min_amount, estimated_days_min, estimated_days_max,
                                     requires_address, requires_phone)
SELECT v.name, v.description, v.cost, v.shipping_type, v.enabled,
       v.min_amount, v.dmin, v.dmax, v.req_addr, v.req_phone
FROM (VALUES
    -- `shipping_methods_days_valid` requires estimated_days_min > 0, so same-day methods
    -- are expressed as 1, not 0.
    ('STG Retiro en tienda',    'Retiro en Purisima (staging)',     0,     'local_pickup', true,  NULL, 1, 1, false, true),
    ('STG Despacho Santiago',   'Despacho dentro de Santiago',      12000, 'flat_rate',    true,  NULL, 1, 1, true,  true),
    ('STG Despacho regiones',   'Despacho a regiones',              25000, 'flat_rate',    false, NULL, 2, 4, true,  true),
    ('STG Envio gratis',        'Gratis sobre monto minimo',        0,     'free',         true,  200000, 1, 2, true, true),
    ('STG Express same-day',    'Express mismo dia (deshabilitado)',35000, 'express',      false, NULL, 1, 1, true,  true)
) AS v(name, description, cost, shipping_type, enabled, min_amount, dmin, dmax, req_addr, req_phone)
WHERE NOT EXISTS (
    SELECT 1 FROM public.shipping_methods sm WHERE sm.name = v.name
);

-- -------------------------------------------------------------------------------------
-- 9. ADMIN USERS — two staff accounts, deliberately WITHOUT a user_profiles row.
--
--    Why this shape. `user_profiles` carries "Admins can read all user_profiles" with
--      USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid()))
--    and that subquery is NOT security-definer: it runs as the caller, so it is itself
--    filtered by admin_users' own RLS ("Allow users to read own admin record",
--    USING (auth.uid() = user_id)). A genuine admin satisfies it through their own row;
--    a customer matches no row and the EXISTS collapses to false.
--
--    Giving the admins no profile makes the probe unambiguous. A customer sees exactly 1
--    profile (their own, via "Users can read own profile"); an admin sees all 5 customer
--    profiles, none of which is their own — so a non-zero admin count cannot be explained
--    by the self-read policy. Both roles are seeded because `admin_users.role` accepts
--    'admin' and 'super_admin' and nothing else exercises the distinction.
-- -------------------------------------------------------------------------------------
INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
SELECT v.id::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated', v.email,
    extensions.crypt('StagingSeed!2026', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', v.nombre),
    -- GoTrue scans these eight into non-pointer Go strings; NULL breaks the scan and the
    -- password grant fails with "Database error querying schema".
    '', '', '', '', '', '', '', ''
FROM (VALUES
    ('bbbbbbbb-0000-4000-8000-000000000001', 'seed-admin@sink.invalid',      'Admin Staging'),
    ('bbbbbbbb-0000-4000-8000-000000000002', 'seed-superadmin@sink.invalid', 'Super Admin Staging')
) AS v(id, email, nombre)
ON CONFLICT (id) DO UPDATE SET
    confirmation_token         = COALESCE(auth.users.confirmation_token, ''),
    recovery_token             = COALESCE(auth.users.recovery_token, ''),
    email_change               = COALESCE(auth.users.email_change, ''),
    email_change_token_new     = COALESCE(auth.users.email_change_token_new, ''),
    email_change_token_current = COALESCE(auth.users.email_change_token_current, ''),
    phone_change               = COALESCE(auth.users.phone_change, ''),
    phone_change_token         = COALESCE(auth.users.phone_change_token, ''),
    reauthentication_token     = COALESCE(auth.users.reauthentication_token, ''),
    encrypted_password         = COALESCE(auth.users.encrypted_password, EXCLUDED.encrypted_password);

INSERT INTO public.admin_users (user_id, email, role)
VALUES
    ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'seed-admin@sink.invalid',      'admin'),
    ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'seed-superadmin@sink.invalid', 'super_admin')
ON CONFLICT (user_id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 10. COUPON USAGE — rows for TWO different customers.
--
--     One customer's rows would leave the probe vacuous in a subtler way than an empty
--     table: a non-zero count proves nothing about the USING clause unless there are
--     other customers' rows it must exclude. `STGPUBLISH10` is deliberately used by both
--     customers, so filtering by coupon alone does not separate them — only `user_id`
--     does, which is precisely what the policy claims to enforce.
--
--     Orders are picked by position within each customer's own orders rather than by
--     literal id, so the block stays correct if the order block above is renumbered.
-- -------------------------------------------------------------------------------------
INSERT INTO public.coupon_usage (coupon_id, user_id, order_id, discount_amount, used_at)
SELECT c.id, v.user_id, o.id, v.discount, now() - make_interval(days => v.days_ago)
FROM (VALUES
    (1, 'STGPUBLISH10', 54000.00, 40, 1),
    (1, 'STGPUBLISH5K',  5000.00, 25, 2),
    (2, 'STGPUBLISH10', 32000.00, 18, 1),
    (2, 'STGPRODUCT3K',  3000.00,  9, 2)
) AS v(user_id, code, discount, days_ago, nth)
JOIN public.coupons c ON c.code = v.code
JOIN LATERAL (
    SELECT ord.id FROM public.orders ord
    WHERE ord.customer_id = v.user_id
    ORDER BY ord.id
    OFFSET v.nth - 1 LIMIT 1
) o ON true
ON CONFLICT (coupon_id, user_id, order_id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 11. SHIPPING USAGE — same two-customer reasoning. `order_id` is UNIQUE here, so each
--     row takes a distinct order. Statuses span four of the five the CHECK allows.
-- -------------------------------------------------------------------------------------
INSERT INTO public.shipping_usage (shipping_method_id, order_id, user_id, shipping_cost,
                                   shipping_address, status, tracking_number)
SELECT sm.id, o.id, v.user_id, sm.cost,
       jsonb_build_object('direccion', up.direccion, 'ciudad', up.ciudad, 'pais', 'Chile'),
       v.status, v.tracking
FROM (VALUES
    (1, 'STG Despacho Santiago', 'delivered', 'STG-TRK-0001', 1),
    (1, 'STG Retiro en tienda',  'pending',   NULL,           2),
    (2, 'STG Despacho Santiago', 'shipped',   'STG-TRK-0002', 1),
    (2, 'STG Despacho regiones', 'cancelled', NULL,           2)
) AS v(user_id, method_name, status, tracking, nth)
JOIN public.shipping_methods sm ON sm.name = v.method_name
JOIN public.user_profiles up ON up.user_id = v.user_id
JOIN LATERAL (
    SELECT ord.id FROM public.orders ord
    WHERE ord.customer_id = v.user_id
    ORDER BY ord.id
    OFFSET v.nth - 1 LIMIT 1
) o ON true
ON CONFLICT (order_id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- 12. Summary
-- -------------------------------------------------------------------------------------
DO $summary$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT 'user_profiles' AS t, count(*) AS n FROM public.user_profiles
        UNION ALL SELECT 'auth.users',           count(*) FROM auth.users
        UNION ALL SELECT 'orders',               count(*) FROM public.orders
        UNION ALL SELECT 'order_communications', count(*) FROM public.order_communications
        UNION ALL SELECT 'products',             count(*) FROM public.products
        UNION ALL SELECT 'categories',           count(*) FROM public.categories
        UNION ALL SELECT 'coupons',              count(*) FROM public.coupons
        UNION ALL SELECT 'shipping_methods',     count(*) FROM public.shipping_methods
        UNION ALL SELECT 'admin_users',          count(*) FROM public.admin_users
        UNION ALL SELECT 'coupon_usage',         count(*) FROM public.coupon_usage
        UNION ALL SELECT 'shipping_usage',       count(*) FROM public.shipping_usage
        ORDER BY 1
    LOOP
        RAISE NOTICE 'seed result: % = %', r.t, r.n;
    END LOOP;
END
$summary$;

COMMIT;
