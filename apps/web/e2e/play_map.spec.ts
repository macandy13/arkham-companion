import { expect, test } from './fixtures/test';
import { houseOpenedExport, resumeImportedGame } from './fixtures/saved_games';
import { startQuickGame } from './fixtures/wizard';

// Journey: read the map – the one location a new game starts with, then a game further on whose
// map has several locations and the connections between them, zoomed in and fitted again.
test('read the map', { tag: '@flow' }, async ({ page }) => {
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
