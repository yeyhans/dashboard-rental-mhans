const encoder = new TextEncoder();

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLength = Math.max(aBytes.length, bBytes.length, 1);
  let diff = aBytes.length ^ bBytes.length;

  for (let i = 0; i < maxLength; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return diff === 0;
}

export function validateFrontendApiKey(request: Request): boolean {
  const expectedSecret = import.meta.env.FRONTEND_API_SECRET;
  const providedSecret = request.headers.get('X-API-Key');

  if (!expectedSecret || !providedSecret) {
    return false;
  }

  return constantTimeEqual(providedSecret, expectedSecret);
}

export function unauthorizedResponse(headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function createInternalApiHeaders(requestId = crypto.randomUUID()): HeadersInit {
  const frontendSecret = import.meta.env.FRONTEND_API_SECRET;
  if (!frontendSecret) {
    throw new Error('Missing FRONTEND_API_SECRET');
  }

  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Key': frontendSecret,
    'X-Request-ID': requestId,
  };
}

export async function isFrontendApiKeyOrAdmin(context: { request: Request }): Promise<boolean> {
  if (validateFrontendApiKey(context.request)) {
    return true;
  }

  const { getServerAdmin } = await import('./supabase');
  const adminSession = await getServerAdmin(context as any);
  return !!adminSession;
}
