import type { Page } from '@playwright/test';
import {
  cardDbWith,
  gameId,
  investigatorCardStats,
  investigatorCode,
  investigatorId,
  PlayTable,
  type InvestigatorCard,
} from '@arkham/engine';
import { theGathering, theGatheringCards } from '@arkham/scenarios';
import { serialiseGameExport } from '../../src/storage/gameExport';

/** An invented investigator: the exported game reads them from its log, never from card data. */
const alder: InvestigatorCard = {
  code: investigatorCode('alder'),
  name: 'Alder',
  health: 6,
  sanity: 8,
  skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
};

/**
 * An export file of a solo game of The Gathering titled `title`, played until act 1 opens the
 * house: Alder takes the Study's two clues and spends them. Played through the engine rather
 * than kept as a file, so it always matches the current event format. The screen has no
 * actions for this yet, so flows that need the house import this game.
 */
export function houseOpenedExport(title: string): Buffer {
  const alderId = investigatorId('alder');
  const table = PlayTable.setUp(
    {
      cards: cardDbWith(theGatheringCards, [investigatorCardStats(alder)]),
      scenario: theGathering,
    },
    { investigators: [{ id: alderId, code: alder.code }], seed: 3 },
  );
  table.nextPhase();
  table.startTurn(alderId);
  table.investigate(alderId);
  table.investigate(alderId);
  table.spendCluesToAdvanceAct([[alderId, 2]]);
  const events = table.events.map((event, seq) => ({
    gameId: gameId('export'),
    seq: seq + 1,
    timestamp: seq,
    commandId: 'house_opened',
    event,
  }));
  return Buffer.from(serialiseGameExport(title, 0, events));
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
