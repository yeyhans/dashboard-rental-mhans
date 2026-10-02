import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Static assertions over `0015_site_settings.sql`: the single-row business settings table read by
 * the PDFs and emails. Vitest has no database, so these are text assertions; the runtime proof is
 * applying on consolidado and checking the grants.
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

const migrationSql = executableSql(read("../0015_site_settings.sql"));
const rollbackSql = executableSql(read("../0015_site_settings.down.sql"));

describe("0015_site_settings migration", () => {
  it("guards execution as supabase_admin and wraps everything in a transaction", () => {
    expect(migrationSql).toMatch(
      /pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i,
    );
    expect(migrationSql).toMatch(/^\s*BEGIN;/m);
    expect(migrationSql).toMatch(/^\s*COMMIT;/m);
    expect(migrationSql).toMatch(/SET\s+lock_timeout/i);
    expect(migrationSql).toMatch(/SET\s+statement_timeout/i);
  });

  it("creates a single-row table idempotently", () => {
    expect(migrationSql).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.site_settings/i,
    );
    expect(migrationSql).toMatch(/id\s+smallint\s+PRIMARY\s+KEY\s+DEFAULT\s+1/i);
    expect(migrationSql).toMatch(/CHECK\s*\(\s*id\s*=\s*1\s*\)/i);
    expect(migrationSql).toMatch(/data\s+jsonb\s+NOT\s+NULL\s+DEFAULT\s+'\{\}'::jsonb/i);
    expect(migrationSql).toMatch(/updated_at\s+timestamptz\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
    expect(migrationSql).toMatch(/updated_by\s+text/i);
  });

  it("is deny-by-default: revokes PUBLIC/anon/authenticated and grants only service_role", () => {
    expect(migrationSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.site_settings\s+FROM\s+PUBLIC/i,
    );
    expect(migrationSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.site_settings\s+FROM\s+anon,\s*authenticated/i,
    );
    expect(migrationSql).toMatch(
      /GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+TABLE\s+public\.site_settings\s+TO\s+service_role/i,
    );
    expect(migrationSql).not.toMatch(/hermes_ro|hermes_rw/i);
    expect(migrationSql).not.toMatch(/GRANT[^;]*\b(anon|authenticated)\b/i);
  });

  it("enables RLS with a service_role policy", () => {
    expect(migrationSql).toMatch(
      /ALTER\s+TABLE\s+public\.site_settings\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    );
    expect(migrationSql).toMatch(/CREATE\s+POLICY[\s\S]*TO\s+service_role/i);
  });
});

describe("0015_site_settings rollback", () => {
  it("guards the role, is transactional and idempotent", () => {
    expect(rollbackSql).toMatch(
      /pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i,
    );
    expect(rollbackSql).toMatch(/^\s*BEGIN;/m);
    expect(rollbackSql).toMatch(/^\s*COMMIT;/m);
    expect(rollbackSql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+public\.site_settings/i);
  });

  it("states that the stored settings are lost", () => {
    expect(read("../0015_site_settings.down.sql")).toMatch(/DATA LOSS/i);
  });
});
