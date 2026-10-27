import type { Page } from '@playwright/test';
import {
  cardCode,
  cardDbWith,
  gameId,
  investigatorCardStats,
  investigatorCode,
  investigatorId,
  PlayTable,
  type CardCode,
  type InstanceId,
  type InvestigatorCard,
  type ScenarioDefinition,
} from '@arkham/engine';
import {
  GATHERING_CODES,
  theGathering,
  theGatheringCards,
  theGatheringHouse,
} from '@arkham/scenarios';
import { serialiseGameExport } from '../../src/storage/gameExport';
import { ROLAND_PICTURE } from './card_pictures';

/**
 * Roland Banks with his printed stats, entered by hand: the exported game reads him from its log,
 * never from card data. His picture is the real scan (`ROLAND_PICTURE`), so the shots show the
 * investigator card's art crop.
 */
const roland: InvestigatorCard = {
  code: investigatorCode('01001'),
  name: 'Roland Banks',
  imageSrc: ROLAND_PICTURE,
  health: 9,
  sanity: 5,
  skills: { willpower: 3, intellect: 3, combat: 4, agility: 2 },
};
const rolandId = investigatorId('roland');

/**
 * A solo game of `scenario` (The Gathering or a variant of it), played until act 1 opens the
 * house: Roland Banks takes the Study's two clues and spends them.
 */
function houseOpened(scenario: ScenarioDefinition): PlayTable {
  const table = PlayTable.setUp(
    { cards: cardDbWith(theGatheringCards, [investigatorCardStats(roland)]), scenario },
    { investigators: [{ id: rolandId, code: roland.code }], seed: 3 },
  );
  table.nextPhase();
  table.startTurn(rolandId);
  table.investigate(rolandId);
  table.investigate(rolandId);
  table.spendCluesToAdvanceAct([[rolandId, 2]]);
  return table;
}

/** The export file of `table`'s game, titled `title`, as the home screen's import reads it. */
function exportOf(title: string, table: PlayTable, commandId: string): Buffer {
  const events = table.events.map((event, seq) => ({
    gameId: gameId('export'),
    seq: seq + 1,
    timestamp: seq,
    commandId,
    event,
  }));
  return Buffer.from(serialiseGameExport(title, 0, events));
}

/**
 * An export file of a solo game of The Gathering titled `title`, played until act 1 opens the
 * house. Played through the engine rather than kept as a file, so it always matches the current
 * event format. The screen has no actions for this yet, so flows that need the house import it.
 */
export function houseOpenedExport(title: string): Buffer {
  return exportOf(title, houseOpened(theGathering), 'house_opened');
}

/**
 * Like `houseOpenedExport`, but the setup set two Ghoul Priests aside, and Roland Banks holds the 3 clues
 * act 2 (The Barrier) needs, given by hand to keep the script short. Advancing the act then cannot
 * tell which Ghoul Priest to spawn, so the screen asks the players to do it by hand.
 */
export function twoGhoulPriestsExport(title: string): Buffer {
  const twoPriests: ScenarioDefinition = {
    ...theGathering,
    setup: theGathering.setup.map((step) =>
      step.kind === 'setAside'
        ? { ...step, codes: [...step.codes, GATHERING_CODES.ghoulPriest] }
        : step,
    ),
  };
  const table = houseOpened(twoPriests);
  table.play({ type: 'AdjustInvestigator', investigatorId: rolandId, stat: 'clues', delta: 3 });
  return exportOf(title, table, 'two_ghoul_priests');
}

/**
 * Like `houseOpenedExport`, but played on to the investigation phase of round 3, so the mythos
 * phases of rounds 2 and 3 have drawn from the encounter deck (each "Next" runs one phase:
 * enemy, upkeep, mythos, investigation): Dissonant Voices, drawn in round 2, lies on the discard
 * pile.
 */
export function mythosDrawnExport(title: string): Buffer {
  const table = houseOpened(theGathering);
  table.endTurn(rolandId);
  table.nextPhase();
  table.nextPhase();
  table.nextPhase();
  table.nextPhase();
  table.startTurn(rolandId);
  table.endTurn(rolandId);
  table.nextPhase();
  table.nextPhase();
  table.nextPhase();
  table.nextPhase();
  return exportOf(title, table, 'mythos_drawn');
}

/**
 * An export file of a solo game of The Gathering titled `title` in which the house map is in
 * play while Roland Banks is still in the Study, so two maps are visible at once. No scenario reaches
 * this yet (act 1 removes the Study as it opens the house), so the house is added directly; it
 * shows the map tabs.
 */
export function twoMapsExport(title: string): Buffer {
  const table = PlayTable.setUp(
    {
      cards: cardDbWith(theGatheringCards, [investigatorCardStats(roland)]),
      scenario: theGathering,
    },
    { investigators: [{ id: rolandId, code: roland.code }], seed: 3 },
  );
  const cardOf = (code: CardCode) => cardIn(table, code);
  const house = theGatheringHouse;
  table.step(() =>
    table.play({
      type: 'AddMap',
      mapId: house.mapId,
      map: {
        name: house.name,
        connections: (house.connections ?? []).map(({ from, to }) => ({
          from: cardOf(from),
          to: cardOf(to),
          oneWay: false,
        })),
      },
      locations: house.locations.map(({ code, at }) => ({ id: cardOf(code), at })),
    }),
  );
  return exportOf(title, table, 'two_maps');
}

/**
 * Like `houseOpenedExport`, but Roland Banks spends their last action investigating the Hallway and the
 * players have not reported the test yet, so the screen opens with the decision dialog asking
 * for its result.
 */
export function investigationOpenExport(title: string): Buffer {
  const table = houseOpened(theGathering);
  table.investigate(rolandId, { result: 'open' });
  return exportOf(title, table, 'investigation_open');
}

/**
 * Like `houseOpenedExport`, but the Parlor is revealed, by hand to keep the script short (act 2
 * reveals it), and Roland Banks spends their last action moving into it, so their turn row offers the
 * Parlor's Resign.
 */
export function inTheParlorExport(title: string): Buffer {
  const table = houseOpened(theGathering);
  const parlor = cardIn(table, GATHERING_CODES.parlor);
  table.play({ type: 'RevealLocation', locationId: parlor });
  table.moveTo(rolandId, parlor);
  return exportOf(title, table, 'in_the_parlor');
}

/**
 * Like `houseOpenedExport`, but the Ghoul Priest, set aside at setup, has spawned in the Cellar,
 * given by hand to keep the script short, so a spec has an enemy to drag around the house.
 */
export function ghoulPriestInCellarExport(title: string): Buffer {
  const table = houseOpened(theGathering);
  table.play({
    type: 'SpawnEnemy',
    enemyId: cardIn(table, GATHERING_CODES.ghoulPriest),
    at: cardIn(table, GATHERING_CODES.cellar),
  });
  return exportOf(title, table, 'ghoul_priest_in_cellar');
}

/**
 * Like `houseOpenedExport`, but with Roland Banks threatened: the Ghoul Priest has spawned in the Hallway,
 * engaged Roland Banks and taken 2 damage, and both Dissonant Voices and both Frozen in Fear sit in
 * Roland Banks' threat area, all given by hand to keep the script short. That is five cards, one more
 * than the threat area shows, so a spec shows it full and scrolling.
 */
export function rolandThreatenedExport(title: string): Buffer {
  const table = houseOpened(theGathering);
  const ghoulPriest = cardIn(table, GATHERING_CODES.ghoulPriest);
  table.play({
    type: 'SpawnEnemy',
    enemyId: ghoulPriest,
    at: cardIn(table, GATHERING_CODES.hallway),
  });
  table.play({
    type: 'ManualAdjust',
    adjustment: { kind: 'tokens', cardId: ghoulPriest, token: 'damage', delta: 2 },
  });
  for (const treachery of Object.values(table.state.cards).filter(({ code }) =>
    THREAT_AREA_TREACHERIES.includes(code),
  ))
    table.play({
      type: 'ManualAdjust',
      adjustment: {
        kind: 'moveCard',
        cardId: treachery.id,
        to: { kind: 'threatArea', investigatorId: rolandId },
      },
    });
  return exportOf(title, table, 'roland_threatened');
}

/** The Gathering's Dissonant Voices and Frozen in Fear, treacheries that go into the threat area; two copies each. */
const THREAT_AREA_TREACHERIES: readonly CardCode[] = [cardCode('01165'), cardCode('01164')];

/** The card of `table`'s game with `code`; only for cards the game has one copy of. */
function cardIn(table: PlayTable, code: CardCode): InstanceId {
  const card = Object.values(table.state.cards).find((candidate) => candidate.code === code);
  if (!card) throw new Error(`no card ${code} in the game`);
  return card.id;
}

/** Imports `file` (an export like `houseOpenedExport`) on the home screen, which lists it there. */
export async function importGame(page: Page, file: Buffer): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Import game').setInputFiles({
    name: 'game.arkham.json',
    mimeType: 'application/json',
    buffer: file,
  });
}

/**
 * Imports `file` (an export like `houseOpenedExport`) on the home screen and resumes the game
 * titled `title`, so a spec starts on the game screen of a prepared game.
 */
export async function resumeImportedGame(page: Page, title: string, file: Buffer): Promise<void> {
  await importGame(page, file);
  await page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: title, exact: true }) })
    .getByRole('link', { name: 'Resume' })
    .click();
}
