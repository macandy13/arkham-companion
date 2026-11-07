import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CardDef } from '@arkham/carddata';
// The cache's path lives with the Node-side fetch, not in the package index, which the browser loads.
import { CACHE_DIR } from '@arkham/carddata/src/fetch';
import type { CardStats, ScaledValue } from '@arkham/engine';
import { describe, expect, it } from 'vitest';
import { theDevourerBelowCardDefs } from './the_devourer_below/cards';
import { theGatheringCardDefs } from './the_gathering/cards';
import { MIDNIGHT_MASKS_CODES, theMidnightMasksCardDefs } from './the_midnight_masks/cards';

// The scenarios' card stats are entered by hand; this check holds them to ArkhamDB's data so a
// typo can't hide. It needs the cards `pnpm carddata:fetch` caches (never committed), so it runs
// where they were fetched (the "Carddata check" workflow) and is skipped elsewhere.
// `toEqual` leaves out the stats a card has in neither source (`undefined`).

/** The printed values both sources have, in one shape so a mismatch shows as a plain diff. */
interface PrintedStats {
  name: string;
  typeCode: string;
  traits: string[];
  encounterCode?: string;
  quantity: number;
  unique: boolean;
  stage?: number;
  shroud?: number;
  clues?: string;
  fight?: number;
  evade?: number;
  health?: string;
  damage?: number;
  horror?: number;
  victory?: number;
  doom?: string;
}

/**
 * "2" or "2 per investigator", as the card prints it. A value with both parts prints its fixed
 * part; its text adds the rest (Umôrdhoth's "+4 health per investigator" on a printed 6).
 */
function printedValue({ fixed, perInvestigator }: ScaledValue): string {
  return perInvestigator && !fixed ? `${perInvestigator} per investigator` : `${fixed}`;
}

/** What the card prints, from the hand-entered stats. */
function enteredStats(stats: CardStats): PrintedStats {
  return {
    name: stats.name,
    typeCode: stats.typeCode,
    traits: [...stats.traits].sort(),
    encounterCode: stats.encounterCode,
    quantity: stats.quantity ?? 1,
    unique: stats.unique ?? false,
    stage: stats.stage?.number,
    shroud: stats.shroud,
    clues: stats.clues && printedValue(stats.clues),
    fight: stats.fight,
    evade: stats.evade,
    health: stats.health && printedValue(stats.health),
    damage: stats.damage,
    horror: stats.horror,
    victory: stats.victory,
    doom: stats.doom && printedValue(stats.doom),
  };
}

/** What the card prints, from ArkhamDB. */
function arkhamDbStats(def: CardDef): PrintedStats {
  const scaled = (value: number | undefined, perInvestigator: boolean) =>
    value === undefined
      ? undefined
      : perInvestigator && value !== 0
        ? `${value} per investigator`
        : `${value}`;
  const enemy = def.typeCode === 'enemy';
  return {
    name: def.name,
    typeCode: def.typeCode,
    traits: [...def.traits].sort(),
    encounterCode: def.encounterCode,
    quantity: def.quantity,
    unique: def.isUnique,
    stage: def.stage,
    shroud: def.shroud,
    // An act's clue threshold is its spend-clues ability, not a stat (`act` in card_builders).
    clues: def.typeCode === 'act' ? undefined : scaled(def.clues, !def.cluesFixed),
    fight: def.fight,
    evade: def.evade,
    health: scaled(def.health, def.healthPerInvestigator === true),
    // ArkhamDB leaves out an enemy's 0 damage or horror.
    damage: def.damage ?? (enemy ? 0 : undefined),
    horror: def.horror ?? (enemy ? 0 : undefined),
    victory: def.victory,
    doom: scaled(def.doom, false),
  };
}

/**
 * The Core Set's cards as `pnpm carddata:fetch` cached them, or none when it hasn't run. Where the
 * workflow fetched them (`ARKHAMDB_CHECK=required`) a missing file fails instead, so a renamed
 * pack or path can't turn the check into a silent skip.
 */
function cachedCoreSet(): readonly CardDef[] {
  const file = join(CACHE_DIR, 'en', 'core.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as CardDef[];
  if (process.env.ARKHAMDB_CHECK === 'required') throw new Error(`no fetched cards at ${file}`);
  return [];
}

/**
 * Cards ArkhamDB doesn't list as cards of their own: The Masked Hunter is the reverse side of
 * agenda 1 (01121a), which the pack data only links to.
 */
const reverseSides: readonly string[] = [MIDNIGHT_MASKS_CODES.theMaskedHunter];

const coreSet = cachedCoreSet();
const entered = [...theGatheringCardDefs, ...theMidnightMasksCardDefs, ...theDevourerBelowCardDefs]
  .filter((stats) => !reverseSides.includes(stats.code))
  .map((stats) => ({ label: `${stats.code} ${stats.name}`, stats }));

describe.skipIf(coreSet.length === 0)('the hand-entered Night of the Zealot cards', () => {
  it.each(entered)('print what ArkhamDB has for $label', ({ stats }) => {
    const def = coreSet.find((card) => card.code === stats.code);

    expect(def && arkhamDbStats(def)).toEqual(enteredStats(stats));
  });
});
