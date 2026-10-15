import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  INCIDENT_LABELS_ES,
  INCIDENT_TYPES,
  LOCATION_CODE_PATTERN,
  LOCATION_KINDS,
  RELOCATION_SOURCES,
  UNIT_CONDITIONS,
  UNIT_CONDITION_LABELS_ES,
  UNIT_IN_RENTAL_LABEL_ES,
  UNIT_WEARS,
  WALLS,
  WEAR_LABELS_ES,
} from '../../../src/types/inventory';

/**
 * Static assertions over `0021_warehouse_units_locations.sql`: unit wear (Nuevo/Usado), the
 * `blocked` condition, the structured warehouse location model (5x5 m room, shelves/levels/boxes,
 * floor items, the central rug), the append-only relocation log, incident types on check-in, the
 * per-product unit counts view, and optimistic concurrency (`row_version`).
 *
 * The vocabulary is asserted against `src/types/inventory.ts` so the SQL CHECK lists and the
 * TypeScript contract (copied verbatim by the ops app) cannot drift apart.
 *
 * Vitest has no database: text assertions only. The runtime proof is a rehearsal on a disposable
 * database, which needs separate authorization.
 */
function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

function executableSql(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

function quotedList(values: readonly string[]): RegExp {
  const body = values.map((value) => `'${value}'`).join(',\\s*');
  return new RegExp(`IN\\s*\\(\\s*${body}\\s*\\)`, 'i');
}

const migration = read('../0021_warehouse_units_locations.sql');
const rollback = read('../0021_warehouse_units_locations.down.sql');
const migrationSql = executableSql(migration);
const rollbackSql = executableSql(rollback);

function tableBlock(table: string): string {
  const match = migrationSql.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'),
  );
  return match?.[1] ?? '';
}

describe('0021_warehouse_units_locations migration', () => {
  it('guards execution as supabase_admin and wraps everything in one transaction', () => {
    expect(migrationSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
    expect(migrationSql).toMatch(/^\s*BEGIN;/m);
    expect(migrationSql).toMatch(/^\s*COMMIT;/m);
    expect(migrationSql).toMatch(/SET\s+lock_timeout/i);
    expect(migrationSql).toMatch(/SET\s+statement_timeout/i);
    expect(migrationSql.match(/^\s*BEGIN;/gm)).toHaveLength(1);
    expect(migrationSql.match(/^\s*COMMIT;/gm)).toHaveLength(1);
  });

  describe('warehouse_locations', () => {
    const block = tableBlock('warehouse_locations');

    it('is created idempotently with a uuid primary key', () => {
      expect(block).not.toBe('');
      expect(block).toMatch(/\bid\s+uuid\s+PRIMARY KEY\s+DEFAULT gen_random_uuid\(\)/i);
    });

    it('has a unique, non-empty code with the wall-prefixed pattern', () => {
      expect(block).toMatch(/\bcode\s+text\s+NOT NULL\s+UNIQUE/i);
      expect(block).toContain(`code ~ '${LOCATION_CODE_PATTERN.source}'`);
      for (const code of ['N-E2', 'N-E2-L3', 'S-CJ4', 'C-ALF', 'W-PISO1']) {
        expect(LOCATION_CODE_PATTERN.test(code)).toBe(true);
      }
      for (const code of ['n-e2', 'X-E2', 'N-', 'NE2', 'N-E2-', 'N E2']) {
        expect(LOCATION_CODE_PATTERN.test(code)).toBe(false);
      }
    });

    it('requires a non-empty name', () => {
      expect(block).toMatch(/\bname\s+text\s+NOT NULL\s+CHECK \(length\(btrim\(name\)\) > 0\)/i);
    });

    it('constrains kind and wall to the shared vocabulary', () => {
      expect(LOCATION_KINDS).toEqual(['shelf', 'level', 'box', 'floor', 'rug']);
      expect(WALLS).toEqual(['N', 'E', 'S', 'W', 'C']);
      expect(block).toMatch(quotedList(LOCATION_KINDS));
      expect(block).toMatch(quotedList(WALLS));
    });

    it('keeps the hierarchy shallow and explicit: levels need a parent, roots have none', () => {
      expect(block).toMatch(/parent_id\s+uuid\s+REFERENCES public\.warehouse_locations\(id\) ON DELETE RESTRICT/i);
      expect(block).toMatch(/kind <> 'level' OR parent_id IS NOT NULL/i);
      expect(block).toMatch(/kind NOT IN \('shelf', 'floor', 'rug'\) OR parent_id IS NULL/i);
      expect(block).toMatch(/parent_id IS NULL OR parent_id <> id/i);
      // The parent's kind is checked by a trigger (a CHECK cannot read another row).
      expect(migrationSql).toMatch(/CREATE OR REPLACE FUNCTION public\.warehouse_locations_validate_parent\(\)/i);
      expect(migrationSql).toMatch(/BEFORE INSERT OR UPDATE ON public\.warehouse_locations/i);
    });

    it('bounds the floor-plan geometry to the 5x5 m room', () => {
      expect(block).toMatch(/pos_x\s+numeric\(5,2\)\s+CHECK \(pos_x BETWEEN 0 AND 5\)/i);
      expect(block).toMatch(/pos_y\s+numeric\(5,2\)\s+CHECK \(pos_y BETWEEN 0 AND 5\)/i);
      for (const dimension of ['width', 'depth', 'height']) {
        expect(block).toMatch(new RegExp(`${dimension}\\s+numeric\\(5,2\\)\\s+CHECK \\(${dimension} > 0\\)`, 'i'));
      }
      expect(block).toMatch(/level_index\s+integer\s+CHECK \(level_index >= 0\)/i);
      expect(block).toMatch(/rotation_deg\s+integer\s+NOT NULL DEFAULT 0\s+CHECK \(rotation_deg IN \(0, 90, 180, 270\)\)/i);
    });

    it('carries activation, optimistic-concurrency and audit columns', () => {
      expect(block).toMatch(/is_active\s+boolean\s+NOT NULL DEFAULT true/i);
      expect(block).toMatch(/row_version\s+integer\s+NOT NULL DEFAULT 1/i);
      expect(block).toMatch(/created_at\s+timestamptz\s+NOT NULL DEFAULT now\(\)/i);
      expect(block).toMatch(/updated_at\s+timestamptz\s+NOT NULL DEFAULT now\(\)/i);
      expect(block).toMatch(/updated_by\s+uuid\s+REFERENCES public\.admin_users\(user_id\) ON DELETE SET NULL/i);
    });

    it('seeds exactly one row, the central rug, idempotently', () => {
      const inserts = migrationSql.match(/INSERT INTO public\.warehouse_locations/gi) ?? [];
      expect(inserts).toHaveLength(1);
      expect(migrationSql).toMatch(
        /VALUES\s*\(\s*'C-ALF',\s*'Alfombra central',\s*'rug',\s*'C',\s*2\.5,\s*2\.5,\s*1\.6,\s*1\.2\s*\)/i,
      );
      expect(migrationSql).toMatch(/ON CONFLICT \(code\) DO NOTHING/i);
    });

    it('bumps row_version and updated_at on every update', () => {
      expect(migrationSql).toMatch(
        /CREATE TRIGGER warehouse_locations_bump_row_version\s+BEFORE UPDATE ON public\.warehouse_locations/i,
      );
      expect(migrationSql).toMatch(
        /CREATE TRIGGER warehouse_locations_set_updated_at\s+BEFORE UPDATE ON public\.warehouse_locations\s+FOR EACH ROW EXECUTE FUNCTION public\.update_updated_at_column\(\)/i,
      );
    });

    it('propagates a code or name change to the legacy text of the units stored there', () => {
      expect(migrationSql).toMatch(/AFTER UPDATE OF code, name ON public\.warehouse_locations/i);
    });
  });

  describe('serialised_assets', () => {
    it('adds wear (new/used) defaulting to used for every existing unit', () => {
      expect(UNIT_WEARS).toEqual(['new', 'used']);
      expect(migrationSql).toMatch(
        /ADD COLUMN IF NOT EXISTS wear text NOT NULL DEFAULT 'used'\s+CONSTRAINT serialised_assets_wear_check CHECK \(wear IN \('new', 'used'\)\)/i,
      );
    });

    it('asserts the legacy condition constraint exists before replacing it to add blocked', () => {
      expect(UNIT_CONDITIONS).toEqual(['operational', 'maintenance', 'cleaning', 'damaged', 'blocked', 'retired']);
      expect(migrationSql).toMatch(/constraint_name = 'serialised_assets_condition_check'/i);
      const drop = migrationSql.search(/DROP CONSTRAINT serialised_assets_condition_check/i);
      const add = migrationSql.search(/ADD CONSTRAINT serialised_assets_condition_check/i);
      expect(drop).toBeGreaterThan(-1);
      expect(add).toBeGreaterThan(drop);
      expect(migrationSql.slice(add, migrationSql.indexOf(';', add))).toMatch(quotedList(UNIT_CONDITIONS));
    });

    it('adds a nullable location_id FK that refuses to delete an occupied location', () => {
      expect(migrationSql).toMatch(
        /ADD COLUMN IF NOT EXISTS location_id uuid\s+REFERENCES public\.warehouse_locations\(id\) ON DELETE RESTRICT/i,
      );
      expect(migrationSql).toMatch(/CREATE INDEX IF NOT EXISTS serialised_assets_location_id_idx/i);
    });

    it('adds row_version and bumps it on every update', () => {
      expect(migrationSql).toMatch(/ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1/i);
      expect(migrationSql).toMatch(
        /CREATE TRIGGER serialised_assets_bump_row_version\s+BEFORE UPDATE ON public\.serialised_assets/i,
      );
      expect(migrationSql).toMatch(/NEW\.row_version := OLD\.row_version \+ 1/i);
    });

    it('derives the legacy location text from location_id on every insert and update', () => {
      expect(migrationSql).toMatch(
        /CREATE TRIGGER serialised_assets_sync_location\s+BEFORE INSERT OR UPDATE ON public\.serialised_assets/i,
      );
      expect(migrationSql).toMatch(/NEW\.location := loc_code \|\| ' · ' \|\| loc_name/i);
      // Legacy text writes without location_id stay allowed: the sync only runs when it is set.
      expect(migrationSql).toMatch(/IF NEW\.location_id IS NULL THEN\s+RETURN NEW;/i);
    });

    it('refuses to store a unit in an inactive location', () => {
      expect(migrationSql).toMatch(/IF NOT loc_active THEN/i);
    });
  });

  describe('asset_relocations', () => {
    const block = tableBlock('asset_relocations');

    it('is an identity-keyed log against units and locations, all RESTRICT', () => {
      expect(block).toMatch(/\bid\s+bigint\s+GENERATED ALWAYS AS IDENTITY PRIMARY KEY/i);
      expect(block).toMatch(/asset_id\s+bigint\s+NOT NULL REFERENCES public\.serialised_assets\(id\) ON DELETE RESTRICT/i);
      expect(block).toMatch(/from_location_id\s+uuid\s+REFERENCES public\.warehouse_locations\(id\) ON DELETE RESTRICT/i);
      expect(block).toMatch(/to_location_id\s+uuid\s+NOT NULL REFERENCES public\.warehouse_locations\(id\) ON DELETE RESTRICT/i);
      expect(block).toMatch(/moved_by_admin_id\s+uuid\s+REFERENCES public\.admin_users\(user_id\) ON DELETE SET NULL/i);
      expect(block).toMatch(/moved_at\s+timestamptz\s+NOT NULL DEFAULT now\(\)/i);
      expect(block).toMatch(/from_location_id IS DISTINCT FROM to_location_id/i);
    });

    it('records which app moved the unit', () => {
      expect(RELOCATION_SOURCES).toEqual(['dashboard', 'ops']);
      expect(block).toMatch(quotedList(RELOCATION_SOURCES));
    });

    it('indexes the per-unit history newest first', () => {
      expect(migrationSql).toMatch(/ON public\.asset_relocations \(asset_id, moved_at DESC\)/i);
    });

    it('applies the move atomically and rejects a stale from_location with PT409', () => {
      expect(migrationSql).toMatch(/AFTER INSERT ON public\.asset_relocations/i);
      expect(migrationSql).toMatch(/location_id IS NOT DISTINCT FROM NEW\.from_location_id/i);
      expect(migrationSql).toMatch(/ERRCODE = 'PT409'/i);
    });

    it('is append-only for service_role', () => {
      expect(migrationSql).toMatch(/GRANT SELECT, INSERT ON TABLE public\.asset_relocations TO service_role/i);
      expect(migrationSql).not.toMatch(/GRANT[^;]*(UPDATE|DELETE)[^;]*asset_relocations/i);
    });
  });

  describe('asset_movements incident_type', () => {
    it('matches the check-in canon vocabulary', () => {
      expect(INCIDENT_TYPES).toEqual([
        'physical_damage',
        'missing_part',
        'moisture',
        'electrical_failure',
        'cosmetic_wear',
        'not_returned',
        'other',
      ]);
      expect(migrationSql).toMatch(/ALTER TABLE public\.asset_movements\s+ADD COLUMN IF NOT EXISTS incident_type text/i);
      expect(migrationSql).toMatch(quotedList(INCIDENT_TYPES));
    });
  });

  describe('product_unit_counts view', () => {
    const view = migrationSql.match(/CREATE OR REPLACE VIEW public\.product_unit_counts([\s\S]*?);/i)?.[1] ?? '';

    it('runs with the caller privileges', () => {
      expect(view).toMatch(/security_invoker\s*=\s*true/i);
    });

    it('lists every product, with zero counts for products without units', () => {
      expect(view).toMatch(/FROM public\.products p\s+LEFT JOIN public\.serialised_assets a/i);
      expect(view).toMatch(/GROUP BY p\.id/i);
    });

    it('derives "in rental" from asset_current_state, never from a stored state', () => {
      expect(view).toMatch(/LEFT JOIN public\.asset_current_state s ON s\.asset_id = a\.id/i);
      expect(view).toMatch(/s\.direction = 'checkout'/i);
    });

    it('exposes the counts the catalogue and ops read', () => {
      for (const column of ['product_id', 'total', 'available', 'in_rental', 'maintenance', 'damaged', 'blocked', 'retired']) {
        expect(view).toMatch(new RegExp(`\\bAS ${column}\\b`, 'i'));
      }
      expect(view).toMatch(/condition IN \('maintenance', 'cleaning'\)/i);
    });
  });

  describe('functions', () => {
    const functions = [
      'bump_row_version',
      'serialised_assets_sync_location',
      'warehouse_locations_validate_parent',
      'warehouse_locations_propagate_label',
      'asset_relocations_apply',
    ];

    it('pins search_path and revokes EXECUTE from PUBLIC on every new function', () => {
      for (const fn of functions) {
        expect(migrationSql).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(\\)`, 'i'));
        expect(migrationSql).toMatch(
          new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\(\\) FROM PUBLIC, anon, authenticated`, 'i'),
        );
      }
      const definitions = migrationSql.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\bAS \$/gi) ?? [];
      expect(definitions).toHaveLength(functions.length);
      for (const definition of definitions) {
        expect(definition).toMatch(/SET search_path = public, pg_temp/i);
        expect(definition).not.toMatch(/SECURITY DEFINER/i);
      }
    });
  });

  describe('privileges — service_role only, RLS on', () => {
    it.each(['warehouse_locations', 'asset_relocations'])('locks down %s', (table) => {
      expect(migrationSql).toMatch(new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC`, 'i'));
      expect(migrationSql).toMatch(new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM anon, authenticated`, 'i'));
      expect(migrationSql).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
      expect(migrationSql).toMatch(
        new RegExp(`CREATE POLICY "Allow service_role full access to ${table}"\\s+ON public\\.${table}\\s+FOR ALL\\s+TO service_role`, 'i'),
      );
    });

    it('grants the view SELECT to service_role only', () => {
      expect(migrationSql).toMatch(/REVOKE ALL ON TABLE public\.product_unit_counts FROM PUBLIC/i);
      expect(migrationSql).toMatch(/REVOKE ALL ON TABLE public\.product_unit_counts FROM anon, authenticated/i);
      expect(migrationSql).toMatch(/GRANT SELECT ON TABLE public\.product_unit_counts TO service_role/i);
    });

    it('grants hermes_ro nothing (isolation invariant of the chain)', () => {
      const grantsToHermes = /\bGRANT\b[^;]*\bhermes_/i;
      expect(migrationSql).not.toMatch(grantsToHermes);
      expect(rollbackSql).not.toMatch(grantsToHermes);
    });
  });

  it('asserts its own end state before COMMIT', () => {
    const assertAt = migrationSql.search(/DO \$assert_0021\$/);
    expect(assertAt).toBeGreaterThan(-1);
    expect(assertAt).toBeLessThan(migrationSql.search(/^\s*COMMIT;/m));
  });

  describe('rollback', () => {
    it('runs under the role guard in one transaction', () => {
      expect(rollbackSql).toMatch(/pg_has_role\(current_user,\s*'supabase_admin',\s*'USAGE'\)/i);
      expect(rollbackSql).toMatch(/^\s*BEGIN;/m);
      expect(rollbackSql).toMatch(/^\s*COMMIT;/m);
    });

    it('refuses to restore the old condition constraint while blocked units exist', () => {
      expect(rollbackSql).toMatch(/WHERE condition = 'blocked'/i);
      const guard = rollbackSql.search(/WHERE condition = 'blocked'/i);
      const restore = rollbackSql.search(/ADD CONSTRAINT serialised_assets_condition_check/i);
      expect(restore).toBeGreaterThan(guard);
      expect(rollbackSql.slice(restore, rollbackSql.indexOf(';', restore))).toMatch(
        /IN \('operational', 'maintenance', 'cleaning', 'damaged', 'retired'\)/i,
      );
    });

    it('drops everything 0021 created, dependents first', () => {
      const order = [
        /DROP VIEW IF EXISTS public\.product_unit_counts/i,
        /DROP TABLE IF EXISTS public\.asset_relocations/i,
        /DROP COLUMN IF EXISTS location_id/i,
        /DROP TABLE IF EXISTS public\.warehouse_locations/i,
        /DROP FUNCTION IF EXISTS public\.bump_row_version\(\)/i,
      ].map((pattern) => rollbackSql.search(pattern));
      for (const position of order) expect(position).toBeGreaterThan(-1);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      for (const column of ['wear', 'row_version', 'incident_type']) {
        expect(rollbackSql).toMatch(new RegExp(`DROP COLUMN IF EXISTS ${column}`, 'i'));
      }
    });

    it('never touches pre-0021 tables or data rows', () => {
      expect(rollbackSql).not.toMatch(/DROP TABLE IF EXISTS public\.(serialised_assets|asset_movements)\b/i);
      expect(rollbackSql).not.toMatch(/DELETE\s+FROM/i);
      expect(rollbackSql).not.toMatch(/asset_current_state/i);
    });
  });
});

describe('src/types/inventory.ts contract labels', () => {
  it('labels every unit condition in Spanish, per canon', () => {
    expect(UNIT_CONDITION_LABELS_ES).toEqual({
      operational: 'Disponible',
      maintenance: 'Mantención',
      cleaning: 'Limpieza',
      damaged: 'Dañado',
      blocked: 'Bloqueado',
      retired: 'Archivado',
    });
    expect(UNIT_IN_RENTAL_LABEL_ES).toBe('En arriendo');
  });

  it('labels wear and incidents in Spanish, per canon', () => {
    expect(WEAR_LABELS_ES).toEqual({ new: 'Nuevo', used: 'Usado' });
    expect(INCIDENT_LABELS_ES).toEqual({
      physical_damage: 'Daño físico visible',
      missing_part: 'Pieza o accesorio faltante',
      moisture: 'Daño por humedad',
      electrical_failure: 'Falla eléctrica',
      cosmetic_wear: 'Rayón o desgaste estético',
      not_returned: 'No devuelto',
      other: 'Otro',
    });
  });
});
