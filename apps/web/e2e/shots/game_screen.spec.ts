import { expect, test } from '../fixtures/test';
import {
  alderThreatenedExport,
  houseOpenedExport,
  resumeImportedGame,
  twoMapsExport,
} from '../fixtures/saved_games';

// Situations on the game screen, each photographed as it ends (`@shot`, coding guidelines §3).

test('the house map with Alder in the Hallway', { tag: '@shot' }, async ({ page }) => {
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

test(
  'Alder with four treacheries and the Ghoul Priest, scrolled on to the Ghoul Priest',
  { tag: '@shot' },
  async ({ page }) => {
    await resumeImportedGame(page, 'Alder threatened', alderThreatenedExport('Alder threatened'));

    const alder = page.getByRole('region', { name: 'Alder' });
    const threatArea = alder.getByRole('list', { name: 'Threat area' });
    const ghoulPriest = threatArea.getByRole('listitem', {
      name: 'Ghoul Priest, 3 of 5 health left, 2 damage',
    });
    await expect(threatArea.getByRole('listitem')).toHaveCount(5);
    await expect(ghoulPriest).not.toBeInViewport({ ratio: 1 });

    await alder.getByRole('button', { name: 'Later cards in the threat area' }).click();

    await expect(ghoulPriest).toBeInViewport({ ratio: 1 });
  },
);

test('the Hallway’s menu open over the board', { tag: '@shot' }, async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page
    .getByRole('figure', { name: 'House' })
    .getByRole('group', { name: 'Hallway' })
    .getByRole('button', { name: 'Edit Hallway' })
    .click();

  await expect(page.getByRole('dialog', { name: 'Hallway' })).toBeVisible();
});

test('the house map by day, the panels on parchment', { tag: '@shot' }, async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Theme').selectOption('Light');
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await expect(page.getByRole('region', { name: 'Alder' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
