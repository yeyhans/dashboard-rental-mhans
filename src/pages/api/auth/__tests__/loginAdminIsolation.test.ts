import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D-20: `supabaseAdmin` is a process-wide singleton. Signing a user in on it stores that user's
 * session in the client, and every later "admin" query from the same instance then runs as
 * `authenticated` instead of `service_role` (observed: `permission denied for table expenses`).
 * Login must authenticate on its own short-lived client and never touch the admin client's auth.
 */
interface FakeClient {
  key: string;
  options: { auth?: { persistSession?: boolean; autoRefreshToken?: boolean } };
  signInWithPassword: ReturnType<typeof vi.fn>;
}

const created: FakeClient[] = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: (
    _url: string,
    key: string,
    options: FakeClient["options"] = {},
  ) => {
    const client: FakeClient = {
      key,
      options,
      signInWithPassword: vi.fn(async () => ({
        data: {
          user: { id: "user-1", email: "admin@example.com" },
          session: { access_token: "access", refresh_token: "refresh" },
        },
        error: null,
      })),
    };
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      single: async () => ({
        data: {
          id: 1,
          user_id: "user-1",
          role: "super_admin",
          email: "admin@example.com",
        },
        error: null,
      }),
    };
    created.push(client);
    return {
      auth: { signInWithPassword: client.signInWithPassword },
      from: () => builder,
    };
  },
}));

function contextFor(ip: string) {
  return {
    request: new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({
        email: "admin@example.com",
        password: "secret-password",
      }),
    }),
    cookies: { set: vi.fn(), get: () => undefined, delete: vi.fn() },
  } as never;
}

beforeEach(() => {
  created.length = 0;
  vi.resetModules();
  vi.stubEnv("PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
});

describe("D-20: admin login never signs in on the service-role client", () => {
  it("does not call signInWithPassword on the supabaseAdmin client", async () => {
    const { POST } = await import("../login");
    const response = await POST(contextFor("203.0.113.20"));

    expect(response.status).toBe(200);
    const serviceClients = created.filter((c) => c.key === "service-key");
    expect(serviceClients.length).toBeGreaterThan(0);
    for (const client of serviceClients) {
      expect(client.signInWithPassword).not.toHaveBeenCalled();
    }
  });

  it("signs in on a fresh anon client that keeps no session", async () => {
    const { POST } = await import("../login");
    await POST(contextFor("203.0.113.21"));

    const signedIn = created.filter(
      (c) => c.signInWithPassword.mock.calls.length > 0,
    );
    expect(signedIn).toHaveLength(1);
    expect(signedIn[0]!.key).toBe("anon-key");
    expect(signedIn[0]!.options.auth?.persistSession).toBe(false);
    expect(signedIn[0]!.options.auth?.autoRefreshToken).toBe(false);
  });

  it("uses a new auth client for every login, never a shared one", async () => {
    const { POST } = await import("../login");
    await POST(contextFor("203.0.113.22"));
    await POST(contextFor("203.0.113.23"));

    const signedIn = created.filter(
      (c) => c.signInWithPassword.mock.calls.length > 0,
    );
    expect(signedIn).toHaveLength(2);
    expect(signedIn[0]).not.toBe(signedIn[1]);
  });
});
