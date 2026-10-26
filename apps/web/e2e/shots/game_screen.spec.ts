import { expect, test } from '../fixtures/test';
import {
  alderThreatenedExport,
  houseOpenedExport,
  investigationOpenExport,
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

test('map tabs for the Study and the house, the house chosen', async ({ page }) => {
  await resumeImportedGame(page, 'Two maps', twoMapsExport('Two maps'));

  await page.getByRole('tab', { name: 'House' }).click();

  await expect(page.getByRole('tabpanel', { name: 'House' })).toBeVisible();
});

test('Alder with four treacheries and the Ghoul Priest, scrolled on to the Ghoul Priest', async ({
  page,
}) => {
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
});

test(
  'the Hallway’s details, its card with Alder on it, on Alder’s turn',
  { tag: '@shot' },
  async ({ page }) => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

    await page
      .getByRole('figure', { name: 'House' })
      .getByRole('group', { name: 'Hallway' })
      .click();

    const details = page.getByRole('dialog', { name: 'Hallway' });
    await expect(details.getByRole('img', { name: 'The card of Hallway' })).toBeVisible();
    await expect(details.getByRole('button', { name: 'Investigate · 1 action' })).toBeVisible();
  },
);

test('the house map by day', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Theme').selectOption('Light');
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await expect(page.getByRole('region', { name: 'Alder' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('Alder’s willpower and agility test, a token drawn', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page
    .getByRole('region', { name: 'Alder' })
    .getByRole('button', { name: /^Willpower/ })
    .click();
  const test = page.getByRole('dialog', { name: /^Skill test/ });
  await test.getByRole('button', { name: /^Agility/ }).click();
  await test.getByRole('button', { name: 'Draw a token' }).click();

  await expect(test.getByRole('status')).toBeVisible();
});

test('the decision dialog asking for the result of an investigation, a token drawn', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Investigating', investigationOpenExport('Investigating'));
  const decision = page.getByRole('dialog', { name: 'Investigate Hallway' });

  await decision.getByRole('button', { name: 'Draw a token' }).click();

  await expect(decision.getByRole('status')).toBeVisible();
});

test("Alder's fight against the Ghoul Priest, the damage raised to 2", async ({ page }) => {
  await resumeImportedGame(page, 'Alder threatened', alderThreatenedExport('Alder threatened'));
  const alder = page.getByRole('region', { name: 'Alder' });
  await alder.getByRole('button', { name: 'Later cards in the threat area' }).click();
  await alder.getByRole('button', { name: 'Details of Ghoul Priest' }).click();
  await page.getByRole('button', { name: 'Fight · 1 action' }).click();
  const decision = page.getByRole('dialog', { name: 'Fight Ghoul Priest' });

  await decision.getByRole('button', { name: 'Raise the Damage dealt' }).click();

  await expect(decision.getByRole('region', { name: 'Damage dealt' })).toContainText('2');
});

test("the Ghoul Priest's details opened from its card on Alder's turn", async ({ page }) => {
  await resumeImportedGame(page, 'Alder threatened', alderThreatenedExport('Alder threatened'));
  const alder = page.getByRole('region', { name: 'Alder' });
  await alder.getByRole('button', { name: 'Later cards in the threat area' }).click();

  await alder.getByRole('button', { name: 'Details of Ghoul Priest' }).click();

  await expect(page.getByRole('dialog', { name: 'Ghoul Priest' })).toBeVisible();
});
