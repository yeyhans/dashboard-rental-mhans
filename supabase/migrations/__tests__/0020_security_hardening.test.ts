import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Static assertions over `0020_security_hardening.sql` (cutover audit 2026-10-13, F2-F5).
 *
 * Vitest has no database: text assertions only. The runtime proof is applying on consolidado and
 * running the post-apply checks listed at the bottom of the migration.
 */
function path(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function executableSql(relativePath: string): string {
  return readFileSync(path(relativePath), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const FORWARD = "../0020_security_hardening.sql";
const ROLLBACK = "../0020_security_hardening.down.sql";

describe("0020_security_hardening migration", () => {
  it("ships a forward and a rollback file", () => {
    expect(existsSync(path(FORWARD))).toBe(true);
    expect(existsSync(path(ROLLBACK))).toBe(true);
  });

  const sql = existsSync(path(FORWARD)) ? executableSql(FORWARD) : "";
  const down = existsSync(path(ROLLBACK)) ? executableSql(ROLLBACK) : "";

  it("guards execution as supabase_admin inside a transaction with a lock timeout", () => {
    for (const source of [sql, down]) {
      expect(source).toMatch(/SET lock_timeout = '5s';/);
      expect(source).toMatch(/BEGIN;[\s\S]*COMMIT;/);
      expect(source).toMatch(
        /pg_has_role\(current_user, 'supabase_admin', 'USAGE'\)/,
      );
    }
  });

  it("F2: removes customer INSERT/UPDATE on orders and keeps the own-orders read", () => {
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE ON public\.orders FROM authenticated;/,
    );
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS "Customers can create their own orders" ON public\.orders;/,
    );
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS "Customers can update their own orders" ON public\.orders;/,
    );
    expect(sql).not.toMatch(
      /DROP POLICY[^;]*Customers can read their own orders/,
    );
  });

  it("F3: guards the contract columns of user_profiles with a trigger", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.guard_user_profiles_server_columns\(\)/,
    );
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/auth\.role\(\)/);
    expect(sql).toMatch(/url_user_contrato/);
    expect(sql).toMatch(/terminos_aceptados/);
    expect(sql).toMatch(
      /CREATE TRIGGER guard_user_profiles_server_columns\s+BEFORE INSERT OR UPDATE ON public\.user_profiles/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.guard_user_profiles_server_columns\(\) FROM PUBLIC, anon, authenticated;/,
    );
  });

  it("F4: pins search_path on the four SECURITY DEFINER coupon/shipping functions", () => {
    for (const signature of [
      "search_coupons(character varying, character varying)",
      "validate_coupon(character varying, integer, numeric)",
      "calculate_shipping_cost(integer, numeric, character varying)",
      "get_available_shipping_methods(numeric, character varying)",
    ]) {
      const escaped = signature.replace(/[()]/g, "\\$&");
      expect(sql).toMatch(
        new RegExp(
          `ALTER FUNCTION public\\.${escaped}\\s+SET search_path = public, pg_temp;`,
        ),
      );
      expect(sql).toMatch(
        new RegExp(
          `REVOKE EXECUTE ON FUNCTION public\\.${escaped} FROM PUBLIC;`,
        ),
      );
    }
  });

  it("F4: keeps anon EXECUTE only where the browser calls the function", () => {
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.search_coupons\(character varying, character varying\) FROM anon, authenticated;/,
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.calculate_shipping_cost\(integer, numeric, character varying\) FROM anon, authenticated;/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.validate_coupon\(character varying, integer, numeric\) TO anon, authenticated, service_role;/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_available_shipping_methods\(numeric, character varying\) TO anon, authenticated, service_role;/,
    );
  });

  it("F5: drops the default EXECUTE grant to anon/authenticated for both grantors", () => {
    for (const grantor of ["postgres", "supabase_admin"]) {
      expect(sql).toMatch(
        new RegExp(
          `ALTER DEFAULT PRIVILEGES FOR ROLE ${grantor}\\s+IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;`,
        ),
      );
    }
  });

  it("F5: revokes TRUNCATE, REFERENCES and TRIGGER from anon/authenticated on every public relation", () => {
    expect(sql).toMatch(/FROM pg_class/);
    expect(sql).toMatch(
      /REVOKE TRUNCATE, REFERENCES, TRIGGER ON public\.%I FROM anon, authenticated/,
    );
  });

  it("rollback restores the previous grants, policies and defaults", () => {
    expect(down).toMatch(
      /GRANT INSERT, UPDATE ON public\.orders TO authenticated;/,
    );
    expect(down).toMatch(
      /CREATE POLICY "Customers can create their own orders" ON public\.orders/,
    );
    expect(down).toMatch(
      /CREATE POLICY "Customers can update their own orders" ON public\.orders/,
    );
    expect(down).toMatch(
      /DROP TRIGGER IF EXISTS guard_user_profiles_server_columns ON public\.user_profiles;/,
    );
    expect(down).toMatch(
      /DROP FUNCTION IF EXISTS public\.guard_user_profiles_server_columns\(\);/,
    );
    expect(down).toMatch(/RESET search_path;/);
    expect(down).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.search_coupons\(character varying, character varying\) TO PUBLIC, anon, authenticated;/,
    );
    for (const grantor of ["postgres", "supabase_admin"]) {
      expect(down).toMatch(
        new RegExp(
          `ALTER DEFAULT PRIVILEGES FOR ROLE ${grantor}\\s+IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;`,
        ),
      );
    }
    expect(down).toMatch(/GRANT TRUNCATE ON public\.%I TO anon, authenticated/);
  });
});
