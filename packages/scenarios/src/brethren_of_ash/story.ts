/**
 * The story record keys of Brethren of Ash's campaign log (the Core Set (2026) campaign), shared
 * by the scenario that writes a record (its resolutions) and the ones whose setup reads it. A flag
 * is named after the sentence the campaign guide records, so `true` means the sentence is in the
 * log.
 */
export const ASH_STORY = {
  /**
   * "The investigators saved Miskatonic University" (`true`, Spreading Flames' R2) or "Miskatonic
   * University burned" (`false`, no resolution and R3).
   */
  savedMiskatonicUniversity: 'savedMiskatonicUniversity',
  /** "The investigators defeated their masked pursuer." (Spreading Flames' R1). */
  defeatedTheirMaskedPursuer: 'defeatedTheirMaskedPursuer',
} as const;
