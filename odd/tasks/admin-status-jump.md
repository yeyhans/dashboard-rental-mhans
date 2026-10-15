# Admin status jump + quick status actions in order detail

Locator: `dashboard-worktrees/order-status-jump/odd/tasks/admin-status-jump.md` (branch `feat/admin-status-jump`, base origin/main c5bbd55)
Engram mirror `odd/admin-status-jump/tasks`: PENDING (engram project ambiguous)

## Objective
In the order detail "Acciones" card, add buttons to change the order status quickly, and let admins
(admin, super_admin) move an order to any status without following the sequence. Operators keep the
forward-only rules.

## Decisions (user, 2026-10-14)
- Jumps (any change that `canTransition` would reject) send the target-status customer email ONLY when the
  admin ticks "Notificar al cliente" (unchecked by default). Sequential changes keep today's behaviour.
- The contract PDF on entering `in-rental` is generated only when the order has none (already the case).

## Design
- Gate: `checkStatusChange` gets an admin bypass (admin/super_admin may go from any status to any other,
  including out of terminal states); operator rule unchanged; same-status is a no-op error.
- Inventory guard: moving away from `in-rental`/`return` to any status other than `return`/`completed`, or to
  `completed`/`cancelled`, while the order has open checkouts returns 409 `OPEN_CHECKOUTS` with the asset tags
  unless the request carries `acknowledge_open_checkouts: true` (UI shows them and asks to confirm).
- API `PUT /api/orders/[id]/status` accepts `{status, notify?, reason?, acknowledge_open_checkouts?}`;
  `reason` saved as `cancellation_reason` when cancelling; `onStatusChanged` receives `notify` and skips the
  email on jumps without notify.
- UI: new presentational `OrderStatusQuickActions` (next-step button, Cancelar pedido, "Cambiar estado…"
  dialog with all statuses for admins, notify checkbox, reason, open-checkout confirmation). Wired into the
  Acciones card in `ProcessOrder.tsx` with a minimal, CRLF-preserving edit (no full-file reformat).

## Tasks
- [x] T1 Gate admin bypass + jump classification + open-checkout guard + API params + lifecycle notify (TDD) — commit 93bd1da (route: delegated writer)
- [x] T2 Quick actions UI + wiring in ProcessOrder (TDD), test + build — UI commit (route: delegated writer)
- [ ] T3 Native review per slice, PR to main, pytest green, merge (deploys dashboard production)
- [ ] T1b Update `src/pages/api/orders/status/__tests__/id.test.ts` ("enforces the state machine on this URL
  too"): it still expects an admin `request -> completed` to be 409. Outside the writer's edit surface; pending
  approval (proposed: assert `SAME_STATUS` on `request -> request`, or run it as a role without the bypass).

## Implementation notes
- Gate (`orderTransitionGate.ts`): operator rule first, then `SAME_STATUS`, then the admin bypass, which only
  accepts targets inside the vocabulary (an admin cannot write `on-hold` into a v1.2 row). Helpers:
  `isSequentialTransition`, `requiresOpenCheckoutCheck`, `parseStatusChangeOptions` (notify/ack only on a
  literal `true`; reason trimmed, max 500, must be text), `openCheckoutsRejection`.
- Lifecycle: a jump is judged with a canonical target and a vocabulary origin; a legacy origin is never a jump
  (keeps today's emails). `finalizeReturn` passes `notify: true`, since its `in-rental -> completed` skips
  `return` for the machine.
- Routes load `AssetMovementService` lazily and fail soft (no inventory tables -> no guard).
- `reason` is stored as `cancellation_reason` only when the target is `cancelled` (needs migration 0003).
- UI: `OrderStatusQuickActions` (presentational; `ProcessOrder.handleStatusChange` owns the fetch). The jump
  dialog shows the reason field only when the target is `cancelled`. The order-chat status note
  (`notifyStatusChange`) is also skipped on a jump without "Notificar al cliente". The unused
  `handleMarkAsCompleted`/`handleMarkAsFailed` (confirm/prompt) were removed.

## Progress / evidence
- RED observed: gate + asset tests against base code (24 failed), lifecycle jump tests (5 failed), route jump
  tests (6 failed), update-route jump tests (4 failed), cancellation reason (1 failed), admin vocabulary hole
  (1 failed), quick-actions wiring/slot (3 failed). Not observed RED: `parseStatusChangeOptions` /
  `openCheckoutsRejection` unit tests and the component helper tests (written alongside the code).
- GREEN: `pnpm test` 2883 passed / 8 failed: 7 `OrdersDashboard.sourceAssertions` (CRLF checkout, file
  untouched, `git ls-files --eol` = `i/lf w/crlf`) + 1 alias test (T1b). `pnpm build` Complete.

## Review follow-up (Gentle AI advisory findings, 2026-10-14) — route: inline (bounded, 3 findings)
- [x] R3-notify-classification-mismatch: the UI judged a jump with the canonical origin, the server with the
  raw one (a legacy origin is never a jump). New shared `isStatusJump` in `orderTransitionGate.ts`; the quick
  actions' `shouldOfferNotify`, `buildJumpRequest` (drops a stale `notify`) and the chat-note rule all use it.
  `orderTransitionGate.jumpParity.test.ts` checks it against `OrderLifecycleService.isStatusJump` for every
  vocabulary + legacy origin and every target. RED: parity tests (5 failed, `isStatusJump` missing) and the
  legacy-origin case against the old component (`on-hold -> request` offered notify: expected true to be false).
- [x] R4-post-commit-failure-reported-as-failure: new pure `statusChangeFlow.executeStatusChange`; once the route
  answered OK, a failing order-chat note returns `followUpError` and `ProcessOrder` shows success plus a
  separate `toast.warning`. `ProcessOrder.tsx` edited by a CRLF-preserving node script (no reformat).
- [x] R3-ui-submit-flow-unproved: the submit flow moved to `statusChangeFlow` (`buildAdvanceRequest`,
  `buildCancelRequest`, `buildJumpRequest`, `acknowledgeOpenCheckouts`, `submitStatusChange`), which the
  component calls; `statusChangeFlow.test.ts` covers advance, cancel with reason, jump with notify on/off,
  `OPEN_CHECKOUTS` then "Confirmar de todos modos" re-sending `acknowledge_open_checkouts`, and route errors.
  RED: the suite failed to import the missing module before the helper existed.
- Evidence: `pnpm test` 2910 passed / 7 failed (only the CRLF `OrdersDashboard.sourceAssertions`; one earlier
  full run also timed out `generate-contract-pdf` "rejects an unauthenticated request" at 6.6 s, which passes
  alone and in the rerun). `pnpm build` Complete.
- Open: `OrderLifecycleService.isStatusJump` still carries its own copy (outside this edit surface); the parity
  test guards drift until it delegates to the gate's `isStatusJump`.
