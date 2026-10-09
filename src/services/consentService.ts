import { isIP } from "node:net";
import { supabaseAdmin } from "../lib/supabase";

/**
 * Append-only consent ledger (`public.data_consents`, Ley 21.719). Only service_role can read or
 * write it. The latest row per (auth_uid, purpose) is the current state; a withdrawal is a new
 * row with `granted = false`. Rows are never updated or deleted.
 *
 * `data_consents` is not in the generated `src/types/database.ts` yet, so the client is used
 * through a loosely typed handle.
 */

export const CONSENT_PURPOSES = [
  "international_transfer",
  "ocr_processing",
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const MAX_CONSENT_VERSION_LENGTH = 64;
export const MAX_USER_AGENT_LENGTH = 512;

export interface ConsentInput {
  purpose: ConsentPurpose;
  granted: boolean;
}

export interface RecordConsentsParams {
  authUid: string;
  consentVersion: string;
  consents: ConsentInput[];
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ConsentState {
  granted: boolean;
  consent_version: string;
  created_at: string;
}

export type ConsentStatus = Record<ConsentPurpose, ConsentState | null>;

interface ConsentRow {
  purpose: string;
  granted: boolean;
  consent_version: string;
  created_at: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ConsentService {
  private static db() {
    if (!supabaseAdmin) throw new Error("supabaseAdmin no está inicializado");
    return supabaseAdmin as unknown as { from: (table: string) => any };
  }

  static isValidUuid(value: unknown): value is string {
    return typeof value === "string" && UUID_PATTERN.test(value);
  }

  static isPurpose(value: unknown): value is ConsentPurpose {
    return (
      typeof value === "string" &&
      (CONSENT_PURPOSES as readonly string[]).includes(value)
    );
  }

  /** Returns the trimmed IP when it is valid IPv4/IPv6, otherwise null (invalid IPs are dropped). */
  static normalizeIp(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return isIP(trimmed) !== 0 ? trimmed : null;
  }

  static normalizeUserAgent(value: unknown): string | null {
    if (typeof value !== "string" || value.length === 0) return null;
    return value.slice(0, MAX_USER_AGENT_LENGTH);
  }

  /** True when a profile with this auth_uid exists (avoids junk consent rows). */
  static async userExists(authUid: string): Promise<boolean> {
    const { data, error } = await ConsentService.db()
      .from("user_profiles")
      .select("auth_uid")
      .eq("auth_uid", authUid)
      .maybeSingle();

    if (error) {
      console.error("[ConsentService] Error verificando usuario:", {
        error: error.message,
      });
      throw error;
    }
    return !!data;
  }

  /** Inserts one row per consent in a single insert. Returns the number of rows recorded. */
  static async record(params: RecordConsentsParams): Promise<number> {
    const rows = params.consents.map((consent) => ({
      auth_uid: params.authUid,
      purpose: consent.purpose,
      consent_version: params.consentVersion,
      granted: consent.granted,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    }));

    const { error } = await ConsentService.db()
      .from("data_consents")
      .insert(rows);
    if (error) {
      console.error("[ConsentService] Error registrando consentimientos:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        status: error.status,
        shape: typeof error === "object" ? Object.keys(error) : typeof error,
      });
      throw error;
    }

    console.log("[ConsentService] Consentimientos registrados:", {
      authUid: params.authUid,
      count: rows.length,
    });
    return rows.length;
  }

  /** Current state per purpose: the latest row wins; null when the purpose was never answered. */
  static async getStatus(authUid: string): Promise<ConsentStatus> {
    const { data, error } = await ConsentService.db()
      .from("data_consents")
      .select("purpose, granted, consent_version, created_at")
      .eq("auth_uid", authUid)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error("[ConsentService] Error consultando consentimientos:", {
        error: error.message,
      });
      throw error;
    }

    const status: ConsentStatus = {
      international_transfer: null,
      ocr_processing: null,
    };
    for (const row of (data ?? []) as ConsentRow[]) {
      if (
        !ConsentService.isPurpose(row.purpose) ||
        status[row.purpose] !== null
      )
        continue;
      status[row.purpose] = {
        granted: row.granted,
        consent_version: row.consent_version,
        created_at: row.created_at,
      };
    }
    return status;
  }
}
