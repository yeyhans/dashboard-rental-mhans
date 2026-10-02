# pdf-redesign-mariohans-os — rebuild the three PDFs on the client's HTML designs

Created: 2026-10-02. Branch: `consolidado-web-2027` (dashboard worktree). Engram mirror: `odd/pdf-redesign-mariohans-os/tasks`.

## Objective

Make the three PDFs the dashboard renders with `@react-pdf/renderer` match the client's HTML
designs, filled with the real data of the user/order they are generated for:

| PDF                              | Design source (HTML)                                                                                 | Component                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Presupuesto (orden `on-hold`)    | `CONSOLIDADO WEB YEYSON/PPTO/01 Presupuesto MarioHans.html` (`02 …` = same without the discount row) | `src/lib/pdf/components/budget/BudgetDocument.tsx`         |
| Pedido confirmado (`processing`) | `CONSOLIDADO WEB YEYSON/PPTO/Presupuesto MarioHans.html` (= 01 + "Anexo de contrato" + signatures)   | `src/lib/pdf/components/processing/ProcessingDocument.tsx` |
| Contrato del cliente             | `CONSOLIDADO WEB YEYSON/legal/contratos/Contrato Arrendamiento.dc.html`                              | `src/lib/pdf/components/contract/UserContractDocument.tsx` |

Reference renders of the HTML (Chrome headless, 2026-10-02) live in the session scratchpad as
`tpl-*.png` / `tpl-*.pdf`; decoded template HTML as `*.tpl.html`.

## Design system (from the templates)

- Fonts: Archivo 700/800/900 (display), Montserrat 400/500/600/700/800 (body), IBM Plex Mono
  400/500/600 (labels + numbers). Ship static TTFs (Google Fonts, OFL) under `src/lib/pdf/fonts/`
  and register them in `core/fonts.ts`; react-pdf does not take woff2 or variable fonts.
- Colors: ink `#0A0A0A`, ink-soft `#1A1A1A`, gray-50 `#FAFAFA`, gray-100 `#F4F4F4`, gray-150
  `#EAEAEA`, gray-200 `#E2E2E2`, gray-400 `#848585`, gray-500 `#666666`, gray-600 `#4E504F`.
- Sizes 11/12/13/14/15/18/22/28 px → pt equivalents; radius 8; labels mono uppercase, tracking 0.06em.
- Logo: the PNG embedded in the templates (2168×375), to be extracted to `src/lib/pdf/assets/logo.png`
  and loaded locally (no remote URL). Page size A4, margins ≈ 40 pt.

## Decisions (resolved 2026-10-02)

- The HTML text is authoritative where it differs from the current components.
- Header reads `Pedido #<id>` in budget and processing; label under the logo "PRESUPUESTO DE ARRIENDO".
- Discount row only when `calculated_discount > 0` (`Descuento <pct>%` when the coupon is a percentage,
  `Descuento` otherwise); "Móvil rental" row only when shipping total > 0.
- Reserve box uses the order's own `reserve_type`/`reserve_value` (`reserveLabel`/`reserveAmount`),
  not a hard-coded 25 %; "Saldo pendiente" = total − reserve.
- "Retiro" = `order_retire_name` when present, else "El cliente"; "Devolución" = `order_fecha_termino` + 1 day
  (business rule: return until 13:00 the day after); "NOTA" = `order_comments` (box hidden when empty).
- Client RUT from `user_profiles.rut`; "productora" line = `billing_company` (hidden when empty).
- Bank data in all three PDFs (user decision): Hans Salinas SpA, RUT 77.892.569-9, Banco de Chile,
  Cuenta Corriente 8140915407, rental.mariohans@gmail.com. Pickup "Purísima 25 o Bellavista 77, Recoleta".
- Processing keeps the annex + two signature lines as in the HTML (no Mario signature image); fixes the
  existing bug that printed `totals.total` as the reserve.
- Contract: keeps the client's `url_firma` image on the right signature block (HTML has text only) and
  Mario's signature image on the left; drops the "Documentos adjuntos" page (not in the design, and it
  spreads ID-card photos). `tipo_cliente = natural` gets a derived variant of the comparecencia and
  signature block (no empresa/representante lines); `empresa` uses the HTML wording verbatim.
- Drop the "IMPORTANTE" availability box and the "Estado" line (not in the designs).
- `generatePdfBuffer` (`core/pdfService.ts`) is not modified.

## Constraints

- TDD strict (session config); runner `pnpm test` (vitest) in this worktree. There are no tests for the
  PDF components today: add render smoke tests (renderToBuffer with fixtures → `%PDF` header, no throw)
  and unit tests for the data-mapping helpers. Prettier runs on save (hook).
- RDD on (global). Review candidate = each work-unit commit.
- Delivery: forecast ≈ 2,000 authored lines across 4 commits (> 400). Strategy `ask-on-risk`: the chain
  strategy is decided with the user at push time (branch has 48 unpushed commits and no open PR).

## Tasks

- [ ] T1 — Foundations: fonts (TTF + `Font.register`), local logo asset, design tokens in `utils/styles.ts`,
      shared blocks under `components/common/` (DocHeader, PartiesGrid, NoteBox, ItemsTable, TotalsBlock,
      ReserveBox, BankAndTerms, SignatureLines, AnnexSection), fixtures + smoke-test harness. Route: delegated writer.
- [ ] T2 — `BudgetDocument` rewrite on the shared blocks + `api/order/generate-budget-pdf.ts` and
      `api/budget/generate-pdf.ts` mapping (devolución, retiro, nota, rut, discount pct). Same writer as T1.
- [ ] T3 — `ProcessingDocument` rewrite (= budget + annex + signatures), reserve bug fix,
      `api/order/generate-processing-pdf.ts` mapping. Delegated writer.
- [ ] T4 — `UserContractDocument` rewrite from the contract HTML (clauses as a data file, natural/empresa
      variants, signature images, running header with page numbers), `api/contracts/generate-pdf.ts` mapping.
      Delegated writer.
- [ ] T5 — Visual verification: render the three PDFs with real-shaped fixtures (long product names, discount,
      shipping, 15+ rows spanning pages, empresa and natural clients), compare against `tpl-*.png`, fix spacing.
      Then generate one real budget/contract on dash-consolidado and open it.

## Progress / evidence

### T1 + T2 — done 2026-10-02, commit `00a600f` (39 files, +1865 −630)

- Route: delegated writer (sonnet); parent spot check: viewed `tmp/pdf/budget-{short,longNamed}-*.png`
  against `tpl-01_Presupuesto_MarioHans.png`; parent fix: totals and reserve blocks were wrapped as
  one unbreakable group and jumped to a new page together — split into two `wrap={false}` views.
- TDD: RED `PASS (0) FAIL (12)` → GREEN `PASS (27) FAIL (0)` for `src/lib/pdf`; full suite
  `PASS (1674) FAIL (0)` (one run showed 2 suite-level timeouts from the pre-existing flaky
  `generate-pdf.test.ts`; re-run clean). `pnpm build` complete; TTFs and logo present in the Vercel
  function output and resolved from cwd.
- Deviations recorded: px→pt at 0.72 so the 7-column table fits 515 pt; IBM Plex Mono taken from
  the google/fonts repo (the CSS-API TTF crashed fontkit); logo loaded as a buffer; `pdf-parse` not
  installed, so text assertions walk the element tree.
- Known gaps: `/api/budget/generate-pdf` (legacy) has no profile → RUT blank unless `billing.rut`;
  discount % only when `coupon_lines` carries a percent coupon.
