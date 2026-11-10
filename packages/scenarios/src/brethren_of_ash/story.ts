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
  /** The suspect "… is the harbinger of Elokoss." (Smoke and Mirrors), a list of one name. */
  harbingerOfElokoss: 'harbingerOfElokoss',
  /**
   * "The investigators discovered the cult's whereabouts." (`true`, Smoke and Mirrors' R1 or a
   * lucky draw without a resolution) or "The investigators failed in their search." (`false`).
   */
  discoveredTheCultsWhereabouts: 'discoveredTheCultsWhereabouts',
  /** "The investigators killed the Servant of Flame." (Smoke and Mirrors). */
  killedTheServantOfFlame: 'killedTheServantOfFlame',
  /** "The investigators scoured Arkham for answers." (Smoke and Mirrors' R1, 6 Elite beneath the act). */
  scouredArkhamForAnswers: 'scouredArkhamForAnswers',
  /** "The investigators stirred up trouble." (Smoke and Mirrors' R1, 6 Elite in the victory display). */
  stirredUpTrouble: 'stirredUpTrouble',
  /** "The Servant of Flame escaped." (Smoke and Mirrors' R2, the Servant beneath the act). */
  theServantOfFlameEscaped: 'theServantOfFlameEscaped',
  /** "Elokoss was reborn." (Queen of Ash without a resolution: the campaign is lost). */
  elokossWasReborn: 'elokossWasReborn',
  /** "The investigators defeated Elokoss and the Brethren of Ash." (Queen of Ash's R1). */
  defeatedElokossAndTheBrethren: 'defeatedElokossAndTheBrethren',
  /** "The investigators stopped Elokoss's glorious rebirth." (Queen of Ash's R2). */
  stoppedElokosssRebirth: 'stoppedElokosssRebirth',
  /** "The investigators flooded the Brethren of Ash's summoning ritual." (Queen of Ash's R3). */
  floodedTheSummoningRitual: 'floodedTheSummoningRitual',
} as const;
