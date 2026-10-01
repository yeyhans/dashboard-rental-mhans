import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  authorizeOrderPdfAccess,
  normalizeOrderId,
  pdfAccessDenialResponse,
} from '../pdfPageAuth';

const user = { id: 'auth-uid-1', email: 'cliente@example.com' };
const profileResult = {
  profile: { user_id: 42, auth_uid: 'auth-uid-1' },
  auth: { id: 'auth-uid-1' },
};

/** The exact bypass this module exists to close: both headers are attacker-controlled. */
function spoofedRequest(orderId: string): Request {
  return new Request(`https://dashboard.mariohans.cl/budget-pdf/${orderId}`, {
    headers: {
      'X-Internal-Request': 'true',
      'X-Requested-Order-Id': orderId,
    },
  });
}

describe('PDF page authorization', () => {
  it('does not treat X-Internal-Request as authentication', () => {
    const decision = authorizeOrderPdfAccess({
      request: spoofedRequest('123'),
      orderCustomerId: 42,
      user: null,
      profileResult: null,
    });

    expect(decision).toEqual({
      allowed: false,
      status: 401,
      message: expect.stringContaining('Inicia sesión'),
    });
  });

  it('does not treat a matching X-Requested-Order-Id as ownership', () => {
    const decision = authorizeOrderPdfAccess({
      request: spoofedRequest('123'),
      orderCustomerId: 999,
      user,
      profileResult,
    });

    expect(decision.allowed).toBe(false);
    expect(decision).toMatchObject({ status: 403 });
  });

  it('allows an authenticated owner', () => {
    expect(
      authorizeOrderPdfAccess({
        request: spoofedRequest('123'),
        orderCustomerId: '42',
        user,
        profileResult,
      })
    ).toEqual({ allowed: true });
  });

  it('matches ownership on auth_uid as well as numeric user_id', () => {
    expect(
      authorizeOrderPdfAccess({
        request: spoofedRequest('123'),
        orderCustomerId: 'auth-uid-1',
        user,
        profileResult,
      })
    ).toEqual({ allowed: true });
  });

  it('rejects an authenticated session with no profile', () => {
    const decision = authorizeOrderPdfAccess({
      request: spoofedRequest('123'),
      orderCustomerId: 42,
      user,
      profileResult: { profile: null },
    });

    expect(decision).toMatchObject({ allowed: false, status: 404 });
  });

  it('refuses an order with no owner rather than defaulting to allow', () => {
    for (const orderCustomerId of [null, undefined, '']) {
      const decision = authorizeOrderPdfAccess({
        request: spoofedRequest('123'),
        orderCustomerId,
        user,
        profileResult,
      });
      expect(decision).toMatchObject({ allowed: false, status: 403 });
    }
  });

  it('strips the optional .pdf suffix from the route parameter', () => {
    expect(normalizeOrderId('123.pdf')).toBe('123');
    expect(normalizeOrderId('123')).toBe('123');
  });

  it('renders denials as JSON with the decision status', async () => {
    const response = pdfAccessDenialResponse({
      allowed: false,
      status: 403,
      message: 'Solo puedes acceder a tus propios documentos.',
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      success: false,
      error: 'Solo puedes acceder a tus propios documentos.',
    });
  });
});

/**
 * Source-level guard: the two PDF pages are Astro templates, so they are not unit-testable
 * here. This asserts the bypass cannot be reintroduced by reading the templates themselves.
 */
describe('PDF page templates carry no header-based bypass', () => {
  const pages = [
    join(process.cwd(), 'src/pages/budget-pdf/[orderId].astro'),
    join(process.cwd(), 'src/pages/order-pdf/[orderId].astro'),
  ];

  for (const page of pages) {
    it(`${page.split(/[\\/]/).slice(-2).join('/')} never reads the internal-request headers`, () => {
      // Comments are stripped so the templates may keep documenting the removed bypass by name
      // without the guard mistaking the explanation for the defect.
      const code = readFileSync(page, 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');

      expect(code).not.toContain('X-Internal-Request');
      expect(code).not.toContain('X-Requested-Order-Id');
      expect(code).not.toContain('isInternalRequest');

      // The page still uses the service-role key once, to read the order owner's RUT for the
      // document body. That is fine only because it runs AFTER the ownership check — the whole
      // defect was a service-role read reached before any authorization.
      expect(code.indexOf('authorizeOrderPdfAccess')).toBeGreaterThan(-1);
      expect(code.indexOf('authorizeOrderPdfAccess')).toBeLessThan(
        code.indexOf('SUPABASE_SERVICE_ROLE_KEY')
      );
    });

    it(`${page.split(/[\\/]/).slice(-2).join('/')} reads the order through the session-scoped client`, () => {
      const code = readFileSync(page, 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');

      // The order read must carry the caller's JWT. A bare anon client passes today only
      // because `orders` has no RLS; after migration 0001 it matches no policy and returns
      // zero rows, 404-ing every legitimate owner out of their own document.
      expect(code).toContain('getSessionSupabaseClient(Astro)');
      expect(code).not.toContain('PUBLIC_SUPABASE_ANON_KEY');
    });
  }
});
