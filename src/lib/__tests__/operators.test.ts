import { describe, expect, it } from 'vitest';

import {
  MIN_PASSWORD_LENGTH,
  OPERATOR_ERRORS,
  isValidEmail,
  operatorStatusLabel,
  parseActiveFlag,
  parseOperatorInput,
} from '../operators';

describe('parseOperatorInput', () => {
  it('accepts a valid email and password, normalising the email', () => {
    const result = parseOperatorInput({ email: '  Bodega@MarioHans.cl ', password: 'correcto1' });
    expect(result.error).toBeNull();
    expect(result.values).toEqual({ email: 'bodega@mariohans.cl', password: 'correcto1' });
  });

  it('keeps an optional display name, trimmed, and drops it when blank', () => {
    expect(
      parseOperatorInput({ email: 'a@b.cl', password: 'correcto1', displayName: '  Juan  ' }).values
    ).toEqual({ email: 'a@b.cl', password: 'correcto1', displayName: 'Juan' });
    expect(
      parseOperatorInput({ email: 'a@b.cl', password: 'correcto1', displayName: '   ' }).values
    ).toEqual({ email: 'a@b.cl', password: 'correcto1' });
  });

  it('rejects a missing or malformed email first', () => {
    expect(parseOperatorInput({ password: 'correcto1' }).error).toBe(OPERATOR_ERRORS.INVALID_EMAIL);
    expect(parseOperatorInput({ email: 'sin-arroba', password: 'correcto1' }).error).toBe(OPERATOR_ERRORS.INVALID_EMAIL);
    expect(parseOperatorInput({ email: 'con espacio@x.cl', password: 'correcto1' }).error).toBe(OPERATOR_ERRORS.INVALID_EMAIL);
    expect(parseOperatorInput(null).error).toBe(OPERATOR_ERRORS.INVALID_EMAIL);
  });

  it(`rejects a password shorter than ${MIN_PASSWORD_LENGTH} characters, or not a string`, () => {
    expect(parseOperatorInput({ email: 'a@b.cl', password: '1234567' }).error).toBe(OPERATOR_ERRORS.WEAK_PASSWORD);
    expect(parseOperatorInput({ email: 'a@b.cl', password: 12345678 }).error).toBe(OPERATOR_ERRORS.WEAK_PASSWORD);
    expect(parseOperatorInput({ email: 'a@b.cl' }).error).toBe(OPERATOR_ERRORS.WEAK_PASSWORD);
  });

  it('does not trim the password — spaces are part of it', () => {
    expect(parseOperatorInput({ email: 'a@b.cl', password: '       1' }).error).toBeNull();
  });
});

describe('isValidEmail', () => {
  it('is a type guard', () => {
    expect(isValidEmail('x@y.cl')).toBe(true);
    expect(isValidEmail(42)).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('parseActiveFlag', () => {
  it('accepts only a real boolean', () => {
    expect(parseActiveFlag({ is_active: true })).toBe(true);
    expect(parseActiveFlag({ is_active: false })).toBe(false);
    expect(parseActiveFlag({ is_active: 'false' })).toBeNull();
    expect(parseActiveFlag({ is_active: 0 })).toBeNull();
    expect(parseActiveFlag({})).toBeNull();
    expect(parseActiveFlag(null)).toBeNull();
  });
});

describe('operatorStatusLabel', () => {
  it('is the Spanish badge copy', () => {
    expect(operatorStatusLabel(true)).toBe('Activo');
    expect(operatorStatusLabel(false)).toBe('Inactivo');
  });
});
