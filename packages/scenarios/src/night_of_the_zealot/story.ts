/**
 * The story record keys of Night of the Zealot's campaign log, shared by the
 * scenario that writes a record (its resolutions) and the ones whose setup
 * reads it. A flag is named after the sentence the campaign guide records,
 * so `true` means the sentence is in the log; a list after its heading.
 */
export const ZEALOT_STORY = {
  /** "Your house is still standing" (`true`) or "your house has burned to the ground" (`false`). */
  houseStillStanding: 'houseStillStanding',
  /** "The Ghoul Priest is still alive." */
  ghoulPriestStillAlive: 'ghoulPriestStillAlive',
  /** "Lita was forced to find others to help her cause." */
  litaForcedToFindOthers: 'litaForcedToFindOthers',
  /**
   * An investigator earned the Lita Chantler card in The Gathering (`true`). Not a sentence of
   * the campaign log but a deck change, recorded so The Devourer Below knows whether anyone can
   * hold her for Umôrdhoth's action.
   */
  litaEarned: 'litaEarned',
  /** "Cultists We Interrogated": a list of the unique Cultists in The Midnight Masks' victory display. */
  cultistsWeInterrogated: 'cultistsWeInterrogated',
  /** "Cultists Who Got Away": a list of the unique Cultists left in the Cultist deck or in play. */
  cultistsWhoGotAway: 'cultistsWhoGotAway',
  /** "It is past midnight." (The Midnight Masks' R2). */
  itIsPastMidnight: 'itIsPastMidnight',
  /** "Arkham succumbed to Umôrdhoth's terrible vengeance." (The Devourer Below, no resolution). */
  arkhamSuccumbed: 'arkhamSuccumbed',
  /** "The ritual to summon Umôrdhoth was broken." (The Devourer Below's R1). */
  ritualBroken: 'ritualBroken',
  /** "The investigators repelled Umôrdhoth." (The Devourer Below's R2). */
  umordhothRepelled: 'umordhothRepelled',
  /** "The investigators sacrificed Lita Chantler to Umôrdhoth." (The Devourer Below's R3). */
  litaSacrificed: 'litaSacrificed',
} as const;
