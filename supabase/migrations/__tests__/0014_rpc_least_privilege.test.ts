import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Static assertions over `0014_rpc_least_privilege.sql`, which closes anon access to the
 * SECURITY DEFINER functions that let anyone holding the public anon key read or rewrite
 * arbitrary `user_profiles` rows (and apply coupons/shipping to arbitrary orders), because none
 * of them checked `auth.uid()`. Verified 2026-10-01, identical in production and consolidado.
 *
 * Vitest has no database: text assertions only. The runtime proof is applying on consolidado
 * (T2) and verifying with the post-apply `has_function_privilege` assertions, then production
 * (T3) in an authorized window.
 */
function read(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function executableSql(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const migrationSql = executableSql(read("../0014_rpc_least_privilege.sql"));
const rollbackSql = executableSql(read("../0014_rpc_least_privilege.down.sql"));

const GROUP_A = [
  "update_user_profile_admin",
  "update_user_profile_admin_full",
  "admin_create_user_profile",
  "create_user_profile_manual",
  "migrate_existing_users_to_profiles",
  "get_user_profile_by_auth_uid",
  "handle_new_user",
  "hermes_notify_new_order",
];

const GROUP_B = [
  "update_user_profile_securely",
  "apply_coupon",
  "apply_shipping_method",
  "get_user_coupon_history",
  "get_user_shipping_history",
];

const GROUP_C = [
  "validate_coupon",
  "calculate_shipping_cost",
  "get_available_shipping_methods",
  "search_coupons",
];

describe("0014_rpc_least_privilege migration", () => {
  it("guards execution as supabase_admin and wraps everything in a transaction", () => {
    expect(migrationSql).toMatch(
      /pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i,
    );
    expect(migrationSql).toMatch(/^\s*BEGIN;/m);
    expect(migrationSql).toMatch(/^\s*COMMIT;/m);
    expect(migrationSql).toMatch(/SET\s+lock_timeout/i);
    expect(migrationSql).toMatch(/SET\s+statement_timeout/i);
  });

  describe("group A — service_role only", () => {
    for (const fn of GROUP_A) {
      describe(fn, () => {
        it("revokes EXECUTE from PUBLIC and from anon, authenticated, and grants only service_role", () => {
          const fnPattern = fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          expect(migrationSql).toMatch(
            new RegExp(
              `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${fnPattern}\\([^)]*\\)\\s+FROM\\s+PUBLIC`,
              "i",
            ),
          );
          expect(migrationSql).toMatch(
            new RegExp(
              `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${fnPattern}\\([^)]*\\)\\s+FROM\\s+anon,\\s*authenticated`,
              "i",
            ),
          );
          expect(migrationSql).toMatch(
            new RegExp(
              `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fnPattern}\\([^)]*\\)\\s+TO\\s+service_role`,
              "i",
            ),
          );
        });
      });
    }
  });

  describe("group B — authenticated + ownership guard", () => {
    for (const fn of GROUP_B) {
      describe(fn, () => {
        const fnPattern = fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const body =
          migrationSql.match(
            new RegExp(
              `CREATE OR REPLACE FUNCTION\\s+public\\.${fnPattern}\\(([\\s\\S]*?)\\n\\$[a-z_]*\\$;`,
              "i",
            ),
          )?.[0] ?? "";

        it("was actually found in the file, replaced in place", () => {
          expect(migrationSql).toMatch(
            new RegExp(
              `CREATE OR REPLACE FUNCTION\\s+public\\.${fnPattern}\\(`,
              "i",
            ),
          );
          expect(body.length).toBeGreaterThan(0);
        });

        it("carries the ownership guard on auth.uid() and auth.role(), never the raw claim setting", () => {
          expect(body).toMatch(/auth\.uid\(\)/);
          // auth.role() reads both `request.jwt.claim.role` (legacy PostgREST) and
          // `request.jwt.claims ->> 'role'` (current). Reading the legacy setting directly would
          // make service_role fail the guard on current PostgREST and break the dashboard.
          expect(body).toMatch(
            /auth\.role\(\)\s+IS DISTINCT FROM\s+'service_role'/,
          );
          expect(body).not.toMatch(/request\.jwt\.claim/);
        });

        it("pins search_path as SECURITY DEFINER hardening", () => {
          expect(body).toMatch(/SET\s+search_path\s*=\s*public,\s*pg_temp/i);
        });

        it("revokes EXECUTE from anon and grants to authenticated, service_role", () => {
          expect(migrationSql).toMatch(
            new RegExp(
              `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${fnPattern}\\([^)]*\\)\\s+FROM\\s+PUBLIC`,
              "i",
            ),
          );
          expect(migrationSql).toMatch(
            new RegExp(
              `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${fnPattern}\\([^)]*\\)\\s+FROM\\s+anon\\b`,
              "i",
            ),
          );
          expect(migrationSql).toMatch(
            new RegExp(
              `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fnPattern}\\([^)]*\\)\\s+TO\\s+authenticated,\\s*service_role`,
              "i",
            ),
          );
        });

        it("does not still grant EXECUTE to anon in the up migration", () => {
          const grantsToAnon = new RegExp(
            `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fnPattern}\\([^)]*\\)\\s+TO\\s+[^;]*\\banon\\b`,
            "i",
          );
          expect(migrationSql).not.toMatch(grantsToAnon);
        });
      });
    }

    it("apply_coupon and apply_shipping_method re-raise the guard before WHEN OTHERS swallows it", () => {
      for (const fn of ["apply_coupon", "apply_shipping_method"]) {
        const body =
          migrationSql.match(
            new RegExp(
              `CREATE OR REPLACE FUNCTION\\s+public\\.${fn}\\(([\\s\\S]*?)\\n\\$[a-z_]*\\$;`,
              "i",
            ),
          )?.[0] ?? "";
        expect(body.length).toBeGreaterThan(0);
        expect(body).toMatch(
          /EXCEPTION\s+WHEN\s+insufficient_privilege\s+THEN\s+RAISE;/i,
        );
        expect(body).toMatch(
          /WHEN\s+insufficient_privilege[\s\S]*WHEN\s+OTHERS/i,
        );
      }
    });
  });

  describe("group C — unchanged, deliberately anon-callable", () => {
    for (const fn of GROUP_C) {
      it(`${fn} is not mentioned in any REVOKE`, () => {
        const fnPattern = fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const revokesFn = new RegExp(
          `REVOKE[^;]*\\bpublic\\.${fnPattern}\\(`,
          "i",
        );
        expect(migrationSql).not.toMatch(revokesFn);
        expect(rollbackSql).not.toMatch(revokesFn);
      });
    }
  });

  describe("rollback", () => {
    it("is guarded the same way and wraps everything in a transaction", () => {
      expect(rollbackSql).toMatch(
        /pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i,
      );
      expect(rollbackSql).toMatch(/^\s*BEGIN;/m);
      expect(rollbackSql).toMatch(/^\s*COMMIT;/m);
      expect(rollbackSql).toMatch(/SET\s+lock_timeout/i);
      expect(rollbackSql).toMatch(/SET\s+statement_timeout/i);
    });

    it("re-grants EXECUTE to anon and authenticated on every group A and B function", () => {
      for (const fn of [...GROUP_A, ...GROUP_B]) {
        const fnPattern = fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        expect(rollbackSql).toMatch(
          new RegExp(
            `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fnPattern}\\([^)]*\\)\\s+TO\\s+anon,\\s*authenticated`,
            "i",
          ),
        );
      }
    });

    it("contains no auth.uid() — it restores the original bodies without the ownership guard", () => {
      expect(rollbackSql).not.toMatch(/auth\.uid\(\)/);
    });
  });
});
