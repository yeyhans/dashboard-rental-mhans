import { AUDITED_PRODUCT_FIELDS, type AuditedProductField } from '../../types/inventory';

/**
 * Shared by the service (which builds the review list) and the intake form (which flags the
 * selected product inline). One definition, so the badge an admin sees while entering a unit and
 * the row that product occupies in the review list can never disagree.
 *
 * An empty string counts as missing: the migration-volume audit found both NULLs and blanks, and
 * neither tells a counter what they are holding.
 */
export function findMissingFields(product: Record<string, unknown>): AuditedProductField[] {
  return AUDITED_PRODUCT_FIELDS.filter((field) => isBlank(product[field]));
}

export function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}
