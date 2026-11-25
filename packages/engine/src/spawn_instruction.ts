import { stripTrailingDot } from '@arkham/util';
import type { EachInPlayRef, PickMeasure, RelativeCard } from './abilities/types';
import { trait } from './cards';

/**
 * Where an enemy's spawn instruction lets it spawn (Rules Reference, "Spawn"), read from the text
 * once when the card data loads (`cardDbFrom`): one alternative after the other, "Your House.
 * Otherwise, Rivertown." trying Rivertown only when Your House gives no location (`spawnPlan`).
 */
export type SpawnInstruction = readonly SpawnAlternative[];

/**
 * One alternative of a spawn instruction: "Engaged with prey", or the locations in play a
 * `Selector` picks among ("Any [[Arkham]] location", "Nearest empty location", a location's
 * name). The investigator who drew the enemy is "you", the one distances count from.
 */
export type SpawnAlternative =
  { kind: 'engagedWithPrey' } | { kind: 'location'; select: SpawnSelector };

/** A `Selector` among the locations in play. */
type SpawnSelector = Extract<RelativeCard, { ref: 'pick' }> & { among: EachInPlayRef };

/**
 * `detail`, the text after "Spawn –", as a `SpawnInstruction`:
 *
 * - "Engaged with prey".
 * - "Any empty location": no investigators and no enemies there; "Any location (empty, if able)"
 *   tries the empty ones first, then any.
 * - "Nearest / Farthest [empty] location", "Location nearest to / farthest from you".
 * - "Any [[Trait]] location", "Location with the most clues", "Any location connected to yours".
 * - "A or B (whichever is nearest to you)".
 * - Anything else names a location ("Cellar"); `spawnPlan` lets the players choose when no location
 *   in the game has that name, as the text is then no instruction the engine can read.
 */
export function parseSpawn(detail: string): SpawnInstruction {
  return detail.split(OTHERWISE).flatMap((alternative) => parseAlternative(alternative.trim()));
}

const OTHERWISE = /\.\s*otherwise,\s*/i;
const WHICHEVER_NEAREST = ' (whichever is nearest to you)';
const NEAREST = { measure: { kind: 'distance' }, extreme: 'fewest' } as const;
const FARTHEST = { measure: { kind: 'distance' }, extreme: 'most' } as const;
const MOST_CLUES = { measure: { kind: 'tokens', token: 'clue' }, extreme: 'most' } as const;

/** The selectors behind the location instructions that name no location. */
const FILTERS: Readonly<Record<string, readonly SpawnAlternative[] | undefined>> = {
  'engaged with prey': [{ kind: 'engagedWithPrey' }],
  'any empty location': [locations({ empty: true })],
  'any location (empty, if able)': [locations({ empty: true }), locations({})],
  'nearest location': [locations({}, NEAREST)],
  'farthest location': [locations({}, FARTHEST)],
  'nearest empty location': [locations({ empty: true }, NEAREST)],
  'farthest empty location': [locations({ empty: true }, FARTHEST)],
  'location nearest to you': [locations({}, NEAREST)],
  'location farthest from you': [locations({}, FARTHEST)],
  'location with the most clues': [locations({}, MOST_CLUES)],
  'any location connected to yours': [locations({ connectedTo: { ref: 'windowLocation' } })],
};

function parseAlternative(text: string): readonly SpawnAlternative[] {
  const plain = stripTrailingDot(text);
  const lower = plain.toLowerCase().replace(/^the /, '');
  const filtered = FILTERS[lower];
  if (filtered !== undefined) return filtered;
  if (lower.endsWith(WHICHEVER_NEAREST)) {
    const names = plain.slice(0, -WHICHEVER_NEAREST.length).split(' or ');
    return [locations({ name: names }, NEAREST)];
  }
  const traitName = lower.startsWith('any ') ? plain.slice('any '.length) : '';
  if (traitName.length > ' location'.length && lower.endsWith(' location'))
    return [locations({ trait: trait(traitName.slice(0, -' location'.length)) })];
  return [locations({ name: plain })];
}

/** The locations in play `filter` matches, with `best` only those that measure the most or fewest. */
function locations(
  filter: Omit<EachInPlayRef, 'ref' | 'typeCode'>,
  best?: { measure: PickMeasure; extreme: 'most' | 'fewest' },
): SpawnAlternative {
  return {
    kind: 'location',
    select: {
      ref: 'pick',
      among: { ref: 'eachInPlay', typeCode: 'location', ...filter },
      ...(best === undefined ? {} : { best }),
      chooser: 'you',
    },
  };
}
