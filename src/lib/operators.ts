/**
 * Operator accounts — validation and copy, kept out of the service so the API tests (which mock
 * the service wholesale) and the create dialog can share one source of truth.
 *
 * An operator is an `admin_users` row with `role = 'operator'` (migration 0011) plus a Supabase
 * Auth user behind it. Each garage worker gets their own so `asset_movements.checked_by_admin_id`
 * names the person who scanned. What the account may reach is decided in `accessControl.ts`.
 */

export const MIN_PASSWORD_LENGTH = 8;

export const OPERATOR_ERRORS = {
  INVALID_EMAIL: 'Debes indicar un correo válido',
  WEAK_PASSWORD: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
  EMAIL_TAKEN: 'Ya existe una cuenta con ese correo',
  NOT_FOUND: 'No existe un operario con ese ID',
  INVALID_ACTIVE_FLAG: 'Debes indicar si la cuenta queda activa o inactiva',
} as const;

export interface OperatorInput {
  email: string;
  password: string;
  /** Optional, stored in the auth user's metadata — `admin_users` has no name column. */
  displayName?: string;
}

export type OperatorInputResult = { values: OperatorInput; error: null } | { values: null; error: string };

/** Deliberately loose: one `@`, something on both sides, no whitespace. The mail server decides the rest. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

/** Validates a create payload. The email is normalised (trimmed, lower-cased); the password is not touched. */
export function parseOperatorInput(body: Record<string, unknown> | null | undefined): OperatorInputResult {
  const rawEmail = body?.email;
  if (!isValidEmail(rawEmail)) {
    return { values: null, error: OPERATOR_ERRORS.INVALID_EMAIL };
  }

  const password = body?.password;
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return { values: null, error: OPERATOR_ERRORS.WEAK_PASSWORD };
  }

  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';

  return {
    values: {
      email: rawEmail.trim().toLowerCase(),
      password,
      ...(displayName ? { displayName } : {}),
    },
    error: null,
  };
}

/** `{ is_active: boolean }` and nothing else — a string `"false"` is rejected, not coerced. */
export function parseActiveFlag(body: Record<string, unknown> | null | undefined): boolean | null {
  const flag = body?.is_active;
  return typeof flag === 'boolean' ? flag : null;
}

export const OPERATOR_STATUS_LABELS = {
  active: 'Activo',
  inactive: 'Inactivo',
} as const;

export function operatorStatusLabel(isActive: boolean): string {
  return isActive ? OPERATOR_STATUS_LABELS.active : OPERATOR_STATUS_LABELS.inactive;
}
