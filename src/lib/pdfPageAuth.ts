// Authorization for the dashboard's PDF-rendering pages (`/budget-pdf/[orderId]`,
// `/order-pdf/[orderId]`).
//
// Same defect class as F1, found in the dashboard repo after T-025 closed the frontend's copy.
// Both pages previously accepted `X-Internal-Request: true` plus an `X-Requested-Order-Id`
// matching the URL parameter as a substitute for a session, and then read the order with the
// SERVICE-ROLE key. The attacker controls both the header and the URL, so the "validation" was
// comparing two attacker-supplied values to each other. Neither page is listed in
// `middleware/index.ts` `protectedRoutes`, so the request never met an auth gate first.
//
// No caller in the monorepo ever emitted those headers: the PDF pipeline renders in-process via
// `@react-pdf/renderer` (`api/order/generate-budget-pdf.ts` -> `lib/pdf/core/pdfService.ts`), and
// these pages are only ever opened by a human following an emailed link. The branch was pure
// attack surface, so it is deleted rather than replaced with an internal secret.
//
// Mirrors `frontend/src/lib/pdfRouteAuth.ts` (T-025) so both repos deny identically. The
// `request` argument is kept in the signature deliberately: it documents that the decision is
// taken with the raw request in hand and still ignores every header on it.

export interface SessionUser {
  id: string;
  email?: string | null;
}

export interface SessionProfile {
  user_id?: number | string | null;
  auth_uid?: string | null;
}

export interface SessionProfileResult {
  profile?: SessionProfile | null;
  auth?: { id?: string | null } | null;
}

export type PdfAccessDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403 | 404; message: string };

const UNAUTHENTICATED: PdfAccessDecision = {
  allowed: false,
  status: 401,
  message: 'Inicia sesión para acceder a este documento.',
};

const PROFILE_MISSING: PdfAccessDecision = {
  allowed: false,
  status: 404,
  message: 'No encontramos tu perfil. Completa tus datos antes de continuar.',
};

const FORBIDDEN: PdfAccessDecision = {
  allowed: false,
  status: 403,
  message: 'Solo puedes acceder a tus propios documentos.',
};

/** Both pages are reachable as `/budget-pdf/42` and `/budget-pdf/42.pdf`. */
export function normalizeOrderId(rawId: string): string {
  return rawId.endsWith('.pdf') ? rawId.slice(0, -'.pdf'.length) : rawId;
}

function identifiersOf(user: SessionUser, profileResult: SessionProfileResult): string[] {
  const profile = profileResult.profile;
  return [user.id, profileResult.auth?.id, profile?.user_id, profile?.auth_uid]
    .filter((value): value is string | number => value !== null && value !== undefined && value !== '')
    .map((value) => value.toString());
}

/** Access to an order-scoped document, keyed on the order's owner. Session only. */
export function authorizeOrderPdfAccess(input: {
  request: Request;
  orderCustomerId: string | number | null | undefined;
  user: SessionUser | null;
  profileResult: SessionProfileResult | null;
}): PdfAccessDecision {
  const { orderCustomerId, user, profileResult } = input;

  if (!user) return UNAUTHENTICATED;
  if (!profileResult?.profile) return PROFILE_MISSING;
  if (orderCustomerId === null || orderCustomerId === undefined || orderCustomerId === '') {
    return FORBIDDEN;
  }

  const owns = identifiersOf(user, profileResult).includes(orderCustomerId.toString());
  return owns ? { allowed: true } : FORBIDDEN;
}

/** Turns a denial into the response the pages return. */
export function pdfAccessDenialResponse(
  decision: Extract<PdfAccessDecision, { allowed: false }>
): Response {
  return new Response(JSON.stringify({ success: false, error: decision.message }), {
    status: decision.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
