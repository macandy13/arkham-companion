import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/test';
import {
  ghoulPriestInCellarExport,
  houseOpenedExport,
  resumeImportedGame,
} from './fixtures/saved_games';
import { startQuickGame } from './fixtures/wizard';

// Journey: read the map – the one location a new game starts with, then a game further on whose
// map has several locations and the connections between them, zoomed in and fitted again.
test('read the map', async ({ page }) => {
  await test.step('Start a quick game', async () => {
    await page.goto('/#/new');
    await startQuickGame(page);
    await expect(page.getByText('Round 0, Setup')).toBeVisible();
  });

  await test.step('Find the Study on its map', async () => {
    const studyMap = page.getByRole('figure', { name: 'Study' });
    await expect(studyMap.getByRole('group', { name: 'Study' })).toBeVisible();
  });

  await test.step('Import a game in which act 1 opened the house', async () => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  });

  await test.step('Read the house: Alder in the Hallway, which connects to the other rooms', async () => {
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
    await expect(hallway.getByRole('img', { name: 'Alder' })).toBeVisible();
    await expect(hallway).toContainText('Shroud 1 · Clues 0');
  });

  await test.step('Zoom in on the Hallway, then fit the whole house again', async () => {
    const hallway = page
      .getByRole('figure', { name: 'House' })
      .getByRole('group', { name: 'Hallway' });
    const fittedWidth = (await hallway.boundingBox())?.width ?? 0;
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect
      .poll(async () => (await hallway.boundingBox())?.width ?? 0)
      .toBeGreaterThan(1.5 * fittedWidth);
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

  await test.step('Import a game in which Alder, on their turn, stands in the Hallway', async () => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
    await expect(room('Hallway').getByRole('img', { name: 'Alder' })).toBeVisible();
  });

  await test.step('Drag Alder to the Attic, which connects to the Hallway', async () => {
    await dragTo(page, room('Hallway').getByRole('img', { name: 'Alder' }), room('Attic'));
    await expect(room('Attic').getByRole('img', { name: 'Alder' })).toBeVisible();
    await expect(room('Hallway').getByRole('img', { name: 'Alder' })).toBeHidden();
  });

  await test.step('Drag Alder to the Cellar, which does not: Alder stays in the Attic', async () => {
    await dragTo(page, room('Attic').getByRole('img', { name: 'Alder' }), room('Cellar'));
    await expect(page.getByText('Those locations are not connected.')).toBeVisible();
    await expect(room('Attic').getByRole('img', { name: 'Alder' })).toBeVisible();
  });
});

// Journey: move an enemy by dragging it as a card instruction says: to a location with no
// connection, then to the investigator's, where it engages them, and away again, which
// disengages it.
test('move an enemy on the map', { tag: '@flow' }, async ({ page }) => {
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

  await test.step('Drag it to the Hallway, where it engages Alder', async () => {
    await dragTo(page, priest('Parlor'), room('Hallway'));
    await expect(
      room('Hallway').getByRole('img', { name: 'Ghoul Priest, engaged with Alder' }),
    ).toBeVisible();
  });

  await test.step('Drag it to the Attic, which disengages it', async () => {
    await dragTo(page, priest('Hallway'), room('Attic'));
    await expect(room('Attic').getByRole('img', { name: 'Ghoul Priest' })).toBeVisible();
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
