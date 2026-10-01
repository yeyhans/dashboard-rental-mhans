import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison of two shared secrets.
 *
 * `===` on strings short-circuits at the first differing byte, so response time leaks how much
 * of a guessed API key is correct — enough to recover the secret byte by byte over many
 * requests. Both sides are hashed first so the operands are always 32 bytes: `timingSafeEqual`
 * throws on a length mismatch, and returning early on that would leak the secret's length.
 *
 * Empty or missing values never match, so an unset environment secret cannot authenticate an
 * empty header.
 */
export function secretsMatch(
  provided: string | undefined | null,
  expected: string | undefined | null
): boolean {
  if (!provided || !expected) return false;

  const providedHash = createHash('sha256').update(provided, 'utf8').digest();
  const expectedHash = createHash('sha256').update(expected, 'utf8').digest();

  return timingSafeEqual(providedHash, expectedHash);
}
