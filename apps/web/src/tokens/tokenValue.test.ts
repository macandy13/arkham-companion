import { describe, expect, it } from 'vitest';
import type { ChaosToken } from '@arkham/engine';
import { hasSymbol, signed, signedOrUnknown } from './tokenValue';

describe('tokenValue', () => {
  it.each([
    { value: 1, text: '+1' },
    { value: 0, text: '0' },
    { value: -2, text: '−2' },
    { value: undefined, text: '?' },
  ])('writes $value as "$text"', ({ value, text }) => {
    expect(signedOrUnknown(value)).toBe(text);
  });

  it('writes a minus as the minus sign, not a hyphen', () => {
    expect(signed(-3).codePointAt(0)).toBe(0x2212);
  });

  it.each<{ token: ChaosToken; symbol: boolean }>([
    { token: '-1', symbol: false },
    { token: '+1', symbol: false },
    { token: 'skull', symbol: true },
    { token: 'bless', symbol: true },
  ])('tells whether the $token shows a symbol: $symbol', ({ token, symbol }) => {
    expect(hasSymbol(token)).toBe(symbol);
  });
});
