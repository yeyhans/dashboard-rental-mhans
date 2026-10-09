import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlacesError, PlacesService } from "../placesService";

const KEY = "test-key-not-real";
const TOKEN = "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f7a8";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PlacesService", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", KEY);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  describe("autocomplete", () => {
    it("posts to Places (New) with Chile restriction and maps suggestions", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          suggestions: [
            {
              placePrediction: {
                placeId: "p1",
                text: { text: "Av. Apoquindo 3000, Las Condes, Chile" },
                structuredFormat: {
                  mainText: { text: "Av. Apoquindo 3000" },
                  secondaryText: { text: "Las Condes, Chile" },
                },
              },
            },
            { queryPrediction: { text: { text: "ignored" } } },
          ],
        }),
      );

      const result = await PlacesService.autocomplete({
        input: "apoquindo 3000",
        sessionToken: TOKEN,
      });

      expect(result).toEqual([
        {
          placeId: "p1",
          text: "Av. Apoquindo 3000, Las Condes, Chile",
          mainText: "Av. Apoquindo 3000",
          secondaryText: "Las Condes, Chile",
        },
      ]);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
      expect(init.method).toBe("POST");
      expect(init.headers["X-Goog-Api-Key"]).toBe(KEY);
      expect(init.headers["X-Goog-FieldMask"]).toContain(
        "suggestions.placePrediction.placeId",
      );
      expect(JSON.parse(init.body)).toEqual({
        input: "apoquindo 3000",
        includedRegionCodes: ["cl"],
        languageCode: "es",
        sessionToken: TOKEN,
      });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("fails with not_configured when the key is missing", async () => {
      vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
      await expect(
        PlacesService.autocomplete({ input: "abc", sessionToken: TOKEN }),
      ).rejects.toMatchObject({
        code: "not_configured",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("maps a timeout to the timeout code", async () => {
      fetchMock.mockRejectedValue(
        Object.assign(new Error("t"), { name: "TimeoutError" }),
      );
      await expect(
        PlacesService.autocomplete({ input: "abc", sessionToken: TOKEN }),
      ).rejects.toMatchObject({
        code: "timeout",
      });
    });

    it("maps a non-ok response to upstream without logging the key or the query", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { message: "echo apoquindo" } }, 403),
      );
      await expect(
        PlacesService.autocomplete({ input: "apoquindo", sessionToken: TOKEN }),
      ).rejects.toBeInstanceOf(PlacesError);
      const logged = JSON.stringify(errorSpy.mock.calls);
      expect(logged).not.toContain(KEY);
      expect(logged).not.toContain("apoquindo");
    });
  });

  describe("details", () => {
    it("normalizes a Chilean address using level_3 as commune", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          formattedAddress:
            "Av. Apoquindo 3000, Las Condes, Región Metropolitana, Chile",
          addressComponents: [
            { longText: "3000", types: ["street_number"] },
            { longText: "Avenida Apoquindo", types: ["route"] },
            {
              longText: "Las Condes",
              types: ["administrative_area_level_3", "political"],
            },
            { longText: "Santiago", types: ["locality", "political"] },
            {
              longText: "Región Metropolitana",
              types: ["administrative_area_level_1"],
            },
            { longText: "Chile", types: ["country"] },
            { longText: "7550000", types: ["postal_code"] },
          ],
          location: { latitude: -33.41, longitude: -70.58 },
        }),
      );

      const result = await PlacesService.details({
        placeId: "p/1",
        sessionToken: TOKEN,
      });

      expect(result).toEqual({
        formattedAddress:
          "Av. Apoquindo 3000, Las Condes, Región Metropolitana, Chile",
        street: "Avenida Apoquindo",
        number: "3000",
        commune: "Las Condes",
        city: "Santiago",
        region: "Región Metropolitana",
        country: "Chile",
        postalCode: "7550000",
        lat: -33.41,
        lng: -70.58,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/v1/places/p%2F1?languageCode=es");
      expect(url).not.toContain(KEY);
      expect(init.headers["X-Goog-FieldMask"]).toBe(
        "formattedAddress,addressComponents,location",
      );
    });

    it("falls back to locality for the commune and nulls missing parts", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          formattedAddress: "X",
          addressComponents: [{ longText: "Ñuñoa", types: ["locality"] }],
        }),
      );
      const result = await PlacesService.details({
        placeId: "p",
        sessionToken: TOKEN,
      });
      expect(result.commune).toBe("Ñuñoa");
      expect(result.street).toBeNull();
      expect(result.lat).toBeNull();
    });

    it("maps 404 to not_found", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 404));
      await expect(
        PlacesService.details({ placeId: "p", sessionToken: TOKEN }),
      ).rejects.toMatchObject({
        code: "not_found",
      });
    });

    it("maps invalid JSON to invalid_response", async () => {
      fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
      await expect(
        PlacesService.details({ placeId: "p", sessionToken: TOKEN }),
      ).rejects.toMatchObject({
        code: "invalid_response",
      });
    });
  });
});
