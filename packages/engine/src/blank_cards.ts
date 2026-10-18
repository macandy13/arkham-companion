import { cardCode, investigatorCode, investigatorId } from './ids';
import type { CardStats, CardType, ScaledValue } from './cards';
import type { Investigator } from './state';

/** A printed value that does not scale with the player count ("3"). */
export function fixed(value: number): ScaledValue {
  return { fixed: value, perInvestigator: 0 };
}

/** A printed "n per investigator" value. */
export function perInvestigator(value: number): ScaledValue {
  return { fixed: 0, perInvestigator: value };
}

/**
 * What a `blank*` card takes: its code as a plain string, so a card table
 * reads like a list of names, plus any stats to set on top of the blank ones.
 */
export type BlankCardOverrides = Partial<Omit<CardStats, 'code' | 'typeCode'>> & { code: string };

/**
 * A card of `typeCode` with nothing on it: named after its code, no traits,
 * and the stats in `blank` (zeros) unless `overrides` sets them. The `blank*`
 * functions below are this for each type, so a test, a sandbox board or a
 * scenario under construction names only the stats that matter to it.
 */
function blankCard(
  typeCode: CardType,
  blank: Partial<CardStats>,
  overrides: BlankCardOverrides,
): CardStats {
  return {
    name: overrides.code,
    traits: [],
    ...blank,
    ...overrides,
    typeCode,
    code: cardCode(overrides.code),
  };
}

/** A location with shroud 0 and no clues. */
export function blankLocation(overrides: BlankCardOverrides): CardStats {
  return blankCard('location', { shroud: 0, clues: fixed(0) }, overrides);
}

/**
 * An enemy with fight, evade, damage and horror 0 and 1 health: the least
 * health an enemy can have, since one with none would be defeated as it
 * enters play. No keywords, so it neither hunts nor retaliates.
 */
export function blankEnemy(overrides: BlankCardOverrides): CardStats {
  return blankCard(
    'enemy',
    { fight: 0, evade: 0, health: fixed(1), damage: 0, horror: 0 },
    overrides,
  );
}

/** A treachery without a revelation test that is discarded after its revelation. */
export function blankTreachery(overrides: BlankCardOverrides): CardStats {
  return blankCard('treachery', {}, overrides);
}

/** An asset (a story asset, as the encounter deck or setup puts into play) with no stats. */
export function blankAsset(overrides: BlankCardOverrides): CardStats {
  return blankCard('asset', {}, overrides);
}

/**
 * An agenda at stage 1. It takes its doom threshold explicitly: no value is
 * neutral, since a low one advances the agenda at the first doom check and a
 * high one is a number the reader would have to look up.
 */
export function blankAgenda(overrides: BlankCardOverrides & { doom: ScaledValue }): CardStats {
  return blankCard('agenda', { stage: { number: 1 } }, overrides);
}

/** An act at stage 1 that needs no clues to advance. */
export function blankAct(overrides: BlankCardOverrides): CardStats {
  return blankCard('act', { stage: { number: 1 }, clues: fixed(0) }, overrides);
}

/** What `blankInvestigator` takes: the ID as a plain string, plus any fields to set. */
export type BlankInvestigatorOverrides = Partial<Omit<Investigator, 'id'>> & { id: string };

/**
 * An investigator with plain stats: 8 health, 6 sanity, 3 in every skill, no
 * damage, horror or clues, 3 actions, seat 0, not placed. Unlike a blank card
 * these are not zeros, because an investigator with no health or sanity is
 * defeated; the 5 resources are what every investigator starts a scenario
 * with. Their card code is their ID unless `overrides` sets one.
 */
export function blankInvestigator(overrides: BlankInvestigatorOverrides): Investigator {
  return {
    code: investigatorCode(overrides.id),
    name: overrides.id,
    seat: 0,
    health: { max: 8, damage: 0 },
    sanity: { max: 6, horror: 0 },
    clues: 0,
    resources: 5,
    doomOnPlayerCards: 0,
    actionsRemaining: 3,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
    status: 'active',
    ...overrides,
    id: investigatorId(overrides.id),
  };
}
