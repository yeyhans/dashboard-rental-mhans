import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ATTACHMENT_MAX_BYTES,
  fetchAttachment,
  isAllowedAttachmentUrl,
} from "../safeFetch";

/** D1-c: the shared attachment download used by the contract and manual emails. */
describe("fetchAttachment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows only https on the app's own hosts", () => {
    expect(isAllowedAttachmentUrl("https://media.mariohans.cl/a.pdf")).toBe(
      true,
    );
    expect(isAllowedAttachmentUrl("http://media.mariohans.cl/a.pdf")).toBe(
      false,
    );
    expect(isAllowedAttachmentUrl("https://evil.example.com/a.pdf")).toBe(
      false,
    );
    expect(isAllowedAttachmentUrl("not a url")).toBe(false);
  });

  it("rejects a disallowed host without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchAttachment("https://127.0.0.1/secret")).rejects.toThrow(
      "hosts permitidos",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never follows a redirect", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new TypeError("redirect");
    });
    vi.stubGlobal("fetch", fetchSpy);
    await expect(
      fetchAttachment("https://media.mariohans.cl/a.pdf"),
    ).rejects.toThrow();
    expect(fetchSpy.mock.calls[0]).toBeDefined();
    expect((fetchSpy.mock.calls[0] as unknown[])[1]).toMatchObject({
      redirect: "error",
    });
  });

  it("rejects an oversized body by header and by stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("x", {
            headers: { "content-length": String(ATTACHMENT_MAX_BYTES + 1) },
          }),
      ),
    );
    await expect(
      fetchAttachment("https://media.mariohans.cl/a.pdf"),
    ).rejects.toThrow("declarado");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array(2048))),
    );
    await expect(
      fetchAttachment("https://media.mariohans.cl/a.pdf", { maxBytes: 1024 }),
    ).rejects.toThrow("fuera de rango");
  });

  it("returns the bytes of an allowed, small file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("%PDF")),
    );
    const bytes = await fetchAttachment("https://media.mariohans.cl/a.pdf");
    expect(Buffer.from(bytes).toString()).toBe("%PDF");
  });
});
