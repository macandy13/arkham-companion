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

/** An invented investigator: the exported game reads them from its log, never from card data. */
const alder: InvestigatorCard = {
  code: investigatorCode('alder'),
  name: 'Alder',
  health: 6,
  sanity: 8,
  skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
};
const alderId = investigatorId('alder');

/**
 * A solo game of `scenario` (The Gathering or a variant of it), played until act 1 opens the
 * house: Alder takes the Study's two clues and spends them.
 */
function houseOpened(scenario: ScenarioDefinition): PlayTable {
  const table = PlayTable.setUp(
    { cards: cardDbWith(theGatheringCards, [investigatorCardStats(alder)]), scenario },
    { investigators: [{ id: alderId, code: alder.code }], seed: 3 },
  );
  table.nextPhase();
  table.startTurn(alderId);
  table.investigate(alderId);
  table.investigate(alderId);
  table.spendCluesToAdvanceAct([[alderId, 2]]);
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
 * Like `houseOpenedExport`, but the setup set two Ghoul Priests aside, and Alder holds the 3 clues
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
  table.play({ type: 'AdjustInvestigator', investigatorId: alderId, stat: 'clues', delta: 3 });
  return exportOf(title, table, 'two_ghoul_priests');
}

/**
 * An export file of a solo game of The Gathering titled `title` in which the house map is in
 * play while Alder is still in the Study, so two maps are visible at once. No scenario reaches
 * this yet (act 1 removes the Study as it opens the house), so the house is added directly; it
 * shows the map tabs.
 */
export function twoMapsExport(title: string): Buffer {
  const table = PlayTable.setUp(
    {
      cards: cardDbWith(theGatheringCards, [investigatorCardStats(alder)]),
      scenario: theGathering,
    },
    { investigators: [{ id: alderId, code: alder.code }], seed: 3 },
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
 * Like `houseOpenedExport`, but with Alder threatened: the Ghoul Priest has spawned in the Hallway
 * and engaged Alder, and a Dissonant Voices sits in Alder's threat area, both given by hand to keep
 * the script short, so a spec shows a threat area.
 */
export function alderThreatenedExport(title: string): Buffer {
  const table = houseOpened(theGathering);
  table.play({
    type: 'SpawnEnemy',
    enemyId: cardIn(table, GATHERING_CODES.ghoulPriest),
    at: cardIn(table, GATHERING_CODES.hallway),
  });
  // Dissonant Voices has two copies; either one shows the same.
  const dissonantVoices = Object.values(table.state.cards).find(
    ({ code }) => code === DISSONANT_VOICES,
  );
  if (!dissonantVoices) throw new Error('no Dissonant Voices in the game');
  table.play({
    type: 'ManualAdjust',
    adjustment: {
      kind: 'moveCard',
      cardId: dissonantVoices.id,
      to: { kind: 'threatArea', investigatorId: alderId },
    },
  });
  return exportOf(title, table, 'alder_threatened');
}

/** The Gathering's Dissonant Voices, a treachery that goes into the threat area. */
const DISSONANT_VOICES = cardCode('01165');

/** The card of `table`'s game with `code`; only for cards the game has one copy of. */
function cardIn(table: PlayTable, code: CardCode): InstanceId {
  const card = Object.values(table.state.cards).find((candidate) => candidate.code === code);
  if (!card) throw new Error(`no card ${code} in the game`);
  return card.id;
}

/**
 * Imports `file` (an export like `houseOpenedExport`) on the home screen and resumes the game
 * titled `title`, so a spec starts on the game screen of a prepared game.
 */
export async function resumeImportedGame(page: Page, title: string, file: Buffer): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Import game').setInputFiles({
    name: 'game.arkham.json',
    mimeType: 'application/json',
    buffer: file,
  });
  await page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: title, exact: true }) })
    .getByRole('link', { name: 'Resume' })
    .click();
}
