import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * R-09e: an account created by an admin gets the "Registro" design with a "Crear mi contraseña"
 * button (a Supabase recovery link). No password is ever generated for the email or put in it.
 */
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  generateLink: vi.fn(),
  sendEmailViaWorker: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: mocks.rpc,
    auth: {
      admin: {
        createUser: mocks.createUser,
        deleteUser: mocks.deleteUser,
        generateLink: mocks.generateLink,
      },
    },
  },
}));
vi.mock("../../lib/emailWorkerService", () => ({
  sendEmailViaWorker: mocks.sendEmailViaWorker,
}));

const { UserService } = await import("../userService");

const profile = { user_id: 41, email: "ana@example.cl", nombre: "Ana" };

beforeEach(() => {
  vi.stubEnv("PUBLIC_FRONTEND_URL", "https://new.mariohans.cl");
  for (const fn of Object.values(mocks)) fn.mockReset();
  mocks.createUser.mockResolvedValue({
    data: { user: { id: "auth-1" } },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: [profile], error: null });
  mocks.generateLink.mockResolvedValue({
    data: {
      properties: {
        hashed_token: "hash-xyz",
        action_link: "https://supabase-v2.mariohans.cl/auth/v1/verify?x=1",
      },
    },
    error: null,
  });
  mocks.sendEmailViaWorker.mockResolvedValue({ success: true });
});

describe("UserService.createUserWithWelcome", () => {
  it("creates the account without a password and emails the Registro design with a recovery link", async () => {
    const result = await UserService.createUserWithWelcome({
      email: "ana@example.cl",
      nombre: "Ana",
    } as never);

    expect(result).toEqual({ user: profile });
    const createArgs = mocks.createUser.mock.calls[0]![0];
    expect(createArgs).toEqual({
      email: "ana@example.cl",
      email_confirm: true,
    });
    expect(createArgs).not.toHaveProperty("password");

    expect(mocks.generateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "ana@example.cl",
      options: { redirectTo: "https://new.mariohans.cl/reset-password" },
    });

    const [to, subject, html] = mocks.sendEmailViaWorker.mock.calls[0]!;
    expect(to).toBe("ana@example.cl");
    expect(subject).toContain("Registro");
    expect(html).toContain("Crear mi contraseña");
    expect(html).toContain(
      "https://new.mariohans.cl/reset-password?token_hash=hash-xyz&amp;type=recovery",
    );
    expect(html).not.toMatch(/contraseña temporal/i);
    expect(html).not.toContain("auth/v1/verify");
  });

  it("keeps the account and returns a warning when the link cannot be generated, sending nothing", async () => {
    mocks.generateLink.mockResolvedValue({
      data: { properties: null },
      error: { message: "boom" },
    });

    const result = await UserService.createUserWithWelcome({
      email: "ana@example.cl",
    } as never);

    expect(result.user).toEqual(profile);
    expect(result.warning).toMatch(/contraseña/);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.sendEmailViaWorker).not.toHaveBeenCalled();
  });

  it("returns a warning when the email cannot be sent", async () => {
    mocks.sendEmailViaWorker.mockResolvedValue({
      success: false,
      error: "worker_timeout",
    });

    const result = await UserService.createUserWithWelcome({
      email: "ana@example.cl",
    } as never);

    expect(result.user).toEqual(profile);
    expect(result.warning).toMatch(/correo/);
  });

  it("createUser still returns just the profile for the other callers", async () => {
    await expect(
      UserService.createUser({ email: "ana@example.cl" } as never),
    ).resolves.toEqual(profile);
  });
});
