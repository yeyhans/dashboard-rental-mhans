import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn(() => ({ from: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

function contextWith(cookies: Record<string, string>) {
  return {
    cookies: {
      get: (name: string) => (name in cookies ? { value: cookies[name] } : undefined),
    },
  };
}

describe('session-scoped Supabase client', () => {
  beforeEach(() => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('sends the caller JWT so PostgREST evaluates RLS as that user', async () => {
    const { getSessionSupabaseClient } = await import('../sessionSupabase');

    const client = getSessionSupabaseClient(contextWith({ 'sb-access-token': 'jwt-abc' }) as never);

    expect(client).not.toBeNull();
    expect(createClient).toHaveBeenCalledTimes(1);

    const [url, key, options] = createClient.mock.calls[0] as unknown as [
      string,
      string,
      { global?: { headers?: Record<string, string> } },
    ];

    expect(url).toBe('https://project.supabase.co');
    // Anon key, never the service role: RLS must actually run for this read.
    expect(key).toBe('anon-key');
    expect(options.global?.headers?.Authorization).toBe('Bearer jwt-abc');
  });

  it('returns null instead of a JWT-less client when there is no session cookie', async () => {
    const { getSessionSupabaseClient } = await import('../sessionSupabase');

    expect(getSessionSupabaseClient(contextWith({}) as never)).toBeNull();
    // A bare anon client would silently return zero rows once RLS is enabled on `orders`
    // (migration 0001), turning every legitimate PDF request into a 404.
    expect(createClient).not.toHaveBeenCalled();
  });
});
