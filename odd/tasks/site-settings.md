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

- [ ] T1 — Migration `0015_site_settings` (+down +test), `src/lib/siteSettings.ts` (schema, defaults, parse/merge),
      `SiteSettingsService` (get cached / update / setSignatureUrl), API `GET|PUT /api/admin/site-settings` and
      `POST /api/admin/site-settings/signature`, tests. Delegated writer.
- [ ] T2 — Page `src/pages/settings.astro` + `components/settings/SiteSettingsForm.tsx` (tabs: Empresa,
      Representante y firma, Banco, Contacto, Direcciones, Reserva y políticas; signature preview + upload),
      nav entry + icon + navigation test. Same writer as T1.
- [ ] T3 — Wire PDFs and emails to settings: mappers + routes + React-PDF blocks + parameterised copy; render
      fixtures; tests. Delegated writer.
- [ ] T4 — Apply `0015` on consolidado, deploy dash-consolidado, upload the real signature (file from the user),
      regenerate the contract for profile 462 and check the image appears.

## Progress / evidence

(empty)
