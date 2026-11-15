import { cardCode, trait, type AttachmentHost, type CardStats } from '@arkham/engine';
import { picturesOf } from './card_builders';

/*
 * The player cards the players can attach to an enemy or a location in the app
 * (`AttachPlayerCard`), entered by hand like the scenarios' cards: the stats
 * the engine reads, what the card does to its host and where its picture is, which the card zoom
 * shows the players to read what it does; no card text.
 */

/**
 * Barricade (01038, Core Set): "Non-Elite enemies cannot move into attached location". Its
 * Forced discard when an investigator leaves is left to the players.
 */
export const barricade: CardStats = {
  code: cardCode('01038'),
  ...picturesOf('01038', 'front'),
  name: 'Barricade',
  typeCode: 'event',
  traits: [trait('Insight'), trait('Tactic')],
  attachesTo: 'location',
  restrictions: [{ cannot: 'enemiesMoveInto', of: 'host', exceptTraits: [trait('Elite')] }],
};

/**
 * Handcuffs (04265, The Depths of Yoth): "If the attached enemy is non-Elite, it cannot ready and
 * doom cannot be placed on it". The evasion that attaches it is left to the players.
 */
export const handcuffs: CardStats = {
  code: cardCode('04265'),
  ...picturesOf('04265', 'front'),
  name: 'Handcuffs',
  typeCode: 'asset',
  traits: [trait('Item'), trait('Police')],
  attachesTo: 'enemy',
  restrictions: [
    { cannot: 'ready', of: 'host', exceptTraits: [trait('Elite')] },
    { cannot: 'placeDoom', of: 'host', exceptTraits: [trait('Elite')] },
  ],
};

/**
 * Hiding Spot (03038, The Path to Carcosa): "Each non-Elite enemy at attached location gains
 * aloof". Its Forced discard at the end of the enemy phase is left to the players.
 */
export const hidingSpot: CardStats = {
  code: cardCode('03038'),
  ...picturesOf('03038', 'front'),
  name: 'Hiding Spot',
  typeCode: 'event',
  traits: [trait('Tactic'), trait('Trick')],
  attachesTo: 'location',
  keywordGrants: [{ gains: 'aloof', of: 'enemiesAtHost', exceptTraits: [trait('Elite')] }],
};

/** The player cards above from the Core Set, which the ArkhamDB check holds to its data. */
export const coreSetPlayerCardDefs: readonly CardStats[] = [barricade];

/** Every player card above, for the `CardDb` of each scenario the app plays. */
export const playerCardDefs: readonly CardStats[] = [
  ...coreSetPlayerCardDefs,
  handcuffs,
  hidingSpot,
];

/**
 * The player cards the players can attach to a card of type `host` from its details: those above
 * that attach to it (`CardStats.attachesTo`), in their listed order.
 */
export function attachableCards(host: AttachmentHost): readonly CardStats[] {
  return playerCardDefs.filter(({ attachesTo }) => attachesTo === host);
}
