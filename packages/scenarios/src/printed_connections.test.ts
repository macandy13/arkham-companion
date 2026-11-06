import {
  cardCode,
  cardStats,
  printedSymbols,
  printsConnectionTo,
  type AddMapStep,
  type CardCode,
  type CardDb,
  type LocationSide,
  type SetupStep,
} from '@arkham/engine';
import { assertNever } from '@arkham/util';
import { describe, expect, it } from 'vitest';
import { theDevourerBelowCards } from './the_devourer_below/cards';
import { theDevourerBelow } from './the_devourer_below/scenario';
import { theGatheringCards, theGatheringHouse } from './the_gathering/cards';
import { theGathering } from './the_gathering/scenario';
import { theMidnightMasksCards } from './the_midnight_masks/cards';
import { theMidnightMasks } from './the_midnight_masks/scenario';

// The maps' connections are entered by hand; these tests hold them to the connection symbols
// printed on the cards (`CardStats.connectsTo`), so the two can't drift apart.

/** Every map a scenario's setup can add, from all its branches. */
function mapsOf(steps: readonly SetupStep[]): AddMapStep[] {
  return steps.flatMap((step): AddMapStep[] => {
    switch (step.kind) {
      case 'addMap':
        return [step];
      case 'whenStory':
        return [...mapsOf(step.then), ...mapsOf(step.otherwise ?? [])];
      case 'whenPlayers':
        return mapsOf(step.then);
      case 'oneAtRandom':
        return step.options.flatMap(mapsOf);
      case 'setAside':
      case 'buildEncounterDeck':
      case 'shuffleIntoEncounterDeck':
      case 'scenarioDeck':
      case 'shuffle':
      case 'placeTokens':
      case 'spawn':
      case 'moveInvestigators':
      case 'addChaosTokens':
        return [];
      default:
        return assertNever(step);
    }
  });
}

/** A connection as a readable pair, "01112 Hallway – 01113 Attic", in a fixed order. */
function pairName(cards: CardDb, a: CardCode, b: CardCode): string {
  const name = (code: CardCode) => `${code} ${cardStats(cards, code).name}`;
  return [name(a), name(b)].sort().join(' – ');
}

/** The pairs of the map's locations whose `side`s print a connection, either way. */
function printedPairs(cards: CardDb, map: AddMapStep, side: LocationSide): string[] {
  const codes = [...map.locations.map((l) => l.code), ...(map.atRandom?.codes ?? [])];
  const printed = (code: CardCode) => printedSymbols(cardStats(cards, code), side);
  return codes
    .flatMap((a, i) =>
      codes
        .slice(i + 1)
        .filter(
          (b) =>
            printsConnectionTo(printed(a), printed(b)) ||
            printsConnectionTo(printed(b), printed(a)),
        )
        .map((b) => pairName(cards, a, b)),
    )
    .sort();
}

/** The pairs the map declares; with `revealedOnly: false`, only those that hold unrevealed too. */
function declaredPairs(
  cards: CardDb,
  map: AddMapStep,
  { revealedOnly }: { revealedOnly: boolean },
) {
  return (map.connections ?? [])
    .filter((connection) => revealedOnly || !connection.revealedOnly)
    .map((connection) => pairName(cards, connection.from, connection.to))
    .sort();
}

const scenarioMaps = [
  {
    scenario: 'The Gathering',
    cards: theGatheringCards,
    maps: [...mapsOf(theGathering.setup), theGatheringHouse],
  },
  {
    scenario: 'The Midnight Masks',
    cards: theMidnightMasksCards,
    maps: mapsOf(theMidnightMasks.setup),
  },
  {
    scenario: 'The Devourer Below',
    cards: theDevourerBelowCards,
    maps: mapsOf(theDevourerBelow.setup),
  },
].flatMap(({ scenario, cards, maps }) =>
  maps.map((map, i) => ({ label: `${scenario}: ${map.name} (${i + 1})`, cards, map })),
);

describe('the printed connection symbols of Night of the Zealot', () => {
  it.each(scenarioMaps)('give $label the connections it declares', ({ cards, map }) => {
    expect(declaredPairs(cards, map, { revealedOnly: true })).toEqual(
      printedPairs(cards, map, 'revealed'),
    );
  });

  it.each(scenarioMaps)(
    'give $label the connections it declares for unrevealed sides',
    ({ cards, map }) => {
      expect(declaredPairs(cards, map, { revealedOnly: false })).toEqual(
        printedPairs(cards, map, 'unrevealed'),
      );
    },
  );

  it('print the Ritual Site and the Main Path as connected to each other', () => {
    const mainPath = printedSymbols(
      cardStats(theDevourerBelowCards, cardCode('01149')),
      'revealed',
    );
    const ritualSite = printedSymbols(
      cardStats(theDevourerBelowCards, cardCode('01156')),
      'revealed',
    );

    expect(printsConnectionTo(mainPath, ritualSite)).toBe(true);
    expect(printsConnectionTo(ritualSite, mainPath)).toBe(true);
  });
});
