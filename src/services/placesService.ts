/**
 * Server-only client for Google Places API (New).
 *
 * The API key is a server secret read at call time. Never import this module from browser code,
 * and never log the key, the query text or the resolved address.
 */

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";
const DETAILS_FIELD_MASK = "formattedAddress,addressComponents,location";
const AUTOCOMPLETE_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat";
const TIMEOUT_MS = 8000;
const MAX_SUGGESTIONS = 5;

export type PlacesErrorCode =
  | "not_configured"
  | "timeout"
  | "upstream"
  | "invalid_response"
  | "not_found";

export class PlacesError extends Error {
  readonly code: PlacesErrorCode;
  constructor(code: PlacesErrorCode) {
    super(code);
    this.name = "PlacesError";
    this.code = code;
  }
}

export interface PlaceSuggestion {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
}

export interface NormalizedAddress {
  formattedAddress: string;
  street: string | null;
  number: string | null;
  commune: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
}

interface AddressComponent {
  longText?: string;
  types?: string[];
}

function pick(
  components: AddressComponent[],
  ...types: string[]
): string | null {
  for (const type of types) {
    const match = components.find((component) =>
      component.types?.includes(type),
    );
    if (match?.longText) return match.longText;
  }
  return null;
}

export class PlacesService {
  private static getKey(): string {
    // process.env first: on Vercel the secret is a runtime variable, not a build-time one.
    const key =
      process.env.GOOGLE_MAPS_API_KEY || import.meta.env.GOOGLE_MAPS_API_KEY;
    if (!key || typeof key !== "string")
      throw new PlacesError("not_configured");
    return key;
  }

  private static async request(
    url: string,
    init: RequestInit,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      throw new PlacesError(
        name === "TimeoutError" || name === "AbortError"
          ? "timeout"
          : "upstream",
      );
    }

    if (response.status === 404) throw new PlacesError("not_found");
    if (!response.ok) {
      // Only the status is logged: bodies may echo the query or the address.
      console.error("[PlacesService] Respuesta no exitosa de Google Places:", {
        status: response.status,
      });
      throw new PlacesError("upstream");
    }

    try {
      return await response.json();
    } catch {
      throw new PlacesError("invalid_response");
    }
  }

  static async autocomplete(params: {
    input: string;
    sessionToken: string;
  }): Promise<PlaceSuggestion[]> {
    const key = PlacesService.getKey();
    const data = (await PlacesService.request(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": AUTOCOMPLETE_FIELD_MASK,
      },
      body: JSON.stringify({
        input: params.input,
        includedRegionCodes: ["cl"],
        languageCode: "es",
        sessionToken: params.sessionToken,
      }),
    })) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }>;
    } | null;

    const result: PlaceSuggestion[] = [];
    for (const suggestion of data?.suggestions ?? []) {
      const prediction = suggestion.placePrediction;
      if (!prediction?.placeId) continue;
      const text = prediction.text?.text ?? "";
      result.push({
        placeId: prediction.placeId,
        text,
        mainText: prediction.structuredFormat?.mainText?.text ?? text,
        secondaryText: prediction.structuredFormat?.secondaryText?.text ?? "",
      });
      if (result.length === MAX_SUGGESTIONS) break;
    }
    return result;
  }

  static async details(params: {
    placeId: string;
    sessionToken: string;
  }): Promise<NormalizedAddress> {
    const key = PlacesService.getKey();
    const url = `${DETAILS_URL}/${encodeURIComponent(params.placeId)}?languageCode=es&sessionToken=${encodeURIComponent(
      params.sessionToken,
    )}`;
    const data = (await PlacesService.request(url, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    })) as {
      formattedAddress?: string;
      addressComponents?: AddressComponent[];
      location?: { latitude?: number; longitude?: number };
    } | null;

    if (!data || typeof data !== "object")
      throw new PlacesError("invalid_response");

    const components = data.addressComponents ?? [];
    return {
      formattedAddress: data.formattedAddress ?? "",
      street: pick(components, "route"),
      number: pick(components, "street_number"),
      // In Chile the commune is administrative_area_level_3, falling back to the locality.
      commune: pick(components, "administrative_area_level_3", "locality"),
      city: pick(components, "locality", "administrative_area_level_2"),
      region: pick(components, "administrative_area_level_1"),
      country: pick(components, "country"),
      postalCode: pick(components, "postal_code"),
      lat: data.location?.latitude ?? null,
      lng: data.location?.longitude ?? null,
    };
  }
}
