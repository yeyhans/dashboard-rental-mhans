import { createClient } from '@supabase/supabase-js';
import type { APIContext, AstroGlobal } from 'astro';
import type { Database } from '../types/database';

/**
 * Anon Supabase client that carries the caller's session JWT.
 *
 * The module-level `supabase` client in `lib/supabase.ts` sends no Authorization header, so
 * PostgREST treats its requests as the `anon` role with `auth.uid()` NULL. That is invisible
 * while a table has no RLS, and becomes a silent zero-row read the moment it does: migration
 * `0001_m1_grants_rls.sql` enables RLS on `orders` with identity-keyed policies
 * ("Customers can read their own orders"), which a JWT-less request can never match.
 *
 * Attaching the access token from the request cookies makes `auth.uid()` resolve to the logged-in
 * user, so those policies apply to the caller instead of rejecting them.
 *
 * Returns `null` when there is no session — callers must treat that as unauthenticated rather
 * than fall back to a bare anon client.
 */
export function getSessionSupabaseClient(context: APIContext | AstroGlobal) {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[SessionSupabase] Faltan PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY');
    return null;
  }

  const accessToken = context.cookies.get('sb-access-token')?.value;
  if (!accessToken) return null;

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    db: { schema: 'public' },
  });
}
