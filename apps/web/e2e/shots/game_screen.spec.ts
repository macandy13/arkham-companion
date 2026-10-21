import { expect, test } from '../fixtures/test';
import { houseOpenedExport, resumeImportedGame, twoMapsExport } from '../fixtures/saved_games';

// Situations on the game screen, each photographed as it ends (`@shot`, coding guidelines §3).

test('the house map with Alder in the Hallway', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  const hallway = page
    .getByRole('figure', { name: 'House' })
    .getByRole('group', { name: 'Hallway' });
  await expect(hallway.getByRole('img', { name: 'Alder' })).toBeVisible();
});

test(
  'map tabs for the Study and the house, the house chosen',
  { tag: '@shot' },
  async ({ page }) => {
    await resumeImportedGame(page, 'Two maps', twoMapsExport('Two maps'));

    await page.getByRole('tab', { name: 'House' }).click();

    await expect(page.getByRole('tabpanel', { name: 'House' })).toBeVisible();
  },
);
