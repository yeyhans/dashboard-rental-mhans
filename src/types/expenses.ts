/**
 * Expenses (T-026 gap 3, Rentabilidad minimal scope).
 *
 * Types live here rather than in `src/types/database.ts` for the same reason as
 * `src/types/assetMovements.ts`: `0006_t026_schema_gaps.sql` has not been applied to any
 * database yet. Replace with regenerated `Database['public']['Tables']` types once it lands.
 */

/**
 * The `expenses.category` CHECK constraint values (R1-001), sourced from the canonical
 * Rentabilidad `#g-cat` <select> ("Gastos Fijos" / "Gastos Variables" optgroups). English tokens
 * are the stored values; Spanish labels are UI-only, per the project's condition-vocabulary
 * convention (see `src/types/inventory.ts`).
 */
export const EXPENSE_CATEGORIES = [
  'warehouse',
  'internet',
  'payroll',
  'accounting',
  'software',
  'hosting',
  'delivery',
  'transport',
  'maintenance',
  'repair',
  'supplies',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  warehouse: 'Bodega',
  internet: 'Internet',
  payroll: 'Sueldos',
  accounting: 'Contador',
  software: 'Software',
  hosting: 'Hosting',
  delivery: 'Delivery',
  transport: 'Transporte',
  maintenance: 'Mantención',
  repair: 'Reparación',
  supplies: 'Insumos',
};

/** UI grouping only — not a DB column (see migration header, R1-001). */
export const FIXED_EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'warehouse',
  'internet',
  'payroll',
  'accounting',
  'software',
  'hosting',
];

export const VARIABLE_EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'delivery',
  'transport',
  'maintenance',
  'repair',
  'supplies',
];

export interface Expense {
  id: number;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  related_order_id: number | null;
  related_asset_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseInsert {
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  related_order_id?: number | null;
  related_asset_id?: number | null;
  notes?: string | null;
}

export interface ExpenseUpdate {
  category?: ExpenseCategory;
  amount?: number;
  expense_date?: string;
  related_order_id?: number | null;
  related_asset_id?: number | null;
  notes?: string | null;
}

/** The minimal shape the pure `lib/profitability.ts` derivations need. */
export interface ExpenseLike {
  readonly category: ExpenseCategory;
  readonly amount: number;
  readonly expense_date: string;
}
