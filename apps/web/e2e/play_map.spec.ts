import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/test';
import {
  ghoulPriestInCellarExport,
  houseOpenedExport,
  resumeImportedGame,
} from './fixtures/saved_games';
import { startQuickGame } from './fixtures/wizard';

// Journey: read the map – the one location a new game starts with, then a game further on whose
// map has several locations and the connections between them, zoomed in, panned and fitted again.
test('read the map', async ({ page }) => {
  await test.step('Start a quick game', async () => {
    await page.goto('/#/new');
    await startQuickGame(page);
    await expect(page.getByRole('heading', { name: 'Setup' })).toBeVisible();
  });

  await test.step('Find the Study on its map', async () => {
    const studyMap = page.getByRole('figure', { name: 'Study' });
    await expect(studyMap.getByRole('group', { name: 'Study' })).toBeVisible();
  });

  await test.step('Import a game in which act 1 opened the house', async () => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  });

  await test.step('Read the house: Roland Banks in the Hallway, which connects to the other rooms', async () => {
    // Act 1 removed the Study from the game, so its map has nothing left to show.
    await expect(page.getByRole('figure', { name: 'Study' })).toBeHidden();
    const house = page.getByRole('figure', { name: 'House' });
    for (const room of ['Hallway', 'Attic', 'Cellar', 'Parlor']) {
      await expect(house.getByRole('group', { name: room })).toBeVisible();
    }
    for (const room of ['Attic', 'Cellar', 'Parlor']) {
      await expect(house.getByRole('img', { name: `Hallway – ${room}` })).toBeAttached();
    }
    const hallway = house.getByRole('group', { name: 'Hallway' });
    await expect(hallway.getByRole('img', { name: 'Roland Banks' })).toBeVisible();
    await expect(hallway.getByRole('img', { name: 'Shroud 1' })).toBeVisible();
    await expect(hallway.getByRole('img', { name: 'Clues 0' })).toBeVisible();
  });

  await test.step('Zoom in on the Hallway, pan it to the right, then fit the whole house again', async () => {
    const hallway = page
      .getByRole('figure', { name: 'House' })
      .getByRole('group', { name: 'Hallway' });
    const fittedWidth = (await hallway.boundingBox())?.width ?? 0;
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect
      .poll(async () => (await hallway.boundingBox())?.width ?? 0)
      .toBeGreaterThan(1.5 * fittedWidth);
    const zoomed = await hallway.boundingBox();
    if (!zoomed) throw new Error('the Hallway is not on screen');
    await page.mouse.move(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2);
    await page.mouse.down();
    await page.mouse.move(zoomed.x + zoomed.width / 2 + 60, zoomed.y + zoomed.height / 2, {
      steps: 5,
    });
    await page.mouse.up();
    await expect
      .poll(async () => Math.round((await hallway.boundingBox())?.x ?? 0))
      .toBeGreaterThan(Math.round(zoomed.x) + 30);
    await page.getByRole('button', { name: 'Fit map' }).click();
    await expect
      .poll(async () => Math.round((await hallway.boundingBox())?.width ?? 0))
      .toBe(Math.round(fittedWidth));
  });
});

// Journey: move by dragging the pawn of the investigator whose turn it is, to a connected
// location and then to one that is not, which the game refuses.
test('move on the map', async ({ page }) => {
  const house = page.getByRole('figure', { name: 'House' });
  const room = (name: string) => house.getByRole('group', { name });

  await test.step('Import a game in which Roland Banks, on their turn, stands in the Hallway', async () => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
    await expect(room('Hallway').getByRole('img', { name: 'Roland Banks' })).toBeVisible();
  });

  await test.step('Drag Roland Banks to the Attic, which connects to the Hallway', async () => {
    await dragTo(page, room('Hallway').getByRole('img', { name: 'Roland Banks' }), room('Attic'));
    await expect(room('Attic').getByRole('img', { name: 'Roland Banks' })).toBeVisible();
    await expect(room('Hallway').getByRole('img', { name: 'Roland Banks' })).toBeHidden();
  });

  await test.step('Drag Roland Banks to the Cellar, which does not: Roland Banks stays in the Attic', async () => {
    await dragTo(page, room('Attic').getByRole('img', { name: 'Roland Banks' }), room('Cellar'));
    await expect(page.getByText('Those locations are not connected.')).toBeVisible();
    await expect(room('Attic').getByRole('img', { name: 'Roland Banks' })).toBeVisible();
  });
});

// Journey: move an enemy by dragging it as a card instruction says: to a location with no
// connection, then to the investigator's, where it engages them, and away again, which
// disengages it.
test('move an enemy on the map', async ({ page }) => {
  const house = page.getByRole('figure', { name: 'House' });
  const room = (name: string) => house.getByRole('group', { name });
  const priest = (name: string) => room(name).getByRole('img', { name: /^Ghoul Priest/ });

  await test.step('Import a game in which the Ghoul Priest lurks in the Cellar', async () => {
    await resumeImportedGame(
      page,
      'The Ghoul Priest is out',
      ghoulPriestInCellarExport('The Ghoul Priest is out'),
    );
    await expect(priest('Cellar')).toBeVisible();
  });

  await test.step('Drag it to the Parlor, which the Cellar does not connect to', async () => {
    await dragTo(page, priest('Cellar'), room('Parlor'));
    await expect(priest('Parlor')).toBeVisible();
    await expect(priest('Cellar')).toBeHidden();
  });

  await test.step('Drag it to the Hallway, where it engages Roland Banks', async () => {
    await dragTo(page, priest('Parlor'), room('Hallway'));
    await expect(
      room('Hallway').getByRole('img', { name: 'Ghoul Priest, engaged with Roland Banks' }),
    ).toBeVisible();
  });

  await test.step('Drag it to the Attic, which disengages it', async () => {
    await dragTo(page, priest('Hallway'), room('Attic'));
    await expect(room('Attic').getByRole('img', { name: 'Ghoul Priest' })).toBeVisible();
  });
});

// Journey: act on an enemy from its token on the map: the Ghoul Priest in the Cellar offers only
// card effects, as Roland Banks is elsewhere; dragged to the Hallway it engages Roland Banks, and a tap on it
// there fights it as an action, whose test follows in the same dialog; once it is answered the
// details come back.
test('fight an enemy from the map', { tag: '@flow' }, async ({ page }) => {
  const house = page.getByRole('figure', { name: 'House' });
  const room = (name: string) => house.getByRole('group', { name });
  const priest = (name: string) => room(name).getByRole('img', { name: /^Ghoul Priest/ });
  const details = page.getByRole('dialog', { name: 'Ghoul Priest' });

  await test.step('Import a game in which the Ghoul Priest lurks in the Cellar', async () => {
    await resumeImportedGame(
      page,
      'The Ghoul Priest is out',
      ghoulPriestInCellarExport('The Ghoul Priest is out'),
    );
    await expect(priest('Cellar')).toBeVisible();
  });

  await test.step('Tap it in the Cellar: away from Roland Banks, it offers only card effects', async () => {
    await priest('Cellar').click();
    await expect(details.getByRole('button', { name: 'Deal 1 damage' })).toBeVisible();
    await expect(details.getByRole('button', { name: 'Fight · 1 action' })).toBeHidden();
    await details.getByRole('button', { name: 'Close' }).click();
  });

  await test.step('Drag it to the Hallway, where it engages Roland Banks', async () => {
    await dragTo(page, priest('Cellar'), room('Hallway'));
    await expect(
      room('Hallway').getByRole('img', { name: 'Ghoul Priest, engaged with Roland Banks' }),
    ).toBeVisible();
  });

  await test.step('Tap it in the Hallway and fight it as an action: the test follows in the same dialog', async () => {
    await priest('Hallway').click();
    await details.getByRole('button', { name: 'Fight · 1 action' }).click();
    const fight = page.getByRole('dialog', { name: 'Fight Ghoul Priest' });
    await expect(fight.getByRole('img', { name: 'Health 5 of 5' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });

  await test.step('Report the fight as passed: the details come back with the damage dealt', async () => {
    const fight = page.getByRole('dialog', { name: 'Fight Ghoul Priest' });
    await fight.getByRole('button', { name: 'Passed' }).click();
    await fight.getByRole('button', { name: 'Done' }).click();
    await expect(details.getByRole('img', { name: 'Health 4 of 5' })).toBeVisible();
  });
});

// Journey: play from a location's details: Roland Banks moves from the Hallway to the Attic as an
// action, which reveals it, and takes a clue there as a card grants it.
test('move and take a clue from the location details', async ({ page }) => {
  const house = page.getByRole('figure', { name: 'House' });
  const room = (name: string) => house.getByRole('group', { name });
  const details = (name: string) => page.getByRole('dialog', { name });

  await test.step('Import a game in which Roland Banks, on their turn, stands in the Hallway', async () => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
    await expect(room('Hallway').getByRole('img', { name: 'Roland Banks' })).toBeVisible();
  });

  await test.step('Tap the Attic and move Roland Banks there as an action', async () => {
    await room('Attic').click();
    await expect(details('Attic')).toContainText('Unrevealed');
    await details('Attic').getByRole('button', { name: 'Move here · 1 action' }).click();
    await expect(room('Attic').getByRole('img', { name: 'Roland Banks' })).toBeVisible();
    await expect(room('Attic').getByRole('img', { name: /^Shroud/ })).toBeVisible();
  });

  await test.step('Tap the Attic again and take one of its clues without a test', async () => {
    const clues = Number(
      await room('Attic')
        .getByRole('img', { name: /^Clues/ })
        .textContent(),
    );
    await room('Attic').click();
    await expect(details('Attic')).toContainText('Roland Banks');
    await details('Attic').getByRole('button', { name: 'Take a clue, no test' }).click();
    await details('Attic').getByRole('button', { name: 'Close' }).click();
    await expect(room('Attic').getByRole('img', { name: `Clues ${clues - 1}` })).toBeVisible();
  });
});

// Journey: keep the map in step with the table through a location's details while adjusting the
// board: reveal a location a card turned over, put doom on it, and place a clue a card adds to the
// Hallway.
test('correct a location from its details', async ({ page }) => {
  const house = page.getByRole('figure', { name: 'House' });
  const room = (name: string) => house.getByRole('group', { name });
  const details = (name: string) => page.getByRole('dialog', { name });

  await test.step('Import a game in which Roland Banks, on their turn, stands in the Hallway', async () => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
    await expect(room('Attic')).toContainText('Unrevealed');
  });

  await test.step('Adjust the board, open the Attic’s details, reveal it and put a doom on it', async () => {
    await page.getByRole('button', { name: 'Adjust board' }).click();
    await room('Attic').getByRole('button', { name: 'Details of Attic' }).click();
    await details('Attic').getByRole('button', { name: 'Reveal' }).click();
    await details('Attic').getByRole('button', { name: 'Add doom' }).click();
    await expect(details('Attic')).toContainText('Doom 1');
    await details('Attic').getByRole('button', { name: 'Close' }).click();
    await expect(room('Attic').getByRole('img', { name: /^Shroud/ })).toBeVisible();
    await expect(room('Attic').getByRole('img', { name: 'Doom 1' })).toBeVisible();
  });

  await test.step('Open the Hallway’s details and add a clue', async () => {
    await room('Hallway').click();
    await details('Hallway').getByRole('button', { name: 'Add a clue' }).click();
    await expect(details('Hallway')).toContainText('Clues 1');
    await details('Hallway').getByRole('button', { name: 'Close' }).click();
    await expect(room('Hallway').getByRole('img', { name: 'Clues 1' })).toBeVisible();
  });

  await test.step('Keep the corrections with "Done"', async () => {
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(room('Hallway').getByRole('img', { name: 'Clues 1' })).toBeVisible();
  });
});

/** Drags `piece` with the mouse to the middle of `target`, in steps, as a player's finger would. */
async function dragTo(page: Page, piece: Locator, target: Locator): Promise<void> {
  const from = await piece.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('the piece or its target is not on screen');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
}
