import {
  parseSiteSettings,
  withDefaults,
  type SiteSettings,
  type SiteSettingsError,
} from "../lib/siteSettings";
import { supabaseAdmin } from "../lib/supabase";

/**
 * Business settings (`site_settings`, migration 0015). Single row, `id = 1`. Reads are cached for
 * 60 s in memory (per server instance); every write invalidates the cache of the instance that
 * handled it. A missing row or a missing table is not an error for readers: the PDFs keep working
 * with `DEFAULT_SETTINGS`. Access control is the API layer's job (`requireRole('super_admin')`).
 */

const CACHE_TTL_MS = 60_000;
const ROW_ID = 1;

export type SiteSettingsSection = Exclude<
  keyof SiteSettings,
  "pickupAddresses"
>;
export type SiteSettingsPatch = {
  [K in SiteSettingsSection]?: Partial<SiteSettings[K]>;
} & { pickupAddresses?: string[] };

/** Subset of the settings that is safe to hand to the public frontend. Strings only. */
export interface PublicSiteProfile {
  legalName: string;
  tradeName: string;
  rut: string;
  representativeName: string;
  contactEmail: string;
  phone: string;
  domicilio: string;
}

export class SiteSettingsValidationError extends Error {
  readonly details: SiteSettingsError;

  constructor(details: SiteSettingsError) {
    super(details.message);
    this.name = "SiteSettingsValidationError";
    this.details = details;
  }
}

let cache: { value: SiteSettings; expiresAt: number } | null = null;
let warned = false;

/** Test hook. `keepWarned` clears the cache but keeps the "already logged" flag. */
export function __resetCacheForTests(
  options: { keepWarned?: boolean } = {},
): void {
  cache = null;
  if (!options.keepWarned) warned = false;
}

function warnOnce(message: string, detail: unknown): void {
  if (warned) return;
  warned = true;
  console.error(`[SiteSettingsService] ${message}`, detail);
}

export class SiteSettingsService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not available");
    }
    // `site_settings` is not in the generated types until 0015 is applied and they are regenerated.
    return supabaseAdmin as any;
  }

  /** Reads the row; never throws. Returns defaults when the row, the table or the data is unusable. */
  private static async read(): Promise<SiteSettings> {
    try {
      const client = this.ensureSupabaseAdmin();
      const { data, error } = await client
        .from("site_settings")
        .select("data")
        .eq("id", ROW_ID)
        .maybeSingle();

      if (error) {
        warnOnce(
          "No se pudo leer site_settings, se usan los valores por defecto:",
          error,
        );
        return withDefaults(undefined);
      }
      if (!data) return withDefaults(undefined);

      const parsed = parseSiteSettings(data.data);
      if (parsed.error) {
        warnOnce(
          "site_settings contiene datos inválidos, se usan los valores por defecto:",
          parsed.error.issues,
        );
        return withDefaults(undefined);
      }
      return parsed.settings;
    } catch (error) {
      warnOnce(
        "Error inesperado al leer site_settings, se usan los valores por defecto:",
        error,
      );
      return withDefaults(undefined);
    }
  }

  /**
   * Strict reader for the write path: a read error or invalid stored data throws instead of
   * degrading to the defaults, so a transient failure can never seed a merge that overwrites the
   * saved settings. Only a genuinely missing row resolves to the defaults.
   */
  private static async readStrict(): Promise<SiteSettings> {
    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from("site_settings")
      .select("data")
      .eq("id", ROW_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data) return withDefaults(undefined);

    const parsed = parseSiteSettings(data.data);
    if (parsed.error) throw new SiteSettingsValidationError(parsed.error);
    return parsed.settings;
  }

  /** Settings merged over the defaults, cached for 60 s. */
  static async get(): Promise<SiteSettings> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) return cache.value;

    const value = await this.read();
    cache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  }

  /**
   * Public subset for the frontend (terms page, consent texts). Whitelist mapper: never add bank
   * data, signature, or the admin notification email here.
   */
  static async getPublicProfile(): Promise<PublicSiteProfile> {
    const settings = await this.get();
    return {
      legalName: settings.company.legalName ?? "",
      tradeName: settings.company.tradeName ?? "",
      rut: settings.company.rut ?? "",
      representativeName: settings.representative.name ?? "",
      contactEmail: settings.contact.email ?? "",
      phone: settings.contact.phone ?? "",
      domicilio: settings.company.domicilio ?? "",
    };
  }

  /** Merges `patch` over the stored settings, validates, saves and returns the result. */
  static async update(
    patch: SiteSettingsPatch,
    updatedBy: string,
  ): Promise<SiteSettings> {
    const current = await this.readStrict();
    const merged: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const base = (current as unknown as Record<string, unknown>)[key];
      merged[key] =
        key === "pickupAddresses" || typeof base !== "object" || base === null
          ? value
          : { ...(base as object), ...(value as object) };
    }

    const { settings, error } = parseSiteSettings(merged);
    if (error) throw new SiteSettingsValidationError(error);

    const client = this.ensureSupabaseAdmin();
    const { error: dbError } = await client
      .from("site_settings")
      .upsert({ id: ROW_ID, data: settings, updated_by: updatedBy });
    if (dbError) {
      console.error("[SiteSettingsService] Error al guardar site_settings:", {
        error: dbError,
      });
      throw dbError;
    }

    cache = null;
    return settings;
  }

  /** Stores the representative's signature url (already cache-busted by the caller). */
  static async setSignatureUrl(
    url: string,
    updatedBy: string,
  ): Promise<SiteSettings> {
    return this.update(
      {
        representative: {
          signatureUrl: url,
          signatureUpdatedAt: new Date().toISOString(),
        },
      },
      updatedBy,
    );
  }
}
