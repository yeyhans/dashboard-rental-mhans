import { describe, expect, it } from 'vitest';
import { secretsMatch } from '../timingSafe';

describe('secretsMatch', () => {
  it('accepts an exact match', () => {
    expect(secretsMatch('s3cr3t-hermes-key', 's3cr3t-hermes-key')).toBe(true);
  });

  it('rejects a different secret of the same length', () => {
    expect(secretsMatch('s3cr3t-hermes-key', 's3cr3t-hermes-KEY')).toBe(false);
  });

  it('rejects secrets of different lengths without throwing', () => {
    // Hashing before comparing keeps both operands 32 bytes, so `timingSafeEqual` never sees a
    // length mismatch — no early return, and no leak of the real secret's length.
    expect(secretsMatch('short', 'a-considerably-longer-secret')).toBe(false);
    expect(secretsMatch('', 'x')).toBe(false);
  });

  it('rejects empty or missing input', () => {
    expect(secretsMatch('', '')).toBe(false);
    expect(secretsMatch(undefined, 'anything')).toBe(false);
    expect(secretsMatch('anything', undefined)).toBe(false);
  });

  it('rejects a prefix of the real secret', () => {
    expect(secretsMatch('s3cr3t', 's3cr3t-hermes-key')).toBe(false);
  });
});
