import type { ChaosToken } from '@arkham/engine';

/**
 * Whether the token shows a symbol rather than its number, so the app spells out its value beside
 * it (the skill test's strip, the chaos bag): the scenario's symbols, the elder sign, auto-fail
 * and the tokens a campaign adds (bless, curse, frost, blood).
 */
export function hasSymbol(token: ChaosToken): boolean {
  return Number.isNaN(Number(token));
}

/** A token's value with its sign, or "?" when the app cannot tell it. */
export function signedOrUnknown(value: number | undefined): string {
  return value === undefined ? '?' : signed(value);
}

/** A modifier with its sign, as the players say it: +1, 0, −2. */
export function signed(value: number): string {
  if (value > 0) return `+${value}`;
  return value < 0 ? `−${-value}` : '0';
}
