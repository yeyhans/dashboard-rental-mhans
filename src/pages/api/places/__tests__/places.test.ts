import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const autocomplete = vi.fn();
const details = vi.fn();

vi.mock("../../../../middleware/auth", () => ({
  withAuth:
    (handler: (context: any) => Promise<Response>) => async (context: any) => {
      if (!context.locals?.user) {
        return new Response(
          JSON.stringify({ success: false, error: "No autorizado" }),
          { status: 401 },
        );
      }
      return handler(context);
    },
}));

vi.mock("../../../../services/placesService", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../services/placesService")
  >("../../../../services/placesService");
  return { ...actual, PlacesService: { autocomplete, details } };
});

const TOKEN = "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f7a8";
let adminCounter = 0;
let admin = {
  locals: { user: { id: "admin-0", email: "a@x.cl", role: "admin" } },
};

function call(body: unknown, ctx: any = admin) {
  const request = new Request("https://dash.test/api/places/x", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { request, ...ctx } as never;
}

describe("POST /api/places/autocomplete", () => {
  beforeEach(() => {
    adminCounter += 1;
    admin = {
      locals: {
        user: { id: `admin-${adminCounter}`, email: "a@x.cl", role: "admin" },
      },
    };
  });
  afterEach(() => vi.clearAllMocks());

  it("401 without a session", async () => {
    const { POST } = await import("../autocomplete");
    const response = await POST(
      call({ input: "abc", sessionToken: TOKEN }, { locals: {} }),
    );
    expect(response.status).toBe(401);
    expect(autocomplete).not.toHaveBeenCalled();
  });

  it("400 on short input, bad token or invalid JSON", async () => {
    const { POST } = await import("../autocomplete");
    expect(
      (await POST(call({ input: "ab", sessionToken: TOKEN }))).status,
    ).toBe(400);
    expect((await POST(call({ input: "abc", sessionToken: "x" }))).status).toBe(
      400,
    );
    expect((await POST(call("{nope"))).status).toBe(400);
    expect(autocomplete).not.toHaveBeenCalled();
  });

  it("200 with suggestions, uncached", async () => {
    autocomplete.mockResolvedValue([
      { placeId: "p", text: "t", mainText: "m", secondaryText: "s" },
    ]);
    const { POST } = await import("../autocomplete");
    const response = await POST(
      call({ input: " apoquindo ", sessionToken: TOKEN }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).data).toHaveLength(1);
    expect(autocomplete).toHaveBeenCalledWith({
      input: "apoquindo",
      sessionToken: TOKEN,
    });
  });

  it("503 with a Spanish message when Places fails, without leaking the code", async () => {
    const { PlacesError } = await import("../../../../services/placesService");
    vi.spyOn(console, "error").mockImplementation(() => {});
    autocomplete.mockRejectedValue(new PlacesError("upstream"));
    const { POST } = await import("../autocomplete");
    const response = await POST(call({ input: "abc", sessionToken: TOKEN }));
    expect(response.status).toBe(503);
    expect((await response.json()).success).toBe(false);
  });

  it("429 after the per-admin limit", async () => {
    autocomplete.mockResolvedValue([]);
    const { POST } = await import("../autocomplete");
    let last = 200;
    for (let i = 0; i < 61; i += 1) {
      last = (await POST(call({ input: "abc", sessionToken: TOKEN }))).status;
    }
    expect(last).toBe(429);
    // another admin is unaffected
    const other = {
      locals: { user: { id: "someone-else", email: "b@x.cl", role: "admin" } },
    };
    expect(
      (await POST(call({ input: "abc", sessionToken: TOKEN }, other))).status,
    ).toBe(200);
  });
});

describe("POST /api/places/details", () => {
  beforeEach(() => {
    adminCounter += 1;
    admin = {
      locals: {
        user: { id: `admin-${adminCounter}`, email: "a@x.cl", role: "admin" },
      },
    };
  });
  afterEach(() => vi.clearAllMocks());

  it("401 without a session", async () => {
    const { POST } = await import("../details");
    expect(
      (await POST(call({ placeId: "p", sessionToken: TOKEN }, { locals: {} })))
        .status,
    ).toBe(401);
  });

  it("400 on missing placeId or bad token", async () => {
    const { POST } = await import("../details");
    expect((await POST(call({ sessionToken: TOKEN }))).status).toBe(400);
    expect(
      (await POST(call({ placeId: "bad id!", sessionToken: TOKEN }))).status,
    ).toBe(400);
    expect((await POST(call({ placeId: "p", sessionToken: "" }))).status).toBe(
      400,
    );
  });

  it("200 with the normalized address", async () => {
    details.mockResolvedValue({ formattedAddress: "X", commune: "Las Condes" });
    const { POST } = await import("../details");
    const response = await POST(
      call({ placeId: "ChIJabc_-1", sessionToken: TOKEN }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).data.commune).toBe("Las Condes");
  });

  it("404 when the place does not exist", async () => {
    const { PlacesError } = await import("../../../../services/placesService");
    vi.spyOn(console, "error").mockImplementation(() => {});
    details.mockRejectedValue(new PlacesError("not_found"));
    const { POST } = await import("../details");
    expect(
      (await POST(call({ placeId: "p", sessionToken: TOKEN }))).status,
    ).toBe(404);
  });
});
