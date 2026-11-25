import { stripTrailingDot } from '@arkham/util';
import type {
  EachInvestigatorRef,
  InvestigatorMeasure,
  PickMeasure,
  RelativeInvestigator,
} from './abilities/types';
import { trait } from './cards';
import { SKILL_NAMES } from './state';

/**
 * Whom an enemy's prey picks (Rules Reference, "Prey"), read from the text once when the card
 * data loads (`cardDbFrom`): a `Selector` among the investigators, and whether it says "only",
 * which makes the enemy ignore everyone else (`preferredByPrey`).
 */
export interface PreyInstruction {
  select: PreySelector;
  only: boolean;
}

/** A `Selector` among the investigators. */
type PreySelector = Extract<RelativeInvestigator, { ref: 'pick' }>;

/** Which of them a comparing prey keeps: those tied for the most or fewest of a measure. */
type PreyBest = { measure: PickMeasure; extreme: 'most' | 'fewest' };

const EXTREME_WORDS: Readonly<Record<string, 'most' | 'fewest' | undefined>> = {
  highest: 'most',
  most: 'most',
  lowest: 'fewest',
  fewest: 'fewest',
  least: 'fewest',
};

/** The counters a prey text compares after its extreme word. */
const COUNTERS: Readonly<Record<string, InvestigatorMeasure | undefined>> = {
  'remaining health': 'remainingHealth',
  'remaining sanity': 'remainingSanity',
  clues: 'clues',
  resources: 'resources',
  damage: 'damage',
  horror: 'horror',
};

const NEAREST_TO_ANOTHER = /^nearest to another (.+) enemy$/i;
const AT_TRAIT_LOCATION = /^investigator at an? (.+) location$/i;
const BEARER = /^bearer$/i;

/**
 * `detail`, the text after "Prey –", as a `PreyInstruction`:
 *
 * - an extreme word (highest, most, lowest, fewest, least) and a counter or a skill: "Highest
 *   [combat]", "Most clues", "Lowest remaining health";
 * - "Nearest to another [[Cultist]] enemy";
 * - "Investigator at a [[Woods]] location";
 * - "Bearer", the investigator whose weakness the enemy is;
 * - anything else names an investigator ("Daisy Walker"); `preferredByPrey` leaves the choice to
 *   the players when nobody in the game has that name, as the text is then no prey the engine can
 *   read from the board (Yithian Observer's "Fewest cards in hand").
 *
 * Each may end in "only".
 */
export function parsePrey(detail: string): PreyInstruction {
  const plain = stripTrailingDot(detail.trim());
  // A suffix check rather than a regular expression: `\s+only$` backtracks on long runs of spaces.
  const words = plain.split(' ');
  const only = words.length > 1 && words.at(-1)?.toLowerCase() === 'only';
  const text = only ? words.slice(0, -1).join(' ').trimEnd() : plain;
  return { select: preySelector(text), only };
}

function preySelector(text: string): PreySelector {
  if (BEARER.test(text)) return investigators({ bearerOf: { ref: 'self' } });
  const nearest = NEAREST_TO_ANOTHER.exec(text);
  if (nearest !== null) {
    const of = { ref: 'eachEnemy' as const, trait: trait(nearest[1] ?? '') };
    return investigators({}, { measure: { kind: 'distanceToOther', of }, extreme: 'fewest' });
  }
  const atTrait = AT_TRAIT_LOCATION.exec(text);
  if (atTrait !== null)
    return investigators({ atLocationWith: { trait: trait(atTrait[1] ?? '') } });
  const lower = text.toLowerCase();
  const space = lower.indexOf(' ');
  const extreme = EXTREME_WORDS[lower.slice(0, space)];
  const stat = measureNamed(lower.slice(space + 1));
  if (extreme !== undefined && stat !== undefined)
    return investigators({}, { measure: { kind: 'stat', stat }, extreme });
  return investigators({ name: text });
}

function measureNamed(name: string): InvestigatorMeasure | undefined {
  return SKILL_NAMES.find((skill) => name === `[${skill}]`) ?? COUNTERS[name];
}

/** The investigators `filter` matches, with `best` only those tied for the most or fewest. */
function investigators(filter: Omit<EachInvestigatorRef, 'ref'>, best?: PreyBest): PreySelector {
  return {
    ref: 'pick',
    among: { ref: 'eachInvestigator', ...filter },
    ...(best === undefined ? {} : { best }),
    chooser: 'lead',
  };
}
