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

/** Stats a `blank*` card sets on top of its blank ones; code and type are its own parameters. */
export type BlankCardStats = Partial<Omit<CardStats, 'code' | 'typeCode'>>;

/**
 * A card of `typeCode` with nothing on it: named after its code, no traits,
 * and the stats in `blank` (zeros) unless `stats` sets them. The `blank*`
 * functions below are this for each type, so a test, a sandbox board or a
 * scenario under construction names only the stats that matter to it. The
 * code is a plain string, so a card table reads like a list of names.
 */
function blankCard(
  typeCode: CardType,
  code: string,
  blank: BlankCardStats,
  stats: BlankCardStats,
): CardStats {
  return { name: code, traits: [], ...blank, ...stats, typeCode, code: cardCode(code) };
}

/** A location with shroud 0 and no clues. */
export function blankLocation(code: string, stats: BlankCardStats = {}): CardStats {
  return blankCard('location', code, { shroud: 0, clues: fixed(0) }, stats);
}

/**
 * An enemy with fight, evade, damage and horror 0 and 1 health: the least
 * health an enemy can have, since one with none would be defeated as it
 * enters play. No keywords, so it neither hunts nor retaliates.
 */
export function blankEnemy(code: string, stats: BlankCardStats = {}): CardStats {
  return blankCard(
    'enemy',
    code,
    { fight: 0, evade: 0, health: fixed(1), damage: 0, horror: 0 },
    stats,
  );
}

/** A treachery without a revelation test that is discarded after its revelation. */
export function blankTreachery(code: string, stats: BlankCardStats = {}): CardStats {
  return blankCard('treachery', code, {}, stats);
}

/** An asset (a story asset, as the encounter deck or setup puts into play) with no stats. */
export function blankAsset(code: string, stats: BlankCardStats = {}): CardStats {
  return blankCard('asset', code, {}, stats);
}

/**
 * An agenda at stage 1. It takes its doom threshold explicitly: no value is
 * neutral, since a low one advances the agenda at the first doom check and a
 * high one is a number the reader would have to look up.
 */
export function blankAgenda(
  code: string,
  doom: ScaledValue,
  stats: BlankCardStats = {},
): CardStats {
  return blankCard('agenda', code, { stage: { number: 1 }, doom }, stats);
}

/** An act at stage 1 that needs no clues to advance. */
export function blankAct(code: string, stats: BlankCardStats = {}): CardStats {
  return blankCard('act', code, { stage: { number: 1 }, clues: fixed(0) }, stats);
}

/** Fields `blankInvestigator` sets on top of its plain ones; the ID is its own parameter. */
export type BlankInvestigatorFields = Partial<Omit<Investigator, 'id'>>;

/**
 * An investigator with plain stats: 8 health, 6 sanity, 3 in every skill, no
 * damage, horror or clues, 3 actions, seat 0, not placed. Unlike a blank card
 * these are not zeros, because an investigator with no health or sanity is
 * defeated; the 5 resources are what every investigator starts a scenario
 * with. Their name and card code are their ID unless `fields` sets them.
 */
export function blankInvestigator(id: string, fields: BlankInvestigatorFields = {}): Investigator {
  return {
    code: investigatorCode(id),
    name: id,
    seat: 0,
    health: { max: 8, damage: 0 },
    sanity: { max: 6, horror: 0 },
    clues: 0,
    resources: 5,
    doomOnPlayerCards: 0,
    actionsRemaining: 3,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
    status: 'active',
    ...fields,
    id: investigatorId(id),
  };
}
