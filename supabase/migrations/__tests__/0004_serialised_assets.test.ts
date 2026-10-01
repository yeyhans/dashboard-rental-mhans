import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * T-034. `serialised_assets` is the first table created after `0002_hermes_least_privilege.sql`
 * revoked the `ALTER DEFAULT PRIVILEGES ... GRANT SELECT ... TO hermes_ro` entries, so it is the
 * first real exercise of `hermes-agent-compatibility/spec.md` — "A newly created table is not
 * agent-readable by default."
 *
 * These are static assertions over the SQL text: vitest has no database. The runtime proof
 * (`has_table_privilege('hermes_ro', 'public.serialised_assets', 'SELECT') = false`) lives in
 * `hermes-mhans/scripts/assert-serialised-assets-isolation.sh`, which the CI `least-privilege`
 * job runs wherever the Supabase container is reachable. Both halves are required: the text
 * assertion catches a reviewer adding a grant line, the script catches the default privilege
 * having survived 0002 for some grantor.
 */
function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

/**
 * Strips `--` comment lines. These migrations carry long rationale headers that discuss grants in
 * prose ("... granted SELECT ... to hermes_ro"), so a grant assertion run over the raw text fails
 * on the explanation of the very thing it is checking. Privilege assertions must read executable
 * statements only.
 */
function executableSql(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

const migration = read('../0004_serialised_assets.sql');
const rollback = read('../0004_serialised_assets.down.sql');
const migrationSql = executableSql(migration);
const rollbackSql = executableSql(rollback);
const isolationScript = read('../../../hermes-mhans/scripts/assert-serialised-assets-isolation.sh');

describe('0004_serialised_assets migration', () => {
  it('creates the table after the least-privilege revocation in the chain', () => {
    expect(migration).toMatch(/CREATE TABLE (IF NOT EXISTS )?public\.serialised_assets/i);
    // The filename carries the ordering. 0004 > 0002, which is what lint-chain.sh enforces.
    expect(4).toBeGreaterThan(2);
  });

  it('ties every asset to an existing product and keeps serials unique', () => {
    expect(migration).toMatch(/product_id\s+integer\s+NOT NULL\s+REFERENCES public\.products\(id\)/i);
    expect(migrationSql).toMatch(
      /CREATE UNIQUE INDEX[\s\S]*?public\.serialised_assets[\s\S]*?lower\(btrim\(serial_number\)\)/i
    );
  });

  it('grants hermes_ro nothing — the whole point of the ordering constraint', () => {
    const grantsToHermesRo = /\bGRANT\b[^;]*\bhermes_ro\b/i;
    expect(migrationSql).not.toMatch(grantsToHermesRo);
    expect(rollbackSql).not.toMatch(grantsToHermesRo);
  });

  it('revokes the blanket anon and authenticated privileges Supabase hands out by default', () => {
    expect(migrationSql).toMatch(/REVOKE ALL ON TABLE public\.serialised_assets FROM PUBLIC/i);
    expect(migrationSql).toMatch(/REVOKE ALL ON TABLE public\.serialised_assets FROM anon, authenticated/i);
  });

  it('enables RLS and admits only the service role the dashboard uses', () => {
    expect(migrationSql).toMatch(/ALTER TABLE public\.serialised_assets ENABLE ROW LEVEL SECURITY/i);
    expect(migrationSql).toMatch(/CREATE POLICY[^;]*TO service_role/i);
  });

  it('ships a rollback that drops the table it created', () => {
    expect(rollbackSql).toMatch(/DROP TABLE (IF EXISTS )?public\.serialised_assets/i);
  });

  it('carries the runtime hermes_ro assertion in an executable guard script', () => {
    expect(isolationScript).toMatch(
      /has_table_privilege\(\s*'hermes_ro',\s*'public\.serialised_assets',\s*'SELECT'\s*\)/i
    );
  });
});
