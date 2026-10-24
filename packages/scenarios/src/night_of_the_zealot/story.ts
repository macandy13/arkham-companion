/**
 * The story record keys of Night of the Zealot's campaign log, shared by the
 * scenario that writes a record (its resolutions) and the ones whose setup
 * reads it. Each is a flag, named after the sentence the campaign guide
 * records, so `true` means the sentence is in the log.
 */
export const ZEALOT_STORY = {
  /** "Your house is still standing" (`true`) or "your house has burned to the ground" (`false`). */
  houseStillStanding: 'houseStillStanding',
  /** "The Ghoul Priest is still alive." */
  ghoulPriestStillAlive: 'ghoulPriestStillAlive',
  /** "Lita was forced to find others to help her cause." */
  litaForcedToFindOthers: 'litaForcedToFindOthers',
} as const;
