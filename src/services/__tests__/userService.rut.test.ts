import { describe, expect, it, vi } from "vitest";

const { from, rpc, createUser } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from,
    rpc,
    auth: { admin: { createUser, deleteUser: vi.fn() } },
  },
}));
vi.mock("../../lib/emailWorkerService", () => ({
  sendEmailViaWorker: vi.fn(),
}));

import { InvalidRutError, UserService } from "../userService";

describe("UserService — RUT con dígito verificador", () => {
  it("createUser rechaza un RUT inválido antes de crear la cuenta", async () => {
    await expect(
      UserService.createUser({ email: "a@b.cl", rut: "12.345.678-4" } as never),
    ).rejects.toBeInstanceOf(InvalidRutError);
    expect(createUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("updateUser rechaza un RUT inválido antes de tocar la base", async () => {
    await expect(
      UserService.updateUser(1, { rut: "1-9" } as never),
    ).rejects.toThrow("El RUT no es válido. Revisa el dígito verificador.");
    expect(from).not.toHaveBeenCalled();
  });

  it("updateUser sin RUT en el payload no valida nada", async () => {
    from.mockImplementation(() => {
      throw new Error("db-reached");
    });
    await expect(
      UserService.updateUser(1, { nombre: "Ana" } as never),
    ).rejects.not.toBeInstanceOf(InvalidRutError);
  });
});
