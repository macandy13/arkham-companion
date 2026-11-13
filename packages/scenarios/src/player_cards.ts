import { cardCode, trait, type CardStats } from '@arkham/engine';

/*
 * The player cards the players can attach to an enemy or a location in the app
 * (`AttachPlayerCard`), entered by hand like the scenarios' cards: the stats
 * the engine reads and what the card does to its host, no card text.
 */

/**
 * Barricade (01038, Core Set): "Non-Elite enemies cannot move into attached location". Its
 * Forced discard when an investigator leaves is left to the players.
 */
export const barricade: CardStats = {
  code: cardCode('01038'),
  name: 'Barricade',
  typeCode: 'event',
  traits: [trait('Insight'), trait('Tactic')],
  restrictions: [{ cannot: 'enemiesMoveInto', of: 'host', exceptTraits: [trait('Elite')] }],
};

/** Every player card above, for the `CardDb` of each scenario the app plays. */
export const playerCardDefs: readonly CardStats[] = [barricade];
