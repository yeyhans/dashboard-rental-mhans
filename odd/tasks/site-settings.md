# site-settings — "Configuración del sitio" page with the legal representative's signature

Created: 2026-10-02. Branch: `consolidado-web-2027` (dashboard worktree). Engram mirror: `odd/site-settings/tasks`.

## Objective

One admin page where the business data that the site, the PDFs and the emails use lives and can be
edited by a `super_admin`: company, legal representative (with an uploadable signature image), bank
account, contact channels, pickup addresses, default reserve and policy copy. The PDF generators and
notification emails read these values instead of hardcoded constants.

## Evidence (mapper 2026-10-02)

- No settings table exists. Hardcoded values are spread across `src/lib/pdf/content/{budgetCopy,
contractCopy,annexCopy,contractClauses}.ts`, `components/common/CompanyInfo.tsx`, the legacy Astro
  PDF pages, `api/emails/send-*-notification.ts` (`rental.mariohans@gmail.com`), `src/layout/Base.astro`
  (WhatsApp 56990818976), `src/lib/finance.ts` (`RESERVE_RATE = 0.25`).
- Admin page pattern: `src/pages/operators.astro` + React island + `getServerAdmin`; sidebar in
  `src/lib/navigation.ts:48-75` (`roles: ['super_admin']`), icon map in `src/layout/Base.astro` ~:55,
  `src/lib/__tests__/navigation.test.ts` asserts the label lists.
- API pattern: `requireRole('super_admin')` (`src/middleware/auth.ts:141`), `{success,data}` envelope,
  static Service with `ensureSupabaseAdmin()`, tests under `__tests__` mocking `../../lib/supabase`.
- Upload pattern: `src/lib/documentUploadService.ts` → `POST ${PUBLIC_CLOUDFLARE_WORKER_URL}/upload-file-only`
  (FormData `file`, `documentType`, `userId`) → `{success,url}`.
- Migration conventions: `0013`/`0014` headers, role guard, `lint-chain.sh` rules, deny-by-default grants
  after `0005` (service_role only), `.down.sql`, static test in `supabase/migrations/__tests__/`.
  Next number: `0015`.
- PDF injection points: `buildBudgetDocumentData`, `buildProcessingDocumentData`, `buildUserContractData`
  and their routes; React-PDF blocks import the constants directly today.

## Decisions

- Data model: single-row `public.site_settings` (`id smallint PK CHECK (id = 1)`, `data jsonb NOT NULL`,
  `updated_at`, `updated_by`). Typed with zod in `src/lib/siteSettings.ts`; `DEFAULT_SETTINGS` carries the
  current constants so every reader works with an empty table.
- Sections: `company { legalName, tradeName, rut, giro, domicilio }`, `representative { name, cedula,
domicilio, signatureUrl, signatureUpdatedAt }`, `bank { holder, rut, bankName, accountType, accountNumber,
email }`, `contact { email, adminNotificationEmail, phone, whatsapp, website }`, `pickupAddresses[]`,
  `reserve { defaultPct }`, `policies { acceptance, footer, pickupWindow, returnDeadline }`.
- Access: page and API `super_admin` only; the service reads with `supabaseAdmin` and caches for 60 s.
- Signature upload: server route `POST /api/admin/site-settings/signature` (multipart, PNG/JPEG by magic
  bytes, ≤ 1 MB) that forwards to the worker `/upload-file-only` with `documentType = 'firma_representante'`
  and stores the URL (cache-busted with `?v=<ts>`) in `representative.signatureUrl`.
- PDFs: mappers take `settings` (default `DEFAULT_SETTINGS`); routes resolve `SiteSettingsService.get()`
  once per render; React-PDF blocks read from the document data, never from constants. Contract clause
  QUINTA and the annex intro become functions of settings (bank, reserve pct, pickup addresses).
- Emails: admin notification address from settings; template HTML bodies are out of scope for now.
- Out of scope: the legacy Astro "human view" PDF pages (`budget-pdf`, `order-pdf`, `contract-pdf`) and the
  frontend site copy; recorded as follow-ups.

## Constraints

- TDD strict (`pnpm test`, vitest). RDD on. Prettier on save. `pdfService.ts` untouched.
- Apply `0015` on the consolidado DB as `supabase_admin` with backup (user authorized remote steps).
- Delivery: forecast ≈ 1,000 lines across 3 commits (> 400); chain strategy decided at push time.

## Tasks

- [x] T1 — Migration `0015_site_settings` (+down +test), `src/lib/siteSettings.ts` (schema, defaults, parse/merge),
      `SiteSettingsService` (get cached / update / setSignatureUrl), API `GET|PUT /api/admin/site-settings` and
      `POST /api/admin/site-settings/signature`, tests. Delegated writer.
- [x] T2 — Page `src/pages/settings.astro` + `components/settings/SiteSettingsForm.tsx` (tabs: Empresa,
      Representante y firma, Banco, Contacto, Direcciones, Reserva y políticas; signature preview + upload),
      nav entry + icon + navigation test. Same writer as T1.
- [x] T3 — Wire PDFs and emails to settings: mappers + routes + React-PDF blocks + parameterised copy; render
      fixtures; tests. Delegated writer.
- [ ] T4 — Apply `0015` on consolidado, deploy dash-consolidado, upload the real signature (file from the user),
      regenerate the contract for profile 462 and check the image appears.

## Progress / evidence

### T1 + T2 — done 2026-10-02, commit `1b91e1b`

- Route: delegated writer (sonnet); parent spot check: `requireRole('super_admin')` on both routes,
  PNG/JPEG magic bytes + 1 MB cap in `signature.ts`, `settings.astro` redirects non-super_admin.
- TDD: RED observed for the migration test, `siteSettings.test.ts` and the route tests; the service,
  `siteSettingsClient` and form tests were written after their implementation (no observed RED —
  recorded honestly). Scoped run `PASS (1228) FAIL (0)`; full `PASS (1765) FAIL (0)`; lint-chain
  0 findings (35 migrations); `pnpm build` OK.
- Deviations: component interaction tests are pure-function tests (`siteSettingsClient.ts`) because
  the repo has no jsdom/testing-library; `company.giro`/`domicilio` defaults were guessed
  ("Arriendo de equipos fotográficos", "Santiago, Chile") — editable from the page.
- Also shipped in the same deploy: `7803169` fixes the dashboard CSP (`vercel.json`) so the
  consolidado admin can reach `supabase-v2` and `workers.mariohans.cl` from the browser (user-reported
  "Procesar" failure on order 1574).
- `0015` applied on the consolidado DB (backup `/root/backups/mhans-stg-pre-0015-20261002-1355.dump`,
  `BEGIN…COMMIT`, exit 0). Deployed `dash-consolidado-mhans-rjxjnxwha…`; `/settings` → 302 without
  session, `GET /api/admin/site-settings` → 401 without session.

### T3 — done 2026-10-02 (committed right after this entry)

- Route: delegated writer (sonnet). Mappers take `settings = DEFAULT_SETTINGS`; copy modules are
  functions of settings (`{{placeholders}}` in clause QUINTA); React-PDF blocks read from document
  data; the four PDF routes call `SiteSettingsService.get()` once; admin copy of budget emails uses
  `contact.adminNotificationEmail`. Parent spot check: `budget-override-1.png` shows the overridden
  bank, reserve 30 % and policy texts in place.
- Parent fix: `generate-budget-pdf.test.ts` failed to load (the route now imports the settings
  service → service-role Supabase client at import time); mocked the service in that suite.
- TDD: RED `Tests 10 failed | 304 passed` → GREEN `PASS (312) FAIL (0)` for `src/lib/pdf src/pages/api`;
  full suite `PASS (1775) FAIL (0)`; `pnpm build` complete.
- Default output deltas (intentional): bank RUT printed with dots; comparecencia address shortened to
  "…N° 83, Santiago"; QUINTA holder "Hans Salinas SpA".
- Not routed yet (follow-ups): annex 13:00 return paragraph and `policies.pickupWindow/returnDeadline`;
  DÉCIMO SEXTA "ciudad de Santiago"; legacy `ContractDocument.tsx`/`CompanyInfo.tsx` (unused);
  email HTML bodies.
- User decision 2026-10-02: production DB (`supabase-9cd8-db`) is frozen — the consolidado DB will
  replace it — so `0001/0005/0014/0015` are applied on the consolidado only.
- RDD slice `7803169..3146ab0` (`high`, 47 files): consent granted → 4 lenses → `review-reliability`
  raised R4-001 (CRITICAL, deterministic, introduced): `update()` seeded its merge from the tolerant
  reader, so a transient read error would overwrite saved settings with defaults. One bounded
  correction (budget 40 lines): strict reader for the write path, two fail-closed tests
  (RED `PASS (10) FAIL (2)` → GREEN), commit `35c3c45`; targeted validation approved; acknowledged.
  Full suite `PASS (1777)`.
