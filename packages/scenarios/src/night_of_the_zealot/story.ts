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
  /** "Cultists We Interrogated": a list of the unique Cultists in The Midnight Masks' victory display. */
  cultistsWeInterrogated: 'cultistsWeInterrogated',
  /** "Cultists Who Got Away": a list of the unique Cultists left in the Cultist deck or in play. */
  cultistsWhoGotAway: 'cultistsWhoGotAway',
  /** "It is past midnight." (The Midnight Masks' R2). */
  itIsPastMidnight: 'itIsPastMidnight',
} as const;
